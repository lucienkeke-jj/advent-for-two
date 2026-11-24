// advent-for-two · 一个文件的小服务：页面 + API + 给 AI 的 MCP。不装任何依赖，Node 22+ 直接跑。
// A one-file server: the page, its API, and an MCP endpoint for the AI. No dependencies; Node 22+.
//
//   node --env-file-if-exists=.env server/server.js      （npm start 一样）
//
// 两把钥匙 / two keys:
//   HUMAN_KEY  人在页面上输一次，之后记在 cookie 里   — typed once on the page, then kept in a cookie
//   AI_KEY     给 AI 的 MCP 用（Bearer，或者 /mcp/<AI_KEY>） — for the AI's MCP connection
// 没设的话第一次启动自动生成，存在 data/keys.json，打印在终端里。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Advent, AdventError } from './rules.js';
import { toolDefs, callTool } from './tools.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(ROOT, process.env.ADVENT_DATA || 'data');
const UPLOADS = path.join(DATA, 'uploads');
const WEB = path.join(ROOT, 'web');
const PORT = +(process.env.PORT || 8024);
const HOST = process.env.HOST || '127.0.0.1';
const NAMES = { ai: process.env.AI_NAME || 'Claude', human: process.env.HUMAN_NAME || 'You' };
const WEBHOOK = process.env.ADVENT_WEBHOOK || '';
const MAX_UPLOAD = 25 * 1024 * 1024;

fs.mkdirSync(UPLOADS, { recursive: true });

// ── 钥匙 ──
function loadKeys() {
  const f = path.join(DATA, 'keys.json');
  let saved = {};
  if (fs.existsSync(f)) saved = JSON.parse(fs.readFileSync(f, 'utf8'));
  const keys = { human: process.env.HUMAN_KEY || saved.human, ai: process.env.AI_KEY || saved.ai };
  let made = false;
  for (const r of ['human', 'ai']) if (!keys[r]) { keys[r] = crypto.randomBytes(18).toString('base64url'); made = true; }
  if (made) {
    fs.writeFileSync(f, JSON.stringify({ human: keys.human, ai: keys.ai }, null, 1), { mode: 0o600 });
    console.log(`\n  新钥匙已生成 / new keys saved to ${f}\n    HUMAN_KEY = ${keys.human}\n    AI_KEY    = ${keys.ai}\n`);
  }
  if (keys.human === keys.ai) throw new Error('HUMAN_KEY and AI_KEY must differ');
  return keys;
}
const KEYS = loadKeys();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const COOKIE = sha('advent-cookie:' + KEYS.human);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const advent = new Advent(path.join(DATA, 'advent.json'));

// ── 有人藏好 / 拆开 / 回答时，往外发一声（可选）：比如接到你们的聊天里，或者 Telegram 机器人 ──
// Optional webhook: POSTs a small JSON when someone hides, opens, answers or nudges. Never includes gift contents.
function notify(ev) {
  const who = NAMES[ev.who];
  const msg = { hide: `${who} 藏好了 12/${ev.day} 那一格 / ${who} hid Dec ${ev.day}`,
    open: `${who} 拆开了 12/${ev.day} / ${who} opened Dec ${ev.day}`,
    answer: `${who} 回答了 12/${ev.day} 的问题 / ${who} answered the question in Dec ${ev.day}`,
    nudge: `${who} 提醒你：12/${ev.day} 那格还没藏 / ${who} reminds you: Dec ${ev.day} is still empty` }[ev.kind];
  console.log(new Date().toISOString(), msg);
  if (!WEBHOOK) return;
  fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ev, from: who, message: msg }) }).catch((e) => console.warn('webhook:', e.message));
}

// ── 小工具 ──
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.heic': 'image/heic',
  '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.mp3': 'audio/mpeg', '.webm': 'audio/webm', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };
function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new AdventError('太大了 / Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) { const b = await readBody(req, 1024 * 1024); try { return b.length ? JSON.parse(b) : {}; } catch { throw new AdventError('JSON 坏了 / Bad JSON'); } }
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const isHuman = (req) => same(cookies(req).advent || '', COOKIE);
const bearer = (req) => (/^Bearer\s+(.+)$/i.exec(req.headers.authorization || '') || [])[1] || '';
const isAi = (req, pathKey) => same(bearer(req) || pathKey || '', KEYS.ai);

function serveFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}

// ── MCP（JSON-RPC over HTTP，一问一答，不开 SSE）──
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
async function rpc(msg) {
  const { id, method, params = {} } = msg || {};
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  if (id === undefined || id === null) return null;                    // 通知，不用回
  if (method === 'initialize') return ok({
    protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
    capabilities: { tools: {} }, serverInfo: { name: 'advent-for-two', version: '1.0.0' },
    instructions: `An advent calendar shared with ${NAMES.human}. Odd days are yours to hide, even days are ${NAMES.human}'s, Dec 24 is half each. Never put a gift in your chat reply — use advent_hide.`,
  });
  if (method === 'ping') return ok({});
  // 有的客户端连上先问资源和提示词：没有，回空的，别让它卡住
  if (method === 'resources/list') return ok({ resources: [] });
  if (method === 'resources/templates/list') return ok({ resourceTemplates: [] });
  if (method === 'prompts/list') return ok({ prompts: [] });
  if (method === 'tools/list') return ok({ tools: toolDefs(NAMES) });
  if (method === 'tools/call') {
    try { return ok({ content: await callTool(params.name, params.arguments || {}, { advent, names: NAMES, uploads: UPLOADS, notify }) }); }
    catch (e) { return ok({ content: [{ type: 'text', text: e instanceof AdventError ? e.message : 'error: ' + e.message }], isError: true }); }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } };
}

// ── 路由 ──
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  // MCP：POST /mcp（Authorization: Bearer AI_KEY）或 POST /mcp/<AI_KEY>（给不能加请求头的客户端）
  const m = /^\/mcp(?:\/([\w-]+))?\/?$/.exec(p);
  if (m) {
    if (!isAi(req, m[1])) return send(res, 401, { error: 'bad key' });
    if (req.method !== 'POST') return send(res, 405, '', { Allow: 'POST' });
    const body = await readJson(req);
    if (Array.isArray(body)) { const out = (await Promise.all(body.map(rpc))).filter(Boolean); return out.length ? send(res, 200, out) : send(res, 202, ''); }
    const out = await rpc(body);
    return out ? send(res, 200, out) : send(res, 202, '');
  }

  if (p === '/api/login' && req.method === 'POST') {
    const { key } = await readJson(req);
    if (!same(key || '', KEYS.human)) return send(res, 401, { error: '钥匙不对 / Wrong key' });
    const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
    return send(res, 200, { ok: true }, { 'Set-Cookie': `advent=${COOKIE}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 86400}${secure}` });
  }

  // 上传：body 就是文件本身（不走 multipart），?name= 带原文件名。人和 AI 都能传。
  if (p === '/api/upload' && req.method === 'POST') {
    if (!isHuman(req) && !isAi(req)) return send(res, 401, { error: 'login' });
    const name = String(url.searchParams.get('name') || 'file').slice(0, 120);
    let ext = path.extname(name).toLowerCase().replace(/[^.\w]/g, '');
    if (!ext) ext = { 'audio/mp4': '.m4a', 'audio/webm': '.webm', 'image/jpeg': '.jpg', 'image/png': '.png' }[(req.headers['content-type'] || '').split(';')[0]] || '.bin';
    const buf = await readBody(req, MAX_UPLOAD);
    if (!buf.length) return send(res, 400, { error: '空文件 / Empty file' });
    const file = crypto.randomBytes(12).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOADS, file), buf);
    return send(res, 200, { url: 'uploads/' + file, name, type: req.headers['content-type'] || '' });
  }

  const up = /^\/uploads\/([\w.-]+)$/.exec(p);
  if (up) {
    if (!isHuman(req) && !isAi(req)) return send(res, 401, 'login');
    return serveFile(res, path.join(UPLOADS, up[1]), 'private, max-age=86400');
  }

  if (p.startsWith('/api/')) {
    if (!isHuman(req)) return send(res, 401, { error: 'login' });
    if (p === '/api/advent' && req.method === 'GET') return send(res, 200, { ...advent.view('human'), names: NAMES });
    const a = /^\/api\/advent\/(\d+)\/(hide|touch|answer|nudge)$/.exec(p);
    if (a && req.method === 'POST') {
      const day = +a[1], body = await readJson(req);
      if (a[2] === 'hide') { const r = advent.hide({ day, author: 'human', icon: body.icon, items: body.items, note: body.note }); if (r.created) notify({ kind: 'hide', who: 'human', day }); return send(res, 200, r); }
      if (a[2] === 'touch') { const r = advent.touch('human', day); if (r.open && r.first) notify({ kind: 'open', who: 'human', day }); return send(res, 200, { day: r.day, open: r.open, first: r.first }); }
      if (a[2] === 'answer') { const r = advent.answer({ day, viewer: 'human', text: body.text }); notify({ kind: 'answer', who: 'human', day }); return send(res, 200, r); }
      if (a[2] === 'nudge') { const r = advent.nudge({ day, who: 'human' }); notify({ kind: 'nudge', who: 'human', day }); return send(res, 200, r); }
    }
    return send(res, 404, { error: 'not found' });
  }

  // 静态页面（公开的只有页面本身和图；数据都在登录后面）
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '');
  const rel = p === '/' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
  const file = path.resolve(WEB, rel);
  if (!file.startsWith(WEB + path.sep)) return send(res, 404, 'not found');
  return serveFile(res, file, rel === 'index.html' ? 'no-cache' : 'public, max-age=3600');
}

http.createServer((req, res) => {
  route(req, res).catch((e) => {
    if (e instanceof AdventError) return send(res, 400, { error: e.message });
    console.error(e); send(res, 500, { error: 'server error' });
  });
}).listen(PORT, HOST, () => {
  console.log(`advent-for-two · http://${HOST}:${PORT}  (${NAMES.human} & ${NAMES.ai}, ${process.env.ADVENT_TZ || 'Asia/Tokyo'})`);
  console.log(`  MCP: POST http://${HOST}:${PORT}/mcp  (Authorization: Bearer AI_KEY, or /mcp/<AI_KEY>)`);
});

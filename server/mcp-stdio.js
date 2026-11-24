#!/usr/bin/env node
// 给只认 stdio 的 MCP 客户端（比如 Claude Code / Claude Desktop 本地配置）用的小桥：把消息转给 server.js 的 /mcp。
// 好处是 AI 可以直接给一个本机图片路径，这里先帮它传上去。
// A tiny stdio → HTTP bridge for MCP clients that only speak stdio. It also uploads local image paths for advent_hide.
//
//   ADVENT_URL=http://127.0.0.1:8024 AI_KEY=... node server/mcp-stdio.js
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const BASE = (process.env.ADVENT_URL || 'http://127.0.0.1:8024').replace(/\/+$/, '');
const KEY = process.env.AI_KEY;
if (!KEY) { console.error('AI_KEY is required'); process.exit(1); }
const auth = { Authorization: 'Bearer ' + KEY };

async function uploadLocal(p) {
  const buf = fs.readFileSync(p);
  const r = await fetch(`${BASE}/api/upload?name=${encodeURIComponent(path.basename(p))}`, { method: 'POST', headers: auth, body: buf });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  return j.url;
}

async function forward(msg) {
  const a = msg?.params?.arguments;
  if (msg?.method === 'tools/call' && msg.params.name === 'advent_hide' && a?.image && !/^(https:|uploads\/)/.test(a.image)) {
    try { a.image = await uploadLocal(a.image); }
    catch (e) { return { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'Could not upload image: ' + e.message }], isError: true } }; }
  }
  const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (r.status === 202) return null;
  return r.json();
}

// 一条一条按顺序处理，回答的顺序跟问的顺序一样 / handle messages one at a time, in order
const rl = readline.createInterface({ input: process.stdin });
let chain = Promise.resolve();
rl.on('line', (line) => { chain = chain.then(() => handle(line)); });
async function handle(line) {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  try {
    const out = await forward(msg);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  } catch (e) {
    if (msg.id != null) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'advent server unreachable: ' + e.message } }) + '\n');
  }
}

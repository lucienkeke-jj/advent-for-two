// 规矩全在这一个文件里：页面（人）和 MCP 工具（AI）用同一份。
// The rules live here. The page (human) and the MCP tools (AI) share them.
//
//   12/1–12/24。单数日 AI 藏，双数日人藏，24 号两个人各藏一半。
//   每格要在前一天 23:59 前藏好；到那天零点（ADVENT_TZ 时区）自动打开。
//   没到日子：对方只知道「藏好了没」，连图标都看不到。没到日子去点对方的格子 = 偷看一次，记下来，两边都看得到次数。
//   藏好以后零点前能改 EDIT_LIMIT 次（默认 1）。拆开的格子不消失，留成一面墙。
//
//   Odd days: the AI hides. Even days: the human hides. Dec 24: half each.
//   Hide by 23:59 the day before; a window opens at local midnight (ADVENT_TZ).
//   Before that, the other side only learns *whether* it's hidden. Tapping it early = one "peek", counted for both to see.

import { Store } from './store.js';

export const YEAR = +(process.env.ADVENT_YEAR || new Date().getFullYear());
export const TZ = process.env.ADVENT_TZ || 'Asia/Tokyo';
export const DAYS = 24;
export const EDIT_LIMIT = process.env.ADVENT_EDIT_LIMIT === 'none' ? null : +(process.env.ADVENT_EDIT_LIMIT ?? 1);
export const ROLES = ['ai', 'human'];
export const ICONS = ['lettre', 'chanson', 'melodie', 'dessin', 'question', 'cadeau', 'mot', 'ensemble'];
export const ITEM_TYPES = ['text', 'song', 'voice', 'audio', 'image', 'file', 'abc', 'question'];

export class AdventError extends Error {}
const fail = (zh, en) => { throw new AdventError(`${zh} / ${en}`); };

// ── 时区：不用任何库，靠 Intl 算「这个时区的零点」是 UTC 几点 ──
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function localParts(sec) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(sec * 1000)).map((x) => [x.type, +x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}
const offsetSec = (sec) => { const p = localParts(sec); return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) / 1000) - sec; };
export function openAt(d) {
  const wall = Date.UTC(YEAR, 11, d) / 1000;           // 「12 月 d 号 00:00」当成 UTC
  let t = wall - offsetSec(wall);
  t = wall - offsetSec(t);                               // 再校一次，夏令时边上也对
  return t;
}
// 试玩用：ADVENT_NOW=2026-12-05T20:00:00+09:00 让时钟从那一刻开始走（正式用别设）
// For trying it out: ADVENT_NOW sets a fake clock that starts at that moment and keeps ticking. Leave unset for real use.
const SHIFT = process.env.ADVENT_NOW ? Date.parse(process.env.ADVENT_NOW) - Date.now() : 0;
if (process.env.ADVENT_NOW && Number.isNaN(SHIFT)) throw new Error("ADVENT_NOW is not a valid date");
export const nowSec = () => Math.floor((Date.now() + SHIFT) / 1000);
// 今天是 12 月几号：还没到 12 月 = 0；12 月照实给；之后 = 99
export function todayOf(now = nowSec()) {
  const p = localParts(now);
  if (p.y < YEAR || (p.y === YEAR && p.m < 12)) return 0;
  if (p.y === YEAR && p.m === 12) return p.d;
  return 99;
}
export const ownersOf = (d) => (d === DAYS ? ['ai', 'human'] : d % 2 ? ['ai'] : ['human']);
export const isOpen = (d, now = nowSec()) => now >= openAt(d);
export const deadlineOf = (d) => (d === 1 ? '11/30' : `12/${d - 1}`) + ' 23:59';

function checkDay(d) {
  const n = Number(d);
  if (!Number.isInteger(n) || n < 1 || n > DAYS) fail('只有 12/1 到 12/24', 'Only Dec 1–24');
  return n;
}
function checkRole(r) { if (!ROLES.includes(r)) fail('不认识的人', 'Unknown role'); return r; }
const clip = (s, n) => (s == null ? null : String(s).trim().slice(0, n) || null);

function cleanItems(items) {
  if (!Array.isArray(items)) fail('items 要是数组', 'items must be an array');
  const out = [];
  for (const it of items.slice(0, 12)) {
    if (!it || !ITEM_TYPES.includes(it.type)) continue;
    const c = { type: it.type };
    if (it.text != null) c.text = clip(it.text, 6000);
    if (it.abc != null) c.abc = clip(it.abc, 4000);
    if (it.url != null) {
      const u = clip(it.url, 600);
      // 只收 https 链接和本服务自己的 uploads/，别让人塞 javascript: 之类的东西
      if (u && (/^https:\/\//i.test(u) || /^uploads\/[\w.-]+$/.test(u))) c.url = u;
    }
    if (it.name != null) c.name = clip(it.name, 200);
    if (it.secs != null && Number.isFinite(+it.secs)) c.secs = Math.round(+it.secs);
    if (it.type === 'abc' && !c.abc && c.text) { c.abc = c.text; delete c.text; }
    if (c.text || c.abc || c.url) out.push(c);
  }
  return out;
}

function guessIcon(items, d) {
  if (d === DAYS) return 'ensemble';
  const t = items.map((i) => i.type);
  if (t.includes('question')) return 'question';
  if (t.includes('abc')) return 'melodie';
  if (t.includes('song') || t.includes('voice') || t.includes('audio')) return 'chanson';
  if (t.includes('image')) return 'dessin';
  if (t.includes('file')) return 'cadeau';
  const len = items.reduce((n, i) => n + (i.text || '').length, 0);
  return len > 120 ? 'lettre' : 'mot';
}

export class Advent {
  constructor(file) { this.store = new Store(file); }
  get db() { return this.store.data; }
  gift(d, author) { return this.db.gifts.find((g) => g.day === d && g.author === author); }
  event(day, who, kind, at) { this.db.events.push({ day, who, kind, at }); }

  // 藏（或者零点前改）
  hide({ day, author, icon, items, note }, now = nowSec()) {
    const d = checkDay(day); checkRole(author);
    if (!ownersOf(d).includes(author)) fail(`${d} 号不归你藏（单数日 AI、双数日人、24 号各一半）`, `Dec ${d} isn't yours to hide (odd = AI, even = human, 24 = both)`);
    if (now >= openAt(d)) fail(`${d} 号已经过了零点，锁住了`, `Dec ${d} is already open and locked`);
    const its = cleanItems(items || []);
    const nt = clip(note, 1200);
    if (!its.length && !nt) fail('空的格子藏不了', 'Nothing to hide');
    const ic = ICONS.includes(icon) ? icon : guessIcon(its, d);
    const old = this.gift(d, author);
    if (!old) {
      this.db.gifts.push({ day: d, author, icon: ic, items: its, note: nt, edits: 0, answer: null, answered_at: null, created_at: now, updated_at: now });
      this.store.save();
      return { day: d, created: true, edits: 0 };
    }
    if (EDIT_LIMIT != null && old.edits >= EDIT_LIMIT) fail(`${d} 号已经改过 ${old.edits} 次，不能再改了`, `Dec ${d} was already changed ${old.edits} time(s); it's final now`);
    Object.assign(old, { icon: ic, items: its, note: nt, edits: old.edits + 1, updated_at: now });
    this.store.save();
    return { day: d, created: false, edits: old.edits };
  }

  // viewer 看到的整面墙。对方的格子：到点前只有「藏没藏」，图标都不给（图标也算剧透）；到点后全给。
  view(viewer, now = nowSec()) {
    checkRole(viewer);
    const ev = this.db.events;
    const peeks = {}; for (const r of ROLES) peeks[r] = ev.filter((e) => e.who === r && e.kind === 'peek').length;
    const cells = [];
    for (let d = 1; d <= DAYS; d++) {
      const o = isOpen(d, now);
      const cell = { day: d, owners: ownersOf(d), open_at: openAt(d), deadline: deadlineOf(d), open: o, hidden: {}, gifts: {}, opened_by: {} };
      for (const r of ROLES) {
        const g = this.gift(d, r);
        if (cell.owners.includes(r)) cell.hidden[r] = !!g;
        const seen = ev.find((e) => e.day === d && e.who === r && e.kind === 'open');
        if (seen) cell.opened_by[r] = seen.at;
        if (g && (r === viewer || o)) cell.gifts[r] = structuredClone(g);
      }
      cells.push(cell);
    }
    return { year: YEAR, tz: TZ, today: todayOf(now), now, hour: localParts(now).h, edit_limit: EDIT_LIMIT, peeks, cells };
  }

  // 没到日子去点 = 偷看一次；到了 = 拆开（第一次拆记时间）
  touch(viewer, day, now = nowSec()) {
    const d = checkDay(day); checkRole(viewer);
    if (!isOpen(d, now)) { this.event(d, viewer, 'peek', now); this.store.save(); return { day: d, open: false, peek: true }; }
    const first = !this.db.events.some((e) => e.day === d && e.who === viewer && e.kind === 'open');
    if (first) { this.event(d, viewer, 'open', now); this.store.save(); }
    return { day: d, open: true, first, gifts: this.db.gifts.filter((g) => g.day === d).map((g) => structuredClone(g)) };
  }

  // 回答对方格子里的问题（到点后才行；可以改）
  answer({ day, viewer, text }, now = nowSec()) {
    const d = checkDay(day); checkRole(viewer);
    if (!isOpen(d, now)) fail('还没到这天', 'Not open yet');
    const t = clip(text, 4000);
    if (!t) fail('空的', 'Empty answer');
    const g = this.db.gifts.find((x) => x.day === d && x.author !== viewer);
    if (!g || (!g.items.some((i) => i.type === 'question') && g.icon !== 'question')) fail('这格没有要你回答的问题', 'No question for you in this window');
    const first = !g.answer;
    Object.assign(g, { answer: t, answered_at: now });
    this.store.save();
    return { day: d, author: g.author, first };
  }

  nudge({ day, who }, now = nowSec()) {
    const d = checkDay(day); checkRole(who);
    this.event(d, who, 'nudge', now); this.store.save();
    return { day: d };
  }
}

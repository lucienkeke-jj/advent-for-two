// 規矩全在這一個檔案裡：頁面（人）和 MCP 工具（AI）用同一份。
// The rules live here. The page (human) and the MCP tools (AI) share them.
//
//   12/1–12/24。單數日 AI 藏，雙數日人藏，24 號兩個人各藏一半。
//   每格要在前一天 23:59 前藏好；到那天零點（ADVENT_TZ 時區）自動開啟。
//   沒到日子：對方只知道「藏好了沒」，連圖示都看不到。沒到日子去點對方的格子 = 偷看一次，記下來，兩邊都看得到次數。
//   藏好以後零點前能改 EDIT_LIMIT 次（預設 1）。拆開的格子不消失，留成一面牆。
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

// ── 時區：不用任何庫，靠 Intl 算「這個時區的零點」是 UTC 幾點 ──
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function localParts(sec) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(sec * 1000)).map((x) => [x.type, +x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}
const offsetSec = (sec) => { const p = localParts(sec); return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) / 1000) - sec; };
export function openAt(d) {
  const wall = Date.UTC(YEAR, 11, d) / 1000;           // 「12 月 d 號 00:00」當成 UTC
  let t = wall - offsetSec(wall);
  t = wall - offsetSec(t);                               // 再校一次，夏令時邊上也對
  return t;
}
// 試玩用：ADVENT_NOW=2026-12-05T20:00:00+09:00 讓時鐘從那一刻開始走（正式用別設）
// For trying it out: ADVENT_NOW sets a fake clock that starts at that moment and keeps ticking. Leave unset for real use.
const SHIFT = process.env.ADVENT_NOW ? Date.parse(process.env.ADVENT_NOW) - Date.now() : 0;
if (process.env.ADVENT_NOW && Number.isNaN(SHIFT)) throw new Error("ADVENT_NOW is not a valid date");
export const nowSec = () => Math.floor((Date.now() + SHIFT) / 1000);
// 今天是 12 月幾號：還沒到 12 月 = 0；12 月照實給；之後 = 99
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
function checkRole(r) { if (!ROLES.includes(r)) fail('不認識的人', 'Unknown role'); return r; }
const clip = (s, n) => (s == null ? null : String(s).trim().slice(0, n) || null);

function cleanItems(items) {
  if (!Array.isArray(items)) fail('items 要是陣列', 'items must be an array');
  const out = [];
  for (const it of items.slice(0, 12)) {
    if (!it || !ITEM_TYPES.includes(it.type)) continue;
    const c = { type: it.type };
    if (it.text != null) c.text = clip(it.text, 6000);
    if (it.abc != null) c.abc = clip(it.abc, 4000);
    if (it.url != null) {
      const u = clip(it.url, 600);
      // 只收 https 連結和本服務自己的 uploads/，別讓人塞 javascript: 之類的東西
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

  // 藏（或者零點前改）
  hide({ day, author, icon, items, note }, now = nowSec()) {
    const d = checkDay(day); checkRole(author);
    if (!ownersOf(d).includes(author)) fail(`${d} 號不歸你藏（單數日 AI、雙數日人、24 號各一半）`, `Dec ${d} isn't yours to hide (odd = AI, even = human, 24 = both)`);
    if (now >= openAt(d)) fail(`${d} 號已經過了零點，鎖住了`, `Dec ${d} is already open and locked`);
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
    if (EDIT_LIMIT != null && old.edits >= EDIT_LIMIT) fail(`${d} 號已經改過 ${old.edits} 次，不能再改了`, `Dec ${d} was already changed ${old.edits} time(s); it's final now`);
    Object.assign(old, { icon: ic, items: its, note: nt, edits: old.edits + 1, updated_at: now });
    this.store.save();
    return { day: d, created: false, edits: old.edits };
  }

  // viewer 看到的整面牆。對方的格子：到點前只有「藏沒藏」，圖示都不給（圖示也算劇透）；到點後全給。
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

  // 沒到日子去點 = 偷看一次；到了 = 拆開（第一次拆記時間）
  touch(viewer, day, now = nowSec()) {
    const d = checkDay(day); checkRole(viewer);
    if (!isOpen(d, now)) { this.event(d, viewer, 'peek', now); this.store.save(); return { day: d, open: false, peek: true }; }
    const first = !this.db.events.some((e) => e.day === d && e.who === viewer && e.kind === 'open');
    if (first) { this.event(d, viewer, 'open', now); this.store.save(); }
    return { day: d, open: true, first, gifts: this.db.gifts.filter((g) => g.day === d).map((g) => structuredClone(g)) };
  }

  // 回答對方格子裡的問題（到點後才行；可以改）
  answer({ day, viewer, text }, now = nowSec()) {
    const d = checkDay(day); checkRole(viewer);
    if (!isOpen(d, now)) fail('還沒到這天', 'Not open yet');
    const t = clip(text, 4000);
    if (!t) fail('空的', 'Empty answer');
    const g = this.db.gifts.find((x) => x.day === d && x.author !== viewer);
    if (!g || (!g.items.some((i) => i.type === 'question') && g.icon !== 'question')) fail('這格沒有要你回答的問題', 'No question for you in this window');
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

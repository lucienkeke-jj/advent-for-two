/* advent-for-two · 房子引擎 / the house engine
 *
 * 不依赖任何框架：mountHouse(stage, opts) 往一个空 div 里画整栋楼（24 扇百叶窗、雪、挂件、扫雪的小家伙、24 号的大门），
 * 返回几个方法让页面驱动。卡片、编辑页、数据都在页面那边（app.js）——这里只管房子和动画。
 * Framework-free. Draws the house into an empty div and returns a few methods; cards, editor and data live in app.js.
 *
 *   const h = mountHouse(el, { assets, sprites, onTap(day), labels })
 *   h.set({ today, night, cells: [{ day, who: "ai"|"human"|"both", lit, ready, icon }] })
 *       lit = opened (window stays lit)   ready = open today but not opened yet (glows)
 *   h.rattle(day, msg)      tapped too early: shutters shake + a toast
 *   h.play(day) → Promise<{ rect, done }>   opening animation; rect = where the gift is on screen; call done() after your card takes over
 *   h.rectOf(day)           an already-lit window: zoom straight from it
 *   h.say(msg), h.destroy()
 *
 * 素材从外面传进来 / assets are passed in:
 *   assets  = { house, ginger, bells, pinecone }       房子和挂件 / the house and ornaments
 *   sprites = { sweep, walk, happy, heart, carry }     扫雪、走路、高兴、爱心眼、扛礼物——默认是一颗小星星，换成你们自己的小家伙
 *             画布照 web/sprites/star-*.svg：viewBox -15 -25 45 45，身子在 x 0–15，脚踩在 y≈16
 *             sweep, walk, happy, heart-eyes, carrying a gift. Default: a little star. Keep the same canvas to swap in your own.
 */

const ICON = {
  lettre: '<path d="M3 7h18v11H3z"/><path d="M3 7l9 6.5L21 7"/><path d="M3 18l6.5-5.5M21 18l-6.5-5.5"/>',
  chanson: '<path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/><path d="M9 9l10-2"/>',
  melodie: '<path d="M3 6h18M3 9h18M3 12h18M3 15h18M3 18h18" opacity=".45"/><circle cx="8" cy="15" r="1.6"/><path d="M9.6 15V7"/><circle cx="15" cy="12" r="1.6"/><path d="M16.6 12V4.5"/>',
  dessin: '<path d="M4 20l1.2-4.2L15.5 5.5l3 3L8.2 18.8z"/><path d="M13.5 7.5l3 3"/><path d="M4 20l4.2-1.2"/>',
  question: '<path d="M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3v.8"/><circle cx="12" cy="18.5" r=".8"/><circle cx="12" cy="12" r="9" opacity=".35"/>',
  cadeau: '<path d="M4 10h16v10H4z"/><path d="M3 7h18v3H3z"/><path d="M12 7v13"/><path d="M12 7c-2-4-6-3.5-5-1 .7 1.4 3.5 1.2 5 1zm0 0c2-4 6-3.5 5-1-.7 1.4-3.5 1.2-5 1z"/>',
  mot: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 12h8M8 15h5"/>',
  ensemble: '<path d="M8 3l1.4 3 3.2.4-2.4 2.2.6 3.2L8 10.3 5.2 11.8l.6-3.2L3.4 6.4l3.2-.4z"/><path d="M16 11l1.4 3 3.2.4-2.4 2.2.6 3.2-2.8-1.5-2.8 1.5.6-3.2-2.4-2.2 3.2-.4z"/>',
  vide: '<circle cx="12" cy="12" r="7" opacity=".35"/>',
};
export const iconSvg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.vide}</svg>`;
export const ICON_KEYS = Object.keys(ICON).filter((k) => k !== "vide");

const GIFT_SVG = '<svg viewBox="0 0 40 36" aria-hidden="true"><rect x="3" y="12" width="34" height="22" rx="1.5" fill="#8d2f2f" stroke="#5a1b1b" stroke-width="1"/><rect x="1.5" y="8" width="37" height="6" rx="1" fill="#a33b3b" stroke="#5a1b1b" stroke-width="1"/><rect x="17.5" y="8" width="5" height="26" fill="#e7c477"/><rect x="3" y="21" width="34" height="4" fill="#e7c477" opacity=".9"/><path d="M20 8c-4-6-11-5-9-1 1 2 6 2 9 1zm0 0c4-6 11-5 9-1-1 2-6 2-9 1z" fill="#e7c477" stroke="#a07a2c" stroke-width=".8"/></svg>';

// 窗玻璃在原图里的位置（1024×1536，逐像素量的）；数字打乱成老式倒数日历的样子，24 在右下角
const W = 1024, H = 1536, COLS = [234, 395, 557, 718], ROWS = [324, 473, 624, 773, 922, 1072], GW = 74, GH = 71, PAD = 6;
const ORDER = [13, 7, 21, 2, 9, 18, 4, 15, 23, 1, 11, 6, 16, 10, 20, 3, 5, 22, 14, 19, 12, 17, 8, 24];
const DOOR = { x: 427, y: 1222, w: 169, h: 233 };
// 小家伙扫雪的三处（身子中心的横坐标、脚踩的高度）：左屋檐、右屋檐、门口台阶
const SPOTS = [{ feet: 250, xs: [150, 290] }, { feet: 250, xs: [730, 875] }, { feet: 1500, xs: [360, 660] }];
const CRAB_W = 170;
const pct = (v, t) => (v / t) * 100 + "%";

export function mountHouse(stage, opts) {
  const { assets, sprites, onTap } = opts;
  const L = { house: "A snowy red house with 24 windows", pine: "pinecone", bells: "bells", sprite: "the little one sweeping snow",
    day: (d, st) => `Dec ${d}` + (st === "open" ? ", open" : st === "ready" ? ", ready to open" : ", not yet"), ...(opts.labels || {}) };
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  stage.classList.add("adv-stage");
  const house = el("div", "adv-house");
  house.innerHTML = `<img class="adv-base" src="${assets.house}" alt="${L.house}">`;
  const door = el("div", "adv-door", '<span class="adv-dglow"></span><span class="adv-dleaf l"></span><span class="adv-dleaf r"></span>');
  door.setAttribute("aria-hidden", "true");
  Object.assign(door.style, { left: pct(DOOR.x, W), top: pct(DOOR.y, H), width: pct(DOOR.w, W), height: pct(DOOR.h, H) });
  house.append(door, el("span", "adv-veil"), el("span", "adv-litall"));
  const cv = el("canvas", "adv-snow"); cv.setAttribute("aria-hidden", "true"); house.append(cv);

  // 挂件：松果挂在左上、铃铛压着右上角
  const pine = el("button", "adv-stk adv-pine", `<span class="adv-hang"><span class="adv-string"></span><img src="${assets.pinecone}" alt=""></span>`);
  pine.type = "button"; pine.setAttribute("aria-label", L.pine);
  const bells = el("button", "adv-stk adv-bells", `<span class="adv-hang"><img src="${assets.bells}" alt=""></span>`);
  bells.type = "button"; bells.setAttribute("aria-label", L.bells);
  house.append(bells);
  stage.append(pine, house);

  // 飞出来的小人和大礼物盒挂在 body 上（position:fixed，别被页面的 transform 框住）
  const ginger = el("div", "adv-fly", `<img src="${assets.ginger}" alt=""><span class="adv-flybox">${GIFT_SVG}</span>`); ginger.hidden = true;
  const carrier = el("div", "adv-fly", `<img src="${sprites.carry}" alt="">`); carrier.hidden = true;
  const biggift = el("div", "adv-fly adv-biggift", GIFT_SVG); biggift.hidden = true;
  const toast = el("div", "adv-toast");
  document.body.append(ginger, carrier, biggift, toast);

  // ── 24 扇窗 ──
  const wins = new Map();
  ORDER.forEach((d, i) => {
    const c = i % 4, r = Math.floor(i / 4);
    const b = el("button", "adv-win");
    b.type = "button";
    Object.assign(b.style, { left: pct(COLS[c] - PAD, W), top: pct(ROWS[r] - PAD, H), width: pct(GW + PAD * 2, W), height: pct(GH + PAD * 2, H) });
    b.innerHTML = `<span class="adv-in">${iconSvg("vide")}<small>${d}</small></span><span class="adv-leaf l"></span><span class="adv-leaf r"></span><span class="adv-plaque">${d}</span>`;
    b.onclick = () => onTap && onTap(d);
    house.appendChild(b); wins.set(d, b);
  });

  function set(s) {
    house.classList.toggle("night", !!s.night);
    let lit = 0;
    for (const c of s.cells) {
      const b = wins.get(c.day); if (!b) continue;
      if (c.lit) lit++;
      b.classList.toggle("ai", c.who === "ai");
      b.classList.toggle("human", c.who === "human");
      b.classList.toggle("both", c.who === "both");
      b.classList.toggle("open", !!c.lit);
      b.classList.toggle("ready", !c.lit && !!c.ready);
      b.classList.toggle("today", !c.lit && c.day === s.today);
      const icon = c.icon || "vide";
      if (b.dataset.icon !== icon) { b.querySelector(".adv-in").innerHTML = `${iconSvg(icon)}<small>${c.day}</small>`; b.dataset.icon = icon; }
      b.setAttribute("aria-label", L.day(c.day, c.lit ? "open" : c.ready ? "ready" : "closed"));
    }
    house.style.setProperty("--lit", (lit / 24).toFixed(3));
    door.classList.toggle("open", !!s.cells.find((c) => c.day === 24 && c.lit));
  }

  // ── 大门：门板是从原图剪下来的两块 ──
  const [dl, dr] = door.querySelectorAll(".adv-dleaf");
  function skinDoor() {
    const hr = house.getBoundingClientRect(), k = hr.width / W;
    [[dl, DOOR.x], [dr, DOOR.x + DOOR.w / 2]].forEach(([e, x]) => {
      e.style.backgroundImage = `url(${assets.house})`; e.style.backgroundSize = `${hr.width}px ${hr.height}px`;
      e.style.backgroundPosition = `${-x * k}px ${-DOOR.y * k}px`;
    });
  }

  // ── 声音：都在页面里合成；AudioContext 在点窗的那一下才建（iPhone 规定）──
  let ac = null;
  const getAC = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch { /* 没声音也照样开 */ } return ac; };
  function tone(f, t, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const musicBox = (f, t, vol = 0.11) => { tone(f, t, 1.3, vol); tone(f * 2, t, 0.6, vol * 0.28); tone(f * 3, t, 0.3, vol * 0.12); };
  function clack(t) {
    const n = Math.floor(ac.sampleRate * 0.05), buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 3; g.gain.value = 0.5;
    s.buffer = buf; s.connect(bp).connect(g).connect(ac.destination); s.start(t);
  }
  // 开窗：百叶两声咔嗒 → Jingle Bells 开头三个 mi（1857 Pierpont，公版）→ 一点亮片；24 号放第一整句
  function openSound(big) {
    if (!getAC()) return;
    try {
      const t = ac.currentTime + 0.02; clack(t); clack(t + 0.07);
      if (big) {
        const E = 1318.5, G = 1568, C = 1046.5, D = 1174.7;
        [[E, 0], [E, 0.2], [E, 0.4, 0.8], [E, 0.8], [E, 1], [E, 1.2, 0.8], [E, 1.6], [G, 1.8], [C, 2.0], [D, 2.3], [E, 2.4, 1.6]]
          .forEach(([f, dt, len]) => { if (len) { tone(f, t + 0.5 + dt, 1.2 + len, 0.12); tone(f * 2, t + 0.5 + dt, 0.6, 0.03); } else musicBox(f, t + 0.5 + dt, 0.11); });
        [2637, 3136, 3520, 4186, 5274].forEach((f, i) => tone(f, t + 3.1 + i * 0.07, 0.6, 0.03));
        return;
      }
      musicBox(1318.5, t + 0.66, 0.12); musicBox(1318.5, t + 0.86, 0.12); tone(1318.5, t + 1.06, 2.2, 0.13); tone(2637, t + 1.06, 0.9, 0.035); tone(3955.5, t + 1.06, 0.4, 0.014);
      [2637, 3136, 3520, 4186].forEach((f, i) => tone(f, t + 1.75 + i * 0.06 + Math.random() * 0.03, 0.5, 0.03));
    } catch { /* ignore */ }
  }
  function ding() {
    if (!getAC()) return;
    try {
      const t = ac.currentTime;
      [[1318, 0], [1760, 0.09]].forEach(([f, dl0]) => [1, 2.76, 5.4].forEach((m, i) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * m;
        g.gain.setValueAtTime(0, t + dl0); g.gain.linearRampToValueAtTime(0.12 / (i + 1), t + dl0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dl0 + 1.6 / (i + 1));
        o.connect(g).connect(ac.destination); o.start(t + dl0); o.stop(t + dl0 + 1.7);
      }));
    } catch { /* ignore */ }
  }
  const anim = (e, cls) => { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); later(() => e.classList.remove(cls), 1700); };
  bells.onclick = () => { anim(bells, "swing"); ding(); };
  pine.onclick = () => anim(pine, "drop");

  let tt;
  const say = (t) => { toast.textContent = t; toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 1900); };

  function rattle(d, msg) {
    const b = wins.get(d); if (!b) return;
    b.classList.remove("rattle"); void b.offsetWidth; b.classList.add("rattle");
    if (msg) say(msg);
  }
  const rectOf = (d) => (d === 24 && door.classList.contains("open") ? door : wins.get(d)).getBoundingClientRect();

  // 开窗动画：谁藏的谁来送——单数日小家伙扛出来，双数日姜饼人抱出来；24 号大门打开两个一起出来
  // Whoever hid it delivers it: odd days the little one carries it out, even days the gingerbread; on the 24th the front door opens.
  function play(d) {
    const b = wins.get(d);
    b.classList.add("open"); b.classList.remove("ready", "today");
    crabSay(sprites.heart, 2400);
    openSound(d === 24);
    return new Promise((resolve) => {
      if (still) { if (d === 24) door.classList.add("open"); resolve({ rect: rectOf(d), done: () => {} }); return; }
      if (d === 24) finale(resolve); else later(() => flyOut(b, d, resolve), 620);
    });
  }
  function settle(cast, anims, resolve, delay = 0) {
    let done = false;
    const finish = () => {
      if (done) return; done = true; document.removeEventListener("pointerdown", skip, true);
      const rs = cast.map((e) => e.getBoundingClientRect());
      const u = { left: Math.min(...rs.map((x) => x.left)), top: Math.min(...rs.map((x) => x.top)), right: Math.max(...rs.map((x) => x.right)), bottom: Math.max(...rs.map((x) => x.bottom)) };
      later(() => resolve({ rect: { left: u.left, top: u.top, width: u.right - u.left, height: u.bottom - u.top }, done: () => { cast.forEach((e) => { e.hidden = true; }); anims.forEach((a) => a.cancel()); } }), delay);
    };
    const skip = (e) => { e.preventDefault(); e.stopPropagation(); anims.forEach((a) => a.finish()); finish(); };
    later(() => document.addEventListener("pointerdown", skip, true), 60);   // 放的时候点一下 = 直接看礼物
    anims[anims.length - 1].onfinish = finish;
  }
  function flyOut(b, d, resolve) {
    const r = b.getBoundingClientRect();
    const isAi = d % 2 === 1;
    const e = isAi ? carrier : ginger;
    const w = r.width * (isAi ? 5 : 2.5);
    e.hidden = false;
    const top = isAi ? r.bottom - w * 0.9 : r.top + r.height * 0.6 - w * 1.1;   // 小家伙脚踩窗台（图里脚底在 90%）；姜饼人从窗当中冒出来
    Object.assign(e.style, { width: w + "px", left: r.left + r.width / 2 - w / 2 + "px", top: top + "px" });
    const a = e.animate([
      { transform: "translateY(55%) scale(.3)", opacity: 0 },
      { transform: "translateY(-6%) scale(1.05)", opacity: 1, offset: 0.55 },
      { transform: "translateY(0) scale(1) rotate(-4deg)", opacity: 1, offset: 0.75 },
      { transform: "translateY(0) scale(1) rotate(4deg)", opacity: 1 }], { duration: 820, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "forwards" });
    settle([e], [a], resolve);
  }
  let snowBoost = 1;
  function finale(resolve) {
    later(() => door.classList.add("open"), 450);
    later(() => { house.classList.add("flash"); anim(bells, "swing"); snowBoost = 2.6; later(() => { house.classList.remove("flash"); snowBoost = 1; }, 3000); }, 950);
    later(() => {
      const r = door.getBoundingClientRect(), dw = r.width, cx = r.left + dw / 2, ground = r.bottom + dw * 0.1;
      const gW = dw * 0.82, cW = dw * 1.75, bW = dw * 0.8;
      const box = ginger.querySelector(".adv-flybox"); box.style.display = "none";
      const cImg = carrier.querySelector("img"); cImg.src = sprites.happy;
      const place = (e, w, left, top) => { e.hidden = false; Object.assign(e.style, { width: w + "px", left: left + "px", top: top + "px" }); };
      place(ginger, gW, cx - dw * 0.62 - gW / 2, ground - gW * 1.094);
      place(carrier, cW, cx + dw * 0.66 - cW * 0.45, ground - cW * 0.92);
      place(biggift, bW, cx - bW / 2, ground - gW * 0.62 - bW * 0.45);
      const kf = [{ transform: "translateY(-14%) scale(.45)", opacity: 0 }, { transform: "translateY(-4%) scale(.9)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }];
      const anims = [ginger, carrier, biggift].map((e, i) => e.animate(kf, { duration: 1000, delay: i === 2 ? 80 : 0, easing: "cubic-bezier(.25,1.2,.5,1)", fill: "forwards" }));
      settle([ginger, carrier, biggift], [anims[1], anims[2], anims[0]], (res) => resolve({ ...res, done: () => { res.done(); box.style.display = ""; cImg.src = sprites.carry; } }), 500);
    }, 1450);
  }

  // ── 屋檐上扫雪的小家伙：同一处左右挪，或者噗一下换到另一处 ──
  const crab = el("div", "adv-crab", `<span class="adv-flip"><img src="${sprites.sweep}" alt=""></span><span class="adv-hit"></span>`);
  crab.setAttribute("role", "button"); crab.tabIndex = 0; crab.setAttribute("aria-label", L.sprite);
  house.append(crab);
  const crabImg = crab.querySelector("img"), crabFlip = crab.querySelector(".adv-flip");
  const CW = CRAB_W; crab.style.width = pct(CW, W);
  let spot = 0, cx = 0, busy = false;
  const put = (s, i) => { crab.style.bottom = pct(H - SPOTS[s].feet, H); crab.style.left = pct(SPOTS[s].xs[i] - CW / 2, W); };
  put(0, 0);
  function crabWalk() {
    if (busy || still || document.hidden) return;
    if (Math.random() < 0.4) {
      busy = true; crab.style.transition = "opacity .35s"; crab.style.opacity = 0;
      later(() => {
        spot = (spot + 1 + Math.floor(Math.random() * 2)) % 3; cx = Math.round(Math.random()); put(spot, cx);
        crabFlip.style.transform = Math.random() < 0.5 ? "scaleX(-1)" : "none"; crabImg.src = sprites.happy; crab.style.opacity = 1;
        later(() => { crab.style.transition = ""; busy = false; crabImg.src = sprites.sweep; }, 1300);
      }, 400);
      return;
    }
    cx = 1 - cx; crabFlip.style.transform = cx ? "scaleX(-1)" : "none"; crabImg.src = sprites.walk; crab.style.left = pct(SPOTS[spot].xs[cx] - CW / 2, W);
    later(() => { if (!busy) crabImg.src = sprites.sweep; }, 4000);
  }
  const walkTimer = setInterval(crabWalk, 9000);
  const crabSay = (src, ms) => { busy = true; crabImg.src = src; later(() => { busy = false; crabImg.src = sprites.sweep; }, ms); };
  crab.onclick = () => crabSay(sprites.happy, 1800);
  crab.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); crab.onclick(); } };

  // ── 雪 ──
  let flakes = [], raf = 0, alive = true;
  function size() {
    const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    flakes = Array.from({ length: 46 }, () => ({ x: Math.random() * r.width, y: Math.random() * r.height, r: 0.6 + Math.random() * 1.6, v: 0.2 + Math.random() * 0.5, w: Math.random() * 6 }));
    skinDoor();
  }
  function tick() {
    if (!alive) return;
    const r = cv.getBoundingClientRect(), x = cv.getContext("2d"); x.clearRect(0, 0, r.width, r.height); x.fillStyle = "rgba(255,255,255,.85)";
    flakes.forEach((f) => { if (!still) { f.y += f.v * snowBoost; f.w += 0.02; f.x += Math.sin(f.w) * 0.3; if (f.y > r.height) { f.y = -4; f.x = Math.random() * r.width; } } x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.fill(); });
    if (!still) raf = requestAnimationFrame(tick);
  }
  const ro = new ResizeObserver(size); ro.observe(house);
  size(); tick();

  function destroy() {
    alive = false; cancelAnimationFrame(raf); clearInterval(walkTimer); timers.forEach(clearTimeout); clearTimeout(tt); ro.disconnect();
    [ginger, carrier, biggift, toast].forEach((e) => e.remove());
    stage.innerHTML = ""; stage.classList.remove("adv-stage");
    try { ac && ac.close(); } catch { /* ignore */ }
  }

  return { set, rattle, play, rectOf, say, destroy };
}

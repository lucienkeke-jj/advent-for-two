/* advent-for-two · 页面 / the page
 *
 * 点窗：到了没拆 → 开窗动画 → 合着的红卡 → 点一下翻开；拆过的 → 直接从窗口拉近；
 *       没到、是自己的格子 → 编辑页；没到、是对方的 → 偷看一次（记数，对方看得到）。
 * Tap a window: open today & unopened → animation → sealed red card → tap to unfold;
 *   already opened → zoom from the window; yours & not yet → editor; theirs & not yet → a counted peek.
 */
import { mountHouse, iconSvg, ICON_KEYS } from "./house.js";
import { T, pickLang } from "./i18n.js";

const ME = "human";
const ASSETS = { house: "assets/house.webp", ginger: "assets/ginger.webp", bells: "assets/bells.webp", pinecone: "assets/pinecone.webp" };
// 扫雪的小家伙。想换成你们自己的：照 sprites/star-*.svg 的画布画五张，改这里的路径就行
const SPRITES = { sweep: "sprites/star-sweep.svg", walk: "sprites/star-walk.svg", happy: "sprites/star-happy.svg", heart: "sprites/star-heart.svg", carry: "sprites/star-carry.svg" };
const KIND = { lettre: "une lettre", chanson: "une chanson", melodie: "une mélodie", dessin: "un dessin", question: "une question", cadeau: "un cadeau", mot: "un mot", ensemble: "ensemble" };
const ABCJS_URL = "https://cdn.jsdelivr.net/npm/abcjs@6.5.2/dist/abcjs-basic-min.js";
const ABCJS_CSS = "https://cdn.jsdelivr.net/npm/abcjs@6.5.2/abcjs-audio.css";

const lang = pickLang();
let t = T[lang](null);           // 名字到了以后再换成带名字的版本
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

/* ── 小工具 ── */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
class AuthError extends Error {}
async function req(path, body) {
  const r = await fetch("api/advent" + path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch { /* 空 */ }
  if (r.status === 401) throw new AuthError("login");
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function upload(blob, name) {
  const r = await fetch("api/upload?name=" + encodeURIComponent(name || "file"), { method: "POST", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error || t.uploadFailed);
  return j;
}
function overlay(onBackdrop) {
  const z = h("div", { class: "adv-zoom" });
  z.addEventListener("click", (e) => { if (e.target === z && onBackdrop) onBackdrop(); });
  document.body.append(z);
  return z;
}

/* ── 五线谱（ABC 记谱）：用到才去 CDN 拿 abcjs ── */
let abcjsP = null;
function loadAbcjs() {
  if (!abcjsP) abcjsP = new Promise((ok, no) => {
    document.head.append(h("link", { rel: "stylesheet", href: ABCJS_CSS }));
    const s = h("script", { src: ABCJS_URL }); s.onload = () => ok(window.ABCJS); s.onerror = no; document.head.append(s);
  });
  return abcjsP;
}
function abcBlock(abc) {
  const text = /^X:/m.test(abc) ? abc : "X:1\n" + abc;
  const score = h("div", { class: "adv-abc" }), ctl = h("div", { class: "adv-abcctl" });
  const box = h("div", { style: { margin: "4px 0 10px" } }, score, ctl);
  loadAbcjs().then((A) => {
    const vis = A.renderAbc(score, text, { responsive: "resize", add_classes: true });
    if (A.synth && A.synth.supportsAudio()) {
      const sc = new A.synth.SynthController();
      sc.load(ctl, null, { displayPlay: true, displayProgress: true });
      sc.setTune(vis[0], false).catch(() => {});
    }
  }).catch(() => { score.append(h("pre", { style: { whiteSpace: "pre-wrap", fontSize: "12px" } }, text)); });
  return box;
}
function songBlock(url) {
  const m = /open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/(\w+)/.exec(url);
  if (m) return h("iframe", { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, width: "100%", height: "152", frameborder: "0", loading: "lazy",
    allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture", style: { borderRadius: "12px", margin: "6px 0 10px", border: 0 } });
  return h("p", {}, h("a", { href: url, target: "_blank", rel: "noreferrer" }, "♪ " + url));
}

/* ── 一格里放的东西 ── */
function itemsView(gift, { day, canAnswer, onAnswered }) {
  const frag = document.createDocumentFragment();
  for (const it of gift.items) {
    if (it.type === "text") frag.append(h("p", {}, it.text));
    else if (it.type === "song") frag.append(songBlock(it.url));
    else if (it.type === "voice" || it.type === "audio") frag.append(h("div", {}, h("audio", { controls: true, preload: "none", src: it.url }),
      (it.text || it.name) && h("p", { class: "cap" }, it.type === "voice" ? "「" + (it.text || "") + "」" : it.name)));
    else if (it.type === "image") frag.append(h("img", { src: it.url, alt: "", loading: "lazy" }));
    else if (it.type === "file") frag.append(h("p", {}, h("a", { href: it.url, target: "_blank", rel: "noreferrer" }, "📎 " + (it.name || t.attachment))));
    else if (it.type === "abc") frag.append(abcBlock(it.abc));
    else if (it.type === "question") frag.append(h("div", { class: "adv-q" }, h("span", { class: "adv-hint" }, t.qHint), h("p", { style: { margin: 0 } }, it.text)));
  }
  if (gift.note) frag.append(h("div", { class: "adv-note" }, gift.note));
  const hasQ = gift.items.some((i) => i.type === "question");
  if (hasQ && canAnswer) {
    const ta = h("textarea", { id: `adv-ans-${day}`, class: "adv-ta", placeholder: t.writeHere });
    ta.value = gift.answer || "";
    const msg = h("span", { class: "adv-hint" });
    const btn = h("button", { type: "button", class: "adv-btn solid" }, gift.answer ? t.update : t.answer);
    const sync = () => { btn.disabled = !ta.value.trim(); }; ta.addEventListener("input", sync); sync();
    btn.onclick = async () => {
      btn.disabled = true; msg.textContent = "";
      try { await req(`/${day}/answer`, { text: ta.value }); msg.textContent = t.answerSent; onAnswered && onAnswered(); }
      catch (e) { msg.textContent = e.message; }
      sync();
    };
    frag.append(h("div", { style: { marginTop: "10px" } }, h("label", { class: "adv-hint", for: `adv-ans-${day}` }, "ta réponse" + (gift.answer ? t.answeredCanEdit : "")), ta,
      h("div", { class: "adv-row" }, msg, btn)));
  }
  if (hasQ && !canAnswer && gift.answer) frag.append(h("div", { class: "adv-q", style: { borderColor: "rgba(79,107,58,.6)" } }, h("span", { class: "adv-hint" }, t.theirAnswer), h("p", { style: { margin: 0 } }, gift.answer)));
  return frag;
}

/* ── 拆开的卡：从窗拉近 → 合着的红卡 → 点一下翻开 ── */
function giftCard(cell, rect, fresh, names, onClose, onAnswered) {
  const d = cell.day, authors = cell.owners;
  const by = authors.length === 2 ? `${names.ai} & ${names.human}` : names[authors[0]];
  const first = cell.gifts[authors[0]];
  const icon = d === 24 ? "ensemble" : (first && first.icon) || "cadeau";
  const z = overlay(() => close());
  const xcard = h("div", { class: "adv-xcard" + (fresh ? "" : " flipped") });
  const flip = () => xcard.classList.add("flipped");
  const front = h("div", { class: "adv-face adv-front", role: "button", tabindex: "0", "aria-label": t.unfold, onclick: flip,
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } },
    html: `<svg class="fseal" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="#b3893f"/><circle cx="32" cy="32" r="21" fill="none" stroke="#8a6526" stroke-width="1.5"/><path d="M32 18l3.2 8.6 9.1.4-7.1 5.7 2.4 8.8L32 36.6l-7.6 4.9 2.4-8.8-7.1-5.7 9.1-.4z" fill="#f0d796" opacity=".9"/></svg>` });
  front.append(h("div", { class: "fd" }, `${d} déc.`), h("div", { class: "fby" }, `de la part de ${by}`), h("div", { class: "fhint" }, "touche pour ouvrir"));
  const body = h("div", { class: "adv-body" });
  for (const a of authors) {
    const g = cell.gifts[a];
    const half = h("div", { class: authors.length === 2 ? "adv-half" : "" });
    if (authors.length === 2) half.append(h("div", { class: "adv-hint", style: { marginBottom: "4px" } }, `la moitié de ${names[a]}`));
    half.append(g ? itemsView(g, { day: d, canAnswer: a !== ME, onAnswered }) : h("p", { class: "adv-hint" }, t.halfEmpty));
    if (a === ME && g) half.append(h("p", { class: "adv-hint", style: { marginTop: "6px" } }, cell.opened_by.ai ? t.theyOpened : t.theyNotYet));
    body.append(half);
  }
  const closeBtn = h("button", { type: "button", class: "adv-btn" }, "close");
  const back = h("div", { class: "adv-face adv-back adv-paper" }, h("div", { class: "adv-frame" },
    h("div", { class: "adv-ctop" }, h("span", { class: "d" }, `${d} déc.`), h("span", { class: "by" }, by)),
    h("div", { class: "adv-pic", html: iconSvg(icon) }), h("div", { class: "adv-k" }, KIND[icon] || ""), body,
    h("div", { class: "adv-row" }, h("span", { class: "adv-hint" }, "la fenêtre reste allumée"), closeBtn)));
  xcard.append(front, back);
  const box = h("div", { class: "adv-cardbox", role: "dialog", "aria-modal": "true", "aria-label": `${d} déc.` }, xcard);
  z.append(box);

  const cr = box.getBoundingClientRect();
  const from = `translate(${rect.left + rect.width / 2 - (cr.left + cr.width / 2)}px,${rect.top + rect.height / 2 - (cr.top + cr.height / 2)}px) scale(${rect.width / cr.width},${rect.height / cr.height})`;
  box.animate([{ transform: from, opacity: 0.3 }, { transform: "none", opacity: 1 }], { duration: still() ? 1 : 520, easing: "cubic-bezier(.2,.9,.25,1)" });
  requestAnimationFrame(() => z.classList.add("on"));
  const esc = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", esc);
  let closing = false;
  function close() {
    if (closing) return; closing = true;
    removeEventListener("keydown", esc); z.classList.remove("on");
    const a = box.animate([{ transform: "none", opacity: 1 }, { transform: from, opacity: 0 }], { duration: 320, easing: "ease-in" });
    a.onfinish = () => { z.remove(); onClose(); };
  }
  closeBtn.onclick = close;
}

/* ── 自己那格的编辑页 ── */
function editor(cell, editLimit, names, onClose, onSaved) {
  const d = cell.day, old = cell.gifts[ME], locked = cell.open;
  const editsLeft = editLimit == null ? null : old ? Math.max(0, editLimit - old.edits) : null;
  const readOnly = locked || editsLeft === 0;
  const pick = (ty) => (old ? old.items.filter((i) => i.type === ty) : []);
  let att = old ? old.items.filter((i) => ["voice", "audio", "image", "file"].includes(i.type)) : [];
  let icon = old ? old.icon : "";
  let busy = false, rec = null;
  const z = overlay(() => { if (!busy && !rec) done(); });
  z.classList.add("on");
  const msg = h("span", { class: "adv-hint" });
  const say = (s) => { msg.textContent = s || ""; };
  const done = () => { if (rec) { rec.keep = false; rec.mr.stop(); } z.remove(); onClose(); };

  const status = h("div", { class: "adv-status", html: t.editorStatus({ locked, final: editsLeft === 0, hidden: !!old, editLimit, editsLeft, deadline: cell.deadline }) });
  const frame = h("div", { class: "adv-frame" },
    h("div", { class: "adv-ctop" }, h("span", { class: "d" }, `${d} déc.`), h("span", { class: "by" }, d === 24 ? "ta moitié" : `pour ${names.ai}`)), status);
  const lab = (fr, cn) => h("span", { class: "adv-lab" }, fr, h("i", {}, cn));

  const btnRow = h("span", { style: { display: "flex", gap: "8px" } });
  const cancel = h("button", { type: "button", class: "adv-btn", onclick: done }, readOnly ? "close" : t.notNow);
  btnRow.append(cancel);

  if (readOnly && old) frame.append(h("div", { class: "adv-body adv-sec" }, itemsView(old, { day: d, canAnswer: false })));
  let save = null;
  if (!readOnly) {
    const text = h("textarea", { class: "adv-ta", style: { minHeight: "110px" } }); text.value = pick("text").map((i) => i.text).join("\n\n");
    const song = h("input", { class: "adv-in1", placeholder: "https://open.spotify.com/track/…", inputmode: "url" }); song.value = pick("song").map((i) => i.url).join(" ");
    const question = h("textarea", { class: "adv-ta", style: { minHeight: "50px" } }); question.value = pick("question").map((i) => i.text).join("\n");
    const note = h("textarea", { class: "adv-ta", style: { minHeight: "50px" } }); note.value = old?.note || "";

    const thumbs = h("div", { class: "adv-thumbs" }), chips = h("div", { class: "adv-chips", style: { marginTop: "6px" } });
    const drawAtt = () => {
      thumbs.replaceChildren(); chips.replaceChildren();
      att.forEach((a, i) => {
        const rm = h("button", { type: "button", "aria-label": t.remove, onclick: () => { att = att.filter((_, j) => j !== i); drawAtt(); } }, "×");
        if (a.type === "image") thumbs.append(h("span", {}, h("img", { src: a.url, alt: "" }), rm));
        else chips.append(h("span", { class: "adv-chip" }, a.type === "voice" ? `🎙 ${a.secs || ""}″` : `📎 ${(a.name || "").slice(0, 16)}`, rm));
      });
    };
    drawAtt();
    const setBusy = (s) => { busy = !!s; say(s); [recBtn, imgBtn, fileBtn, cancel].forEach((b) => { b.disabled = busy || !!rec; }); if (save) save.disabled = busy || !!rec; };
    const imgIn = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
    const fileIn = h("input", { type: "file", multiple: true, hidden: true });
    const addFiles = async (files, asImage) => {
      setBusy(t.uploading);
      try {
        for (const f of files) {
          const j = await upload(f, f.name);
          if (asImage) att.push({ type: "image", url: j.url });
          else att.push({ type: (f.type || "").startsWith("audio/") ? "audio" : "file", url: j.url, name: f.name });
        }
      } catch (e) { setBusy(""); say(e.message); drawAtt(); return; }
      setBusy(""); drawAtt();
    };
    imgIn.onchange = () => { addFiles([...imgIn.files], true); imgIn.value = ""; };
    fileIn.onchange = () => { addFiles([...fileIn.files], false); fileIn.value = ""; };
    const imgBtn = h("button", { type: "button", class: "adv-btn", onclick: () => imgIn.click() }, t.photos);
    const fileBtn = h("button", { type: "button", class: "adv-btn", onclick: () => fileIn.click() }, t.files);

    // 录一段：满 3 分钟自动停
    const recBox = h("span", { style: { display: "contents" } });
    const recBtn = h("button", { type: "button", class: "adv-btn" }, t.record);
    recBox.append(recBtn);
    recBtn.onclick = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { say(t.noRecorder); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); }
      catch { say(t.noMic); return; }
      const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((x) => MediaRecorder.isTypeSupported?.(x)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      rec = { mr, chunks: [], t0: Date.now(), keep: false };
      const clock = h("span", { class: "adv-hint" });
      const ok = h("button", { type: "button", class: "adv-btn solid", onclick: () => { rec.keep = true; mr.stop(); } }, t.recDone);
      const no = h("button", { type: "button", class: "adv-btn", onclick: () => { rec.keep = false; mr.stop(); } }, t.recDiscard);
      recBox.replaceChildren(clock, ok, no); setBusy("");
      const tick = setInterval(() => { const s = Math.floor((Date.now() - rec.t0) / 1000); clock.textContent = `${t.recording} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 250);
      const auto = setTimeout(() => { rec.keep = true; mr.stop(); }, 180000);
      mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onstop = async () => {
        clearInterval(tick); clearTimeout(auto); stream.getTracks().forEach((x) => x.stop());
        const r = rec; rec = null; recBox.replaceChildren(recBtn);
        const secs = Math.max(1, Math.round((Date.now() - r.t0) / 1000));
        const blob = new Blob(r.chunks, { type: (mr.mimeType || type || "audio/webm").split(";")[0] });
        setBusy("");
        if (!r.keep || blob.size < 800 || !z.isConnected) return;
        setBusy(t.savingRec);
        try { const j = await upload(blob, blob.type.includes("mp4") ? "voice.m4a" : "voice.webm"); att.push({ type: "voice", url: j.url, secs }); }
        catch (e) { setBusy(""); say(e.message); drawAtt(); return; }
        setBusy(""); drawAtt();
      };
      mr.start(250);
    };

    const icons = h("div", { class: "adv-icons" });
    const drawIcons = () => {
      icons.replaceChildren(...ICON_KEYS.filter((k) => k !== "ensemble" || d === 24).map((k) => h("button", {
        type: "button", class: icon === k ? "on" : "", title: t.kind[k], "aria-label": t.kind[k], "aria-pressed": icon === k ? "true" : "false",
        html: iconSvg(k), onclick: () => { icon = icon === k ? "" : k; drawIcons(); } })));
    };
    drawIcons();

    frame.append(
      h("div", { class: "adv-sec" }, lab("le cadeau", t.labText), text),
      h("div", { class: "adv-sec" }, lab("une chanson", t.labSong), song),
      h("div", { class: "adv-sec" }, lab("ta voix · images · fichiers", t.labMedia), h("div", { class: "adv-rec" }, recBox, imgBtn, fileBtn, imgIn, fileIn), thumbs, chips),
      h("div", { class: "adv-sec" }, lab("une question", t.labQuestion), question),
      h("div", { class: "adv-sec" }, lab("petit mot", t.labNote), note),
      h("div", { class: "adv-sec" }, lab("la fenêtre", t.labIcon), icons));

    save = h("button", { type: "button", class: "adv-btn solid" }, old ? t.saveChange : t.hideIt);
    save.onclick = async () => {
      const items = [];
      if (text.value.trim()) items.push({ type: "text", text: text.value });
      for (const u of song.value.split(/\s+/).filter(Boolean)) items.push({ type: "song", url: u });
      items.push(...att);
      if (question.value.trim()) items.push({ type: "question", text: question.value });
      if (!items.length && !note.value.trim()) { say(t.stillEmpty); return; }
      setBusy(t.hiding);
      try { await req(`/${d}/hide`, { icon: icon || undefined, items, note: note.value }); z.remove(); onSaved(old ? t.changed : t.hidden); }
      catch (e) { setBusy(""); say(e.message); }
    };
    btnRow.append(save);
  }
  frame.append(h("div", { class: "adv-row" }, msg, btnRow));
  z.append(h("div", { class: "adv-sheet adv-paper adv-face", role: "dialog", "aria-modal": "true", "aria-label": `${d} déc.` }, frame));
}

/* ── 谁藏好了（只看得到藏没藏；对方忘了藏可以提醒）── */
function board(data, names, onClose, onEdit, onNudged) {
  const z = overlay(() => close()); z.classList.add("on");
  const close = () => { z.remove(); onClose(); };
  const msg = h("span", { class: "adv-hint" });
  const list = h("ul", { class: "adv-list" });
  for (const c of data.cells) {
    const w = h("span", { class: "w" });
    for (const a of c.owners) {
      const hid = c.hidden[a];
      w.append(h("span", { class: hid ? "ok" : c.open ? "late" : "no", style: { marginRight: "8px" } }, (a === ME ? t.you : names.ai) + (hid ? t.stHidden : c.open ? t.stEmpty : t.stNotYet)));
    }
    const li = h("li", {}, h("span", { class: "n" }, `12/${c.day}`), w);
    if (!c.open && c.owners.includes(ME)) li.append(h("button", { type: "button", class: "adv-btn", onclick: () => { z.remove(); onEdit(c.day); } }, c.hidden[ME] ? t.view : t.goHide));
    if (!c.open && c.owners.includes("ai") && !c.hidden.ai) li.append(h("button", { type: "button", class: "adv-btn", onclick: async () => {
      msg.textContent = "";
      try { await req(`/${c.day}/nudge`, {}); msg.textContent = t.nudged(c.day); onNudged(); } catch (e) { msg.textContent = e.message; }
    } }, t.nudge));
    list.append(li);
  }
  z.append(h("div", { class: "adv-sheet adv-paper adv-face", role: "dialog", "aria-modal": "true", "aria-label": t.boardTitle }, h("div", { class: "adv-frame" },
    h("div", { class: "adv-ctop" }, h("span", { class: "d" }, "qui a caché quoi"), h("span", { class: "by" }, t.boardTitle)),
    h("div", { class: "adv-status" }, t.boardNote), list,
    h("div", { class: "adv-row" }, msg, h("button", { type: "button", class: "adv-btn", onclick: close }, "close")))));
}

/* ── 进门：输一次钥匙 ── */
function login(root) {
  return new Promise((resolve) => {
    const inp = h("input", { class: "adv-in1", type: "password", autocomplete: "current-password", placeholder: t.keyPlaceholder });
    const err = h("div", { class: "adv-err" });
    const go = async () => {
      err.textContent = "";
      const r = await fetch("api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: inp.value.trim() }) });
      if (r.ok) { box.remove(); resolve(); } else err.textContent = (await r.json().catch(() => ({}))).error || t.wrongKey;
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    const box = h("div", { class: "adv-sheet adv-paper adv-face", style: { margin: "24px auto" } }, h("div", { class: "adv-frame" },
      h("div", { class: "adv-ctop" }, h("span", { class: "d" }, "la clé"), h("span", { class: "by" }, t.loginTitle)),
      h("div", { class: "adv-sec" }, inp), err, h("div", { class: "adv-row" }, h("span"), h("button", { type: "button", class: "adv-btn solid", onclick: go }, t.comeIn))));
    root.append(box); inp.focus();
  });
}

/* ── 整页 ── */
async function main() {
  const page = document.getElementById("app");
  const wrap = h("div", { class: "adv-wrap" });
  page.append(wrap);
  const boardBtn = h("button", { type: "button", disabled: true }, "qui a caché ?");
  const eyebrow = h("div", { class: "adv-eyebrow" }, "DÉCEMBRE");
  const left = h("div", { class: "adv-left" });
  const stage = h("div");
  const err = h("div", { class: "adv-err" });
  const peeks = h("div", { class: "adv-peeks" });
  const langBtn = h("button", { type: "button", onclick: () => { try { localStorage.setItem("advent-lang", lang === "zh" ? "en" : "zh"); } catch { /* 私密模式 */ } location.reload(); } }, lang === "zh" ? "English" : "中文");
  wrap.append(h("div", { class: "adv-nav" }, langBtn, boardBtn), h("header", { class: "adv-head" }, eyebrow, h("h1", {}, "Calendrier de l'Avent"), left), stage, err, peeks);

  let data = null, names = null, house = null, skew = 0, busy = false, midnight = 0;

  const load = async () => {
    try {
      const j = await req("");
      data = j; skew = j.now * 1000 - Date.now(); err.textContent = "";
      if (!names) { names = j.names; t = T[lang](names); }
      render(); return j;
    } catch (e) {
      if (e instanceof AuthError) { await login(wrap); return load(); }
      err.textContent = t.cantReach + e.message; return null;
    }
  };

  const tap = async (day) => {
    if (!data || !house || busy) return;
    const c = data.cells[day - 1];
    if (c.open) {
      if (c.opened_by[ME]) { giftCard(c, house.rectOf(day), false, names, () => {}, load); return; }
      busy = true;
      const anim = house.play(day);          // 点了马上开窗，别等网络；拆的记录和内容同时去拿
      try {
        await req(`/${day}/touch`, {});
        const fresh = await load();
        const { rect, done } = await anim;
        if (fresh) { giftCard(fresh.cells[day - 1], rect, true, names, () => {}, load); done(); } else done();
      } catch (e) { house.say(t.couldntOpen + e.message); anim.then(({ done }) => done()); load(); }
      busy = false;
      return;
    }
    if (c.owners.includes(ME)) { editor(c, data.edit_limit, names, () => {}, (m) => { load(); house.say(m); }); return; }
    try { await req(`/${day}/touch`, {}); house.rattle(day, t.peekToast); load(); }
    catch (e) { house.say(e.message); }
  };

  function render() {
    if (!house) house = mountHouse(stage, { assets: ASSETS, sprites: SPRITES, onTap: tap, labels: t.houseLabels });
    boardBtn.disabled = false;
    boardBtn.onclick = () => board(data, names, () => {}, (d) => editor(data.cells[d - 1], data.edit_limit, names, () => {}, (m) => { load(); house.say(m); }), load);
    const night = data.hour >= 17 || data.hour < 6;
    page.classList.toggle("dusk", night);
    eyebrow.textContent = `DÉCEMBRE ${data.year}`;
    const today = data.today;
    left.innerHTML = today === 0 ? `encore <b>${Math.max(1, Math.ceil((data.cells[0].open_at - data.now) / 86400))}</b> jours avant le premier`
      : today < 24 ? `encore <b>${24 - today}</b> jours avant le 24` : today === 24 ? "c'est <b>aujourd'hui</b>" : "Joyeux Noël";
    house.set({
      today, night,
      cells: data.cells.map((c) => {
        const lit = !!c.opened_by[ME];
        const g = c.gifts.ai || c.gifts.human;
        return { day: c.day, who: c.owners.length === 2 ? "both" : c.owners[0], lit, ready: c.open && !lit, icon: lit ? (c.day === 24 ? "ensemble" : g ? g.icon : "vide") : undefined };
      }),
    });
    const todo = data.cells.filter((c) => !c.open && c.owners.includes(ME) && !c.hidden[ME]).length;
    peeks.replaceChildren(data.peeks.human || data.peeks.ai ? t.peekCount(data.peeks.human, data.peeks.ai) : t.rulesLine(data.tz));
    if (todo) peeks.append(h("br"), t.todo(todo));
    // 跨零点那一刻自动刷新（开着页面等的时候）
    clearTimeout(midnight);
    const now = Date.now() + skew;
    const next = data.cells.map((c) => c.open_at * 1000).filter((x) => x > now).sort((a, b) => a - b)[0];
    if (next && next - now < 6 * 3600e3) midnight = setTimeout(load, next - now + 1500);
  }

  await load();
  setInterval(load, 60000);
}

main();

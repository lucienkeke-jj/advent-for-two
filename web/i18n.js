/* 頁面上的字。法文小標籤是裝飾，兩種語言都留著；其它中英各一份。
   UI strings. The little French labels are decoration and stay in both languages. */

export function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "zh" || q === "en") return q;
  try { const s = localStorage.getItem("advent-lang"); if (s === "zh" || s === "en") return s; } catch { /* 私密模式 */ }
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const T = {
  zh: (names) => {
    const A = names ? names.ai : "TA";
    return {
      loginTitle: "進門", keyPlaceholder: "鑰匙（HUMAN_KEY）", comeIn: "進門", wrongKey: "鑰匙不對",
      cantReach: "沒連上：", couldntOpen: "沒打開：", uploadFailed: "上傳沒成功",
      peekToast: "還沒到 · 偷看記一次",
      peekCount: (h, a) => `你偷看了 ${h} 次 · ${A} 偷看了 ${a} 次`,
      rulesLine: (tz) => `單數日 ${A} 藏，雙數日你藏，24 號一人一半 · ${tz} 零點開`,
      todo: (n) => `你還有 ${n} 格沒藏 · 點自己的窗（金色數字）就能藏`,
      attachment: "附件", qHint: "une question · 不許跳過", writeHere: "寫在這裡…", answer: "回答", update: "改好了",
      answerSent: `交上去了，${A} 會看到`, answeredCanEdit: " · 已經交過，可以改", theirAnswer: `${A} 的回答`,
      unfold: "翻開", halfEmpty: "（這一半空著）", theyOpened: `${A} 拆開了 ✓`, theyNotYet: `${A} 還沒拆`,
      editorStatus: ({ locked, final, hidden, editLimit, editsLeft, deadline }) => {
        if (locked) return "已經過了零點，這格鎖住了。";
        if (final) return `<b>已藏好 ✓</b> 改過了，就是它了。${esc(deadline)} 後自動送到 ${esc(A)} 那裡。`;
        if (!hidden) return `還沒藏。${esc(deadline)} 前要藏好` + (editLimit == null ? "，之前都能改" : `，藏好後還能改 ${editLimit} 次`) + `，零點自動送到 ${esc(A)} 那裡。`;
        return `<b>已藏好 ✓</b> ${esc(A)} 只知道你藏好了，看不到裡面。${esc(deadline)} 前` + (editLimit == null ? "都能改" : `還能改 ${editsLeft} 次`) + `，零點自動送到 ${esc(A)} 那裡。`;
      },
      labText: `寫給 ${A} 的（信、一句話都行）`, labSong: "Spotify 歌曲連結（別的 https 連結也行）", labMedia: "自己唱的、錄的、照片、檔案",
      labQuestion: `問 ${A} 一個問題，必須回答（可以不寫）`, labNote: "附在禮物上的小卡片", labIcon: "拆開以後窗裡亮的小圖（不選就按內容猜）",
      record: "● 錄一段", recDone: "✓ 好了", recDiscard: "× 不要", recording: "錄音中", photos: "照片", files: "音訊 / 檔案", remove: "拿掉",
      noRecorder: "這個瀏覽器錄不了音，可以傳音訊檔案", noMic: "沒拿到麥克風權限",
      uploading: "上傳中…", savingRec: "存錄音…", hiding: "藏起來…", stillEmpty: "還是空的",
      notNow: "先不藏", hideIt: "藏起來", saveChange: "改好了", hidden: `藏好了，零點前 ${A} 看不到`, changed: "改好了",
      kind: { lettre: "信", chanson: "歌", melodie: "小曲子", dessin: "畫", question: "問題", cadeau: "禮物", mot: "一句話", ensemble: "一起" },
      boardTitle: "誰藏好了", boardNote: "只看得到藏沒藏，看不到裡面。每格要在前一天 23:59 前藏好。",
      you: "你", stHidden: " ✓ 藏好了", stEmpty: " · 空著", stNotYet: " · 還沒藏", view: "看看", goHide: "去藏", nudge: `提醒 ${A}`,
      nudged: (d) => `提醒發過去了（12/${d}）`,
      houseLabels: { house: "一棟蓋著雪的紅房子，24 扇窗", pine: "松果", bells: "鈴鐺", sprite: "掃雪的小傢伙",
        day: (d, st) => `${d} 號` + (st === "open" ? "，開著" : st === "ready" ? "，可以拆了" : "，還沒到") },
    };
  },
  en: (names) => {
    const A = names ? names.ai : "them";
    return {
      loginTitle: "come in", keyPlaceholder: "your key (HUMAN_KEY)", comeIn: "Come in", wrongKey: "Wrong key",
      cantReach: "Can't reach the server: ", couldntOpen: "Couldn't open: ", uploadFailed: "Upload failed",
      peekToast: "Not yet · that's one peek",
      peekCount: (h, a) => `You peeked ${h}× · ${A} peeked ${a}×`,
      rulesLine: (tz) => `Odd days ${A} hides, even days you do, the 24th is half each · opens at midnight, ${tz}`,
      todo: (n) => `${n} of your windows still empty · tap one with a gold number to hide something`,
      attachment: "attachment", qHint: "une question · no skipping", writeHere: "Write here…", answer: "Answer", update: "Update",
      answerSent: `Sent — ${A} will see it`, answeredCanEdit: " · sent, you can still edit", theirAnswer: `${A}'s answer`,
      unfold: "Open the card", halfEmpty: "(this half is empty)", theyOpened: `${A} opened it ✓`, theyNotYet: `${A} hasn't opened it yet`,
      editorStatus: ({ locked, final, hidden, editLimit, editsLeft, deadline }) => {
        if (locked) return "Past midnight — this window is locked.";
        if (final) return `<b>Hidden ✓</b> Already changed — this is the one. It goes to ${esc(A)} after ${esc(deadline)}.`;
        const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
        if (!hidden) return `Nothing hidden yet. Due ${esc(deadline)}` + (editLimit == null ? "" : `; once it's hidden you can change it ${times(editLimit)}`) + `. At midnight it goes to ${esc(A)}.`;
        return `<b>Hidden ✓</b> ${esc(A)} only knows it's ready, not what's inside. ` +
          (editLimit == null ? `You can change it until ${esc(deadline)}.` : `You can still change it ${times(editsLeft)} until ${esc(deadline)}.`) + ` At midnight it goes to ${esc(A)}.`;
      },
      labText: `for ${A} — a letter, or one line`, labSong: "a Spotify link (any https link works)", labMedia: "your voice, photos, files",
      labQuestion: `ask ${A} something they must answer (optional)`, labNote: "a little card tied to the gift", labIcon: "the drawing that lights up in the window (guessed if you skip)",
      record: "● Record", recDone: "✓ Done", recDiscard: "× Discard", recording: "Recording", photos: "Photos", files: "Audio / files", remove: "Remove",
      noRecorder: "This browser can't record — upload an audio file instead", noMic: "No microphone permission",
      uploading: "Uploading…", savingRec: "Saving recording…", hiding: "Hiding…", stillEmpty: "Still empty",
      notNow: "Not now", hideIt: "Hide it", saveChange: "Save change", hidden: `Hidden — ${A} can't see it before midnight`, changed: "Changed",
      kind: { lettre: "letter", chanson: "song", melodie: "tune", dessin: "drawing", question: "question", cadeau: "gift", mot: "a few words", ensemble: "together" },
      boardTitle: "who's ready", boardNote: "You only see whether it's hidden, never what. Each window is due by 23:59 the day before.",
      you: "You", stHidden: " ✓ hidden", stEmpty: " · empty", stNotYet: " · not yet", view: "View", goHide: "Hide", nudge: "Nudge",
      nudged: (d) => `Nudge sent (Dec ${d})`,
      houseLabels: {},
    };
  },
};

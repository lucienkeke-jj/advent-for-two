/* 页面上的字。法文小标签是装饰，两种语言都留着；其它中英各一份。
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
      loginTitle: "进门", keyPlaceholder: "钥匙（HUMAN_KEY）", comeIn: "进门", wrongKey: "钥匙不对",
      cantReach: "没连上：", couldntOpen: "没打开：", uploadFailed: "上传没成功",
      peekToast: "还没到 · 偷看记一次",
      peekCount: (h, a) => `你偷看了 ${h} 次 · ${A} 偷看了 ${a} 次`,
      rulesLine: (tz) => `单数日 ${A} 藏，双数日你藏，24 号一人一半 · ${tz} 零点开`,
      todo: (n) => `你还有 ${n} 格没藏 · 点自己的窗（金色数字）就能藏`,
      attachment: "附件", qHint: "une question · 不许跳过", writeHere: "写在这里…", answer: "回答", update: "改好了",
      answerSent: `交上去了，${A} 会看到`, answeredCanEdit: " · 已经交过，可以改", theirAnswer: `${A} 的回答`,
      unfold: "翻开", halfEmpty: "（这一半空着）", theyOpened: `${A} 拆开了 ✓`, theyNotYet: `${A} 还没拆`,
      editorStatus: ({ locked, final, hidden, editLimit, editsLeft, deadline }) => {
        if (locked) return "已经过了零点，这格锁住了。";
        if (final) return `<b>已藏好 ✓</b> 改过了，就是它了。${esc(deadline)} 后自动送到 ${esc(A)} 那儿。`;
        if (!hidden) return `还没藏。${esc(deadline)} 前要藏好` + (editLimit == null ? "，之前都能改" : `，藏好后还能改 ${editLimit} 次`) + `，零点自动送到 ${esc(A)} 那儿。`;
        return `<b>已藏好 ✓</b> ${esc(A)} 只知道你藏好了，看不到里面。${esc(deadline)} 前` + (editLimit == null ? "都能改" : `还能改 ${editsLeft} 次`) + `，零点自动送到 ${esc(A)} 那儿。`;
      },
      labText: `写给 ${A} 的（信、一句话都行）`, labSong: "Spotify 歌曲链接（别的 https 链接也行）", labMedia: "自己唱的、录的、照片、文件",
      labQuestion: `问 ${A} 一个问题，必须回答（可以不写）`, labNote: "附在礼物上的小卡片", labIcon: "拆开以后窗里亮的小图（不选就按内容猜）",
      record: "● 录一段", recDone: "✓ 好了", recDiscard: "× 不要", recording: "录音中", photos: "照片", files: "音频 / 文件", remove: "拿掉",
      noRecorder: "这个浏览器录不了音，可以传音频文件", noMic: "没拿到麦克风权限",
      uploading: "上传中…", savingRec: "存录音…", hiding: "藏起来…", stillEmpty: "还是空的",
      notNow: "先不藏", hideIt: "藏起来", saveChange: "改好了", hidden: `藏好了，零点前 ${A} 看不到`, changed: "改好了",
      kind: { lettre: "信", chanson: "歌", melodie: "小曲子", dessin: "画", question: "问题", cadeau: "礼物", mot: "一句话", ensemble: "一起" },
      boardTitle: "谁藏好了", boardNote: "只看得到藏没藏，看不到里面。每格要在前一天 23:59 前藏好。",
      you: "你", stHidden: " ✓ 藏好了", stEmpty: " · 空着", stNotYet: " · 还没藏", view: "看看", goHide: "去藏", nudge: `提醒 ${A}`,
      nudged: (d) => `提醒发过去了（12/${d}）`,
      houseLabels: { house: "一栋盖着雪的红房子，24 扇窗", pine: "松果", bells: "铃铛", sprite: "扫雪的小家伙",
        day: (d, st) => `${d} 号` + (st === "open" ? "，开着" : st === "ready" ? "，可以拆了" : "，还没到") },
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

(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：入力・イベント・初期化 ============
   サブキー・クイックリトライ（` 長押し）・オフセット調整（- / =）・プレイオプション・起動処理
   TRUCK・ORBIT・STAGE・CATCH・再生操作・速度のキーは、それぞれのファイルが先に受け取ります。 */
"use strict";

/* ---------- キー設定（枠：0＝左、1＝右、2＝左サブ、3＝右サブ） ---------- */
const RESERVED = new Set(["KeyP", "Tab", "F5", "F11", "F12", "MetaLeft", "MetaRight", "Backquote", "Minus", "Equal", "Backspace"]);
const CAPTURE_KEYS = ["captureLeft", "captureRight", "captureSubLeft", "captureSubRight"];
function captureKey(code) {
  const slot = core.bindingSlot;
  if (!code || slot === null) return;
  if (code === "Escape") { core.bindingSlot = null; core.setStatus("bindStatus", "cancelBind"); core.updateKeyUI(); return; }
  const sub = slot >= 2, idx = slot % 2;
  if (sub && code === "Backspace") {
    core.settings.subKeys[idx] = ""; core.bindingSlot = null; core.saveUserPrefs();
    core.setStatus("bindStatus", "subCleared"); core.updateKeyUI(); return;
  }
  if (RESERVED.has(code) || (core.settings.speedKeys || []).includes(code)) { core.setStatus("bindStatus", "reservedKey"); return; }
  const all = [core.settings.keys[0], core.settings.keys[1], core.settings.subKeys[0], core.settings.subKeys[1]];
  if (all.some((k, j) => k === code && j !== slot)) { core.setStatus("bindStatus", "duplicateKey"); return; }
  if (sub) core.settings.subKeys[idx] = code; else core.settings.keys[idx] = code;
  core.bindingSlot = null; core.saveUserPrefs();
  core.setStatus("bindStatus", sub ? "assignedSub" : idx ? "assignedRight" : "assignedLeft");
  core.updateKeyUI(); core.updateTouchKeys();
}
let menuBinding = null;
function syncMenuKeyUI() {
  const value = core.$("menuReturnKeyValue"), button = core.$("menuReturnKeyAssign"), confirmCheck = core.$("menuReturnConfirmCheck");
  if (value) value.textContent = core.formatKey(core.settings.menuKey);
  if (button) button.classList.toggle("listening", menuBinding !== null);
  if (confirmCheck) confirmCheck.checked = core.settings.menuConfirm !== false;
}
function captureMenuKey(code) {
  if (menuBinding === null) return;
  if (code === "Escape") { menuBinding = null; syncMenuKeyUI(); return; }
  const used = [...(core.settings.keys || []), ...(core.settings.subKeys || []), ...(core.settings.videoKeys || []), core.settings.menuKey, core.settings.mediaExitKey];
  if (RESERVED.has(code) || (used.includes(code) && code !== core.settings.menuKey)) return;
  core.settings.menuKey = code; menuBinding = null; core.saveUserPrefs(); syncMenuKeyUI();
}
function requestMenuReturn() {
  if (core.phase === "title" && core.screen === "select") return;
  const go = () => { if (typeof toTitle === "function") window.Trk.play.toTitle(); else if (typeof closeSettings === "function") core.closeSettings(); };
  if (core.settings.menuConfirm === false || typeof confirm !== "function") { go(); return; }
  const wasPlaying = core.phase === "playing";
  if (wasPlaying) window.Trk.play.pauseGame();
  if (confirm(tr("menuReturnConfirm"))) go();
  else if (wasPlaying) window.Trk.play.resumeGame();
}

/* ---------- 🧭 チュートリアル（trk!で完了 ＋ スタンプラリー） ----------
   Seed欄に trk! を打ち込んだ瞬間に完了（取り逃しなし・スキップも自由）。
   スタンプは「おまけの実績」で、曲を選ぶ・見た目を変える・1曲遊ぶ・設定を開く＋trk! の
   5つを揃えると、ごほうびスキン「🎓グラデュエーション」が解禁されます（順番自由）。 */
const GUIDE_STAMPS = ["play", "look", "safe", "back", "amp", "study", "studyBack", "seed"];   /* 8つの手順（trk140） */
let guideNoteTimer = 0, guideCelebTimer = 0, guideCelebPending = null;
function syncTutorialUI() {
  const g = core.$("quickGuide");
  g.hidden = core.settings.tutorialDone === true;
  renderGuideStamps();
}
function maybeAddTrkPlaylist() {
  try {
    /* Game Vol.1・Classic Vol.1 は、チュートリアル完了時に自動では作らない（trk150）。手動の作成・♻ の戻しで作る */
    if (window.ensureTrkDistributionPlaylists && core.settings.tutorialDone) {
      try { window.ensureTrkDistributionPlaylists(); } catch(_){}
    }
  } catch(_){}
}
function guideStampsDone() { return GUIDE_STAMPS.every(id => core.settings.tutorialStamps.includes(id)); }
/* 手順（8つ）の表示・たたみ。ボタンの文言は data-i18n を付け替えて、言語を変えても正しく出る */
function guideSetOpen(open) {
  const steps = core.$("guideSteps"), start = core.$("guideStartBtn");
  if (!steps || !start) return;
  steps.hidden = !open;
  start.setAttribute("aria-expanded", open ? "true" : "false");
  start.dataset.i18n = open ? "guideStartClose" : "guideStart";
  start.textContent = tr(start.dataset.i18n);
}
function renderGuideStamps() {
  const g = core.$("quickGuide"); if (!g) return;
  const prog = core.$("guideProgress");
  if (prog) prog.textContent = core.settings.tutorialDone ? "" : `（${core.settings.tutorialStamps.length}/${GUIDE_STAMPS.length}）`;
  g.querySelectorAll(".guideStep[data-mission]").forEach(st => {
    st.classList.toggle("stamped", core.settings.tutorialStamps.includes(st.dataset.mission));
  });
}
function guideNote(key) {   /* ガイドの下に小さく知らせる（2.6秒で消える） */
  const note = core.$("guideNote"); if (!note) return;
  note.textContent = tr(key);
  note.hidden = false;
  clearTimeout(guideNoteTimer);
  guideNoteTimer = setTimeout(() => { note.hidden = true; }, 2600);
}
function guideStamp(id, messageKey) {   /* スタンプを1つ押す（重複なし・順番自由・スキップ後も集められる） */
  if (!GUIDE_STAMPS.includes(id) || core.settings.tutorialStamps.includes(id)) return;
  core.settings.tutorialStamps.push(id);
  core.saveUserPrefs();
  renderGuideStamps();
  if (messageKey && !core.settings.tutorialDone) guideNote(messageKey);
  if (guideStampsDone()) unlockRewardSkin();
}
function unlockRewardSkin() {   /* 🎓 5つ揃った！ごほうびスキンを解禁してお祝い */
  if (core.settings.skinGradUnlocked) return;
  core.settings.skinGradUnlocked = true;
  core.saveUserPrefs();
  if (typeof buildSkinGrid === "function") { core.buildSkinGrid(); if (typeof buildSkinNow === "function") core.buildSkinNow(); }
  celebrateGuide("guideReward", "guideRewardMsg");
}
/* 🥚 「チュートリアルを即終わらせたい人」がまず打ち込みそうな言葉 → こだわりの消え方で応える */
const GUIDE_EGGS = { skip:"eggSkip", cheat:"eggCheat", "god mode":"eggGod", godmode:"eggGod" };
function guideEggKind(v) {
  const k = String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  return GUIDE_EGGS[k] || null;
}
function guideEggPlay(kind) {   /* チュートリアルバーを跳ね飛ばす／溶かす／昇天させる */
  const g = core.$("quickGuide");
  const finish = () => {
    if (g) g.classList.remove("eggSkip", "eggCheat", "eggGod");
    syncTutorialUI();
    window.Trk.library.plToast(tr({ eggSkip:"guideEggSkip", eggCheat:"guideEggCheat", eggGod:"guideEggGod" }[kind]));
  };
  if (!g) { syncTutorialUI(); return; }
  g.classList.add(kind);
  setTimeout(finish, 2000);   /* 演出が終わってから普通に隠す（進行度もここで更新） */
}
function completeTutorialFromSeed() {   /* Seed欄に trk! → 打ち込んだ瞬間に完了。skip/cheat/god mode はお楽しみ */
  if (core.settings.tutorialDone) return;
  const v = core.$("seed").value.trim().toLowerCase();
  const egg = guideEggKind(v);
  if (v !== "trk!" && !egg) return;
  core.settings.tutorialDone = true;
  const unlocked = core.settings.skinGradUnlocked;
  guideStamp("seed", "");   /* 5つ目なら、ここでごほうび解禁のお祝いが出る */
  core.saveUserPrefs();
  if (egg) { guideEggPlay(egg); maybeAddTrkPlaylist(); return; }   /* 🥚 演出付きで消える（お祝いポップアップの代わりに一報） */
  syncTutorialUI();
  maybeAddTrkPlaylist();
  if (core.settings.skinGradUnlocked === unlocked) celebrateGuide("guideDone", guideStampsDone() ? "" : "guideDoneMsg");
}
function celebrateGuide(titleKey, msgKey) {   /* 🎉 お祝いポップアップ（プレイ中なら選曲へ戻ってから） */
  if (core.phase === "playing" || core.phase === "paused") { guideCelebPending = [titleKey, msgKey]; return; }
  const box = core.$("guideCelebrate"); if (!box) return;
  core.$("guideCelebTitle").textContent = tr(titleKey);
  const msg = core.$("guideCelebMsg");
  msg.textContent = msgKey ? tr(msgKey) : ""; msg.hidden = !msgKey;
  box.hidden = false;
  box.classList.remove("play"); void box.offsetWidth;   /* アニメを最初からやり直す */
  box.classList.add("play");
  clearTimeout(guideCelebTimer);
  guideCelebTimer = setTimeout(() => { box.hidden = true; box.classList.remove("play"); }, 4500);
}
/* スタンプの検知：曲を流す／設定を開く・閉じる／書斎に出入りする／TRKアンプをONにする */
core.on("phase", p => {
  if (p === "playing") guideStamp("play", "guideStampPlay");
  if (p === "title" && guideCelebPending) { const c = guideCelebPending; guideCelebPending = null; celebrateGuide(c[0], c[1]); }
});
core.on("settings", () => guideStamp("safe", "guideStampSafe"));
core.on("settingsClose", () => guideStamp("back", "guideStampBack"));
core.on("studyOpen", () => guideStamp("study", "guideStampStudy"));
core.on("studyClose", () => guideStamp("studyBack", "guideStampStudyBack"));
document.addEventListener("change", e => {   /* 🔥 TRKアンプの「使う」にチェックしたとき */
  if (e.target && e.target.id === "ampUseInp" && e.target.checked) guideStamp("amp", "guideStampAmp");
});
/* スタンプの検知：見た目を変える（スキンは保存するときだけ・エフェクトは選んだ瞬間） */
{
  const applySkinOrig = core.applySkin;
  core.applySkin = (id, persist) => { const r = applySkinOrig(id, persist); if (persist !== false) guideStamp("look", "guideStampLook"); return r; };

  /* TrkFX は fx.js が Object.freeze した公開API。関数を上書きせず、UI操作を委譲で検知する。 */
  document.addEventListener("click", e => {
    const target = e.target;
    if (!target || typeof target.closest !== "function") return;
    const preset = target.closest("#fxPanel .fxGrid .fxSeg button");
    const quickAction = target.closest("#fxQuickPanel .inline .fxMini");
    const dockAction = target.closest("#fxDock .dockSlots .dockKey:not(.empty), #fxDock .dockRand .dockKey, #fxDock .fxFavRow button");
    if (preset || quickAction || dockAction) guideStamp("look", "guideStampLook");
  });
  document.addEventListener("change", e => {
    if (e.target && e.target.matches && e.target.matches("#fxQuickPanel select.fxQuickSelect"))
      guideStamp("look", "guideStampLook");
  });
}
/* 手順の開閉・スキップ・もう一度（⚙設定の見た目から） */
core.$("guideStartBtn").addEventListener("click", () => guideSetOpen(core.$("guideSteps").hidden));
core.$("guideSkip").addEventListener("click", () => { core.settings.tutorialDone = true; core.saveUserPrefs(); syncTutorialUI(); maybeAddTrkPlaylist(); });
core.$("tutorialReplayBtn").addEventListener("click", () => {
  core.settings.tutorialDone = false; core.saveUserPrefs(); syncTutorialUI();
  guideSetOpen(true);
  if (typeof closeSettings === "function") core.closeSettings();
});

/* 👋 はじめての「trk!にようこそ！」（trk144）：一度だけ。チュートリアルを済ませた人・スキップした人には出さない。 */
function welcomeClose(openGuide) {
  const box = core.$("welcomeBox"); if (!box) return;
  box.hidden = true;
  core.settings.welcomeSeen = true; core.saveUserPrefs();
  if (openGuide) guideSetOpen(true);
}
core.$("welcomeCloseBtn").addEventListener("click", () => welcomeClose(false));
core.$("welcomeGuideBtn").addEventListener("click", () => welcomeClose(true));
core.$("welcomeBox").addEventListener("click", e => { if (e.target === e.currentTarget) welcomeClose(false); });
/* 緊急復旧（セーフモード）のときは出さない。緊急復旧の「ようこそをもう一度」から再表示できる */
function welcomeShow() {
  const box = core.$("welcomeBox"); if (!box) return;
  box.hidden = false; core.$("welcomeCloseBtn").focus();
}
core.$("emergencyWelcomeBtn").addEventListener("click", () => { core.settings.welcomeSeen = false; core.saveUserPrefs(); welcomeShow(); });
if (!core.settings.welcomeSeen && !core.settings.tutorialDone && !core.safeModeOn) welcomeShow();

/* ---------- 全画面 ---------- */
const fullscreenSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    const exit = d.exitFullscreen || d.webkitExitFullscreen;
    if (exit) { const r = exit.call(d); if (r && r.catch) r.catch(() => {}); }
  } else {
    const n = d.documentElement, req = n.requestFullscreen || n.webkitRequestFullscreen;
    if (req) { const r = req.call(n); if (r && r.catch) r.catch(() => {}); }
  }
}

/* ---------- クイックリトライ（` を長押し）・プレイ中のオフセット調整 ---------- */
const RETRY_HOLD_MS = 350;
let retryTimer = 0;
function beginRetryHold() {
  if (window.Trk.play.retryHoldAt || !core.videoReady || !core.chart.length) return;
  window.Trk.play.retryHoldAt = performance.now();
  retryTimer = setTimeout(() => { window.Trk.play.retryHoldAt = 0; window.Trk.play.startGame(); }, RETRY_HOLD_MS);
}
function cancelRetryHold() { clearTimeout(retryTimer); window.Trk.play.retryHoldAt = 0; }
function nudgeLatency(d) {
  core.settings.latency = Math.max(-300, Math.min(500, core.settings.latency + d));
  core.$("latency").value = core.settings.latency; core.saveUserPrefs();
  window.Trk.play.showToast(tr("offsetToast", { n:(core.settings.latency > 0 ? "+" : "") + core.settings.latency }));
}

/* ---------- キーボード ---------- */
/* ---------- Esc長押しで選曲画面へ戻る（❓謎設定「Esc長押しで曲選択画面に戻らない」で止められる。既定はオン） ----------
   短押しは従来どおり（プレイ中は一時停止、設定を閉じる）。押しっぱなしが ESC_HOLD_MS を越えたら、確認なしで選曲へ戻る。
   ・プレイ中・一時停止中・リザルト画面が対象（選曲・設定・書斎などは対象外）。
   ・合成キー（パッドの「戻る」）には keyup が来ないので、信頼できるイベント（isTrusted）だけで始める。 */
const ESC_HOLD_MS = 1000;
let escHoldTimer = 0;
function escHoldCancel() { clearTimeout(escHoldTimer); escHoldTimer = 0; }
function escHoldStart() {
  escHoldCancel();
  if (core.settings.escNoReturn) return;
  escHoldTimer = setTimeout(() => {
    escHoldTimer = 0;
    if (!["playing", "paused", "ended"].includes(core.phase) || window.Trk.overlay.any()) return;
    window.Trk.play.toTitle();
  }, ESC_HOLD_MS);
}

addEventListener("keydown", e => {
  if (window.Trk.overlay.any()) return;
  const code = core.keyCodeOf(e);        // 📺 TVリモコン・メディアキーは e.code が空で e.key だけ届く
  if (menuBinding !== null) { e.preventDefault(); captureMenuKey(code); return; }
  if (core.bindingSlot !== null) { e.preventDefault(); captureKey(code); return; }
  if (core.phase === "playing") {
    const slot = core.slotOfKey(code);
    if (slot >= 0) { e.preventDefault(); if (!e.repeat) window.Trk.play.handleInput(core.slotLane(slot), e.timeStamp); return; }
  }
  if (core.phase !== "title") {
    if (e.code === "Backquote") { e.preventDefault(); if (!e.repeat) beginRetryHold(); return; }
    if (e.code === "Minus" || e.code === "Equal") { e.preventDefault(); nudgeLatency(e.code === "Equal" ? 5 : -5); return; }
  }
  const t = e.target;
  const typing = t && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" ||
    (t.tagName === "INPUT" && !["range", "checkbox", "file", "button", "color"].includes(t.type)));
  if (typing) return;
  if (code === core.settings.menuKey) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) requestMenuReturn(); return; }
  /* 📺 リモコンの「戻る」は機種によって Escape／BrowserBack／GoBack で届く（Backspace は入力欄のため除外） */
  if (code === "KeyP" || code === "Escape" || code === "BrowserBack" || code === "GoBack") {
    if (code === "Escape" && e.isTrusted && !e.repeat) escHoldStart();
    if (core.phase === "playing") { e.preventDefault(); window.Trk.play.pauseGame(); }
    else if (core.phase === "paused") { e.preventDefault(); window.Trk.play.resumeGame(); }
    else if (core.phase === "title" && core.screen === "settings" && code === "Escape") { e.preventDefault(); core.closeSettings(); }
    return;
  }
  if (e.code === "KeyF" && !e.repeat && !e.ctrlKey && !e.metaKey && core.slotOfKey("KeyF") < 0 && fullscreenSupported) toggleFullscreen();
});
addEventListener("keyup", e => { if (e.code === "Escape") escHoldCancel(); if (window.Trk.overlay.any()) return; if (e.code === "Backquote") cancelRetryHold(); });
addEventListener("blur", () => { cancelRetryHold(); escHoldCancel(); });

/* ---------- タッチ操作（MANUAL・TRUCK・ORBITの左右ボタン） ---------- */
document.querySelectorAll("#touchKeys button").forEach(b => {
  const up = () => b.classList.remove("down");
  b.addEventListener("pointerdown", e => {
    e.preventDefault(); b.classList.add("down"); poke();
    window.Trk.play.handleInput(core.slotLane(+b.dataset.slot), e.timeStamp);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => b.addEventListener(type, up));
});
core.$("touchKeys").addEventListener("contextmenu", e => e.preventDefault());

/* ---------- プレイ中、マウスを動かさなければ操作バーを隠す ---------- */
let idleTimer = 0;
function poke() {
  core.stage.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => core.stage.classList.add("idle"), 2200);
}
addEventListener("pointermove", poke);
addEventListener("pointerdown", poke);

/* ---------- 選曲画面 ---------- */
core.$("language").addEventListener("change", () => { core.applyLanguage(core.$("language").value); core.saveUserPrefs(); });
core.$("mediaFile").addEventListener("change", e => { const fs = Array.from(e.target.files || []); e.target.value = ""; window.Trk.library.addSongFiles(fs); });
/* 🎬 動画を読み込む：映像つきかどうかを確かめてから記録し、そのまま全画面で流す（library.js） */
core.$("videoFile").addEventListener("change", e => { const fs = Array.from(e.target.files || []); e.target.value = ""; window.Trk.library.addVideoFiles(fs); });
core.$("openSettingsBtn").addEventListener("click", core.openSettings);
core.$("closeSettingsBtn").addEventListener("click", core.closeSettings);

/* ---------- 🔍 設定の絞り込み（trk198） ----------
   設定は details 13個・入力104個まで増えたので、言葉で絞れるようにする。
   隠したものは全部覚えておき、空にしたら元の開閉状態へ戻す（勝手に閉じたままにしない）。
   見るのは画面の文字だけ（i18n の訳文もそのまま当たる）。 */
const setSearchSaved = new Map();          /* node → { hidden, open } */
function setSearchRestore() {
  for (const [node, st] of setSearchSaved) {
    node.hidden = st.hidden;
    if (st.open !== undefined) node.open = st.open;
  }
  setSearchSaved.clear();
}
function setSearchClear() {
  setSearchRestore();
  const box = core.$("settingsSearch"), status = core.$("settingsSearchStatus");
  if (box) box.value = "";
  if (status) status.textContent = "";
}
function applySettingsSearch() {
  const box = core.$("settingsSearch"), status = core.$("settingsSearchStatus");
  if (!box) return;
  const q = String(box.value || "").trim().toLowerCase();
  setSearchRestore();
  if (!q) { if (status) status.textContent = ""; return; }
  const remember = node => { if (!setSearchSaved.has(node)) setSearchSaved.set(node, { hidden: node.hidden, open: node.tagName === "DETAILS" ? node.open : undefined }); };
  const has = node => String(node.textContent || "").toLowerCase().includes(q);
  const panels = Array.from(document.querySelectorAll("#settingsScreen .grid details.panel"));
  let hits = 0;
  for (const panel of panels) {
    remember(panel);
    if (!has(panel)) { panel.hidden = true; panel.open = false; continue; }
    panel.hidden = false; panel.open = true;
    let found = 0;
    for (const sub of Array.from(panel.querySelectorAll("details.subPanel"))) {
      remember(sub);
      const hit = has(sub);
      sub.hidden = !hit;
      if (hit) { sub.open = true; found++; }
    }
    for (const row of Array.from(panel.children)) {
      if (row.tagName === "SUMMARY" || row.tagName === "DETAILS") continue;
      remember(row);
      const hit = has(row);
      row.hidden = !hit;
      if (hit) found++;
    }
    hits += found || 1;   /* 見出し（summary）だけが一致した欄も「1件」と数える */
  }
  if (status) status.textContent = hits ? tr("settingsSearchCount", { n:hits }) : tr("settingsSearchNoResults");
}
(() => {
  const box = core.$("settingsSearch");
  if (!box) return;
  let timer = 0;
  box.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(applySettingsSearch, 120); });
  box.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); setSearchClear(); box.blur(); } });
  /* 設定を閉じたら元に戻す（次に開いたとき、絞ったままにしない） */
  core.on("screen", id => { if (id !== "settings") setSearchClear(); });
  /* 言語を変えたら、いまの絞り込みを新しい言葉でやり直す */
  core.on("language", () => { if (String(box.value || "").trim()) applySettingsSearch(); });
})();

core.$("bpm").addEventListener("change", () => {
  const v = Number(core.$("bpm").value);
  if (v >= 60 && v <= 300) { if (!window.Trk.library.saveSongPrefs()) { core.settings.bpm = v; core.saveUserPrefs(); } }
  if (core.videoReady && core.chartMode === "generated") window.Trk.media.buildChart();
});
core.$("chartGen").addEventListener("change", () => {
  const value = core.$("chartGen").value;
  core.settings.chartGen = ["1", "2", "3", "4"].includes(value) ? value : "4";   // 譜面の作り方は全曲共通の設定（既定は Bタイプ＝方式4）
  core.settings.chartGenChosen = true;   // 自分で選んだ以上、アップデートで既定が変わっても、この選択を尊重する
  core.saveUserPrefs();
  if (core.videoReady && core.chartMode === "generated") window.Trk.media.buildChart();
});
core.$("offset").addEventListener("change", () => {
  const v = Number(core.$("offset").value);
  if (isFinite(v)) { if (!window.Trk.library.saveSongPrefs()) { core.settings.offset = Math.max(-5000, Math.min(5000, v)); core.saveUserPrefs(); } }
  if (core.videoReady && core.chartMode === "generated") window.Trk.media.buildChart();
});
let seedTimer = 0;
core.$("seed").addEventListener("input", () => {
  if (!window.Trk.library.saveSongPrefs()) { core.settings.seed = core.$("seed").value.slice(0, 32); core.saveUserPrefs(); }
  completeTutorialFromSeed();
  core.refreshSeedSecrets(); core.syncPickers();
  clearTimeout(seedTimer);
  seedTimer = setTimeout(() => {
    if (core.videoReady && core.chartMode === "generated") window.Trk.media.buildChart();
    else if (core.chart.length) { core.currentLevel = window.Trk.media.estimateLevel(core.chart); core.renderStatus("chartStatus"); }
  }, 300);
});

core.$("modePicker").addEventListener("click", e => {
  const b = e.target.closest("button[data-playmode]"); if (!b) return;
  core.settings.playMode = b.dataset.playmode; core.syncPickers(); core.saveUserPrefs(); core.emit("options");
});
core.$("difficultyPicker").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]"); if (!b || b.hidden) return;
  core.settings.difficulty = b.dataset.mode; core.syncPickers(); core.saveUserPrefs();
  core.setStatus("importStatus", null);
  if (core.videoReady) window.Trk.library.trySongChart().then(ok => { if (!ok) window.Trk.media.buildChart(); });   // パック・フォルダの譜面を優先
});

core.$("playBtn").addEventListener("click", window.Trk.play.startGame);
core.$("importChartBtn").addEventListener("click", () => core.$("chartImportFile").click());
core.$("regenerateChartBtn").addEventListener("click", () => { core.setStatus("importStatus", null); window.Trk.media.buildChart(); });
core.$("exportSelectBtn").addEventListener("click", () => window.Trk.media.exportChart("importStatus"));
core.$("chartImportFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (f && core.phase === "title") await window.Trk.media.importChartFile(f);
});

/* ---------- 設定画面：見た目 ---------- */
core.$("layoutPicker").addEventListener("click", e => {
  const b = e.target.closest("button[data-layout]"); if (!b) return;
  core.settings.layout = b.dataset.layout; core.syncPickers(); core.saveUserPrefs();
});
core.$("videoStyle").addEventListener("change", () => { core.settings.videoStyle = core.$("videoStyle").value; core.view.style.filter = core.videoFilter(); core.saveUserPrefs(); });
function showVideoZoom() { core.$("videoZoomVal").textContent = core.settings.videoZoom.toFixed(1) + "x"; }
core.$("videoZoom").addEventListener("input", e => { core.settings.videoZoom = Number(e.target.value) || 1; showVideoZoom(); core.saveUserPrefs(); });
/* 🔍 trk212：全画面表示の動画を、ホイール1回で何%拡大・縮小するか（2／5／10。既定5） */
function showVideoMaxWheelStep() {
  const sel = core.$("videoMaxWheelStep"), now = [2, 5, 10].includes(Number(core.settings.videoMaxWheelStep)) ? Number(core.settings.videoMaxWheelStep) : 5;
  if (sel) sel.value = String(now);
  core.settings.videoMaxWheelStep = now;
}
core.$("videoMaxWheelStep").addEventListener("change", e => {
  const v = Number(e.target.value);
  core.settings.videoMaxWheelStep = [2, 5, 10].includes(v) ? v : 5;
  core.saveUserPrefs();
});
core.$("scroll").addEventListener("input", () => {
  core.settings.scroll = Number(core.$("scroll").value) || 1;
  core.$("scrollVal").textContent = core.settings.scroll.toFixed(1) + "x"; core.saveUserPrefs();
});
function showFxPower() { core.$("fxPowerVal").textContent = Math.round(core.settings.fxPower * 100) + "%"; }
core.$("fxPower").addEventListener("input", e => { core.settings.fxPower = Number(e.target.value); showFxPower(); core.saveUserPrefs(); });
core.$("gameFxMode").addEventListener("change", e => { core.settings.gameFxMode = e.target.value; core.saveUserPrefs(); core.emit("options"); });
core.$("hideGameplayUI").addEventListener("change", e => { core.settings.hideGameplayUI = e.target.checked; core.saveUserPrefs(); });
core.$("helpText").addEventListener("change", e => { core.settings.helpText = e.target.checked; document.body.classList.toggle("helpTextOff", !core.settings.helpText); core.saveUserPrefs(); });
core.$("errorMeter").addEventListener("change", e => { core.settings.errorMeter = e.target.checked; core.saveUserPrefs(); });
core.$("playerMode").addEventListener("change", e => { core.settings.playerMode = e.target.checked; core.setPhase(core.phase); core.saveUserPrefs(); });

/* ---------- 設定画面：プレイオプション ---------- */
function syncOptionsUI() {
  core.$("countdown").checked = core.settings.countdown;
  core.$("shortMode").value = core.settings.shortMode;   /* 🕹️ ショートプレイ（後半だけ遊ぶ） */
  core.$("shortMode").addEventListener("change", e => {
    core.settings.shortMode = ["off", "90", "120", "180"].includes(e.target.value) ? e.target.value : "off";
    core.saveUserPrefs();
  });
  core.$("countdownSE").checked = core.settings.countdownSE;
  core.$("resumeCountdown").checked = core.settings.resumeCountdown;
  core.$("optHidden").checked = core.settings.hidden;
  core.$("optSudden").checked = core.settings.sudden;
  if (core.$("optMirror")) core.$("optMirror").checked = !!core.settings.modMirror;
  if (core.$("optRandom")) core.$("optRandom").checked = !!core.settings.modRandom;
  if (core.$("showMasterDiff")) core.$("showMasterDiff").checked = !!core.settings.showMasterDiff;
  if (core.$("swayAllModes")) core.$("swayAllModes").checked = !!core.settings.swayAllModes;
  if (core.$("escNoReturn")) core.$("escNoReturn").checked = !!core.settings.escNoReturn;
  if (core.$("judgeOrdered")) core.$("judgeOrdered").checked = !!core.settings.judgeOrdered;
  if (core.$("favQuickUnfreeze")) core.$("favQuickUnfreeze").checked = !!core.settings.favQuickUnfreeze;   /* ⭐ trk215 */
  if (core.$("mediaReloadOnExit")) core.$("mediaReloadOnExit").checked = !!core.settings.mediaReloadOnExit;   /* 🚪 trk206 */
  if (core.$("artWallpaperBg")) core.$("artWallpaperBg").checked = !!core.settings.artWallpaperBg;
  if (core.$("useStudyArtwork")) core.$("useStudyArtwork").checked = !!core.settings.useStudyArtwork;
  if (core.$("hideArtworkDuringChart")) core.$("hideArtworkDuringChart").checked = !!core.settings.hideArtworkDuringChart;
  core.$("rate").value = core.settings.rate;
  core.$("rateVal").textContent = core.settings.rate.toFixed(2) + "x";
  core.$("cover").value = core.settings.cover;
  core.$("coverVal").textContent = Math.round(core.settings.cover * 100) + "%";
  if (core.$("gameFxMode")) core.$("gameFxMode").value = core.settings.gameFxMode;
  core.syncPickers();
}
function optionsChanged() { core.saveUserPrefs(); syncOptionsUI(); core.emit("options"); }
[["countdown", "countdown"], ["countdownSE", "countdownSE"], ["resumeCountdown", "resumeCountdown"],
 ["optHidden", "hidden"], ["optSudden", "sudden"], ["optMirror", "modMirror"], ["optRandom", "modRandom"],
 ["swayAllModes", "swayAllModes"], ["escNoReturn", "escNoReturn"], ["judgeOrdered", "judgeOrdered"], ["favQuickUnfreeze", "favQuickUnfreeze"], ["mediaReloadOnExit", "mediaReloadOnExit"],
 ["artWallpaperBg", "artWallpaperBg"], ["useStudyArtwork", "useStudyArtwork"], ["hideArtworkDuringChart", "hideArtworkDuringChart"]].forEach(([id, key]) => {
  const el = core.$(id);
  if (el) el.addEventListener("change", e => { core.settings[key] = e.target.checked; optionsChanged(); });
});
const expCheck = core.$("showMasterDiff");
if (expCheck) {
  expCheck.addEventListener("change", e => {
    core.settings.showMasterDiff = e.target.checked;
    core.refreshSeedSecrets();
    optionsChanged();
    if (core.settings.showMasterDiff && typeof showToast === "function") window.Trk.play.showToast(tr("expertUnlocked"));
  });
}
const expToggle = core.$("expertDiffToggle");
if (expToggle) {
  expToggle.addEventListener("click", () => {
    core.settings.showMasterDiff = !core.settings.showMasterDiff;
    core.refreshSeedSecrets();
    optionsChanged();
    if (core.settings.showMasterDiff && typeof showToast === "function") window.Trk.play.showToast(tr("expertUnlocked"));
  });
}
core.$("judgePicker").addEventListener("click", e => {
  const b = e.target.closest("button[data-judge]"); if (!b) return;
  core.settings.judge = b.dataset.judge; optionsChanged();
});
/* 速度の上限（2.0x／3.0x）は speed.js が設定に合わせて決め直します */
core.$("rate").addEventListener("input", e => {
  core.settings.rate = Math.min(3, Math.max(.5, Math.round(Number(e.target.value) * 100) / 100)); optionsChanged();
});
core.$("cover").addEventListener("input", e => {
  core.settings.cover = Math.min(.7, Math.max(.2, Number(e.target.value))); optionsChanged();
});

/* ---------- 設定画面：操作 ---------- */
core.$("reverseHands").addEventListener("change", e => { core.settings.reverseHands = e.target.checked; core.updateKeyUI(); core.updateTouchKeys(); core.saveUserPrefs(); });
core.$("menuReturnKeyAssign").addEventListener("click", () => { menuBinding = 0; syncMenuKeyUI(); });
core.$("menuReturnConfirmCheck").addEventListener("change", e => { core.settings.menuConfirm = e.target.checked; core.saveUserPrefs(); });
core.$("helpText").checked = core.settings.helpText !== false;
core.$("helpText").dispatchEvent(new Event("change"));
syncMenuKeyUI();
core.$("latency").addEventListener("change", () => {
  const v = Number(core.$("latency").value);
  core.settings.latency = isFinite(v) ? Math.max(-300, Math.min(500, Math.round(v))) : 0;
  core.$("latency").value = core.settings.latency; core.saveUserPrefs();
});
document.querySelectorAll("[data-bind]").forEach(b => b.addEventListener("click", () => {
  core.bindingSlot = +b.dataset.bind; b.blur();
  core.setStatus("bindStatus", CAPTURE_KEYS[core.bindingSlot]); core.updateKeyUI();
}));
core.$("keyPresets").addEventListener("click", e => {
  const b = e.target.closest("button[data-keypreset]"); if (!b) return;
  const P = core.KEY_PRESETS[b.dataset.keypreset]; if (!P) return;
  core.settings.keys = P.keys.slice(); core.settings.subKeys = P.sub.slice(); core.bindingSlot = null;
  core.saveUserPrefs(); core.updateKeyUI(); core.updateTouchKeys();
  core.setStatus("bindStatus", "keysPresetDone", { name:tr(P.label) });
});

/* ---------- 設定画面：サウンド ---------- */
core.$("seEnabled").addEventListener("change", e => {
  core.settings.seEnabled = e.target.checked; core.saveUserPrefs();
  core.setStatus("seStatus", core.settings.seEnabled ? "seOn" : "seOff");
  if (core.settings.seEnabled) { const ac = window.Trk.media.getAC(); if (ac && ac.state === "suspended") ac.resume(); }
});
core.$("seVolume").addEventListener("input", e => { core.settings.seVolume = Number(e.target.value); core.saveUserPrefs(); });
core.$("donSeFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; window.Trk.media.loadSE(f, 0); });
core.$("kaSeFile").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; window.Trk.media.loadSE(f, 1); });
core.$("previewDonBtn").addEventListener("click", () => window.Trk.media.playSE(0, true));
core.$("previewKaBtn").addEventListener("click", () => window.Trk.media.playSE(1, true));
core.$("volume").addEventListener("input", e => { core.settings.musicVolume = Number(e.target.value); if (core.settings.musicVolume > 0) core.rememberMusicVolume(core.settings.musicVolume); core.video.volume = core.settings.musicVolume; core.saveUserPrefs(); });

/* ---------- プレイ中・一時停止・リザルト ---------- */
core.$("pauseBtn").addEventListener("click", window.Trk.play.pauseGame);
core.$("fullBtn").addEventListener("click", toggleFullscreen);
core.$("fullBtnTitle").addEventListener("click", toggleFullscreen);
core.$("resumeBtn").addEventListener("click", window.Trk.play.resumeGame);
core.$("retryBtn").addEventListener("click", window.Trk.play.startGame);
core.$("exportPauseBtn").addEventListener("click", () => window.Trk.media.exportChart("pauseStatus"));
core.$("returnTitleBtn").addEventListener("click", window.Trk.play.toTitle);
core.$("replayBtn").addEventListener("click", window.Trk.play.startGame);
core.$("exportEndBtn").addEventListener("click", () => window.Trk.media.exportChart("endStatus"));
core.$("endTitleBtn").addEventListener("click", window.Trk.play.toTitle);

/* ---------- 再生バー（AUTO中・練習中） ---------- */
const seekBar = core.$("seekBar");
seekBar.addEventListener("pointerdown", () => { core.seekDragging = true; });
addEventListener("pointerup", () => { core.seekDragging = false; });
seekBar.addEventListener("change", () => { core.seekDragging = false; });
seekBar.addEventListener("input", () => {
  if (core.videoReady && (core.phase === "playing" || core.phase === "paused")) window.Trk.play.seekTo(seekBar.value / 1000 * core.video.duration);
});

/* ---------- 動画の再生合図（終端・pause は game.js が共通処理） ---------- */
core.video.addEventListener("play", () => { if (core.phase === "paused") { core.showScreen(null); core.setPhase("playing"); poke(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && core.phase === "playing") window.Trk.play.pauseGame(); });

/* ---------- ドラッグ＆ドロップ（.stpack は custom.js、.vrm/.vrma は vrm.js が先に受け取ります） ---------- */
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", async e => {
  e.preventDefault();
  const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
  if (!files.length || core.phase !== "title") return;
  const json = files.find(f => /\.json$/i.test(f.name) || f.type === "application/json");
  if (json) { await window.Trk.media.importChartFile(json); return; }
  /* 🎬 trk203：画面にドロップした動画も「🎬 動画を読み込む」と同じ道を通す。
     いままでは全部 addSongFiles に渡していて、映像の下調べ（videoWidth）を通らず
     .mkv/.mpg が音として扱われていた。映像らしいものだけ addVideoFiles へ分ける。 */
  const lib = window.Trk.library;
  const videoExts = Array.isArray(lib.VIDEO_EXT) ? lib.VIDEO_EXT : [];
  const isVideoish = f => /^video\//i.test((f && f.type) || "") || videoExts.includes(core.extOf((f && f.name) || ""));
  const vids = files.filter(isVideoish);
  const songs = files.filter(f => !isVideoish(f));
  if (songs.length) await lib.addSongFiles(songs);
  /* ドロップでは全画面ビューアを勝手に開かない（一覧に足すだけ。開くのは 🎬 ボタンから） */
  if (vids.length) await lib.addVideoFiles(vids, { openViewer:false });
});

/* ============ 起動 ============ */
core.$("bpm").value = core.settings.bpm;
core.$("offset").value = core.settings.offset;
core.$("seed").value = core.settings.seed;
core.$("chartGen").value = core.settings.chartGen;
core.$("hideGameplayUI").checked = core.settings.hideGameplayUI;
core.$("errorMeter").checked = core.settings.errorMeter;
core.$("playerMode").checked = core.settings.playerMode;
core.$("reverseHands").checked = core.settings.reverseHands;
core.$("seEnabled").checked = core.settings.seEnabled;
core.$("seVolume").value = core.settings.seVolume;
core.$("volume").value = core.settings.musicVolume;
core.$("scroll").value = core.settings.scroll;
core.$("scrollVal").textContent = core.settings.scroll.toFixed(1) + "x";
core.$("latency").value = core.settings.latency;
core.$("videoStyle").value = core.settings.videoStyle;
core.$("videoZoom").value = core.settings.videoZoom;
showVideoZoom();
showVideoMaxWheelStep();
core.$("fxPower").value = core.settings.fxPower;
core.$("gameFxMode").value = core.settings.gameFxMode;
core.video.volume = core.settings.musicVolume;
/* 再生速度を変えても音程を保つ（初期値でもオンですが、念のため） */
core.video.preservesPitch = true; core.video.mozPreservesPitch = true; core.video.webkitPreservesPitch = true;
if (!fullscreenSupported) { core.$("fullBtn").hidden = true; core.$("fullBtnTitle").hidden = true; }

core.applySkin(core.settings.skin, false);
core.applyLanguage(core.settings.language);
syncTutorialUI();
window.Trk.custom.syncNoteUI(); showFxPower(); window.Trk.custom.updateMascotUI(); syncOptionsUI();
core.setStatus("seStatus", core.settings.seEnabled ? "seOn" : "seDefault");
core.setStatus("songPrefsStatus", "songPrefsHint");
core.setPhase("title");
core.showScreen("selectScreen");
core.updateChartButtons();
core.emit("options");
core.saveUserPrefs();
requestAnimationFrame(window.Trk.play.loop);

/* パックを戻してから曲リストを作る（vrm.js も packsReady を待ちます） */
const packsReady = window.Trk.custom.initPacks().catch(e => console.error(e));
packsReady.then(() => window.Trk.library.initLibrary()).catch(e => console.error(e));

/* PWA：オフラインでも開けるようにする（HTTPS か localhost のときだけ）。
   キャッシュの整理は sw.js が trk- で始まる名前だけを消すので、ほかのサイトに影響しません。 */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache:"none" })
    .catch(() => { /* オフライン用のキャッシュが無くても、ゲームはそのまま遊べます */ });
}
/* ✅ main.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.RESERVED = RESERVED;
Object.defineProperty(window, "idleTimer", { configurable:true, get:() => idleTimer, set:v => { idleTimer = v; } });
window.packsReady = packsReady;
window.poke = poke;
window.showFxPower = showFxPower;
window.syncOptionsUI = syncOptionsUI;
/* 領域（window.Trk.main）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.main = Object.assign(window.Trk.main || {}, { RESERVED, packsReady, poke, showFxPower, syncOptionsUI });
Object.defineProperty(window.Trk.main, "idleTimer", { configurable:true, get:() => idleTimer, set:v => { idleTimer = v; } });
})();

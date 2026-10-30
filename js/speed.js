// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk!：⏩ 再生速度（選曲画面のパネル・速度変更キー） ============
   ・PLAYボタンの下（Import／Exportの上）に、速度のボタン・バーを表示
     表示：ボタン（初期値）／バー／ボタン＋バー／非表示（いつも1.00x）。2.0x・3.0xは設定で追加
   ・速度変更キー（初期値 [ と ]）。選曲画面・プレイ中・一時停止中に使える。幅は 0.01／0.1／0.25
   ・曲の途中で速度を変えたプレイは練習扱い（やり直すとその速度で記録）
   ※ main.js の後に読み込んでください。 */
"use strict";
(() => {
  const core = window.Trk.core;
/* ---------- 文章 ---------- */
Object.assign(TEXT.ja, {
  speedTitle:"⏩ 再生速度", speedNoteNormal:"1.00x：通常のハイスコア",
  speedNoteRecord:"この速度のハイスコアと「🏁 最高クリア速度」が別に残ります",
  speedNotePractice:"1.00x未満は練習扱い（記録には残りません）",
  speedPanelLabel:"選曲画面の速度パネル", speedPanelButtons:"ボタン", speedPanelBar:"バー",
  speedPanelBoth:"ボタン＋バー", speedPanelHidden:"非表示（いつも1.00x）", speedExtra:"2.0x・3.0x も使う",
  speedKeysTitle:"⏩ 速度の変更キー", speedDown:"遅くする", speedUp:"速くする", speedStepLabel:"1回で変わる幅",
  stepFine:"0.01x（細かく）", stepNormal:"0.1x", stepBig:"0.25x（大きく）",
  speedKeysHint:"選曲画面・プレイ中・一時停止中に使えます。押し続けると続けて変わります。曲の途中で速度を変えたプレイは練習扱いです（` 長押しや「↻ 最初から」でやり直すと、その速度で記録されます）。",
  speedKeyHint:"{down}／{up} キーで {step}x ずつ変更（一時停止中も可）",
  speedCapture0:"「遅くする」に割り当てるキーを押してください。ESCでキャンセル。",
  speedCapture1:"「速くする」に割り当てるキーを押してください。ESCでキャンセル。",
  speedAssigned:"速度の変更キーを設定しました。", speedToast:"⏩ {r}",
  speedMidNote:"途中で速度を変えたので、このプレイは練習扱いです（やり直すと記録されます）"
});
Object.assign(TEXT.en, {
  speedTitle:"⏩ Playback speed", speedNoteNormal:"1.00x: normal high score",
  speedNoteRecord:"A separate high score and “🏁 best clear speed” are kept for this speed",
  speedNotePractice:"Below 1.00x counts as practice (not recorded)",
  speedPanelLabel:"Speed panel on song select", speedPanelButtons:"Buttons", speedPanelBar:"Slider",
  speedPanelBoth:"Buttons + slider", speedPanelHidden:"Hidden (always 1.00x)", speedExtra:"Also use 2.0x and 3.0x",
  speedKeysTitle:"⏩ Speed keys", speedDown:"Slower", speedUp:"Faster", speedStepLabel:"Step per press",
  stepFine:"0.01x (fine)", stepNormal:"0.1x", stepBig:"0.25x (big)",
  speedKeysHint:"Works on song select, during play and while paused. Hold to keep changing. Changing speed mid-song makes the run practice (retry with ` or “↻ Restart” to record at the new speed).",
  speedKeyHint:"{down} / {up} change speed by {step}x (also while paused)",
  speedCapture0:"Press a key for “Slower”. ESC cancels.", speedCapture1:"Press a key for “Faster”. ESC cancels.",
  speedAssigned:"Speed key assigned.", speedToast:"⏩ {r}",
  speedMidNote:"Speed changed mid-song, so this run is practice (retry to record it)"
});
Object.assign(TEXT.zh, {
  speedTitle:"⏩ 播放速度", speedNoteNormal:"1.00x：普通最高分",
  speedNoteRecord:"会单独记录此速度的最高分和“🏁 最高通关速度”",
  speedNotePractice:"低于1.00x视为练习（不记录）",
  speedPanelLabel:"选曲画面的速度面板", speedPanelButtons:"按钮", speedPanelBar:"滑块",
  speedPanelBoth:"按钮＋滑块", speedPanelHidden:"隐藏（始终1.00x）", speedExtra:"也使用 2.0x·3.0x",
  speedKeysTitle:"⏩ 变速按键", speedDown:"减速", speedUp:"加速", speedStepLabel:"每次变化幅度",
  stepFine:"0.01x（精细）", stepNormal:"0.1x", stepBig:"0.25x（大幅）",
  speedKeysHint:"可在选曲画面、游戏中、暂停中使用。按住会连续变化。曲中途变速的游玩视为练习（用 ` 长按或“↻ 重新开始”重来即可按新速度记录）。",
  speedKeyHint:"{down}／{up} 键每次改变 {step}x（暂停中也可）",
  speedCapture0:"请按下“减速”的按键。ESC取消。", speedCapture1:"请按下“加速”的按键。ESC取消。",
  speedAssigned:"已设置变速按键。", speedToast:"⏩ {r}",
  speedMidNote:"中途变速，本次游玩视为练习（重来即可记录）"
});
Object.assign(TEXT.ko, {
  speedTitle:"⏩ 재생 속도", speedNoteNormal:"1.00x: 일반 최고 점수",
  speedNoteRecord:"이 속도의 최고 점수와 '🏁 최고 클리어 속도'가 따로 남습니다",
  speedNotePractice:"1.00x 미만은 연습 취급 (기록되지 않음)",
  speedPanelLabel:"곡 선택 화면의 속도 패널", speedPanelButtons:"버튼", speedPanelBar:"바",
  speedPanelBoth:"버튼＋바", speedPanelHidden:"숨기기 (항상 1.00x)", speedExtra:"2.0x·3.0x도 사용",
  speedKeysTitle:"⏩ 속도 변경 키", speedDown:"느리게", speedUp:"빠르게", speedStepLabel:"한 번에 바뀌는 폭",
  stepFine:"0.01x (세밀하게)", stepNormal:"0.1x", stepBig:"0.25x (크게)",
  speedKeysHint:"곡 선택 화면·플레이 중·일시정지 중에 쓸 수 있습니다. 누르고 있으면 계속 바뀝니다. 곡 도중에 속도를 바꾼 플레이는 연습 취급입니다 (` 길게 누르기나 '↻ 다시 시작'으로 다시 하면 그 속도로 기록됩니다).",
  speedKeyHint:"{down}／{up} 키로 {step}x씩 변경 (일시정지 중에도 가능)",
  speedCapture0:"'느리게'로 지정할 키를 누르세요. ESC로 취소.", speedCapture1:"'빠르게'로 지정할 키를 누르세요. ESC로 취소.",
  speedAssigned:"속도 변경 키를 설정했습니다.", speedToast:"⏩ {r}",
  speedMidNote:"곡 도중에 속도를 바꿔서 이번 플레이는 연습 취급입니다 (다시 하면 기록됩니다)"
});

/* ---------- 設定 ---------- */
const SPEED_BASE = [.75, 1, 1.3, 1.5], SPEED_EXTRA = [2, 3];
core.settings.speedPanel = core.pick(core.prefs.speedPanel, ["buttons", "bar", "both", "hidden"], "buttons");
core.settings.speedExtra = !!core.prefs.speedExtra;
core.settings.speedStep = core.pick(core.prefs.speedStep, ["0.01", "0.1", "0.25"], "0.1");
core.settings.speedKeys = (Array.isArray(core.prefs.speedKeys) && core.prefs.speedKeys.length === 2 && core.prefs.speedKeys.every(core.validCode) && core.prefs.speedKeys[0] !== core.prefs.speedKeys[1])
  ? core.prefs.speedKeys.slice() : ["BracketLeft", "BracketRight"];
const maxRate = () => core.settings.speedExtra ? 3 : 2;
core.settings.rate = Math.min(maxRate(), core.settings.rate);
if (core.settings.speedPanel === "hidden") core.settings.rate = 1;
const i18nNow = root => root.querySelectorAll("[data-i18n]").forEach(n => { n.textContent = tr(n.dataset.i18n); });
const fmtRate = r => r.toFixed(2).replace(/0$/, "") + "x";       // 0.75x / 1.0x / 1.3x
const keyHintText = () => tr("speedKeyHint", { down:core.formatKey(core.settings.speedKeys[0]), up:core.formatKey(core.settings.speedKeys[1]), step:core.settings.speedStep });

/* ---------- 選曲画面のパネル ---------- */
const panel = core.el("section", "panel"); panel.id = "speedPanel";
const head = core.el("div", "libHead"), title = core.el("h3"), val = core.el("b", "mono");
title.dataset.i18n = "speedTitle"; title.style.margin = "0"; head.append(title, val);
const seg = core.el("div", "seg"); seg.id = "speedButtons"; seg.style.marginTop = "8px";
const barRow = core.el("div", "inline tight"), bar = document.createElement("input");
bar.type = "range"; bar.min = "0.5"; bar.step = "0.01"; bar.style.flex = "1"; barRow.append(bar);
const note = core.el("div", "hint"), keyNote = core.el("div", "hint");
panel.append(head, seg, barRow, note, keyNote);
core.$("playBtn").after(panel);

/* 一時停止画面に、今の速度とキーを表示 */
const pauseLine = core.el("div", "hint status");
core.$("pauseScreen").querySelector("p").after(pauseLine);

/* ---------- 速度の変更 ---------- */
let runRate = null;   // このプレイを始めたときの速度
function setRate(r) {
  r = Math.min(maxRate(), Math.max(.5, Math.round(Number(r) * 100) / 100));
  if (!isFinite(r)) return;
  core.settings.rate = r; core.saveUserPrefs();
  if (core.phase === "title" && !core.video.paused) core.video.playbackRate = r;   // プレビューにもすぐ反映
  window.Trk.main.syncOptionsUI(); core.emit("options");
}
function stepRate(dir) {
  if (core.settings.speedPanel === "hidden") return;
  const s = Number(core.settings.speedStep), r = core.settings.rate;
  let nr = dir > 0 ? Math.floor(r / s + 1e-6) * s + s : Math.ceil(r / s - 1e-6) * s - s;   // きりのいい数字にそろえる
  nr = Math.min(maxRate(), Math.max(.5, Math.round(nr * 100) / 100));
  if (Math.abs(nr - r) < .001) return;
  setRate(nr);
  if (core.phase === "playing") {
    if (window.Trk.play.leadIn && !window.Trk.play.leadIn.resume) runRate = nr;                 // 曲が始まる前のカウント中は、記録に影響しない
    else {
      if (!window.Trk.play.leadIn && !core.video.paused) core.video.playbackRate = nr;
      if (Math.abs(nr - runRate) > .001) core.practice = true;       // 途中で速度を変えた → 練習扱い
    }
    window.Trk.play.showToast(tr("speedToast", { r:nr.toFixed(2) + "x" }) + (core.practice && !core.settings.autoPlay ? " · " + tr("practice") : ""));
  }
}
core.on("beforePlay", () => { runRate = core.settings.rate; });
core.on("phase", p => {   // 一時停止から違う速度で戻ったら練習扱い（開始前のカウント中に止めていた場合は除く）
  if (p !== "playing" || runRate == null || Math.abs(core.settings.rate - runRate) < .001) return;
  if (window.Trk.play.pausedInLeadIn) runRate = core.settings.rate; else core.practice = true;
});

function renderSpeed() {
  const mode = core.settings.speedPanel, list = core.settings.speedExtra ? [...SPEED_BASE, ...SPEED_EXTRA] : SPEED_BASE;
  panel.hidden = mode === "hidden";
  seg.hidden = mode === "bar"; barRow.hidden = mode === "buttons";
  seg.textContent = "";
  for (const r of list) {
    const b = core.el("button", "", fmtRate(r)); b.type = "button";
    const onFlag = Math.abs(r - core.settings.rate) < .001;
    b.classList.toggle("selected", onFlag); b.setAttribute("aria-pressed", onFlag);
    b.addEventListener("click", () => setRate(r));
    seg.append(b);
  }
  bar.max = String(maxRate()); bar.value = core.settings.rate;
  val.textContent = core.settings.rate.toFixed(2) + "x";
  note.textContent = tr(core.settings.rate < 1 ? "speedNotePractice" : core.settings.rate > 1 ? "speedNoteRecord" : "speedNoteNormal");
  keyNote.textContent = keyHintText();
  const rs = core.$("rate");                                            // 設定画面の速度バー
  if (rs) { rs.max = String(maxRate()); rs.step = "0.01"; rs.disabled = mode === "hidden"; }
  pauseLine.hidden = mode === "hidden";
  pauseLine.textContent = `${tr("speedTitle")} ${core.settings.rate.toFixed(2)}x · ${keyHintText()}`
    + (core.phase === "paused" && runRate != null && Math.abs(core.settings.rate - runRate) > .001 ? ` · ${tr("speedMidNote")}` : "");
}
bar.addEventListener("input", e => setRate(e.target.value));
core.on("options", renderSpeed);
core.on("language", renderSpeed);
core.on("phase", renderSpeed);

/* 設定画面の速度バー：main.js の処理のあとに、上限を2.0x／3.0xに合わせて決め直す */
core.$("rate").addEventListener("input", e => setRate(e.target.value));
/* 選曲中のプレビューも、選んだ速度で流す */
core.video.addEventListener("play", () => { if (core.phase === "title") core.video.playbackRate = core.settings.rate; });

/* ---------- 速度変更キー ---------- */
let speedBinding = null;   // 0＝遅くする、1＝速くする
function syncOrbitIgnore(oldKeys) {   // ORBIT の「どのキーでもOK」から、速度キーを外す
  (oldKeys || []).forEach(k => { if (!["Backquote", "Minus", "Equal", "KeyP", "Escape", "Tab"].includes(k)) window.Trk.modes.ORBIT_IGNORE.delete(k); });
  core.settings.speedKeys.forEach(k => window.Trk.modes.ORBIT_IGNORE.add(k));
}
syncOrbitIgnore();
function usedKeys() {
  const list = [...core.settings.keys, ...core.settings.subKeys, ...window.Trk.modes.truckPosKeys(), ...TRUCK_PRESETS.ud, ...TRUCK_PRESETS.lr,
    ...window.Trk.modes.stageKeys(), ...window.Trk.modes.catchAllKeys(), ...(core.settings.skipKeys || []), "KeyR"];
  if (core.settings.truckToggleKey) list.push(core.settings.truckToggleKey);
  return list.filter(Boolean);
}
function captureSpeedKey(code) {
  const slot = speedBinding;
  if (code === "Escape") { speedBinding = null; core.setStatus("speedBindStatus", "cancelBind"); syncSpeedKeyUI(); return; }
  if (window.Trk.main.RESERVED.has(code)) { core.setStatus("speedBindStatus", "reservedKey"); return; }
  if (usedKeys().includes(code) || core.settings.speedKeys[1 - slot] === code) { core.setStatus("speedBindStatus", "duplicateKey"); return; }
  const old = core.settings.speedKeys.slice();
  core.settings.speedKeys[slot] = code; speedBinding = null; core.saveUserPrefs();
  syncOrbitIgnore(old);
  core.setStatus("speedBindStatus", "speedAssigned"); syncSpeedKeyUI(); renderSpeed();
}
addEventListener("keydown", e => {
  if (window.Trk.overlay.any()) return;
  if (speedBinding !== null) { e.preventDefault(); e.stopImmediatePropagation(); captureSpeedKey(e.code); return; }
  if (core.bindingSlot !== null || window.Trk.modes.truckBinding !== null || window.Trk.modes.stageBinding !== null) return;
  const i = core.settings.speedKeys.indexOf(e.code); if (i < 0) return;
  if (core.phase === "playing" && core.slotOfKey(e.code) >= 0) return;      // 叩くキーと同じなら、叩くほうを優先
  const t = e.target;
  if (t && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" ||
    (t.tagName === "INPUT" && !["range", "checkbox", "button", "color", "file"].includes(t.type)))) return;
  e.preventDefault(); e.stopImmediatePropagation();
  stepRate(i ? 1 : -1);                                            // 押し続けると続けて変わる
}, true);

/* ---------- 設定画面 ---------- */
/* 🎯 プレイオプション：速度パネルの表示 */
const rateHint = document.querySelector('#settingsScreen [data-i18n="rateHint"]');
if (rateHint) {
  const label = window.Trk.modes.hintEl("speedPanelLabel");
  const pSeg = window.Trk.modes.makeSeg("speedPanelPicker", "speedPanel",
    [["buttons", "speedPanelButtons"], ["bar", "speedPanelBar"], ["both", "speedPanelBoth"], ["hidden", "speedPanelHidden"]]);
  const extra = window.Trk.modes.makeCheck("speedExtra", "speedExtra", "speedExtra");
  pSeg.addEventListener("click", () => { if (core.settings.speedPanel === "hidden") setRate(1); else renderSpeed(); });
  extra.querySelector("input").addEventListener("change", () => { if (core.settings.rate > maxRate()) setRate(maxRate()); else renderSpeed(); });
  rateHint.after(label, pSeg, extra);
}
/* ⌨ 操作：速度の変更キー */
let syncSpeedKeyUI = () => {};
const truckHint = document.querySelector('#settingsScreen [data-i18n="truckCtlHint"]');
if (truckHint) {
  const h3 = core.el("h3", "", tr("speedKeysTitle")); h3.dataset.i18n = "speedKeysTitle";
  const rows = core.el("div", "keyRows"); rows.style.marginTop = "10px";
  const values = [];
  ["speedDown", "speedUp"].forEach((key, i) => {
    const row = core.el("div", "keyRow"), name = core.el("strong", "", tr(key)), v = core.el("span", "keyValue"), b = core.el("button", "", tr("assign"));
    name.dataset.i18n = key; b.type = "button"; b.dataset.i18n = "assign"; b.dataset.speedbind = i;
    b.addEventListener("click", () => {
      core.bindingSlot = null; core.updateKeyUI();
      if (window.Trk.modes.truckBinding !== null) { window.Trk.modes.truckBinding = null; window.Trk.modes.syncTruckKeyUI(); }
      speedBinding = i; b.blur();
      core.setStatus("speedBindStatus", "speedCapture" + i); syncSpeedKeyUI();
    });
    row.append(name, v, b); rows.append(row); values.push(v);
  });
  const stepSeg = window.Trk.modes.makeSeg("speedStepPicker", "speedStep", [["0.01", "stepFine"], ["0.1", "stepNormal"], ["0.25", "stepBig"]]);
  stepSeg.addEventListener("click", renderSpeed);
  const status = core.el("div", "hint status"); status.id = "speedBindStatus";
  /* STAGE・CATCHのキー設定（stage.js・catch.js が truckCtlHint の直後に入れたもの）の後ろに並べる */
  let anchor = truckHint;
  for (const id of ["stageBindStatus", "catchBindStatus"]) { const n = core.$(id); if (n) anchor = n.nextElementSibling && n.nextElementSibling.dataset.i18n === "catchHint" ? n.nextElementSibling : n; }
  anchor.after(h3, rows, window.Trk.modes.hintEl("speedStepLabel"), stepSeg, status, window.Trk.modes.hintEl("speedKeysHint"));
  syncSpeedKeyUI = () => {
    values.forEach((v, i) => { v.textContent = core.formatKey(core.settings.speedKeys[i]); });
    rows.querySelectorAll("[data-speedbind]").forEach(b => b.classList.toggle("listening", speedBinding === +b.dataset.speedbind));
  };
  document.querySelectorAll("[data-bind], [data-truckbind]").forEach(b => b.addEventListener("click", () => {
    if (speedBinding !== null) { speedBinding = null; syncSpeedKeyUI(); }
  }));
  syncSpeedKeyUI();
}

i18nNow(panel);
window.Trk.main.syncOptionsUI(); core.emit("options");
})();
/* ✅ speed.js 完了 */

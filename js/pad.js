(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：🎮 ゲームパッド・コントローラー・TVリモコン（入力デバイス） ============
   ・Gamepad API を rAF で見張り、割り当て（settings.padLeft など）に「パッドのボタン／軸」を
     直接つなぎます。ボタン＝"b0"、軸＝"a0+"（＋方向）／"a0-"（−方向）で、スティック・
     D-pad（軸で届く機種）・アケコンのレバーも同じ形で扱えます。
   ・プレイ中はノーツ（左／右）と一時停止。判定は音声の時計なので、パッドでもズレません。
     タイトル・選曲・設定では、D-pad／スティック＝メニュー移動、決定＝押す、戻る＝ESC と同じ。
   ・TVリモコンは、この端末ではキーボード（← → ↑ ↓・Enter・Back）として届きます。
     すぐ上の「⌨ 操作」のキー割り当てがそのままリモコンにも効きます（メディアキーも可）。
   ・追加の読み込みはありません。パッドを抜き差ししても設定は保存されたままです。 */
"use strict";

/* ---------- 決まりごと ---------- */
const PAD_ACTIONS = ["left", "right", "confirm", "back", "pause"];          // 割り当てる操作
const PAD_AXIS_ON = .6;                                                     // 軸を「押した」とみなす量
const PAD_REPEAT_MS = 260, PAD_REPEAT_FIRST = 380;                          // 押しっぱなしでメニューを連続移動
const PAD_PRESETS = {                                                       // ノーツキーのまとめ設定
  ab:    { left:"b0",  right:"b1"  },                                       // Xbox A／B・PS ×／○
  dpad:  { left:"b14", right:"b15" },                                       // D-pad ← →
  stick: { left:"a0-", right:"a0+" }                                        // 左スティック ← →
};
const PAD_PRESET_KEYS = { ab:"padPresetAB", dpad:"padPresetDpad", stick:"padPresetStick" };
const PAD_FOCUS_SEL = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PAD_DIR_BINDS = {                                                     // メニュー移動（ボタン＋軸＋ハット）
  left:  ["b14", "a0-", "a4-", "a9-"],
  right: ["b15", "a0+", "a4+", "a9+"],
  up:    ["b12", "a1-", "a5-", "a10-"],
  down:  ["b13", "a1+", "a5+", "a10+"]
};

const padSettingOf = id => "pad" + id[0].toUpperCase() + id.slice(1);        // left → padLeft
const padActKey = id => "padAct" + id[0].toUpperCase() + id.slice(1);        // left → padActLeft
let padBinding = null;                                                      // 割り当て待ちの操作（null＝待っていない）
let padMsg = "", padMsgAt = 0;                                              // 一時的な案内（接続の表示より優先）
const padSeen = new Map();                                                  // pad.index → 前フレームの状態
let padCount = 0;

/* ---------- パッドを読む ---------- */
const padList = () => (typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads()).filter(p => p && p.connected) : []);
const padAxisVal = (pad, i) => { const v = (pad.axes || [])[i]; return Number.isFinite(v) ? v : 0; };
const padBtnOn = b => !!b && (b.pressed === true || (Number.isFinite(b.value) && b.value > .5));
/* 割り当て（"b0"／"a0+"）はいま押されているか */
function padBindOn(pad, bind) {
  if (!core.validPadBind(bind)) return false;
  if (bind[0] === "b") return padBtnOn((pad.buttons || [])[+bind.slice(1)]);
  const v = padAxisVal(pad, +bind.slice(1, -1));
  return bind.endsWith("+") ? v > PAD_AXIS_ON : v < -PAD_AXIS_ON;
}
/* 押した瞬間の生の値："b3" / "a0+" / "a0-"（前フレームで押されていなかったものだけ） */
function padRawEdges(pad, s) {
  const out = [];
  const btns = pad.buttons || [], axes = pad.axes || [];
  for (let i = 0; i < btns.length; i++) {
    const on = padBtnOn(btns[i]);
    if (on && !s.buttons[i]) out.push("b" + i);
    s.buttons[i] = on;
  }
  for (let i = 0; i < axes.length; i++) {
    const v = Number.isFinite(axes[i]) ? axes[i] : 0, neg = v < -PAD_AXIS_ON, pos = v > PAD_AXIS_ON;
    if (neg && !s.axes[i * 2]) out.push("a" + i + "-");
    if (pos && !s.axes[i * 2 + 1]) out.push("a" + i + "+");
    s.axes[i * 2] = neg; s.axes[i * 2 + 1] = pos;
  }
  return out;
}
/* pad.index ごとの前フレーム（ボタン数・軸数が変わったら作り直す＝ホットスワップ対応） */
function padStateOf(pad) {
  let s = padSeen.get(pad.index);
  if (!s || s.buttons.length !== (pad.buttons || []).length || s.axes.length !== (pad.axes || []).length * 2) {
    s = { buttons:new Array((pad.buttons || []).length).fill(false), axes:new Array((pad.axes || []).length * 2).fill(false), dirs:{} };
    padSeen.set(pad.index, s);
  }
  return s;
}

/* ---------- 割り当て ---------- */
function padAssign(id, bind) {
  if (!core.validPadBind(bind)) return false;
  core.settings[padSettingOf(id)] = bind;
  padBinding = null; core.saveUserPrefs(); updatePadUI();
  padNote("padBindSet", { name:tr(padActKey(id)), v:core.formatPadBind(bind) });
  return true;
}
function padNote(id, vars) {
  padMsg = tr(id, vars); padMsgAt = performance.now();
  updatePadUI();
  try { window.Trk.play.showToast(padMsg); } catch (_) {}
}
const padClearMsg = () => { if (!padMsg) return; padMsg = ""; updatePadUI(); };

/* ---------- メニューの移動（D-pad／スティック）・決定・戻る ---------- */
/* 🎮 を使ってよい場面か（プレイ中と、書斎・プレーヤー・シンセが開いている間はメニュー操作をしない） */
const padMenuOk = () => core.settings.padMenuNav && core.phase !== "playing" &&
  !window.Trk.overlay.any();

function padFocusables() {
  const all = [...document.querySelectorAll(PAD_FOCUS_SEL)].filter(n => !n.closest("[hidden]") && n.getAttribute("aria-hidden") !== "true");
  const visible = all.filter(n => n.offsetWidth || n.offsetHeight || n.getClientRects().length);
  return visible.length ? visible : all;      // レイアウトが取れない環境（検査用）ではDOM順に動く
}
function padFocusNode(n) {
  if (!n) return;
  try { n.focus({ preventScroll:true }); } catch (_) { try { n.focus(); } catch (_) {} }
  try { n.scrollIntoView({ block:"nearest", inline:"nearest" }); } catch (_) {}
}
function padMoveFocus(dir) {
  const list = padFocusables(); if (!list.length) return;
  const cur = document.activeElement, i = list.indexOf(cur);
  if (i < 0) { padFocusNode(list[0]); return; }        // まだ何も選ばれていない → 先頭から
  const rectsOk = list.some(n => n.getBoundingClientRect().width > 0 || n.getBoundingClientRect().height > 0);
  if (!rectsOk) {                                      // 座標が取れないときはDOM順（前＝左／上）
    const step = (dir === "left" || dir === "up") ? -1 : 1;
    padFocusNode(list[(i + step + list.length) % list.length]); return;
  }
  const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  let best = null, bestScore = Infinity;
  for (const n of list) {
    if (n === cur) continue;
    const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    let along, cross;
    if (dir === "left") { if (x >= cx - 1) continue; along = cx - x; cross = Math.abs(y - cy); }
    else if (dir === "right") { if (x <= cx + 1) continue; along = x - cx; cross = Math.abs(y - cy); }
    else if (dir === "up") { if (y >= cy - 1) continue; along = cy - y; cross = Math.abs(x - cx); }
    else { if (y <= cy + 1) continue; along = y - cy; cross = Math.abs(x - cx); }
    const score = along + cross * 2;
    if (score < bestScore) { bestScore = score; best = n; }
  }
  if (best) padFocusNode(best);
}
function padDispatchKey(code) {
  try { window.dispatchEvent(new KeyboardEvent("keydown", { code, key:code === "Escape" ? "Escape" : code === "Enter" ? "Enter" : code, bubbles:true, cancelable:true })); }
  catch (_) { try { window.dispatchEvent(new Event("keydown")); } catch (_) {} }
}
/* 決定：いま選ばれているボタンを押す（何も選ばれていなければ先頭を選んで押す） */
function padActivate() {
  const usable = n => n && n !== document.body && n !== document.documentElement && !n.disabled && typeof n.click === "function";
  let el = document.activeElement;
  if (!usable(el)) { padMoveFocus("right"); el = document.activeElement; }
  if (usable(el)) { try { el.click(); return; } catch (_) {} }
  padDispatchKey("Enter");
}
const padBack = () => padDispatchKey("Escape");       // 戻る＝ESC と同じ（一時停止・設定を閉じる・戻る）

/* ---------- 叩く ---------- */
function padTap(slot) {
  const lane = core.slotLane(slot), p = performance.now();
  try {
    if (core.settings.playMode === "stage" && typeof stageInput === "function") { window.Trk.modes.stageInput(lane, p); return; }
    if (core.settings.playMode === "catch" && typeof catchState !== "undefined" && window.Trk.modes.catchState.held) {
      window.Trk.modes.catchState.held[lane] = true; setTimeout(() => { window.Trk.modes.catchState.held[lane] = false; }, 140); return;   // 🚛 は一瞬だけ倒す
    }
  } catch (_) {}
  if (typeof handleInput === "function") window.Trk.play.handleInput(lane, p);
}
/* 押した瞬間の1回だけ（プレイ中＝ノーツ・一時停止／それ以外＝メニュー） */
function padPressed(id) {
  if (core.phase === "playing") {
    if (core.settings.autoPlay) { if (id === "pause") window.Trk.play.pauseGame(); return; }
    if (id === "left") padTap(0);
    else if (id === "right") padTap(1);
    else if (id === "pause") window.Trk.play.pauseGame();
    return;                                             // プレイ中は決定・戻るをノーツと取り合わない
  }
  if (id === "confirm" || id === "pause") padActivate();
  else if (id === "back") padBack();
}
function padHandleDirs(pad, s, now) {
  const look = padMenuOk();
  for (const dir of ["left", "right", "up", "down"]) {
    const st = s.dirs[dir] || (s.dirs[dir] = { on:false, last:0, moved:false });
    const on = look && PAD_DIR_BINDS[dir].some(b => padBindOn(pad, b));
    if (on && (!st.on || now - st.last > (st.moved ? PAD_REPEAT_MS : PAD_REPEAT_FIRST))) {
      st.last = now; st.moved = true; padMoveFocus(dir);
    }
    if (!on) { st.on = false; st.moved = false; } else st.on = true;
  }
}

/* ---------- 毎フレームの見張り（rAF・画面が隠れている間はブラウザが止めます） ---------- */
function padTick(now) {
  requestAnimationFrame(padTick);
  const pads = padList();
  if (pads.length !== padCount) { padCount = pads.length; updatePadUI(); }
  if (!core.settings.padEnabled || !pads.length) return;
  for (const pad of pads) {
    const s = padStateOf(pad), edges = padRawEdges(pad, s);
    if (padBinding !== null) {                          // 🎮 割り当て待ち：生のボタン／軸をそのまま拾う
      if (edges.length) padAssign(padBinding, edges[0]);
      continue;
    }
    for (const id of PAD_ACTIONS) {
      const bind = core.settings[padSettingOf(id)];
      if (bind && edges.includes(bind)) padPressed(id);
    }
    padHandleDirs(pad, s, now);
  }
}

/* ---------- 表示（設定 ⚙ の ⌨ 操作 → 🎮 パッド） ---------- */
function updatePadUI() {
  const en = core.$("padEnabled"), nav = core.$("padMenuNav");
  if (en) en.checked = core.settings.padEnabled;
  if (nav) nav.checked = core.settings.padMenuNav;
  document.querySelectorAll("[data-padvalue]").forEach(n => { n.textContent = core.formatPadBind(core.settings[padSettingOf(n.dataset.padvalue)]); });
  document.querySelectorAll("[data-padbind]").forEach(b => b.classList.toggle("listening", padBinding === b.dataset.padbind));
  document.querySelectorAll("#padPresets button").forEach(b => {
    const P = PAD_PRESETS[b.dataset.padpreset];
    b.classList.toggle("selected", !!P && P.left === core.settings.padLeft && P.right === core.settings.padRight);
  });
  const st = core.$("padStatus");
  if (!st) return;
  const pads = padList();
  if (padMsg) st.textContent = padMsg;                                              // 直近の案内を優先
  else if (padBinding !== null) st.textContent = tr("padCapture");
  else if (pads.length) st.textContent = tr("padConnected", { name:pads.map(p => p.id).join("・"), n:pads.length });
  else st.textContent = tr("padNone");
}

/* ---------- 配線 ---------- */
document.querySelectorAll("[data-padbind]").forEach(b => b.addEventListener("click", () => {
  const id = b.dataset.padbind;
  padBinding = padBinding === id ? null : id;
  padMsg = padBinding !== null ? tr("padCapture") : tr("cancelBind");
  padMsgAt = performance.now();
  b.blur(); updatePadUI();
  if (padBinding !== null && !padList().length) padNote("padNone");                 // 未接続なら案内（ボタンを1回押すと認識されます）
}));
document.querySelectorAll("#padPresets button").forEach(b => b.addEventListener("click", () => {
  const P = PAD_PRESETS[b.dataset.padpreset]; if (!P) return;
  core.settings.padLeft = P.left; core.settings.padRight = P.right; core.settings.padEnabled = true;
  padBinding = null; core.saveUserPrefs(); updatePadUI();
  padNote("padPresetSet", { name:tr(PAD_PRESET_KEYS[b.dataset.padpreset] || "padPanelTitle") });
}));
(() => {
  const en = core.$("padEnabled"); if (en) en.addEventListener("change", () => {
    core.settings.padEnabled = en.checked; core.saveUserPrefs(); updatePadUI();
    padNote(core.settings.padEnabled ? "padEnableOn" : "padEnableOff");
  });
  const nav = core.$("padMenuNav"); if (nav) nav.addEventListener("change", () => {
    core.settings.padMenuNav = nav.checked; core.saveUserPrefs(); updatePadUI();
    padNote(core.settings.padMenuNav ? "padMenuNavOn" : "padMenuNavOff");
  });
})();
addEventListener("gamepadconnected", e => {
  padCount = padList().length; padSeen.delete(e.gamepad.index);
  padNote("padConnectedToast", { name:e.gamepad.id });
});
addEventListener("gamepaddisconnected", e => {
  padCount = padList().length; padSeen.delete(e.gamepad.index);
  padNote("padGoneToast", { name:e.gamepad.id });
});
addEventListener("pointerdown", padClearMsg, true);
addEventListener("keydown", padClearMsg, true);
updatePadUI();
requestAnimationFrame(padTick);
/* ✅ pad.js 完了：公開は window.TrkPad（検査・将来の拡張用） */
window.TrkPad = Object.freeze({
  list: padList, format: core.formatPadBind, defaults: core.PAD_DEFAULTS, presets: PAD_PRESETS,
  binding: () => padBinding, tick: padTick, moveFocus: padMoveFocus, activate: padActivate, back: padBack, menuOk: padMenuOk
});

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.padBack = padBack;
window.updatePadUI = updatePadUI;
/* 領域（window.Trk.pad）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.pad = Object.assign(window.Trk.pad || {}, { padBack, updatePadUI });
})();

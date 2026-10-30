(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：🚚 トラックモード（操作設定つき）・レーンの色付け・揺れ ============
   ・共通の文章（紹介文・操作の案内・記録・称号）は i18n.js にあります。
   ・トラック用のキーは、main.js より先に（キャプチャ段階で）受け取ります。 */
"use strict";

/* ---------- 文章（トラック・揺れの設定だけ） ---------- */
Object.assign(TEXT.ja, {
  secTruck:"🚚 トラックモード",
  truckHint:"操作キーでレーンを移動し、トラックが踏んだノーツは自動で判定されます（キーは「⌨ 操作」で設定）。記録はMANUALとは別に残ります。",
  laneTint:"レーンの色の濃さ", truckBounce:"トラックを跳ねさせる",
  swayTitle:"🌀 レーンの揺れ（TRUCK／ORBIT）", swayBeat:"ビートに合わせて左右に傾ける", swayHit:"ドンで左、カッで右に傾ける",
  swayPower:"揺れの強さ", swayReduced:"OSの「視差効果を減らす」がオンのため、揺れと跳ねは止めています。",
  swayModeHint:"🚚トラックと🪐ORBITは既定で揺れます（それぞれのモードの設定で止められます）。ほかのモードは揺れません。❓謎設定の「全ゲームモードで揺れをオンにする」がいちばん優先されます。",
  swayTruck:"🚚 トラックモードでレーンを揺らす（オフ＝揺れを止める）",
  truckCtlTitle:"🚚 トラックモードの操作",
  truckPresetLayout:"レイアウトに合わせる", truckPresetUD:"↑／↓ に固定", truckPresetLR:"←／→ に固定",
  truckLane0:"レーン1（上／左）", truckLane1:"レーン2（下／右）", truckToggle:"切り替えキー（任意）",
  truckAutoTag:"自動", truckHitKeys:"通常の叩くキー（既定は A・Space）でもレーンを移動する",
  truckCtlHint:"「レイアウトに合わせる」は、横スクロールでは↑↓、縦レイアウトでは←→を使います。切り替えキーは押すたびにレーンを行き来します（片手プレイ向け）。",
  truckCapture0:"レーン1（上／左）に割り当てるキーを押してください。ESCでキャンセル。",
  truckCapture1:"レーン2（下／右）に割り当てるキーを押してください。ESCでキャンセル。",
  truckCapture2:"切り替えキーを押してください。Backspaceで解除、ESCでキャンセル。",
  truckAssigned:"トラックの操作キーを設定しました。", truckToggleCleared:"切り替えキーを解除しました。",
  truckKeysDone:"トラックの操作を「{name}」にしました。", truckPreviewToggle:"切り替え"
});
Object.assign(TEXT.en, {
  secTruck:"🚚 Truck mode",
  truckHint:"Change lanes with your truck keys; notes your truck drives over are judged automatically (set keys in “⌨ Controls”). Records are kept separately from MANUAL.",
  laneTint:"Lane tint strength", truckBounce:"Make the truck bounce",
  swayTitle:"🌀 Lane sway (TRUCK / ORBIT)", swayBeat:"Tilt left/right with the beat", swayHit:"Tilt left on Don, right on Ka",
  swayPower:"Sway strength", swayReduced:"Sway and bounce are off because your system's “reduce motion” setting is on.",
  swayModeHint:"🚚 Truck and 🪐 ORBIT sway by default (each mode can turn it off). Other modes stay still. The ❓ mystery option “Sway in every game mode” wins over both.",
  swayTruck:"🚚 Sway the lane in Truck mode (off = keep it still)",
  truckCtlTitle:"🚚 Truck mode controls",
  truckPresetLayout:"Follow layout", truckPresetUD:"Fixed ↑ / ↓", truckPresetLR:"Fixed ← / →",
  truckLane0:"Lane 1 (top / left)", truckLane1:"Lane 2 (bottom / right)", truckToggle:"Toggle key (optional)",
  truckAutoTag:"auto", truckHitKeys:"Normal hit keys (default A / Space) also change lanes",
  truckCtlHint:"“Follow layout” uses ↑↓ for horizontal layouts and ←→ for vertical ones. The toggle key switches lanes on every press (good for one-handed play).",
  truckCapture0:"Press a key for lane 1 (top / left). ESC cancels.",
  truckCapture1:"Press a key for lane 2 (bottom / right). ESC cancels.",
  truckCapture2:"Press a toggle key. Backspace clears, ESC cancels.",
  truckAssigned:"Truck key assigned.", truckToggleCleared:"Toggle key cleared.",
  truckKeysDone:"Truck controls set to “{name}”.", truckPreviewToggle:"Toggle"
});
Object.assign(TEXT.zh, {
  secTruck:"🚚 卡车模式",
  truckHint:"用操作键切换车道，卡车压过的音符会自动判定（按键在“⌨ 操作”中设置）。记录与MANUAL分开保存。",
  laneTint:"车道染色浓度", truckBounce:"让卡车弹跳",
  swayTitle:"🌀 车道摇摆（TRUCK／ORBIT）", swayBeat:"随节拍左右倾斜", swayHit:"咚向左、咔向右倾斜",
  swayPower:"摇摆强度", swayReduced:"系统已开启“减弱动态效果”，摇摆和弹跳已关闭。",
  swayModeHint:"🚚卡车与🪐ORBIT 默认摇摆（可在各自模式设置中关闭）。其他模式不摇摆。❓谜之设定中的“所有游戏模式都摇摆”优先级最高。",
  swayTruck:"🚚 卡车模式下摇摆车道（关闭＝不摇）",
  truckCtlTitle:"🚚 卡车模式操作",
  truckPresetLayout:"跟随布局", truckPresetUD:"固定 ↑／↓", truckPresetLR:"固定 ←／→",
  truckLane0:"车道1（上／左）", truckLane1:"车道2（下／右）", truckToggle:"切换键（可选）",
  truckAutoTag:"自动", truckHitKeys:"普通敲击键（默认 A / Space）也能切换车道",
  truckCtlHint:"“跟随布局”在横向布局使用↑↓，纵向布局使用←→。切换键每按一次就在两条车道间切换（适合单手游玩）。",
  truckCapture0:"请按下车道1（上／左）的按键。ESC取消。",
  truckCapture1:"请按下车道2（下／右）的按键。ESC取消。",
  truckCapture2:"请按下切换键。Backspace解除，ESC取消。",
  truckAssigned:"已设置卡车操作键。", truckToggleCleared:"已解除切换键。",
  truckKeysDone:"已将卡车操作设为“{name}”。", truckPreviewToggle:"切换"
});
Object.assign(TEXT.ko, {
  secTruck:"🚚 트럭 모드",
  truckHint:"조작 키로 레인을 옮기면 트럭이 밟은 노트가 자동으로 판정됩니다 (키는 '⌨ 조작'에서 설정). 기록은 MANUAL과 따로 남습니다.",
  laneTint:"레인 색 농도", truckBounce:"트럭 통통 튀기기",
  swayTitle:"🌀 레인 흔들림 (TRUCK／ORBIT)", swayBeat:"비트에 맞춰 좌우로 기울이기", swayHit:"쿵은 왼쪽, 딱은 오른쪽으로 기울이기",
  swayPower:"흔들림 강도", swayReduced:"시스템의 '동작 줄이기'가 켜져 있어 흔들림과 튀기기를 껐습니다.",
  swayModeHint:"🚚트럭과 🪐ORBIT는 기본적으로 흔들립니다(각 모드 설정에서 끌 수 있음). 다른 모드는 흔들리지 않습니다. ❓ 수수께끼 설정의 '모든 게임 모드에서 흔들기'가 가장 우선합니다.",
  swayTruck:"🚚 트럭 모드에서 레인 흔들기 (끄면 흔들리지 않음)",
  truckCtlTitle:"🚚 트럭 모드 조작",
  truckPresetLayout:"레이아웃에 맞추기", truckPresetUD:"↑／↓ 고정", truckPresetLR:"←／→ 고정",
  truckLane0:"레인 1 (위／왼쪽)", truckLane1:"레인 2 (아래／오른쪽)", truckToggle:"전환 키 (선택)",
  truckAutoTag:"자동", truckHitKeys:"일반 두드리기 키(기본 A / Space)로도 레인 이동",
  truckCtlHint:"'레이아웃에 맞추기'는 가로 레이아웃에서 ↑↓, 세로 레이아웃에서 ←→를 씁니다. 전환 키는 누를 때마다 레인을 오갑니다 (한 손 플레이용).",
  truckCapture0:"레인 1 (위／왼쪽)로 지정할 키를 누르세요. ESC로 취소.",
  truckCapture1:"레인 2 (아래／오른쪽)로 지정할 키를 누르세요. ESC로 취소.",
  truckCapture2:"전환 키를 누르세요. Backspace로 해제, ESC로 취소.",
  truckAssigned:"트럭 조작 키를 설정했습니다.", truckToggleCleared:"전환 키를 해제했습니다.",
  truckKeysDone:"트럭 조작을 '{name}'(으)로 바꿨습니다.", truckPreviewToggle:"전환"
});

/* ---------- 設定（初期値：色付けはほんのり、揺れと跳ねはオフ、操作はレイアウトに合わせる） ---------- */
core.settings.laneTint = core.num(core.prefs.laneTint, 0, .5, .12);
core.settings.truckBounce = core.prefs.truckBounce !== false;
core.settings.swayBeat = core.prefs.swayBeat !== false;
core.settings.swayHit = core.prefs.swayHit !== false;
core.settings.swayPower = core.num(core.prefs.swayPower, .2, 2, 1.1);
/* 🌀 揺れるモード：既定は 🚚TRUCK と 🪐ORBIT だけ。それぞれのモードで止められます。
   （🪐ORBIT のチェックボックスは modes.js が作ります）
   ❓謎設定の swayAllModes は「揺らさない」設定より優先して、全モードで揺らします。 */
core.settings.swayTruck = core.prefs.swayTruck !== false;
core.settings.swayOrbit = core.prefs.swayOrbit !== false;
core.settings.swayAllModes = core.prefs.swayAllModes === true;
const TRUCK_PRESETS = { ud:["ArrowUp", "ArrowDown"], lr:["ArrowLeft", "ArrowRight"] };
core.settings.truckKeyMode = core.pick(core.prefs.truckKeyMode, ["layout", "custom"], "layout");
core.settings.truckKeys = (Array.isArray(core.prefs.truckKeys) && core.prefs.truckKeys.length === 2 && core.prefs.truckKeys.every(core.validCode) && core.prefs.truckKeys[0] !== core.prefs.truckKeys[1])
  ? core.prefs.truckKeys.slice() : TRUCK_PRESETS.ud.slice();
core.settings.truckToggleKey = core.validCode(core.prefs.truckToggleKey) && !core.settings.truckKeys.includes(core.prefs.truckToggleKey) ? core.prefs.truckToggleKey : "";
core.settings.truckHitKeys = core.prefs.truckHitKeys !== false;
const isTruck = () => core.settings.playMode === "truck";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

/* ---------- トラックの操作キー ----------
   キーは「画面上の位置」に対応します（0＝上か左、1＝下か右）。
   位置→レーンは slotLane() で変換するので、左右反転をオンにしても ↑ は上のレーンのままです。 */
const truckPosKeys = () => core.settings.truckKeyMode === "layout"
  ? (window.Trk.play.layout().vertical ? TRUCK_PRESETS.lr : TRUCK_PRESETS.ud)
  : core.settings.truckKeys;
const truckPosOfKey = code => truckPosKeys().indexOf(code);
function truckKeysLabel(pos) {   // プレイ中のキー案内（render.js から使います）
  const list = [truckPosKeys()[pos]];
  if (core.settings.truckHitKeys) list.push(core.settings.keys[pos], core.settings.subKeys[pos]);
  return list.filter(Boolean).map(core.formatKey).join("/");
}

/* ---------- トラックの状態 ---------- */
const TRUCK_ROW = 42;   // 横スクロールで、ドン／カッの段を上下にずらす量
const truckState = { lane:0, vis:0, last:0, dash:-1e9 };
function resetTruck() { truckState.lane = 0; truckState.vis = core.laneCol(0); truckState.last = performance.now(); truckState.dash = -1e9; }
function steerTruck(lane) {
  const changed = lane !== truckState.lane;
  truckState.lane = lane;
  const p = performance.now();
  if (changed) truckState.dash = p;
  core.pressFlash[core.laneCol(lane)] = p;
}
const truckRowY = (L, lane) => L.laneY + (core.laneCol(lane) ? 1 : -1) * TRUCK_ROW;

/* ---------- 判定：トラックと同じレーンのノーツを自動で踏む（AUTOでないとき。render.js から） ---------- */
function truckJudge(now) {
  const w = core.windows();
  for (let i = core.nextIdx; i < core.chart.length; i++) {
    if (core.phase !== "playing") return;
    const n = core.chart[i]; if (n.time > now) break;
    if (n.judged || n.lane !== truckState.lane) continue;
    const d = now - n.time;
    if (d > w.good) continue;                       // 間に合わなければ sweepMisses がMISSにします
    window.Trk.play.judgeNote(n, d <= w.perfect ? "perfect" : "good", d);
    window.Trk.media.playSE(n.lane);
    const p = performance.now(); core.pressFlash[core.laneCol(n.lane)] = p; core.pressH = { lane:n.lane, t:p };
  }
}

/* ---------- キー入力（main.js より先に受け取る） ---------- */
let truckBinding = null;   // 0＝レーン1、1＝レーン2、2＝切り替えキー
const TRUCK_RESERVED = new Set(["KeyP", "Tab", "F5", "F11", "F12", "MetaLeft", "MetaRight", "Backquote", "Minus", "Equal", "Backspace"]);
addEventListener("keydown", e => {
  if (window.Trk.overlay.any()) return;
  if (truckBinding !== null) { e.preventDefault(); e.stopImmediatePropagation(); captureTruckKey(e.code); return; }
  if (core.phase !== "playing" || !isTruck() || core.bindingSlot !== null || core.settings.autoPlay) return;   // AUTO中は自動で動く
  if (core.settings.truckToggleKey && e.code === core.settings.truckToggleKey) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) steerTruck(1 - truckState.lane);
    return;
  }
  const pos = truckPosOfKey(e.code);
  if (pos >= 0) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat) steerTruck(core.slotLane(pos));
    return;
  }
  if (!core.settings.truckHitKeys && core.slotOfKey(e.code) >= 0) { e.preventDefault(); e.stopImmediatePropagation(); }   // 叩くキーでは動かさない
}, true);

function captureTruckKey(code) {
  const slot = truckBinding;
  if (!code || slot === null) return;
  if (code === "Escape") { truckBinding = null; core.setStatus("truckBindStatus", "cancelBind"); syncTruckKeyUI(); return; }
  if (slot === 2 && code === "Backspace") {
    core.settings.truckToggleKey = ""; truckBinding = null; core.saveUserPrefs();
    core.setStatus("truckBindStatus", "truckToggleCleared"); syncTruckKeyUI(); return;
  }
  if (TRUCK_RESERVED.has(code) || (core.settings.speedKeys || []).includes(code)) { core.setStatus("truckBindStatus", "reservedKey"); return; }
  const others = slot === 2 ? truckPosKeys() : [core.settings.truckKeys[1 - slot], core.settings.truckToggleKey];
  if (others.includes(code)) { core.setStatus("truckBindStatus", "duplicateKey"); return; }
  if (slot === 2) core.settings.truckToggleKey = code; else core.settings.truckKeys[slot] = code;
  truckBinding = null; core.saveUserPrefs();
  core.setStatus("truckBindStatus", "truckAssigned"); syncTruckKeyUI();
}

/* ---------- 操作設定の表示 ---------- */
function syncTruckKeyUI() {
  const keys = truckPosKeys(), auto = core.settings.truckKeyMode === "layout";
  for (const i of [0, 1]) core.$("truckKeyValue" + i).textContent = core.formatKey(keys[i]) + (auto ? ` (${tr("truckAutoTag")})` : "");
  core.$("truckKeyValue2").textContent = core.settings.truckToggleKey ? core.formatKey(core.settings.truckToggleKey) : tr("unset");
  core.$("truckHitKeys").checked = core.settings.truckHitKeys;
  const sel = auto ? "layout"
    : core.settings.truckKeys.join() === TRUCK_PRESETS.ud.join() ? "ud"
    : core.settings.truckKeys.join() === TRUCK_PRESETS.lr.join() ? "lr" : "";
  document.querySelectorAll("#truckKeyPresets button").forEach(b => {
    b.classList.toggle("selected", b.dataset.truckpreset === sel); b.setAttribute("aria-pressed", b.dataset.truckpreset === sel);
  });
  document.querySelectorAll("[data-truckbind]").forEach(b => b.classList.toggle("listening", truckBinding === +b.dataset.truckbind));
  const parts = [0, 1].map(p => `${core.laneName(core.slotLane(p))}: [${truckKeysLabel(p)}]`);
  if (core.settings.truckToggleKey) parts.push(`${tr("truckPreviewToggle")}: [${core.formatKey(core.settings.truckToggleKey)}]`);
  core.$("truckKeyPreview").textContent = parts.join("   ·   ");
}
core.$("truckKeyPresets").addEventListener("click", e => {
  const b = e.target.closest("button[data-truckpreset]"); if (!b) return;
  const id = b.dataset.truckpreset;
  if (id === "layout") core.settings.truckKeyMode = "layout";
  else { core.settings.truckKeyMode = "custom"; core.settings.truckKeys = TRUCK_PRESETS[id].slice(); }
  if (truckPosKeys().includes(core.settings.truckToggleKey)) core.settings.truckToggleKey = "";
  truckBinding = null; core.saveUserPrefs(); syncTruckKeyUI();
  core.setStatus("truckBindStatus", "truckKeysDone", { name:b.textContent });
});
document.querySelectorAll("[data-truckbind]").forEach(b => b.addEventListener("click", () => {
  const slot = +b.dataset.truckbind;
  if (slot < 2 && core.settings.truckKeyMode === "layout") {   // 自動から自分で設定に切り替え（今のキーを元にする）
    core.settings.truckKeys = truckPosKeys().slice(); core.settings.truckKeyMode = "custom"; core.saveUserPrefs();
  }
  core.bindingSlot = null; core.updateKeyUI();                        // 通常のキー設定と同時に待たない
  truckBinding = slot; b.blur();
  core.setStatus("truckBindStatus", "truckCapture" + slot); syncTruckKeyUI();
}));
document.querySelectorAll("[data-bind]").forEach(b => b.addEventListener("click", () => {
  if (truckBinding !== null) { truckBinding = null; syncTruckKeyUI(); }
}));
core.$("truckHitKeys").addEventListener("change", e => { core.settings.truckHitKeys = e.target.checked; core.saveUserPrefs(); syncTruckKeyUI(); });
core.$("layoutPicker").addEventListener("click", () => setTimeout(syncTruckKeyUI, 0));   // レイアウトで自動のキーが変わる
core.$("reverseHands").addEventListener("change", () => setTimeout(syncTruckKeyUI, 0));
document.querySelectorAll("#keyPresets, [data-bind]").forEach(n => n.addEventListener("click", () => setTimeout(syncTruckKeyUI, 0)));
addEventListener("keyup", () => { if (window.Trk.overlay.is("study")) return; if (core.bindingSlot === null) syncTruckKeyUI(); });   // 通常キーの変更をプレビューに反映
core.on("language", syncTruckKeyUI);

/* ---------- レーンの色付け（スキンのアクセント色） ---------- */
function drawLaneTint(L) {
  const a = core.settings.laneTint; if (a <= 0) return;
  core.ctx.fillStyle = window.Trk.data.hexToRgba(window.Trk.data.toHex(core.skin().ui["--ui-accent"]), a);
  if (L.vertical) {
    const x0 = L.centers[0] - L.laneW / 2, x1 = L.centers[1] + L.laneW / 2;
    core.ctx.fillRect(x0, L.topY, x1 - x0, L.hitY - L.topY);
  } else { window.Trk.play.rr(L.hitX - 110, L.laneY - 84, L.endX - L.hitX + 170, 168, 42); core.ctx.fill(); }
}

/* ---------- 揺れ（判定位置を軸に傾けるので、叩く場所はほとんど動きません） ---------- */
function lanePivot(L) {
  return L.vertical ? { x:(L.centers[0] + L.centers[1]) / 2, y:L.hitY } : { x:L.hitX, y:L.laneY };
}
/* いまのモードで揺らすか（純粋関数・テストしやすいように分離） */
/* 既定で揺れるモード（🚚トラック／🪐ORBIT） */
const SWAY_DEFAULT_MODES = ["truck", "orbit"];
function swayModeOn(mode) {
  if (core.settings.swayAllModes) return true;                 // ❓謎設定が最優先
  const m = mode || core.settings.playMode;
  if (m === "truck") return core.settings.swayTruck !== false;
  if (m === "orbit") return core.settings.swayOrbit !== false;
  return false;                                          // ほかのモード（MANUAL・STAGE・CATCH）は既定で揺れない
}
function laneTilt(now) {
  if (reduceMotion.matches || !swayModeOn()) return 0;
  const D = Math.PI / 180, k = core.settings.swayPower * core.gameplayFxMultiplier(), p = performance.now();
  let a = 0;
  if (core.settings.swayBeat && core.chartMeta.bpm) a += Math.sin(Math.PI * (now - core.chartMeta.offset) / (60000 / core.chartMeta.bpm)) * 1.4 * D * k;
  if (core.settings.swayHit) {
    const dk = t => Math.max(0, 1 - (p - t) / 260);
    a += (dk(core.avatarHit[1]) - dk(core.avatarHit[0])) * 2.2 * D * k;   // ドン＝左（反時計回り）、カッ＝右
  }
  return a;
}

/* ---------- トラック本体（Canvasで描いたオリジナル） ---------- */
function drawTruck(L, now) {
  const p = performance.now(), dt = Math.min(.05, Math.max(0, (p - truckState.last) / 1000));
  truckState.last = p;
  const col = core.laneCol(truckState.lane);
  truckState.vis += (col - truckState.vis) * Math.min(1, dt * 16);
  const v = truckState.vis, lean = (col - v) * .35;
  const hitK = Math.max(0, 1 - (p - Math.max(core.avatarHit[0], core.avatarHit[1])) / 180);
  const bounce = core.settings.truckBounce && !reduceMotion.matches ? (hitK * 9 + window.Trk.play.beatPulse(now) * 3) * core.gameplayFxMultiplier() : 0;
  core.ctx.save();
  if (L.vertical) {
    core.ctx.translate(L.centers[0] + (L.centers[1] - L.centers[0]) * v, L.hitY);
    core.ctx.rotate(-Math.PI / 2); core.ctx.scale(.8 + bounce * .006, .8 + bounce * .006);
  } else {
    core.ctx.translate(L.hitX, L.laneY - TRUCK_ROW + 2 * TRUCK_ROW * v - bounce);
    core.ctx.scale(.78, .78);
  }
  core.ctx.rotate(lean);
  const cab = core.laneColor(truckState.lane), ink = "#1b1b22";
  const dashAge = p - truckState.dash;
  if (dashAge >= 0 && dashAge < 260 && core.gameplayFxPower() > 0) {
    core.ctx.save(); core.ctx.globalAlpha = (1 - dashAge / 260) * Math.min(1, core.gameplayFxPower());
    core.ctx.strokeStyle = cab; core.ctx.lineWidth = 5; core.ctx.lineCap = "round";
    for (const y of [-18, 0, 18]) { core.ctx.beginPath(); core.ctx.moveTo(-142, y); core.ctx.lineTo(-94, y + lean * 18); core.ctx.stroke(); }
    core.ctx.restore();
  }
  core.ctx.lineJoin = "round";
  core.ctx.fillStyle = "rgba(0,0,0,.28)"; core.ctx.beginPath(); core.ctx.ellipse(-35, 36, 70, 8, 0, 0, window.Trk.data.TAU); core.ctx.fill();   // 影
  window.Trk.play.rr(-100, -30, 82, 52, 7); core.ctx.fillStyle = "#f4f4f8"; core.ctx.fill();                                          // 荷台
  core.ctx.lineWidth = 3; core.ctx.strokeStyle = ink; core.ctx.stroke();
  core.ctx.fillStyle = cab; core.ctx.fillRect(-100, 4, 82, 7);
  core.ctx.fillStyle = ink; core.ctx.font = `900 18px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle";
  core.ctx.fillText("trk!", -59, -12);
  window.Trk.play.rr(-16, -18, 44, 40, 9); core.ctx.fillStyle = cab; core.ctx.fill(); core.ctx.stroke();                                  // 運転席（今のレーンの色）
  window.Trk.play.rr(6, -12, 17, 14, 4); core.ctx.fillStyle = "#cfeaff"; core.ctx.fill();
  core.ctx.fillStyle = "#ffe27a"; core.ctx.beginPath(); core.ctx.arc(27, 12, 4 + hitK * 2, 0, window.Trk.data.TAU); core.ctx.fill();            // ヘッドライト
  if (hitK > 0 && core.gameplayFxPower() > 0) {
    core.ctx.globalCompositeOperation = "lighter";
    const gr = core.ctx.createRadialGradient(30, 12, 0, 30, 12, 44);
    gr.addColorStop(0, `rgba(255,226,122,${Math.min(.8, .4 * core.gameplayFxPower()) * hitK})`); gr.addColorStop(1, "rgba(255,226,122,0)");
    core.ctx.fillStyle = gr; core.ctx.beginPath(); core.ctx.arc(30, 12, 44, 0, window.Trk.data.TAU); core.ctx.fill();
    core.ctx.globalCompositeOperation = "source-over";
  }
  const spin = (p / 60) % window.Trk.data.TAU;                                                                              // タイヤ
  for (const wx of [-78, -40, 12]) {
    core.ctx.fillStyle = ink; core.ctx.beginPath(); core.ctx.arc(wx, 24, 11, 0, window.Trk.data.TAU); core.ctx.fill();
    core.ctx.strokeStyle = "#9aa0aa"; core.ctx.lineWidth = 2; core.ctx.beginPath();
    core.ctx.moveTo(wx + Math.cos(spin) * 7, 24 + Math.sin(spin) * 7); core.ctx.lineTo(wx - Math.cos(spin) * 7, 24 - Math.sin(spin) * 7); core.ctx.stroke();
  }
  core.ctx.restore();
}

/* ---------- 設定画面（見た目の欄） ---------- */
function showTruckVals() {
  core.$("laneTintVal").textContent = Math.round(core.settings.laneTint * 100) + "%";
  core.$("swayPowerVal").textContent = Math.round(core.settings.swayPower * 100) + "%";
}
core.$("laneTint").value = core.settings.laneTint;
core.$("swayPower").value = core.settings.swayPower;
core.$("truckBounce").checked = core.settings.truckBounce;
core.$("swayBeat").checked = core.settings.swayBeat;
core.$("swayHit").checked = core.settings.swayHit;
core.$("swayTruck").checked = core.settings.swayTruck;
showTruckVals();
core.$("laneTint").addEventListener("input", e => { core.settings.laneTint = Number(e.target.value); showTruckVals(); core.saveUserPrefs(); });
core.$("swayPower").addEventListener("input", e => { core.settings.swayPower = Number(e.target.value); showTruckVals(); core.saveUserPrefs(); });
for (const id of ["truckBounce", "swayTruck", "swayBeat", "swayHit"]) {
  core.$(id).addEventListener("change", e => { core.settings[id] = e.target.checked; core.saveUserPrefs(); });
}
const syncReducedNote = () => { core.$("swayReducedNote").hidden = !reduceMotion.matches; };
if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", syncReducedNote);
syncReducedNote();
setTimeout(syncTruckKeyUI, 0);   // 言語の反映が終わってから表示
/* ✅ truck.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.drawLaneTint = drawLaneTint;
window.drawTruck = drawTruck;
window.isTruck = isTruck;
window.lanePivot = lanePivot;
window.laneTilt = laneTilt;
window.reduceMotion = reduceMotion;
window.resetTruck = resetTruck;
window.steerTruck = steerTruck;
window.syncTruckKeyUI = syncTruckKeyUI;
Object.defineProperty(window, "truckBinding", { configurable:true, get:() => truckBinding, set:v => { truckBinding = v; } });
window.truckJudge = truckJudge;
window.truckKeysLabel = truckKeysLabel;
window.truckPosKeys = truckPosKeys;
window.truckRowY = truckRowY;
window.truckState = truckState;
})();

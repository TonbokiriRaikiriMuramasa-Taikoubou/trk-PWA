(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! catch.js — 🚛 CATCH（荷物を受け止めるトラック）＋ 🚀 ぶっ飛ばしモード
   ・落ちてくる荷物を荷台で受け止める。中心ほど高評価（PERFECT✦／PERFECT／GOOD）
   ・道の上に出るニトロ缶🚀を取ると「ぶっ飛ばしモード」（8拍）：受け止める幅2倍・移動1.6倍・派手な演出
   ・Seed nitro／buttobi／ぶっとばし で常時ぶっ飛ばし（練習扱い）
   ・障害物はありません（自動生成の譜面と相性が悪いため）
   呼び出し元：game.js（判定位置）／render.js（描画・判定）
   読み込み順：stagefx.js の後
   ========================================================================== */
"use strict";

/* ============ 文章 ============ */
Object.assign(TEXT.ja, {
  catchHint:"落ちてくる荷物を荷台で受け止めます。←→（A・Dでも可）で左右に動き、画面をなぞっても動かせます。道の上のニトロ缶🚀を取ると、しばらく「ぶっ飛ばしモード」（受け止める幅2倍・移動が速くなる）になります。",
  catchKeysTitle:"🚛 CATCHのキー", catchLeft:"左へ", catchRight:"右へ", catchKeyReset:"↺ A ／ Space に戻す",
  catchCapture0:"「左へ」に割り当てるキーを押してください。ESCでキャンセル。",
  catchCapture1:"「右へ」に割り当てるキーを押してください。ESCでキャンセル。",
  catchAssigned:"CATCHのキーを設定しました。",
  blastToast:"🚀 ぶっ飛ばし！", blastLabel:"🚀 BLAST", blastCount:"🚀 ぶっ飛ばし：{n}回",
  eggNitro:"✦ NITRO：CATCHがずっとぶっ飛ばしモードになります（練習扱い・ハイスコア対象外）",
  catchNitroBonus:"🚀 ニトロ中は得点1.1倍", catchNitroBonusHint:"オンにすると、ニトロ中に受け止めたノーツの得点が少し上がります。",
  blastOverlapToast:"💥 重なった！画面の荷物を消して終了", catchBlastNext:"🚀 ぶっ飛ばしは「次の荷物を取る（落とす）まで」", catchBlastNextHint:"オフ：10秒間。重なると画面の荷物を消して終わります。オン：次の荷物が判定されるまで続きます。",
});
Object.assign(TEXT.en, {
  catchHint:"Catch the falling parcels in your truck bed. Move with ← → (or A / D), or drag on the screen. Grab a nitro can 🚀 on the road to enter Blast mode for a while (double catch width, faster moves).",
  catchKeysTitle:"🚛 CATCH keys", catchLeft:"Left", catchRight:"Right", catchKeyReset:"↺ Back to A / Space",
  catchCapture0:"Press a key for “Left”. ESC cancels.", catchCapture1:"Press a key for “Right”. ESC cancels.",
  catchAssigned:"CATCH key assigned.",
  blastToast:"🚀 BLAST!", blastLabel:"🚀 BLAST", blastCount:"🚀 Blasts: {n}",
  eggNitro:"✦ NITRO: CATCH stays in Blast mode the whole song (practice — no high score)",
  catchNitroBonus:"🚀 Score x1.1 during Nitro", catchNitroBonusHint:"When on, notes caught during Nitro give a small score bonus.",
  blastOverlapToast:"💥 Overlap! Screen cleared, blast ended", catchBlastNext:"🚀 Blast lasts until the next parcel", catchBlastNextHint:"Off: 10 seconds. Overlapping (taking another nitro can) clears the screen and ends the blast. On: lasts until the next parcel is caught or dropped.",
});
Object.assign(TEXT.zh, {
  catchHint:"用货斗接住落下的包裹。用 ← →（或 A·D）左右移动，也可以在画面上拖动。拿到路上的氮气罐🚀，会进入一段时间的“狂飙模式”（接取范围2倍·移动更快）。",
  catchKeysTitle:"🚛 CATCH 按键", catchLeft:"向左", catchRight:"向右", catchKeyReset:"↺ 恢复为 A ／ Space",
  catchCapture0:"请按下“向左”的按键。ESC取消。", catchCapture1:"请按下“向右”的按键。ESC取消。",
  catchAssigned:"已设置CATCH按键。",
  blastToast:"🚀 狂飙！", blastLabel:"🚀 BLAST", blastCount:"🚀 狂飙：{n}次",
  eggNitro:"✦ NITRO：CATCH整首歌都是狂飙模式（练习·不计最高分）",
  catchNitroBonus:"🚀 氮气中得分×1.1", catchNitroBonusHint:"开启后，在氮气期间接住音符会获得少量分数加成。",
  blastOverlapToast:"💥 重叠！画面已清空，冲刺结束", catchBlastNext:"🚀 冲刺持续到下一个包裹", catchBlastNextHint:"关闭：10 秒。重叠（再取一个氮气罐）会清空画面并结束冲刺。开启：持续到下一个包裹被判定为止。",
});
Object.assign(TEXT.ko, {
  catchHint:"떨어지는 짐을 짐칸으로 받습니다. ← →(A·D도 가능)로 좌우로 움직이고, 화면을 드래그해도 됩니다. 길 위의 니트로 캔🚀을 먹으면 잠시 '폭주 모드'(받는 폭 2배·이동이 빨라짐)가 됩니다.",
  catchKeysTitle:"🚛 CATCH 키", catchLeft:"왼쪽", catchRight:"오른쪽", catchKeyReset:"↺ A ／ Space 로 되돌리기",
  catchCapture0:"'왼쪽'으로 지정할 키를 누르세요. ESC로 취소.", catchCapture1:"'오른쪽'으로 지정할 키를 누르세요. ESC로 취소.",
  catchAssigned:"CATCH 키를 설정했습니다.",
  blastToast:"🚀 폭주!", blastLabel:"🚀 BLAST", blastCount:"🚀 폭주: {n}회",
  eggNitro:"✦ NITRO: CATCH가 곡 내내 폭주 모드가 됩니다 (연습 취급·최고 점수 제외)",
  catchNitroBonus:"🚀 니트로 중 점수×1.1", catchNitroBonusHint:"켜면 니트로 중 받은 노트에 작은 점수 보너스가 붙습니다.",
  blastOverlapToast:"💥 겹침! 화면을 비우고 종료", catchBlastNext:"🚀 돌진은 다음 짐까지 지속", catchBlastNextHint:"끄기: 10초. 겹치면(니트로 캔을 또 잡으면) 화면을 비우고 끝납니다. 켜기: 다음 짐이 판정될 때까지 계속됩니다.",
});

/* ============ 設定 ============ */
const CATCH_DEFAULT_KEYS = ["KeyA", "Space"], CATCH_ALT = ["ArrowLeft", "ArrowRight"];   /* 既定：左＝A（ドン）、右＝Space（カッ）。← → も使える */
core.settings.catchKeys = (Array.isArray(core.prefs.catchKeys) && core.prefs.catchKeys.length === 2 && core.prefs.catchKeys.every(core.validCode) && core.prefs.catchKeys[0] !== core.prefs.catchKeys[1])
  ? core.prefs.catchKeys.slice() : CATCH_DEFAULT_KEYS.slice();
const isCatch = () => core.settings.playMode === "catch";
function catchKeyDir(code) {
  const i = core.settings.catchKeys.indexOf(code); if (i >= 0) return i ? 1 : -1;
  const j = CATCH_ALT.indexOf(code); return j >= 0 ? (j ? 1 : -1) : 0;
}
const catchAllKeys = () => [...core.settings.catchKeys, ...CATCH_ALT];   // player.js・speed.js が重なりの確認に使います

/* ============ 🚀 常時ぶっ飛ばしのSeed ============ */
const NITRO_SEEDS = ["nitro", "buttobi", "ぶっとばし"];
for (const s of NITRO_SEEDS) window.Trk.data.EGG_KEYS[s] = "eggNitro";
const alwaysBlast = () => NITRO_SEEDS.includes((core.$("seed").value || "").trim().toLowerCase());
/* MODS に ∞BLAST を表示 */
(() => {
  const base = core.activeMods;
  core.activeMods = () => { const m = base(); if (isCatch() && alwaysBlast()) m.push("∞BLAST"); return m; };
})();
/* 常時ぶっ飛ばしは練習扱い（resetRun のあとに付けるので、プレイ開始の合図で設定） */
core.on("phase", p => { if (p === "playing" && isCatch() && alwaysBlast() && !core.settings.autoPlay) core.practice = true; });

/* ============ 形（1920×1080の座標）と状態 ============ */
const CATCH = { left:410, width:1100, topY:70, lineY:880, speed:1.5, half:.085, perfect:.05, item:.11, boost:1.6, blastMs:10000 };   /* ぶっ飛ばし：10秒（固定。重なれば足される） */
const catchX = x => CATCH.left + x * CATCH.width;
const catchState = { x:.5, target:null, held:[false, false], last:0, blastUntil:-1e9, blastLen:1, trail:[] };
const catchMap = { src:null, len:0, key:"", xs:new Float32Array(0), items:[] };
const flying = [];   // ぶっ飛んでいく荷物
const isBlast = now => alwaysBlast() || now < catchState.blastUntil;

/* ============ 荷物の位置とニトロ缶を決める ============
   ・ドンは左寄り、カッは右寄り。前の荷物から、時間内に必ず届く距離だけ動かす
   ・ニトロ缶は、荷物と荷物の間の「通る道の上」に置くので、普通に追いかければ拾える */
function ensureCatchMap() {
  const key = `${core.$("seed").value}|${core.chartDiff}|${core.chartMeta.bpm}`;
  if (catchMap.src === core.chart && catchMap.len === core.chart.length && catchMap.key === key) return;
  const tier = { easy:0, normal:1, hard:2, master:3, rush:3 }[core.chartDiff] ?? 1;
  const use = [.45, .65, .85, .95][tier], dens = [.06, .09, .12, .15][tier];
  const beat = 60000 / (core.chartMeta.bpm || 120);
  const rand = core.mulberry32(core.hashString(`catch|${key}|${core.chart.length}`));
  const L = core.chart.length, xs = new Float32Array(L), items = [];
  let x = .5, prevT = (core.chart.length ? core.chart[0].time : 0) - beat * 2;
  for (let i = 0; i < L; i++) {
    const n = core.chart[i], gap = Math.max(1, n.time - prevT);
    const reach = Math.min(.85, gap / 1000 * CATCH.speed * .7) * use;
    const want = (n.lane ? .68 : .32) + (rand() - .5) * .5;
    const nx = Math.max(.07, Math.min(.93, x + Math.max(-reach, Math.min(reach, want - x))));
    if (i > 0 && gap >= beat * 1.4 && rand() < dens && !alwaysBlast()) {
      const mid = (x + nx) / 2 + (rand() - .5) * .06;
      items.push({ time:prevT + gap / 2, x:Math.max(.06, Math.min(.94, mid)), done:false });
    }
    xs[i] = nx; x = nx; prevT = n.time;
  }
  Object.assign(catchMap, { src:core.chart, len:L, key, xs, items });
}
function resetCatch() {
  Object.assign(catchState, { x:.5, target:null, held:[false, false], last:performance.now(), blastUntil:-1e9, blastLen:1, trail:[] });
  flying.length = 0; core.stats.blasts = 0;
  catchMap.src = null; ensureCatchMap();
}
function catchHitPos(n) {      // game.js から使います（ヒットエフェクトの位置）
  ensureCatchMap();
  const i = Math.max(0, core.chart.indexOf(n));
  return { x:catchX(catchMap.xs[i] ?? .5), y:CATCH.lineY - 20 };
}

/* ============ 🚀 ぶっ飛ばし ============ */
function blastSound() {
  const ac = window.Trk.media.getAC(); if (!ac) return;
  if (ac.state === "suspended") ac.resume();
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1400, t + .35);
  g.gain.setValueAtTime(Math.max(.03, core.settings.seVolume * .5), t); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .5);
}
/* ぶっ飛ばし中にニトロ缶を取った（重なった）：画面に見えている荷物を取った扱いで消して、ぶっ飛ばしを終える（trk149）。
   AUTO のときは荷物の判定を AUTO に任せ、ニトロ缶と終了だけ行う。 */
function clearScreenOnOverlap(now) {
  ensureCatchMap();
  const travel = core.travelMs();
  for (const it of catchMap.items) {
    if (it.done || it.time <= now || it.time - now > travel) continue;
    it.done = true;
  }
  if (core.settings.autoPlay) return;
  for (let i = core.nextIdx; i < core.chart.length; i++) {
    const n = core.chart[i];
    if (n.time - now > travel) break;
    if (n.judged || n.time <= now) continue;
    window.Trk.play.judgeNote(n, "perfect", 0);
    launchParcel(catchMap.xs[i], n.lane);
  }
}
function triggerBlast(now, it) {
  if (isBlast(now)) {                                               // 重なった：画面の荷物を消して終わる
    clearScreenOnOverlap(now);
    catchState.blastUntil = now;
    core.stats.blasts = (core.stats.blasts || 0) + 1;
    core.effects.push({ x:catchX(it.x), y:CATCH.lineY - 20, c:"#ffb000", t:performance.now(), kind:"perfect", seed:Math.random() * window.Trk.data.TAU });
    window.Trk.play.showToast(tr("blastOverlapToast")); blastSound();
    return;
  }
  if (core.settings.catchBlastNext) {                               // 「次の荷物まで」：次の荷物を判定するまで続く
    catchState.blastUntil = Infinity; catchState.blastLen = Infinity;
  } else {
    const len = CATCH.blastMs;
    const start = Math.max(catchState.blastUntil, now);
    catchState.blastUntil = start + len;
    catchState.blastLen = catchState.blastUntil - now;
  }
  core.stats.blasts = (core.stats.blasts || 0) + 1;
  core.effects.push({ x:catchX(it.x), y:CATCH.lineY - 20, c:"#ffb000", t:performance.now(), kind:"perfect", seed:Math.random() * window.Trk.data.TAU });
  window.Trk.play.showToast(tr("blastToast")); blastSound();
}

/* ============ 動き ============ */
function updateCatch(now) {
  ensureCatchMap();
  const p = performance.now(), dt = Math.min(.05, Math.max(0, (p - catchState.last) / 1000)); catchState.last = p;
  if (core.phase !== "playing") return;
  const blast = isBlast(now);
  let tx = catchState.target;
  if (core.settings.autoPlay && core.chart[core.nextIdx]) {                       // AUTO：次の荷物へ。途中のニトロ缶も拾う
    tx = catchMap.xs[core.nextIdx];
    const nt = core.chart[core.nextIdx].time;
    for (const it of catchMap.items) {
      if (it.done || it.time <= now || it.time >= nt) continue;
      if (it.time - now < 500) tx = it.x;
      break;
    }
  }
  const dir = (catchState.held[1] ? 1 : 0) - (catchState.held[0] ? 1 : 0), step = CATCH.speed * dt * (blast ? CATCH.boost : 1);
  if (dir && !core.settings.autoPlay) { catchState.x += dir * step; catchState.target = null; }
  else if (tx != null) { const d = tx - catchState.x; catchState.x += Math.sign(d) * Math.min(Math.abs(d), step * (core.settings.autoPlay ? 1.4 : 1)); }
  catchState.x = Math.max(.04, Math.min(.96, catchState.x));
  for (const it of catchMap.items) {
    if (it.done && it.time > now + 50) it.done = false;            // 巻き戻したときは元に戻す
    if (it.done || it.time > now) continue;
    it.done = true;                                                 // 取っても取り逃しても、通り過ぎたら消える
    if (now - it.time > 150 || window.Trk.play.leadIn) continue;
    if (Math.abs(it.x - catchState.x) < CATCH.item) triggerBlast(now, it);
  }
  if (blast) {                                                      // 残像（虹の軌跡）
    catchState.trail.push({ x:catchState.x, t:p });
    while (catchState.trail.length && p - catchState.trail[0].t > 260) catchState.trail.shift();
  } else catchState.trail.length = 0;
}
/* render.js のループから呼ばれます（AUTOでないとき） */
function catchJudge(now) {
  if (core.settings.autoPlay) return;
  ensureCatchMap();
  const k = isBlast(now) ? 2 : 1, bonus = core.settings.catchNitroBonus && k > 1;
  for (let i = core.nextIdx; i < core.chart.length; i++) {
    const n = core.chart[i]; if (n.time > now) break;
    if (n.judged) continue;
    const dx = Math.abs(catchMap.xs[i] - catchState.x);
    if (dx <= CATCH.half * k) {
      /* CATCHは good を持たない：捕まえたら必ず perfect。ぶっ飛ばし中は常に★（精度完璧）扱い */
      if (bonus) core.stats.blastBonus = (core.stats.blastBonus || 0) + 1;
      window.Trk.media.playSE(n.lane);
      window.Trk.play.judgeNote(n, "perfect", (k > 1 || dx <= CATCH.perfect * .5) ? 0 : null);
      if (k > 1) launchParcel(catchMap.xs[i], n.lane);
    } else window.Trk.play.judgeNote(n, "miss", null);
    if (k > 1 && core.settings.catchBlastNext) { catchState.blastUntil = now; break; }   // 次の荷物（取った・落とした）で終わり。同じフレームの残りは次のフレームで通常どおり判定
    if (core.phase !== "playing") return;
  }
}
/* AUTOでも、ぶっ飛ばし中は荷物を飛ばす */
core.on("options", () => {});
function launchParcel(x, lane) {
  if (flying.length > 40) flying.shift();
  flying.push({ x:catchX(x), y:CATCH.lineY - 40, vx:(Math.random() - .5) * 900, t:performance.now(), c:core.laneColor(lane), spin:(Math.random() - .5) * 12 });
}

/* ============ 描画（render.js から呼ばれます） ============ */
function drawParcel(x, y, c, s, g) {
  window.Trk.play.rr(x - s, y - s, s * 2, s * 2, 8); core.ctx.fillStyle = c; core.ctx.fill();
  core.ctx.lineWidth = 3; core.ctx.strokeStyle = g.noteBorder; core.ctx.stroke();
  core.ctx.fillStyle = "rgba(255,255,255,.85)";
  core.ctx.fillRect(x - 3, y - s, 6, s * 2); core.ctx.fillRect(x - s, y - 3, s * 2, 6);
}
function drawNitro(x, y, p) {
  const pulse = .5 + .5 * Math.sin(p / 120);
  const gr = core.ctx.createRadialGradient(x, y, 0, x, y, 52);
  gr.addColorStop(0, `rgba(255,176,0,${.5 + .3 * pulse})`); gr.addColorStop(1, "rgba(255,176,0,0)");
  core.ctx.fillStyle = gr; core.ctx.beginPath(); core.ctx.arc(x, y, 52, 0, window.Trk.data.TAU); core.ctx.fill();
  core.ctx.font = `44px ${window.Trk.data.FONT_DEFAULT}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle";
  core.ctx.fillText("🚀", x, y + 2);
}
function drawCatchTruck(x, y, p, blast, now) {
  const hitK = Math.max(0, 1 - (p - Math.max(core.avatarHit[0], core.avatarHit[1])) / 200);
  core.ctx.save(); core.ctx.translate(x, y - hitK * 6);
  core.ctx.fillStyle = "rgba(0,0,0,.35)"; core.ctx.beginPath(); core.ctx.ellipse(0, 76, 112, 14, 0, 0, window.Trk.data.TAU); core.ctx.fill();
  if ((core.stats.combo >= 50 && core.gameplayFxPower() > 0) || blast) {       // マフラーの炎（ぶっ飛ばし中は大きく）
    for (const s of [-1, 1]) {
      const f = (blast ? 46 : 14) + Math.random() * (blast ? 34 : 12);
      core.ctx.fillStyle = blast ? "#ff5d2a" : "#ffb000";
      core.ctx.beginPath(); core.ctx.moveTo(s * 44 - 9, 78); core.ctx.lineTo(s * 44 + 9, 78); core.ctx.lineTo(s * 44, 78 + f); core.ctx.closePath(); core.ctx.fill();
      if (blast) { core.ctx.fillStyle = "#ffe27a"; core.ctx.beginPath(); core.ctx.moveTo(s * 44 - 5, 78); core.ctx.lineTo(s * 44 + 5, 78); core.ctx.lineTo(s * 44, 78 + f * .55); core.ctx.closePath(); core.ctx.fill(); }
    }
  }
  core.ctx.fillStyle = "#1b1b22"; window.Trk.play.rr(-102, 40, 34, 40, 8); core.ctx.fill(); window.Trk.play.rr(68, 40, 34, 40, 8); core.ctx.fill();
  window.Trk.play.rr(-92, -40, 184, 96, 12); core.ctx.fillStyle = "#f4f4f8"; core.ctx.fill(); core.ctx.lineWidth = 4; core.ctx.strokeStyle = "#1b1b22"; core.ctx.stroke();
  window.Trk.play.rr(-78, -30, 156, 46, 8); core.ctx.fillStyle = "#2b2f36"; core.ctx.fill();
  const pile = Math.min(8, Math.floor(core.stats.combo / 8));             // 荷台に積み上がる荷物
  for (let i = 0; i < pile; i++) {
    const bx = -57 + (i % 4) * 38, by = -6 - Math.floor(i / 4) * 16;
    window.Trk.play.rr(bx - 15, by - 11, 30, 22, 4); core.ctx.fillStyle = core.laneColor(i % 2); core.ctx.fill();
  }
  core.ctx.fillStyle = hitK > 0 ? "#ffe27a" : "#ff3b30"; window.Trk.play.rr(-88, 24, 20, 12, 4); core.ctx.fill(); window.Trk.play.rr(68, 24, 20, 12, 4); core.ctx.fill();
  window.Trk.play.rr(-30, 26, 60, 20, 4); core.ctx.fillStyle = "#ffd166"; core.ctx.fill();
  core.ctx.fillStyle = "#1b1b22"; core.ctx.font = `900 14px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.fillText("trk!", 0, 37);
  if (hitK > 0) {
    core.ctx.globalCompositeOperation = "lighter"; core.ctx.globalAlpha = hitK * .6;
    core.ctx.fillStyle = window.Trk.data.toHex(core.skin().ui["--ui-accent"]); window.Trk.play.rr(-92, -46, 184, 20, 10); core.ctx.fill();
    core.ctx.globalCompositeOperation = "source-over"; core.ctx.globalAlpha = 1;
  }
  if (blast && !alwaysBlast()) {                                     // 残り時間のゲージ
    const k = isFinite(catchState.blastLen) ? Math.max(0, Math.min(1, (catchState.blastUntil - now) / catchState.blastLen)) : 1;
    window.Trk.play.rr(-60, -66, 120, 8, 4); core.ctx.fillStyle = "rgba(0,0,0,.5)"; core.ctx.fill();
    window.Trk.play.rr(-60, -66, 120 * k, 8, 4); core.ctx.fillStyle = "#ffb000"; core.ctx.fill();
  }
  core.ctx.restore();
}
function drawCatchField(now) {
  updateCatch(now);
  const g = core.skin().game, travel = core.travelMs(), p = performance.now(), accent = window.Trk.data.toHex(core.skin().ui["--ui-accent"]);
  const Lx = CATCH.left, Wd = CATCH.width, top = CATCH.topY, ly = CATCH.lineY;
  const still = reduceMotion.matches, blast = isBlast(now), blastVisual = blast && core.gameplayFxMultiplier() > 0, hue = (p / 6) % 360;
  core.ctx.save();

  /* 道路（白線はコンボとぶっ飛ばしで速く流れる） */
  core.ctx.fillStyle = g.lane; window.Trk.play.rr(Lx - 40, top - 30, Wd + 80, window.Trk.data.H - top + 60, 28); core.ctx.fill();
  const edge = blastVisual ? `hsla(${hue},90%,60%,.85)` : window.Trk.data.hexToRgba(accent, .35);
  core.ctx.fillStyle = edge; core.ctx.fillRect(Lx - 40, top - 30, blastVisual ? 14 : 8, window.Trk.data.H); core.ctx.fillRect(Lx + Wd + (blastVisual ? 26 : 32), top - 30, blastVisual ? 14 : 8, window.Trk.data.H);
  const boost = Math.min(1, core.stats.combo / 100), speed = .45 + .35 * boost + (blastVisual ? 1.2 : 0);
  const off = still ? 0 : ((now * speed) % 120 + 120) % 120;
  core.ctx.fillStyle = g.track;
  for (const fx of [.25, .5, .75]) for (let y = top - 120 + off; y < window.Trk.data.H; y += 120) core.ctx.fillRect(Lx + fx * Wd - 4, y, 8, 60);
  if ((boost >= .5 || blastVisual) && !still) {                            // スピード線
    core.ctx.globalAlpha = blastVisual ? .55 : .25 * boost;
    for (let i = 0; i < (blastVisual ? 22 : 10); i++) {
      const sx = (i * 211) % window.Trk.data.W, sy = (p * (blastVisual ? 2.2 : .9) + i * 137) % window.Trk.data.H;
      core.ctx.fillStyle = blastVisual ? `hsl(${(hue + i * 30) % 360},90%,70%)` : "#fff";
      if (sx < Lx - 40 || sx > Lx + Wd + 40) core.ctx.fillRect(sx, sy, 3, blastVisual ? 160 : 90);
    }
    core.ctx.globalAlpha = 1;
  }
  core.ctx.globalAlpha = .55; core.ctx.fillStyle = g.ink; core.ctx.fillRect(Lx, ly - 3, Wd, 6); core.ctx.globalAlpha = 1;

  /* ニトロ缶 */
  for (const it of catchMap.items) {
    const u = it.time - now; if (it.done || u > travel || u < -150) continue;
    drawNitro(catchX(it.x), ly - u / travel * (ly - top), p);
  }
  /* 荷物 */
  let end = core.nextIdx;
  while (end < core.chart.length && core.chart[end].time - now <= travel) end++;
  for (let i = end - 1; i >= core.nextIdx; i--) {
    const n = core.chart[i]; if (n.judged) continue;
    const u = n.time - now, a = window.Trk.play.noteAlpha(u); if (a <= 0) continue;
    core.ctx.globalAlpha = a;
    drawParcel(catchX(catchMap.xs[i]), ly - u / travel * (ly - top), core.settings.stageLaneColor === false ? accent : core.laneColor(n.lane), 26, g);
    core.ctx.globalAlpha = 1;
  }

  /* ぶっ飛ばし：虹の残像・受け止めバー */
  const tx = catchX(catchState.x);
  if (blastVisual) {
    for (const tr0 of catchState.trail) {
      const a = 1 - (p - tr0.t) / 260;
      core.ctx.globalAlpha = .35 * a; core.ctx.fillStyle = `hsl(${(hue + (p - tr0.t)) % 360},90%,60%)`;
      window.Trk.play.rr(catchX(tr0.x) - 92, ly + 10, 184, 96, 12); core.ctx.fill();
    }
    core.ctx.globalAlpha = 1;
    const hw = CATCH.half * 2 * Wd, gr = core.ctx.createLinearGradient(tx - hw, 0, tx + hw, 0);
    for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsla(${(hue + i * 60) % 360},90%,60%,.75)`);
    window.Trk.play.rr(tx - hw, ly - 14, hw * 2, 12, 6); core.ctx.fillStyle = gr; core.ctx.fill();
  }
  drawCatchTruck(tx, ly + 50, p, blastVisual, now);

  /* ぶっ飛んでいく荷物 */
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i], a = (p - f.t) / 900;
    if (a >= 1) { flying.splice(i, 1); continue; }
    const x = f.x + f.vx * a, y = f.y - 1300 * a + 350 * a * a;
    core.ctx.save(); core.ctx.globalAlpha = 1 - a; core.ctx.translate(x, y); core.ctx.rotate(f.spin * a);
    drawParcel(0, 0, f.c, 22, g); core.ctx.restore();
  }

  /* 表示 */
  if (blastVisual) {
    core.ctx.font = `900 30px ${core.fontFamily()}`; core.ctx.textAlign = "right"; core.ctx.textBaseline = "middle";
    core.ctx.lineWidth = 6; core.ctx.strokeStyle = "rgba(0,0,0,.6)"; core.ctx.strokeText(tr("blastLabel"), Lx + Wd - 10, top + 30);
    core.ctx.fillStyle = `hsl(${hue},90%,65%)`; core.ctx.fillText(tr("blastLabel"), Lx + Wd - 10, top + 30);
  }
  if (!core.settings.hideGameplayUI && !core.settings.autoPlay) {
    core.ctx.font = `800 20px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.fillStyle = g.ink;
    core.ctx.fillText(`◀ ${core.formatKey(core.settings.catchKeys[0])} / ${core.formatKey(CATCH_ALT[0])}      ${core.formatKey(CATCH_ALT[1])} / ${core.formatKey(core.settings.catchKeys[1])} ▶`, 960, window.Trk.data.H - 30);
  }
  core.ctx.restore();
}
/* AUTO中も、ぶっ飛ばし中に受け止めた荷物を飛ばす（game.js の判定のあとに合図を見る） */
(() => {
  let lastPerfect = 0;
  core.on("beforePlay", () => { lastPerfect = 0; });
  const watch = () => {
    requestAnimationFrame(watch);
    if (!isCatch() || !core.settings.autoPlay || core.phase !== "playing") { lastPerfect = core.stats.perfect; return; }
    if (core.stats.perfect > lastPerfect && isBlast(window.Trk.play.gameTime())) {
      const i = Math.max(0, core.nextIdx - 1);
      if (core.chart[i]) launchParcel(catchMap.xs[i] ?? .5, core.chart[i].lane);
    }
    lastPerfect = core.stats.perfect;
  };
  requestAnimationFrame(watch);
})();

/* ============ 入力（キーを押している間だけ動く／画面をなぞると追いかける） ============ */
let catchBinding = null, catchPointer = false;
addEventListener("keydown", e => {
  if (window.Trk.overlay.any()) return;
  if (catchBinding !== null) { e.preventDefault(); e.stopImmediatePropagation(); captureCatchKey(e.code); return; }
  if (core.phase !== "playing" || !isCatch() || core.bindingSlot !== null || core.settings.autoPlay) return;
  const d = catchKeyDir(e.code); if (!d) return;
  e.preventDefault(); e.stopImmediatePropagation();
  catchState.held[d > 0 ? 1 : 0] = true;
}, true);
addEventListener("keyup", e => { if (window.Trk.overlay.is("study")) return; const d = catchKeyDir(e.code); if (d) catchState.held[d > 0 ? 1 : 0] = false; });
addEventListener("blur", () => { catchState.held = [false, false]; });
function catchTargetFrom(e) {
  const r = core.stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * window.Trk.data.W;
  catchState.target = Math.max(0, Math.min(1, (x - CATCH.left) / CATCH.width));
}
core.stage.addEventListener("pointerdown", e => {
  if (core.phase !== "playing" || !isCatch() || core.settings.autoPlay) return;
  if (e.target.closest("#controls, #seekBar")) return;
  e.preventDefault(); e.stopPropagation(); catchPointer = true; catchTargetFrom(e);
}, true);
addEventListener("pointermove", e => { if (catchPointer && isCatch()) catchTargetFrom(e); });
addEventListener("pointerup", () => { catchPointer = false; });
core.on("chart", () => { catchMap.src = null; });
core.on("screen", id => {                                                 // リザルトにぶっ飛ばした回数を出す
  if (id === "endScreen" && isCatch() && core.stats.blasts) core.$("result").append(core.el("div", "best", tr("blastCount", { n:core.stats.blasts })));
});

/* ============ 設定画面（⌨ 操作 の中） ============ */
let syncCatchKeyUI = () => {};
(() => {
  const anchor = document.querySelector('#settingsScreen [data-i18n="truckCtlHint"]'); if (!anchor) return;
  const h3 = core.el("h3", "", tr("catchKeysTitle")); h3.dataset.i18n = "catchKeysTitle";
  const rows = core.el("div", "keyRows"); rows.style.marginTop = "10px";
  const reset = core.el("button", "", tr("catchKeyReset")); reset.type = "button"; reset.dataset.i18n = "catchKeyReset";
  reset.style.cssText = "margin-top:8px;padding:7px 12px;font-size:14px";
  const status = core.el("div", "hint status"); status.id = "catchBindStatus";
  const hint = core.el("div", "hint", tr("catchHint")); hint.dataset.i18n = "catchHint";
  const bonus = core.el("label", "check");
  const bonusInput = document.createElement("input"); bonusInput.type = "checkbox"; bonusInput.id = "catchNitroBonus"; bonusInput.checked = core.settings.catchNitroBonus;
  const bonusText = core.el("span", "", tr("catchNitroBonus")); bonusText.dataset.i18n = "catchNitroBonus";
  bonus.append(bonusInput, bonusText);
  const bonusHint = core.el("div", "hint", tr("catchNitroBonusHint")); bonusHint.dataset.i18n = "catchNitroBonusHint";
  anchor.after(h3, rows, reset, status, hint, bonus, bonusHint);
  bonusInput.addEventListener("change", () => { core.settings.catchNitroBonus = bonusInput.checked; core.saveUserPrefs(); });
  const nextLabel = core.el("label", "check");
  const nextInput = document.createElement("input"); nextInput.type = "checkbox"; nextInput.id = "catchBlastNext"; nextInput.checked = core.settings.catchBlastNext;
  const nextText = core.el("span", "", tr("catchBlastNext")); nextText.dataset.i18n = "catchBlastNext";
  nextLabel.append(nextInput, nextText);
  const nextHint = core.el("div", "hint", tr("catchBlastNextHint")); nextHint.dataset.i18n = "catchBlastNextHint";
  bonusHint.after(nextLabel, nextHint);
  nextInput.addEventListener("change", () => { core.settings.catchBlastNext = nextInput.checked; core.saveUserPrefs(); });
  syncCatchKeyUI = () => {
    bonusInput.checked = core.settings.catchNitroBonus;
    nextInput.checked = core.settings.catchBlastNext;
    rows.textContent = "";
    ["catchLeft", "catchRight"].forEach((key, i) => {
      const row = core.el("div", "keyRow"), b = core.el("button", "", tr("assign"));
      b.type = "button"; b.classList.toggle("listening", catchBinding === i);
      b.addEventListener("click", () => {
        core.bindingSlot = null; core.updateKeyUI(); catchBinding = i; b.blur();
        core.setStatus("catchBindStatus", "catchCapture" + i); syncCatchKeyUI();
      });
      row.append(core.el("strong", "", tr(key)), core.el("span", "keyValue", core.formatKey(core.settings.catchKeys[i])), b);
      rows.append(row);
    });
  };
  reset.addEventListener("click", () => {
    core.settings.catchKeys = CATCH_DEFAULT_KEYS.slice(); catchBinding = null; core.saveUserPrefs();
    syncCatchKeyUI(); core.setStatus("catchBindStatus", "catchAssigned");
  });
  core.on("language", syncCatchKeyUI);
  syncCatchKeyUI();
})();
function captureCatchKey(code) {
  const i = catchBinding;
  if (code === "Escape") { catchBinding = null; core.setStatus("catchBindStatus", "cancelBind"); syncCatchKeyUI(); return; }
  if (RESERVED.has(code) || (core.settings.speedKeys || []).includes(code)) { core.setStatus("catchBindStatus", "reservedKey"); return; }
  if (core.settings.catchKeys[1 - i] === code) { core.setStatus("catchBindStatus", "duplicateKey"); return; }
  core.settings.catchKeys[i] = code; catchBinding = null; core.saveUserPrefs();
  core.setStatus("catchBindStatus", "catchAssigned"); syncCatchKeyUI();
}
/* ✅ catch.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.CATCH = CATCH;
window.catchAllKeys = catchAllKeys;
window.catchHitPos = catchHitPos;
window.catchJudge = catchJudge;
window.catchState = catchState;
window.drawCatchField = drawCatchField;
window.isBlast = isBlast;
window.isCatch = isCatch;
window.resetCatch = resetCatch;
/* 領域（window.Trk.modes）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.modes = Object.assign(window.Trk.modes || {}, { ORBIT_CX, ORBIT_CY, ORBIT_IGNORE, drawLives, drawOrbitField, failSound, hintEl, isOrbit, lifeAfterJudge, lifeState, makeCheck, makeColorRow, makeSeg, orbit, orbitHitPos, resetLives, resetOrbit, starPath, titleString, drawLaneTint, drawTruck, isTruck, lanePivot, laneTilt, reduceMotion, resetTruck, steerTruck, syncTruckKeyUI, truckJudge, truckKeysLabel, truckPosKeys, truckRowY, truckState, STAGE, drawStageField, ensureStageMap, isStage, resetStage, stageHitPos, stageInput, stageKeys, stageMap, stagePress, CATCH, catchAllKeys, catchHitPos, catchJudge, catchState, drawCatchField, isBlast, isCatch, resetCatch });
Object.defineProperty(window.Trk.modes, "truckBinding", { configurable:true, get:() => truckBinding, set:v => { truckBinding = v; } });
Object.defineProperty(window.Trk.modes, "stageBinding", { configurable:true, get:() => stageBinding, set:v => { stageBinding = v; } });
})();

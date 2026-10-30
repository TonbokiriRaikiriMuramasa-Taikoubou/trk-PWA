// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! extras.js — 🧰 上級者向けの便利機能
   ・🎯 オフセット測定（メトロノームに合わせてタップ）／プレイ後の自動微調整
   ・📊 リザルトに判定の平均とばらつき
   ・👻 ゴースト（自己ベストとの差をプレイ中に表示）
   ・🌗 背景の暗さ・ぼかしの設定欄（効果は core.js・render.js が反映）
   game.js が stats.errN／errSum／errSq を集計し、render.js が drawExtrasOverlay() を呼びます。
   読み込み順：catch.js の後、library.js の前
   ========================================================================== */
"use strict";
(() => {
  const core = window.Trk.core;
Object.assign(TEXT.ja, {
  owTitle:"🎯 オフセットを測る", owStart:"▶ 測定をはじめる", owTap:"🥁 音に合わせてタップ（どのキーでもOK）",
  owHint:"カチッという音に合わせて16回ほどタップしてください。画面ではなく、耳で合わせるのがコツです。イヤホンを変えたら測り直しましょう。",
  owRunning:"測定中… {n}回", owResult:"ずれの目安：{m}ms（ばらつき {s}ms）→ おすすめの補正値：{v}ms",
  owApply:"✓ この値にする", owApplied:"タイミング補正を {v}ms にしました。", owFail:"うまく測れませんでした。もう一度試してください。",
  autoAdj:"プレイ後にタイミング補正を自動で微調整する（MANUAL・ORBIT・STAGE）",
  autoAdjDone:"タイミング補正を {d}ms 調整しました（現在 {v}ms）",
  ghostLabel:"👻 プレイ中に自己ベストとの差を表示する（ゴースト）",
  judgeStats:"📊 判定 平均 {m}ms · ばらつき {s}ms", bgDim:"背景の暗さ", bgBlur:"背景のぼかし"
});
Object.assign(TEXT.en, {
  owTitle:"🎯 Measure offset", owStart:"▶ Start", owTap:"🥁 Tap to the click (any key)",
  owHint:"Tap about 16 times along with the clicks. Use your ears, not the screen. Measure again when you switch headphones.",
  owRunning:"Measuring… {n} taps", owResult:"Average offset {m} ms (spread {s} ms) → suggested latency {v} ms",
  owApply:"✓ Use this value", owApplied:"Latency set to {v} ms.", owFail:"Couldn't measure. Please try again.",
  autoAdj:"Fine-tune latency automatically after each play (MANUAL / ORBIT / STAGE)",
  autoAdjDone:"Latency adjusted by {d} ms (now {v} ms)",
  ghostLabel:"👻 Show the difference from your best during play (ghost)",
  judgeStats:"📊 Timing mean {m} ms · spread {s} ms", bgDim:"Background dim", bgBlur:"Background blur"
});
Object.assign(TEXT.zh, {
  owTitle:"🎯 测量偏移", owStart:"▶ 开始测量", owTap:"🥁 跟着声音点击（任意键）",
  owHint:"请跟着“咔哒”声点击约16次。用耳朵对拍，而不是看画面。更换耳机后请重新测量。",
  owRunning:"测量中… {n}次", owResult:"平均偏差 {m}ms（离散 {s}ms）→ 建议补偿值 {v}ms",
  owApply:"✓ 使用此值", owApplied:"已将延迟补偿设为 {v}ms。", owFail:"测量失败，请重试。",
  autoAdj:"每次游玩后自动微调延迟补偿（MANUAL·ORBIT·STAGE）",
  autoAdjDone:"已调整延迟补偿 {d}ms（当前 {v}ms）",
  ghostLabel:"👻 游玩中显示与个人最佳的差距（幽灵）",
  judgeStats:"📊 判定 平均 {m}ms · 离散 {s}ms", bgDim:"背景暗度", bgBlur:"背景模糊"
});
Object.assign(TEXT.ko, {
  owTitle:"🎯 오프셋 측정", owStart:"▶ 측정 시작", owTap:"🥁 소리에 맞춰 탭 (아무 키나)",
  owHint:"딸깍 소리에 맞춰 16번 정도 탭하세요. 화면이 아니라 귀로 맞추는 것이 요령입니다. 이어폰을 바꾸면 다시 측정하세요.",
  owRunning:"측정 중… {n}회", owResult:"평균 어긋남 {m}ms (흩어짐 {s}ms) → 추천 보정값 {v}ms",
  owApply:"✓ 이 값으로", owApplied:"지연 보정을 {v}ms로 설정했습니다.", owFail:"측정하지 못했습니다. 다시 시도해 주세요.",
  autoAdj:"플레이 후 지연 보정을 자동으로 미세 조정 (MANUAL·ORBIT·STAGE)",
  autoAdjDone:"지연 보정을 {d}ms 조정했습니다 (현재 {v}ms)",
  ghostLabel:"👻 플레이 중 개인 최고 기록과의 차이 표시 (고스트)",
  judgeStats:"📊 판정 평균 {m}ms · 흩어짐 {s}ms", bgDim:"배경 어둡기", bgBlur:"배경 흐림"
});

core.settings.autoAdjust ??= !!core.prefs.autoAdjust;
core.settings.ghost ??= core.prefs.ghost !== false;
core.settings.bgDim ??= core.num(core.prefs.bgDim, 0, .9, 0);
core.settings.bgBlur ??= core.num(core.prefs.bgBlur, 0, 12, 0);
const signed = v => (v > 0 ? "+" : "") + v;

/* ============ 🎯 オフセット測定 ============ */
const OW_N = 20, OW_IV = 500, OW_SKIP = 4;          // 120BPMで20回。最初の4回は慣らし
const ow = { running:false, beats:[], taps:[], timer:0, value:null };
let owStatus, owApply, owTapBtn;
function owClick(ac, t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "square"; o.frequency.value = 1500;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.05, core.settings.seVolume), t + .002);
  g.gain.exponentialRampToValueAtTime(.0001, t + .05);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .06);
}
function owStart() {
  const ac = window.Trk.media.getAC(); if (!ac) { owStatus.textContent = tr("seUnavailable"); return; }
  if (ac.state === "suspended") ac.resume();
  const lead = .8, t0 = ac.currentTime + lead, p0 = performance.now() + lead * 1000;
  ow.beats = []; ow.taps = []; ow.value = null; ow.running = true; owApply.hidden = true;
  for (let i = 0; i < OW_N; i++) { owClick(ac, t0 + i * OW_IV / 1000); ow.beats.push(p0 + i * OW_IV); }
  owStatus.textContent = tr("owRunning", { n:0 });
  clearTimeout(ow.timer); ow.timer = setTimeout(owFinish, lead * 1000 + OW_N * OW_IV + 400);
}
function owTap(ts) {
  if (!ow.running) return;
  ow.taps.push(ts || performance.now());
  owStatus.textContent = tr("owRunning", { n:ow.taps.length });
  owTapBtn.animate([{ transform:"scale(.94)" }, { transform:"scale(1)" }], 120);
}
function owFinish() {
  ow.running = false;
  const ds = [];
  for (const t of ow.taps) {
    let best = null;
    for (let i = OW_SKIP; i < ow.beats.length; i++) { const d = t - ow.beats[i]; if (Math.abs(d) < OW_IV * .45 && (best === null || Math.abs(d) < Math.abs(best))) best = d; }
    if (best !== null) ds.push(best);
  }
  if (ds.length < 8) { owStatus.textContent = tr("owFail"); return; }
  ds.sort((a, b) => a - b);
  const med = ds[Math.floor(ds.length / 2)], mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / ds.length);
  ow.value = Math.max(-300, Math.min(500, Math.round(med)));
  owStatus.textContent = tr("owResult", { m:signed(Math.round(med)), s:Math.round(sd), v:signed(ow.value) });
  owApply.hidden = false;
}
addEventListener("keydown", e => {                   // 測定中は、どのキーでもタップ
  if (window.Trk.overlay.any() || !ow.running || e.repeat) return;
  e.preventDefault(); e.stopImmediatePropagation(); owTap(e.timeStamp);
}, true);
(() => {
  const anchor = document.querySelector('#settingsScreen [data-i18n="latencyHint"]'); if (!anchor) return;
  const box = core.el("details", "subPanel"), sum = core.el("summary"); sum.dataset.i18n = "owTitle"; box.append(sum);
  const hint = core.el("div", "hint"); hint.dataset.i18n = "owHint";
  const start = core.el("button"); start.type = "button"; start.dataset.i18n = "owStart";
  owTapBtn = core.el("button", "primary"); owTapBtn.type = "button"; owTapBtn.dataset.i18n = "owTap"; owTapBtn.style.marginTop = "8px";
  owStatus = core.el("div", "hint status");
  owApply = core.el("button"); owApply.type = "button"; owApply.dataset.i18n = "owApply"; owApply.hidden = true;
  start.addEventListener("click", owStart);
  owTapBtn.addEventListener("pointerdown", e => { e.preventDefault(); owTap(e.timeStamp); });
  owApply.addEventListener("click", () => {
    if (ow.value == null) return;
    core.settings.latency = ow.value; core.$("latency").value = ow.value; core.saveUserPrefs();
    owStatus.textContent = tr("owApplied", { v:signed(ow.value) }); owApply.hidden = true;
  });
  box.append(hint, start, owTapBtn, owStatus, owApply);
  anchor.after(box, window.Trk.modes.makeCheck("autoAdjust", "autoAdjust", "autoAdj"));
})();

/* ============ 📊 判定の平均とばらつき／🎯 自動微調整（リザルト） ============ */
core.on("screen", id => {
  if (id !== "endScreen") return;
  const n = core.stats.errN || 0; if (n < 5) return;
  const m = core.stats.errSum / n, sd = Math.sqrt(Math.max(0, core.stats.errSq / n - m * m));
  core.$("result").append(core.el("div", "best", tr("judgeStats", { m:signed(+m.toFixed(1)), s:sd.toFixed(1) })));
  if (!core.settings.autoAdjust || core.settings.autoPlay || n < 20 || !["manual", "orbit", "stage"].includes(core.settings.playMode)) return;
  const d = Math.max(-15, Math.min(15, Math.round(m * .5)));
  if (Math.abs(d) < 2) return;
  core.settings.latency = Math.max(-300, Math.min(500, core.settings.latency + d));
  core.$("latency").value = core.settings.latency; core.saveUserPrefs();
  core.setStatus("endStatus", "autoAdjDone", { d:signed(d), v:signed(core.settings.latency) });
});

/* ============ 👻 ゴースト ============ */
let ghostBest = 0;
core.on("beforePlay", () => {
  ghostBest = 0;
  if (!core.settings.ghost || core.settings.autoPlay) return;
  const s = window.Trk.play.songRec(false); if (!s) return;
  const c = s.charts[window.Trk.play.chartKeyOf()]; if (!c) return;
  const base = core.settings.playMode === "manual" ? c : c[core.settings.playMode];
  const rk = window.Trk.play.rateKey(), slot = rk && core.settings.rate > 1 ? base && base.rates && base.rates[rk] : base;
  ghostBest = slot && slot.best ? Number(slot.best.score) || 0 : 0;
});
function drawGhost() {
  if (!core.settings.ghost || !ghostBest || !(core.phase === "playing" || core.phase === "paused") || !core.chart.length) return;
  const judged = core.stats.perfect + core.stats.good + core.stats.miss;
  const diff = Math.round(window.Trk.play.currentScore() - ghostBest * judged / core.chart.length);
  const vertical = core.settings.layout === "vertical" && !["stage", "catch"].includes(core.settings.playMode);
  const g = core.skin().game, x = vertical ? 760 : 70, y = 226;
  core.ctx.save();
  core.ctx.font = `800 18px ${core.fontFamily()}`; core.ctx.textAlign = "left"; core.ctx.textBaseline = "middle";
  const t = `👻 ${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString()}`;
  core.ctx.lineWidth = 4; core.ctx.strokeStyle = "rgba(0,0,0,.6)"; core.ctx.strokeText(t, x, y);
  core.ctx.fillStyle = diff >= 0 ? g.perfect : g.miss; core.ctx.fillText(t, x, y);
  core.ctx.restore();
}
window.drawExtrasOverlay = drawGhost;
(() => {
  const anchor = core.$("errorMeter") && core.$("errorMeter").closest("label"); if (!anchor) return;
  anchor.after(window.Trk.modes.makeCheck("ghost", "ghost", "ghostLabel"));
})();

/* ============ 🌗 背景の暗さ・ぼかし（設定欄） ============ */
(() => {
  const field = core.$("videoStyle") && core.$("videoStyle").closest(".fields2"); if (!field) return;
  const rows = [["bgDim", "bgDim", 0, .9, .05, v => Math.round(v * 100) + "%"], ["bgBlur", "bgBlur", 0, 12, 1, v => v + "px"]].map(([key, label, min, max, step, fmt]) => {
    const row = core.el("div", "inline"), lab = core.el("span"), inp = document.createElement("input"), val = core.el("span", "mono");
    lab.dataset.i18n = label; inp.type = "range"; inp.min = min; inp.max = max; inp.step = step;
    lab.id = "videoStyleLab-" + key; inp.setAttribute("aria-labelledby", lab.id);
    const sync = () => { inp.value = core.settings[key]; val.textContent = fmt(core.settings[key]); };
    inp.addEventListener("input", () => { core.settings[key] = Number(inp.value); core.saveUserPrefs(); sync(); core.view.style.filter = core.videoFilter(); });
    sync(); row.append(lab, inp, val);
    return row;
  });
  field.after(...rows);
})();
})();
/* ✅ extras.js 完了 */

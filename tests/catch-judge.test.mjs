// SPDX-License-Identifier: GPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// trk145: CATCHの判定（good を持たない・ぶっ飛ばし中は★）と既定キー（左＝A、右＝Space）を、
// js/catch.js を vm で動かして確かめる。ブラウザは使わない（依存は何でも返す代用品）。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "js/catch.js"), "utf8")
  .replace("window.catchState = catchState;", "window.catchState = catchState; window.__catchMap = catchMap; window.__catchKeys = { def: CATCH_DEFAULT_KEYS, alt: CATCH_ALT }; window.__triggerBlast = triggerBlast; window.__CATCH = CATCH;");   /* 検査用に譜面の表を外へ見せる */

function loadCatch(seedValue = "") {
  const judged = [];
  const effects = [];
  const settings = { playMode: "catch", autoPlay: false, catchKeys: undefined, catchNitroBonus: true, hideGameplayUI: true };
  const prefs = {};
  // 何を呼んでも・何を読んでも落ちない代用品
  const anything = (name = "any") => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : anything(String(k))),
    apply: () => anything(),
    construct: () => anything(),
  });
  const core = new Proxy({}, {
    get: (t, k) => {
      if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
      if (k === "settings") return settings;
      if (k === "prefs") return prefs;
      if (k === "stats") return t.stats || (t.stats = { perfect: 0, combo: 0 });
      if (k === "chart") return t.chart;
      if (k === "nextIdx") return t.nextIdx ?? 0;
      if (k === "chartMeta") return { bpm: 120 };
      if (k === "chartDiff") return "easy";
      if (k === "phase") return "playing";
      if (k === "effects") return effects;
      if (k === "validCode") return () => false;
      if (k === "formatKey") return c => c;
      if (k === "$") return () => ({ value: seedValue, style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} });
      if (k === "on" || k === "addEventListener") return () => {};
      return anything(String(k));
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const play = {
    judgeNote: (n, kind, delta) => judged.push({ kind, delta }),
    showToast() {}, gameTime: () => 0, leadIn: false, rr() {},
  };
  const data = { TAU: Math.PI * 2, W: 1920, H: 1080, hexToRgba: () => "", EGG_KEYS: {}, LAYOUTS: {} };
  const windowStub = { Trk: { core, play, data, media: { playSE() {}, getAC: () => anything("audio") }, modes: {} } };
  const ctx = vm.createContext({
    core, window: windowStub, document: anything("document"), performance: { now: () => 0 },
    addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    Float32Array, Math, Date, JSON, Number, String, Array, Object, Set, Map, console, setTimeout() {},
    requestAnimationFrame() {}, cancelAnimationFrame() {}, Image: function () {}, AudioContext: function () {},
    tr: k => k, reduceMotion: { matches: false }, TEXT: { ja: {}, en: {}, zh: {}, ko: {} },
  });
  /* catch.js の末尾は、他ファイル（modes.js など）の名前を window.Trk.modes へ並べて渡すだけ。値は判定に使わないので、名前だけ用意する */
  const names = [...source.matchAll(/window\.Trk\.modes = Object\.assign\(window\.Trk\.modes \|\| \{\}, \{([^}]*)\}/g)].flatMap(m => m[1].split(",").map(x => x.trim()).filter(x => /^[A-Za-z_$][\w$]*$/.test(x)));
  vm.runInContext(`var ${[...new Set(names)].join(", ")};`, ctx, { filename: "stub" });
  vm.runInContext(source, ctx, { filename: "js/catch.js" });
  return { ctx, judged, effects, settings, core };
}

// 1点だけの譜面を置いて、荷物の位置 x と、キャッチャーの位置 catchX を決める
function judgeAt(dx, { blast = false } = {}) {
  const env = loadCatch();
  const { ctx, judged, core } = env;
  const run = code => vm.runInContext(code, ctx);
  const map = ctx.window.__catchMap;
  core.chart = [{ time: 1000, lane: 0, judged: false }];
  core.nextIdx = 0;
  // ensureCatchMap が作り直さないよう、キーを合わせておく
  map.src = core.chart; map.len = 1; map.key = "|easy|120"; map.xs = new ctx.Float32Array([0.5]);
  ctx.window.catchState.x = 0.5 + dx; ctx.window.catchState.blastUntil = blast ? 5000 : -1e9;
  ctx.window.catchJudge(1000);
  return judged;
}

test("既定キー：左＝A（ドン）、右＝Space（カッ）。← → は別の割り当て", () => {
  const { ctx } = loadCatch();
  const keys = JSON.parse(JSON.stringify(ctx.window.__catchKeys));
  assert.deepEqual(keys.def, ["KeyA", "Space"]);
  assert.deepEqual(keys.alt, ["ArrowLeft", "ArrowRight"]);
});

test("good は出ない：範囲の中ならどこで捕まえても perfect", () => {
  for (const dx of [0, 0.02, 0.05, 0.07, 0.084]) {
    const [hit] = judgeAt(dx);
    assert.equal(hit.kind, "perfect", `dx=${dx}`);
  }
});

test("ぶっ飛ばし中は、ズレに関係なく★（精度完璧＝delta 0）", () => {
  for (const dx of [0, 0.07, 0.15]) {
    const [hit] = judgeAt(dx, { blast: true });
    assert.equal(hit.kind, "perfect", `dx=${dx}`);
    assert.equal(hit.delta, 0, `dx=${dx} should be perfect+`);
  }
});

test("ぶっ飛ばし前は、ごくわずかなズレだけ★（従来どおり）", () => {
  assert.equal(judgeAt(0.01)[0].delta, 0);
  assert.equal(judgeAt(0.07)[0].delta, null);
});

test("範囲の外は miss", () => {
  assert.equal(judgeAt(0.2)[0].kind, "miss");
});

test("ぶっ飛ばしは10秒（BPMに関係なく固定）", () => {
  const env = loadCatch();
  const { ctx } = env;
  const w = ctx.window;
  w.catchState.blastUntil = -1e9;
  w.__triggerBlast(1000, { x: 0.5 });
  assert.equal(w.catchState.blastUntil - 1000, 10000);
  assert.equal(w.__CATCH.blastMs, 10000);
  env.core.chart = []; env.core.nextIdx = 0;       // 画面の荷物はない譜面
  w.__triggerBlast(2000, { x: 0.5 });
  assert.equal(w.catchState.blastUntil, 2000, "重なると、ぶっ飛ばしは終わる（足されない）");
});

// trk146：「ぶっ飛ばしは次の荷物まで」オプション（既定はオフ＝10秒）
test("既定はオフ：ぶっ飛ばしは10秒（catchBlastNext は false）", () => {
  const { ctx, settings } = loadCatch();
  assert.equal(settings.catchBlastNext, undefined);
  ctx.window.catchState.blastUntil = -1e9;
  ctx.window.__triggerBlast(1000, { x: 0.5 });
  assert.equal(ctx.window.catchState.blastUntil - 1000, 10000);
});

test("次の荷物まで：発動後は続き（Infinity）、次の荷物を判定した時点で終わる", () => {
  const env = loadCatch();
  const { ctx, judged, core, settings } = env;
  settings.catchBlastNext = true;
  const w = ctx.window;
  w.catchState.blastUntil = -1e9;
  w.__triggerBlast(500, { x: 0.5 });
  assert.equal(w.catchState.blastUntil, Infinity);
  // 時間が経っても続く
  assert.ok(w.catchState.blastUntil > 60000);
  // 次の荷物が2つある譜面。1つ目を判定すると終わるので、2つ目は ★ にならない
  core.chart = [{ time: 1000, lane: 0, judged: false }, { time: 2000, lane: 0, judged: false }];
  core.nextIdx = 0;
  const map = w.__catchMap;
  map.src = core.chart; map.len = 2; map.key = "|easy|120"; map.xs = new ctx.Float32Array([0.5, 0.57]);   // 2つ目は少しずらす（ぶっ飛ばしが終われば ★ にならない）
  w.catchState.x = 0.5;
  w.catchJudge(2500);
  assert.equal(judged.length, 1, "判定は1つで止まる（同じフレームの残りは次へ）");
  assert.equal(judged[0].delta, 0, "1つ目はぶっ飛ばし中の★");
  assert.equal(w.catchState.blastUntil, 2500, "判定で終わる");
  core.chart[0].judged = true; core.nextIdx = 1;   // 実際の判定と同じく、判定済みにしてから次のフレーム
  w.catchJudge(2600);
  assert.equal(judged.length, 2);
  assert.equal(judged[1].delta, null, "2つ目はもう ★ ではない");
});

test("次の荷物まで：ゲージは壊れない（無限でも NaN にならない）", () => {
  const src = fs.readFileSync(path.join(root, "js/catch.js"), "utf8");
  assert.ok(src.includes("isFinite(catchState.blastLen)"));
});

// trk149：ぶっ飛ばし中にニトロ缶を取った（重なった）→ 画面に見えている荷物を消して終わる
test("重なると、見えている荷物を取った扱いで消して、ぶっ飛ばしが終わる", () => {
  const env = loadCatch();
  const { ctx, judged, core } = env;
  const w = ctx.window;
  core.travelMs = () => 5000;               // 画面に見える時間（描画と同じ幅）
  w.catchState.blastUntil = -1e9;
  w.__triggerBlast(500, { x: 0.5 });
  assert.equal(w.catchState.blastUntil - 500, 10000);
  core.chart = [
    { time: 1500, lane: 0, judged: false },   // 見えている → 消える
    { time: 2000, lane: 1, judged: false },   // 見えている → 消える
    { time: 40000, lane: 0, judged: false },  // 画面の外 → 残る
  ];
  core.nextIdx = 0;
  const map = w.__catchMap;
  map.src = core.chart; map.len = 3; map.key = "|easy|120"; map.xs = new ctx.Float32Array([0.3, 0.6, 0.5]);
  w.__triggerBlast(1000, { x: 0.5 });
  assert.equal(w.catchState.blastUntil, 1000, "終わる");
  assert.equal(judged.length, 2, "見えている2つだけ");
  assert.deepEqual(judged.map(j => j.kind), ["perfect", "perfect"]);
  assert.ok(judged.every(j => j.delta === 0), "消した荷物は★扱い");
});

test("重なりは、ぶっ飛ばし中のときだけ。ぶっ飛ばし前のニトロ缶は通常どおり発動", () => {
  const { ctx } = loadCatch();
  const w = ctx.window;
  w.catchState.blastUntil = -1e9;
  w.__triggerBlast(1000, { x: 0.5 });
  assert.equal(w.catchState.blastUntil - 1000, 10000);
});

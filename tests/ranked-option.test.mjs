// SPDX-License-Identifier: GPL-3.0-or-later
/* ランク判定（ゆるめ判定・1.00x未満は練習扱い、きびしめ・1.05x以上は記録対象）の検査。
   js/core.js の modsUnranked と js/game.js の記録まわり（recordPlay）を実ソースから取り出して動かす。
   ブラウザが無い環境でも、記録の結果（ハイスコア・プレイ回数）が設定どおりか確かめられる。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreSource = fs.readFileSync(path.join(root, "js/core.js"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const modsLine = coreSource.match(/^const modsUnranked = .*$/m)[0];
/* trk19x: 記録の判定は「その回にAUTOを使ったか」も見る（runAutoUsed）。宣言は記録ブロックの外にある。 */
const runStateLine = gameSource.match(/^let runPaused = .*$/m)[0];
const a = gameSource.indexOf("const rateKey = ");
const b = gameSource.indexOf("function slotCell(");
assert.ok(a > 0 && b > a, "game.js record block must be found");
const recordBlock = gameSource.slice(a, b);

function run({ judge = "standard", rate = 1, autoPlay = false, score = 1000, prev = null, prevJudge = judge } = {}) {
  const store = new Map();
  const core = {
    settings: { judge, rate, autoPlay, playMode: "manual" },
    stats: { perfect: 10, good: 0, miss: 0, crash: 0, maxCombo: 10, star: 0 },
    chart: [{ time: 1, lane: 0 }, { time: 2, lane: 1 }],
    fingerprint: "1234:abcd", mediaName: "song.ogg", chartDiff: "easy", currentLevel: 3, chartMode: "generated",
    practice: false,
    hashString: s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h >>> 0; },
    baseName: n => n, currentSong: null,
    modsUnranked: null,
    activeMods: () => [],
    emit() {},
    on() { return () => {}; },
  };
  const context = vm.createContext({
    core, settings: core.settings,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    console, renderRecords() {}, window: { Trk: { modes: { lifeTags: () => [] } } },
  });
  vm.runInContext(`${modsLine}\ncore.modsUnranked = modsUnranked;`, context);
  vm.runInContext(`${runStateLine}\n${recordBlock}\nglobalThis.recordPlay = recordPlay; globalThis.songRec = songRec; globalThis.runUnranked = runUnranked;`, context);
  if (prev !== null) {
    // 前回のプレイを先に記録しておく（同じ譜面・同じ設定）
    core.settings.judge = prevJudge;
    context.recordPlay({ score: prev, acc: 90, grade: "A", ap: false, fc: false, failed: false, short: 0 });
    core.settings.judge = judge;
  }
  const out = context.recordPlay({ score, acc: 99, grade: "S", ap: false, fc: false, failed: false, short: 0 });
  const rec = context.songRec(false);
  const chart = rec.charts[Object.keys(rec.charts)[0]];
  return { out, rec, chart, rated: !context.runUnranked() };
}

test("ゆるめ判定は練習扱い：プレイ回数は増えるが、ハイスコアは更新されない", () => {
  const r = run({ judge: "lenient", score: 5000 });
  assert.equal(r.rated, false);
  assert.equal(r.out.isNew, false);
  assert.equal(r.chart.best, null);
  assert.equal(r.chart.plays, 1);
});

test("きびしめ（standard・strict）はランク対象：ハイスコアが更新される", () => {
  for (const judge of ["standard", "strict"]) {
    const r = run({ judge, score: 5000 });
    assert.equal(r.rated, true, judge);
    assert.equal(r.out.isNew, true, judge);
    assert.equal(r.chart.best.score, 5000, judge);
  }
});

test("1.00x未満は練習扱い、1.05x以上は速度別にランク対象", () => {
  const slow = run({ rate: 0.9, score: 5000 });
  assert.equal(slow.rated, false);
  assert.equal(slow.out.isNew, false);
  assert.equal(slow.chart.best, null);

  const fast = run({ rate: 1.25, score: 5000 });
  assert.equal(fast.rated, true);
  assert.equal(fast.out.isNew, true);
  assert.equal(fast.chart.rates["1.25"].best.score, 5000, "速度別の記録に入る");
});

test("ランク対象のプレイは前回のベストより高いときだけ更新する", () => {
  const lower = run({ judge: "strict", score: 4000, prev: 5000 });
  assert.equal(lower.out.isNew, false);
  assert.equal(lower.chart.best.score, 5000, "ベストは残る");
});

test("ゆるめで出した高得点は、きびしめのベストを上書きしない（練習の点数は混ざらない）", () => {
  const r = run({ judge: "lenient", score: 9999, prev: 3000, prevJudge: "strict" });
  assert.equal(r.chart.best.score, 3000);
  assert.equal(r.chart.plays, 2);
});

test("AUTO は記録されない（プレイ回数も増えない）", () => {
  const r = run({ autoPlay: true, score: 5000 });
  assert.equal(r.rated, false);
  assert.equal(r.chart.plays, 0);
});

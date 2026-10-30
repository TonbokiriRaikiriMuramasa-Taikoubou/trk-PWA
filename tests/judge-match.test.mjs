// SPDX-License-Identifier: GPL-3.0-or-later
/* MANUAL の打鍵とノーツの対応づけ（js/judge-match.js）を node --test で検査する（依存パッケージ不要）。
 *
 *   node --test tests/        または   npm test
 *
 * 1) 純関数 matchManualInput の場面別の検査（密な連打の「巻き込み」：旧方式 "ordered" で連鎖し、既定 "smart" で連鎖しない）
 * 2) js/game.js の handleInput（実ソースを切り出して VM で実行）が judge-match を通して judgeNote を呼ぶ配線
 * 3) 実ソースの自動譜面（js/chart-gen.js＋合成曲）に対するプレイヤーモデルの小さなシミュレーション
 * 4) 設定 judgeOrdered（❓謎設定）の配線：初期値・リセット・UI・4言語 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT, loadBrowserData } from "./helpers/browser-data.mjs";
import { SYNTH_SONGS, synthAnalysis, makeLcg } from "./helpers/synth.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read("js/judge-match.js"), ctx, { filename: "js/judge-match.js" });
const { matchManualInput, JUDGE_POLICIES, JUDGE_POLICY_DEFAULT } = ctx.window.Trk.judge;

/* 上級の判定幅（data.js の DIFFS.hard と同じ値）。16分＝86ms（約174BPM）は GOOD 幅より狭い */
const W = { perfect: 36, good: 95 };
const GAP = 86;
const mk = (...lanes) => lanes.map((lane, i) => ({ time: 1000 + i * GAP, lane, judged: false }));

/* 小さな再生器：打鍵列を順に当て、判定幅を出た未判定ノーツは sweepMisses と同じ条件で MISS にする */
function play(chart, presses, policy, w = W) {
  const notes = chart.map(n => ({ ...n, result: null }));
  let nextIdx = 0;
  const results = [];
  const judge = (i, kind) => { notes[i].judged = true; notes[i].result = kind; while (nextIdx < notes.length && notes[nextIdx].judged) nextIdx++; };
  const sweep = now => { for (let i = nextIdx; i < notes.length; i++) { const n = notes[i]; if (n.time > now - w.good) break; if (!n.judged) judge(i, "miss"); } };
  for (const p of presses) {
    sweep(p.t);
    const r = matchManualInput(notes, nextIdx, p.lane, p.t, w, policy);
    results.push(r ? `${r.kind}@${r.idx}${r.wrongLane ? "!" : ""}` : "none");
    if (r) judge(r.idx, r.kind);
  }
  sweep(Infinity);
  return { results, final: notes.map(n => n.result), misses: notes.filter(n => n.result === "miss").length };
}

describe("判定の対応づけ（純関数）", () => {
  test("公開面：方式は smart と ordered、既定は smart", () => {
    assert.deepEqual([...JUDGE_POLICIES], ["smart", "ordered"]);          // VM 側の配列なので展開して比べる
    assert.equal(JUDGE_POLICY_DEFAULT, "smart");
  });

  test("普通に叩けば両方式とも同じ：PERFECT／GOOD の境界と、判定幅の外は空振り", () => {
    for (const policy of JUDGE_POLICIES) {
      const c = mk(0, 1);
      assert.deepEqual({ ...matchManualInput(c, 0, 0, 1000, W, policy) }, { idx: 0, kind: "perfect", delta: 0, wrongLane: false }, policy);
      assert.equal(matchManualInput(c, 0, 0, 1000 + 36, W, policy).kind, "perfect", `${policy}: |d|=perfect は PERFECT`);
      assert.equal(matchManualInput(c, 0, 0, 1000 - 37, W, policy).kind, "good", `${policy}: perfect を1ms外れると GOOD`);
      assert.equal(matchManualInput(c, 0, 0, 1000 + 95, W, policy).kind, "good", `${policy}: |d|=good は GOOD`);
      assert.equal(matchManualInput(c, 0, 0, 1000 - 96, W, policy), null, `${policy}: good の外は空振り`);
      assert.equal(matchManualInput(mk(), 0, 0, 1000, W, policy), null, `${policy}: ノーツが無ければ空振り`);
    }
  });

  test("判定済みのノーツと nextIdx より前は見ない。判定幅を出たが未処理のノーツは無いものとして扱う", () => {
    for (const policy of JUDGE_POLICIES) {
      const c = mk(0, 0, 0);
      c[0].judged = true;
      assert.equal(matchManualInput(c, 0, 0, 1000 + 40, W, policy).idx, 1, `${policy}: 判定済みを飛ばす`);
      assert.equal(matchManualInput(mk(0, 0), 1, 0, 1000 + 40, W, policy).idx, 1, `${policy}: nextIdx より前は見ない`);
      const past = mk(1, 0);                                   // 1つ目は 100ms 前（GOOD 幅の外）で、まだ sweep されていない
      const r = matchManualInput(past, 0, 0, 1000 + 100, W, policy);
      assert.deepEqual([r.idx, r.kind], [1, "perfect"], `${policy}: 幅を出たノーツには当てない`);
    }
  });

  test("色違いをノーツの時刻ちょうどに押せば、両方式とも MISS（両ボタン連打の抑止）", () => {
    const c = [{ time: 1000, lane: 0, judged: false }, { time: 1300, lane: 1, judged: false }];   // 次のカは判定幅の外
    for (const policy of JUDGE_POLICIES) {
      const r = matchManualInput(c, 0, 1, 1000 + 5, W, policy);
      assert.deepEqual([r.idx, r.kind, r.wrongLane], [0, "miss", true], policy);
    }
  });

  test("色違いの直後（判定幅内）に同色ノーツが続くときは、smart はそちらへ届く（旧方式は前のノーツを MISS）", () => {
    const r = matchManualInput(mk(0, 1), 0, 1, 1000 + 5, W, "smart");    // ド@1000 カ@1086 で、カを 1005 に押す
    assert.deepEqual([r.idx, r.kind], [1, "good"], "81ms 早い GOOD（ドは判定幅を出たときに MISS）");
    const o = matchManualInput(mk(0, 1), 0, 1, 1000 + 5, W, "ordered");
    assert.deepEqual([o.idx, o.kind], [0, "miss"]);
  });

  test("【巻き込み】ドカドの1つ目を落としても、以降の正しい打鍵は吸われない（旧方式は連鎖）", () => {
    const c = mk(0, 1, 0);
    const presses = [{ t: 1000 + GAP, lane: 1 }, { t: 1000 + GAP * 2, lane: 0 }];   // 2つ目・3つ目を時刻どおりに
    const smart = play(c, presses, "smart");
    assert.deepEqual(smart.results, ["perfect@1", "perfect@2"]);
    assert.deepEqual(smart.final, ["miss", "perfect", "perfect"], "落とした1個だけが MISS");
    const ordered = play(c, presses, "ordered");
    assert.deepEqual(ordered.results, ["miss@0!", "miss@1!"], "旧方式：正しい打鍵が前の色違いノーツに吸われる");
    assert.deepEqual(ordered.final, ["miss", "miss", "miss"], "旧方式：3つとも MISS");
  });

  test("【巻き込み】早すぎる空振りのあと、正しい打鍵が連鎖 MISS にならない（trk98 までの再現）", () => {
    /* ド カ ド カ の 16 分。1つ目のドを 100ms 早く（幅の外）押して空振り。あとは全部ぴったり */
    const c = mk(0, 1, 0, 1);
    const presses = [{ t: 1000 - 100, lane: 0 }, { t: 1000 + GAP, lane: 1 }, { t: 1000 + GAP * 2, lane: 0 }, { t: 1000 + GAP * 3, lane: 1 }];
    const smart = play(c, presses, "smart");
    assert.deepEqual(smart.results, ["none", "perfect@1", "perfect@2", "perfect@3"]);
    assert.equal(smart.misses, 1);
    const ordered = play(c, presses, "ordered");
    assert.deepEqual(ordered.final, ["miss", "miss", "miss", "miss"], "旧方式：1回の空振りで4つとも MISS");
  });

  test("同じ色の連打は時刻順のまま：遅れ気味でも次のノーツに飛ばない（両方式とも全部 GOOD、MISS なし）", () => {
    const c = mk(0, 0, 0, 0);
    const presses = c.map(n => ({ t: n.time + 45, lane: 0 }));   // 45ms 遅れ（GAP の半分を超える）
    for (const policy of JUDGE_POLICIES) {
      const r = play(c, presses, policy);
      assert.deepEqual(r.final, ["good", "good", "good", "good"], policy);
    }
  });

  test("隣り合う2つの打鍵の順番が入れ替わっても、どちらも判定幅内なら両方 GOOD（旧方式は MISS）", () => {
    const c = mk(0, 1);
    const presses = [{ t: 1000 + GAP - 62, lane: 1 }, { t: 1000 + 51, lane: 0 }];   // カが先（62ms早い）、ドが後（51ms遅い）
    const smart = play(c, presses, "smart");
    assert.deepEqual(smart.results, ["good@1", "good@0"]);
    assert.equal(smart.misses, 0);
    const ordered = play(c, presses, "ordered");
    assert.equal(ordered.results[0], "miss@0!", "旧方式：先に来たカがドを MISS にする");
  });

  test("前の色違いノーツの時刻より前には、後ろの同色ノーツへ飛べない（osu!lazer と同じ境界）", () => {
    const c = mk(1, 0);
    /* カ@1000（未判定）、ド@1086。ドを 1000 より前に押すと届かない。ちょうど 1000 なら届く */
    const before = matchManualInput(c, 0, 0, 999, W, "smart");
    assert.deepEqual([before.idx, before.kind, before.wrongLane], [0, "miss", true], "時刻前：カへの色違い打鍵として MISS");
    const at = matchManualInput(c, 0, 0, 1000, W, "smart");
    assert.deepEqual([at.idx, at.kind], [1, "good"], "時刻ちょうど：後ろのドに届く");
  });

  test("色違いの打鍵が PERFECT 幅より早ければ空振り（相手を巻き込まない）。PERFECT 幅の内側なら MISS", () => {
    const c = mk(1);
    assert.equal(matchManualInput(c, 0, 0, 1000 - 37, W, "smart"), null, "37ms 早い：空振り");
    const r = matchManualInput(c, 0, 0, 1000 - 36, W, "smart");
    assert.deepEqual([r.idx, r.kind, r.wrongLane], [0, "miss", true], "36ms 早い：MISS");
    assert.equal(matchManualInput(c, 0, 0, 1000 - 37, W, "ordered").kind, "miss", "旧方式：早くても MISS");
  });

  test("両手打ち（同じレーンの2打目が 10ms 後）が、トリルの次のノーツを消費しない", () => {
    const c = mk(0, 1, 0);
    const presses = [{ t: 1000, lane: 0 }, { t: 1010, lane: 0 }, { t: 1000 + GAP, lane: 1 }, { t: 1000 + GAP * 2, lane: 0 }];
    const smart = play(c, presses, "smart");
    assert.deepEqual(smart.results, ["perfect@0", "none", "perfect@1", "perfect@2"]);
    const ordered = play(c, presses, "ordered");
    assert.equal(ordered.results[1], "miss@1!", "旧方式：2打目がカを MISS にする");
  });

  test("遅れた打鍵が次の色違いノーツに届いたとき：±PERFECT の内側なら MISS、それより手前なら空振り", () => {
    /* ド@1000 カ@1086。ドを 96ms 遅く押す（ドは幅の外）→ カの 10ms 手前なので色違いとして MISS */
    const late = matchManualInput(mk(0, 1), 0, 0, 1000 + 96, W, "smart");
    assert.deepEqual([late.idx, late.kind], [1, "miss"]);
    /* ド@1000（判定済み）カ@1086。カの 46ms 手前（PERFECT 幅 36 より前）に押したドは空振り */
    const c = mk(0, 1); c[0].judged = true;
    assert.equal(matchManualInput(c, 0, 0, 1000 + GAP - 46, W, "smart"), null);
  });

  test("未知の方式名は smart として扱う", () => {
    const c = mk(0, 1, 0);
    const r = matchManualInput(c, 0, 1, 1000 + GAP, W, "something-else");
    assert.deepEqual([r.idx, r.kind], [1, "perfect"]);
  });
});

/* ---------- 2) game.js の handleInput との配線（実ソースを切り出して動かす） ---------- */
describe("game.js の handleInput は judge-match を通して判定する", () => {
  const gameSource = read("js/game.js");
  const a = gameSource.indexOf("const judgePolicy = ");
  const b = gameSource.indexOf("/* AUTO：");
  assert.ok(a > 0 && b > a, "game.js の handleInput の区間が見つかること");
  const block = gameSource.slice(a, b);

  function run({ judgeOrdered = false, chart, nextIdx = 0, presses }) {
    const calls = [];
    const core = {
      phase: "playing", nextIdx, chart,
      settings: { playMode: "manual", autoPlay: false, judgeOrdered },
      windows: () => W, pressFlash: [0, 0], laneCol: l => l, pressH: null,
    };
    const sandbox = {
      core, performance: { now: () => 5e5 },
      window: { Trk: { media: { playSE() {} }, judge: ctx.window.Trk.judge } },
      gameTime: at => at,
      judgeNote: (n, kind, delta) => { calls.push({ idx: chart.indexOf(n), kind, delta }); n.judged = true; while (core.nextIdx < chart.length && chart[core.nextIdx].judged) core.nextIdx++; },
      orbitInput() { throw new Error("orbit"); }, steerTruck() { throw new Error("truck"); },
    };
    vm.createContext(sandbox);
    vm.runInContext(`${block}\nglobalThis.handleInput = handleInput;`, sandbox, { filename: "game.js(handleInput)" });
    for (const p of presses) sandbox.handleInput(p.lane, p.t);
    return calls;
  }

  test("ドカドの1つ目を落としても、2つ目のカは PERFECT として judgeNote に届く（既定）", () => {
    const chart = mk(0, 1, 0);
    const calls = run({ chart, presses: [{ lane: 1, t: 1000 + GAP }] });
    assert.deepEqual(calls, [{ idx: 1, kind: "perfect", delta: 0 }]);
  });

  test("judgeOrdered をオンにすると旧方式になる（同じ打鍵で1つ目のドが MISS）", () => {
    const chart = mk(0, 1, 0);
    const calls = run({ judgeOrdered: true, chart, presses: [{ lane: 1, t: 1000 + GAP }] });
    assert.deepEqual(calls, [{ idx: 0, kind: "miss", delta: GAP }]);
  });

  test("空振り（判定幅に何も無い）では judgeNote を呼ばない。AUTO 中は何もしない", () => {
    assert.deepEqual(run({ chart: mk(0), presses: [{ lane: 0, t: 500 }] }), []);
    const chart = mk(0);
    const calls = [];
    const core = { phase: "playing", nextIdx: 0, chart, settings: { playMode: "manual", autoPlay: true }, windows: () => W, pressFlash: [0, 0], laneCol: l => l };
    const sandbox = { core, performance: { now: () => 1 }, window: { Trk: { media: { playSE() {} }, judge: ctx.window.Trk.judge } }, gameTime: at => at, judgeNote: (...x) => calls.push(x) };
    vm.createContext(sandbox);
    vm.runInContext(`${block}\nglobalThis.handleInput = handleInput;`, sandbox);
    sandbox.handleInput(0, 1000);
    assert.deepEqual(calls, []);
  });

  test("handleInput は昔の走査（for ループ＋lane !== lane で miss）を持たず、matchManualInput だけを使う", () => {
    assert.match(block, /window\.Trk\.judge\.matchManualInput\(core\.chart, core\.nextIdx, lane, now, core\.windows\(\), judgePolicy\(\)\)/);
    assert.doesNotMatch(block, /n\.lane !== lane\) judgeNote/);
  });
});

/* ---------- 3) 実ソースの自動譜面でのシミュレーション ---------- */
describe("実ソースの自動譜面（上級・174BPM）でのプレイヤーモデル", () => {
  const { DIFFS, hashString, mulberry32 } = loadBrowserData();
  const cg = { window: {} };
  vm.createContext(cg);
  vm.runInContext(read("js/chart-gen.js"), cg, { filename: "js/chart-gen.js" });
  const song = SYNTH_SONGS.longRamp, diff = "hard";
  const analysis = synthAnalysis(song, 7);
  const rand = mulberry32(hashString(`834271|${diff}|${song.bpm}|0`));
  const notes = cg.window.buildChartNotes({ analysis, durationMs: song.durSec * 1000, diff, spec: DIFFS[diff], bpm: song.bpm, offset: 0, rand, chartGen: "2" });
  const w = { perfect: DIFFS[diff].perfect, good: DIFFS[diff].good };
  const gaps = notes.slice(1).map((n, i) => n.time - notes[i].time);
  const gauss = rnd => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  function simulate(policy, { drop = 0, sigma = 0, seed = 7919 }) {
    const rnd = makeLcg(seed);
    const presses = [];
    for (const n of notes) { if (drop && rnd() < drop) continue; presses.push({ t: n.time + sigma * gauss(rnd), lane: n.lane }); }
    presses.sort((a, b) => a.t - b.t);
    const chart = notes.map(n => ({ time: n.time, lane: n.lane, judged: false, result: null, pressedWell: false }));
    let nextIdx = 0;
    const judge = (i, kind) => { chart[i].judged = true; chart[i].result = kind; while (nextIdx < chart.length && chart[nextIdx].judged) nextIdx++; };
    const sweep = now => { for (let i = nextIdx; i < chart.length; i++) { const n = chart[i]; if (n.time > now - w.good) break; if (!n.judged) judge(i, "miss"); } };
    for (const p of presses) {
      sweep(p.t);
      for (let i = nextIdx; i < chart.length; i++) { const n = chart[i]; if (n.time - p.t > w.perfect) break; if (n.lane === p.lane && Math.abs(n.time - p.t) <= w.perfect) n.pressedWell = true; }
      const r = matchManualInput(chart, nextIdx, p.lane, p.t, w, policy);
      if (r) judge(r.idx, r.kind);
    }
    sweep(Infinity);
    let run = 0, maxRun = 0;
    for (const n of chart) { if (n.result === "miss") { run++; maxRun = Math.max(maxRun, run); } else run = 0; }
    return {
      miss: chart.filter(n => n.result === "miss").length,
      unfair: chart.filter(n => n.result === "miss" && n.pressedWell).length,   // ±PERFECT で正しく押したのに MISS
      perfect: chart.filter(n => n.result === "perfect").length,
      maxRun,
    };
  }

  test("前提：この譜面は16分（86ms）が GOOD 幅（±95ms）より狭く、判定幅が隣のノーツに重なる", () => {
    assert.ok(notes.length > 1500, `ノーツ数 ${notes.length}`);
    assert.ok(gaps.filter(g => g <= w.good).length / gaps.length > 0.5, "間隔 ≤ GOOD 幅のノーツが半分以上");
  });

  test("ぴったり叩けば両方式とも ALL PERFECT", () => {
    for (const policy of JUDGE_POLICIES) {
      const r = simulate(policy, {});
      assert.deepEqual([r.miss, r.perfect], [0, notes.length], policy);
    }
  });

  test("3% 落とす（σ20ms）：smart は正しく押したノーツを MISS にせず、連鎖も起きない。旧方式は連鎖する", () => {
    for (const seed of [7919, 15838]) {
      const smart = simulate("smart", { drop: .03, sigma: 20, seed });
      const ordered = simulate("ordered", { drop: .03, sigma: 20, seed });
      assert.ok(smart.unfair <= ordered.unfair / 3, `seed ${seed}: 不公平 MISS smart=${smart.unfair} ordered=${ordered.unfair}`);
      assert.ok(smart.maxRun <= 3, `seed ${seed}: smart の連続 MISS 最大=${smart.maxRun}`);
      assert.ok(smart.miss < ordered.miss, `seed ${seed}: MISS smart=${smart.miss} ordered=${ordered.miss}`);
    }
  });

  test("ばらつき σ25ms（落とさない）：smart の MISS は旧方式より少なく、±PERFECT で押したノーツは MISS にならない", () => {
    const smart = simulate("smart", { sigma: 25 });
    const ordered = simulate("ordered", { sigma: 25 });
    assert.equal(smart.unfair, 0, `smart の不公平 MISS ${smart.unfair}`);
    assert.ok(smart.miss < ordered.miss, `MISS smart=${smart.miss} ordered=${ordered.miss}`);
  });
});

/* ---------- 4) 設定 judgeOrdered の配線 ---------- */
describe("❓謎設定 judgeOrdered の配線", () => {
  test("core.js：初期値はオフ（=== true のときだけオン）、ファクトリーリセットで戻る", () => {
    const core = read("js/core.js");
    assert.match(core, /judgeOrdered: prefs\.judgeOrdered === true/);
    assert.match(core, /settings\.judgeOrdered = false;/);
  });
  test("index.html：謎設定の中にチェックと説明があり、judge-match.js は game.js より前に読み込む", () => {
    const html = read("index.html");
    const sec = html.indexOf('data-i18n="secMystery"'), box = html.indexOf('id="judgeOrdered"'), ctrl = html.indexOf('data-i18n="secControls"');
    assert.ok(sec > 0 && box > sec && ctrl > box, "謎設定の節の中にある");
    assert.ok(html.includes('data-i18n="judgeOrderedHint"'));
    const jm = html.indexOf('<script src="js/judge-match.js"></script>'), gm = html.indexOf('<script src="js/game.js"></script>');
    assert.ok(jm > 0 && gm > jm, "読み込み順");
  });
  test("main.js：チェックの同期と変更の保存", () => {
    const main = read("js/main.js");
    assert.match(main, /core\.\$\("judgeOrdered"\)\.checked = !!core\.settings\.judgeOrdered/);
    assert.match(main, /\["judgeOrdered", "judgeOrdered"\]/);
  });
  test("i18n-options.js：4言語", () => {
    const opts = read("js/i18n-options.js");
    assert.equal((opts.match(/judgeOrdered:"/g) || []).length, 4);
    assert.equal((opts.match(/judgeOrderedHint:"/g) || []).length, 4);
  });
});

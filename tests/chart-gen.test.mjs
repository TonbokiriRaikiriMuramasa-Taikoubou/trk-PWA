// SPDX-License-Identifier: GPL-3.0-or-later
/* 自動譜面の生成を node --test で検査する（依存パッケージ不要）。
 *
 *   node --test tests/        または   npm test
 *
 * 対象は js/chart-gen.js の純関数（buildChartNotes／cgAllocate／cgEstimateLevel）。
 * 音源は使わず、tests/helpers/synth.mjs の合成曲で検査する。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { ROOT, loadBrowserData } from "./helpers/browser-data.mjs";
import { SYNTH_SONGS, synthAnalysis } from "./helpers/synth.mjs";

const { DIFFS, DIFF_IDS, hashString, mulberry32 } = loadBrowserData();
/* js/chart-gen.js は即時関数で包まれ、公開名は window に出る（名前空間の移行。ctx.window で受け取る） */
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/chart-gen.js"), "utf8"), ctx, { filename: "js/chart-gen.js" });
const { buildChartNotes, cgAllocate, cgEstimateLevel } = ctx.window;

const golden = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/chart-legacy-golden.json"), "utf8"));
const SONGS = { ...SYNTH_SONGS, noAnalysis: { durSec: 90, bpm: 128, ampAt: () => 0.2, none: true } };

/* media.js の generateNotes と同じ手順で乱数を作り、純関数を呼ぶ */
function generate(songId, { diff, seed = "834271", offset = 0, chartGen }) {
  const song = SONGS[songId];
  const analysis = song.none ? null : synthAnalysis(song, 7);
  const rand = mulberry32(hashString(`${String(seed).trim()}|${diff}|${song.bpm}|${offset}`));
  return buildChartNotes({ analysis, durationMs: song.durSec * 1000, diff, spec: DIFFS[diff], bpm: song.bpm, offset, rand, chartGen });
}
const sha = notes => crypto.createHash("sha256").update(JSON.stringify(notes)).digest("hex");
/* 区間 [a,b) 秒の1秒あたりのノーツ数 */
const perSec = (notes, a, b) => notes.filter(n => n.time >= a * 1000 && n.time < b * 1000).length / (b - a);

describe("旧譜面の再現（chartGen 1）", () => {
  test("旧方式は ca84a19 の generateNotes と全件ビット一致する（ゴールデン 140件）", () => {
    const bad = [];
    for (const g of golden.cases) {
      const notes = generate(g.song, { diff: g.diff, seed: g.seed, offset: g.offset, chartGen: "1" });
      if (notes.length !== g.count || sha(notes) !== g.sha256) bad.push(`${g.song}/${g.diff}/seed=${g.seed}/offset=${g.offset}`);
    }
    assert.deepEqual(bad, [], `旧方式の出力が変わった組み合わせ（旧譜面の記録が結び付かなくなる）`);
    assert.equal(golden.cases.length, 140);
  });

  test("旧方式の譜面の Lv（estimateLevel）も ca84a19 と全件一致する", () => {
    const bad = [];
    for (const g of golden.cases) {
      const lv = cgEstimateLevel(generate(g.song, { diff: g.diff, seed: g.seed, offset: g.offset, chartGen: "1" }));
      if (lv !== g.level) bad.push(`${g.song}/${g.diff}: ${lv} != ${g.level}`);
    }
    assert.deepEqual(bad, []);
  });

  test("chartGen が未指定・\"1\" のときは旧方式を使う", () => {
    for (const diff of DIFF_IDS) {
      const a = generate("introChorus", { diff, chartGen: "1" });
      assert.deepEqual(generate("introChorus", { diff }), a, `${diff}: 未指定`);
      assert.deepEqual(generate("introChorus", { diff, chartGen: 1 }), a, `${diff}: 数値の1`);
    }
  });
});

describe("新方式（chartGen 2）", () => {
  test("同じ入力なら同じ譜面になる（決定性）", () => {
    for (const diff of DIFF_IDS) {
      const a = generate("longRamp", { diff, chartGen: "2" });
      assert.deepEqual(generate("longRamp", { diff, chartGen: "2" }), a, diff);
    }
  });

  test("Seed を変えると譜面も変わる", () => {
    for (const diff of ["normal", "master"]) {
      const a = generate("introChorus", { diff, seed: "834271", chartGen: "2" });
      const b = generate("introChorus", { diff, seed: "other-seed", chartGen: "2" });
      assert.notEqual(sha(a), sha(b), diff);
    }
  });

  test("静かなイントロにもノーツが置かれる（旧方式では易しい難易度で0件だった）", () => {
    for (const diff of DIFF_IDS) {
      const notes = generate("introChorus", { diff, chartGen: "2" });
      assert.ok(notes.filter(n => n.time < 30000).length > 0, `${diff}: 0〜30秒に1件もない`);
    }
  });

  test("静かな区間と盛り上がりの1秒あたり密度比は、区間係数（0.7〜1.3）の範囲に収まる", () => {
    // 区間（8小節＝introChorus・longRampは120／174 BPM で 16秒強）の境界にそろえて比べる。
    // 理論上の範囲は 0.7/1.3 〜 1.3/0.7（約0.54〜1.86）。易しい難易度は1区間に十数個しかないため、
    // 整数の丸めで数％ずれるぶんを見込んで [0.45, 2.2] で判定する。
    for (const diff of DIFF_IDS) {
      const notes = generate("introChorus", { diff, chartGen: "2" });
      const ratio = perSec(notes, 0, 16) / perSec(notes, 96, 176);
      assert.ok(ratio >= 0.45 && ratio <= 2.2, `introChorus ${diff}: 比 ${ratio.toFixed(2)}`);
    }
    for (const diff of DIFF_IDS) {
      const notes = generate("longRamp", { diff, chartGen: "2" });
      const ratio = perSec(notes, 0, 16) / perSec(notes, 224, 300);
      assert.ok(ratio >= 0.45 && ratio <= 2.2, `longRamp ${diff}: 比 ${ratio.toFixed(2)}`);
    }
  });

  test("音量の差が大きい曲では、静かな区間の方が密度が低い（係数と絶対音量ゲートの両方が効く）", () => {
    // 係数だけなら 小さい区間÷大きい区間 ≒ 0.7 ÷ 1.3 ≒ 0.54 になる。絶対音量ゲートは難易度順の上限表
    // （初級15%・中級20%）で静かな区間を絞る。初級は上限15%の表で約0.13（0.44 nps）。
    // 下限 0.10 は「静かな区間がゼロにはならない」ことの確認で、仕様の数値ではない。
    for (const diff of ["easy", "normal"]) {
      const notes = generate("contrast", { diff, chartGen: "2" });
      const ratio = perSec(notes, 0, 16) / perSec(notes, 96, 120);
      assert.ok(ratio >= 0.10 && ratio <= 0.7, `contrast ${diff}: 比 ${ratio.toFixed(2)}`);
    }
  });

  test("静かな長い曲では、難易度が上がるとノーツ総数が厳密に増える", () => {
    // 以前は上級・達人とも静かな区間が候補の25%、盛り上がりが候補の100%で頭打ちになり、459ノーツで一致した。
    // 静かな区間の上限は難易度順の表（CG_QUIET_CAPS）で単調に増えるため、総数も厳密に増えることを検査する。
    const counts = DIFF_IDS.map(diff => generate("contrast", { diff, chartGen: "2" }).length);
    for (let i = 1; i < counts.length; i++) {
      assert.ok(counts[i] > counts[i - 1], `${DIFF_IDS[i - 1]}=${counts[i - 1]} !< ${DIFF_IDS[i]}=${counts[i]}`);
    }
  });

  test("静かな区間の密度は難易度が上がるほど厳密に増える（上限表が難易度順に単調なことの実効）", () => {
    // contrast の 0〜90 秒は静かな区間。候補数に対する上限は 初級15% < 中級20% < 上級25% < 達人34% < RUSH40%。
    // グリッド密度（div）の違いで秒あたりの候補数は難易度ごとに異なるが、実密度も単調に増えることを見る。
    const nps = DIFF_IDS.map(diff => perSec(generate("contrast", { diff, chartGen: "2" }), 0, 90));
    for (let i = 1; i < nps.length; i++) {
      assert.ok(nps[i] > nps[i - 1], `${DIFF_IDS[i - 1]}=${nps[i - 1].toFixed(2)} !< ${DIFF_IDS[i]}=${nps[i].toFixed(2)}`);
    }
  });

  test("絶対音量ゲート：静かな長い区間（contrast の 0〜90秒）も、上級・達人で満密度にはならない", () => {
    // 上級（25%）は約2.5 nps、達人（34%）は約3.1 nps。どちらも旧来の満密度（約7.9 nps）より低い。
    for (const [diff, maxNps] of [["hard", 3.0], ["master", 3.5]]) {
      const notes = generate("contrast", { diff, chartGen: "2" });
      const quiet = perSec(notes, 0, 90);
      assert.ok(quiet <= maxNps, `${diff}: 静かな区間 ${quiet.toFixed(2)} nps > ${maxNps}`);
      assert.ok(quiet > 0, `${diff}: 静かな区間にも全く置かないのは行き過ぎ`);
    }
  });

  test("絶対音量ゲート：通常の導入部（introChorus の 0〜30秒）は絞られない", () => {
    // 導入部は曲の最大音量の約 10〜12%。静かな区間の判定（6%）より大きいので、密度は変わらない
    const notes = generate("introChorus", { diff: "hard", chartGen: "2" });
    assert.ok(perSec(notes, 0, 30) >= 3.0, `hard の導入部 ${perSec(notes, 0, 30).toFixed(2)} nps`);
  });

  test("音量がほぼ一定の曲では、前半と後半の密度がそろう", () => {
    for (const diff of DIFF_IDS) {
      const notes = generate("flat", { diff, chartGen: "2" });
      const ratio = perSec(notes, 0, 60) / perSec(notes, 60, 120);
      assert.ok(ratio >= 0.9 && ratio <= 1.1, `${diff}: 比 ${ratio.toFixed(2)}`);
    }
  });

  test("無音の冒頭（0〜6秒）には置かず、音が始まった直後から置く", () => {
    for (const diff of DIFF_IDS) {
      const notes = generate("silentLead", { diff, chartGen: "2" });
      assert.ok(notes.length > 0, diff);
      assert.ok(notes[0].time >= 5900 && notes[0].time <= 7000, `${diff}: 最初のノーツ ${notes[0].time}ms`);
    }
  });

  test("初級・中級のノーツ総数は旧方式と同じ（配り方だけが変わる）", () => {
    for (const songId of ["introChorus", "flat"]) {
      for (const diff of ["easy", "normal"]) {
        const oldN = generate(songId, { diff, chartGen: "1" }).length;
        const newN = generate(songId, { diff, chartGen: "2" }).length;
        assert.equal(newN, oldN, `${songId}/${diff}`);
      }
    }
  });

  test("上級以上のノーツ総数は目標の±10%に収まる", () => {
    for (const diff of ["hard", "master"]) {
      const oldN = generate("longRamp", { diff, chartGen: "1" }).length;
      const newN = generate("longRamp", { diff, chartGen: "2" }).length;
      assert.ok(Math.abs(newN - oldN) <= oldN * 0.1, `${diff}: 旧 ${oldN} / 新 ${newN}`);
    }
  });

  test("ノーツは時刻順に並び、同じ時刻の重複がない", () => {
    for (const id of Object.keys(SONGS)) {
      for (const diff of DIFF_IDS) {
        const notes = generate(id, { diff, chartGen: "2" });
        for (let i = 1; i < notes.length; i++) assert.ok(notes[i].time > notes[i - 1].time, `${id}/${diff}/${i}`);
        for (const n of notes) assert.ok(n.lane === 0 || n.lane === 1, `${id}/${diff}: lane ${n.lane}`);
      }
    }
  });

  test("baseline：旧方式と新方式の数値を診断に出す（判定はしない）", t => {
    const rows = [];
    for (const gen of ["1", "2"]) {
      const quiet = DIFF_IDS.map(diff => {
        const notes = generate("introChorus", { diff, chartGen: gen });
        return `${diff}=${(perSec(notes, 0, 30) / perSec(notes, 90, 180)).toFixed(2)}`;
      });
      rows.push(`gen${gen} 前半(0-30s)÷後半(90-180s)の密度比: ${quiet.join("  ")}`);
    }
    t.diagnostic(rows.join("\n"));
  });
});

describe("区間配分（cgAllocate）", () => {
  test("合計は min(総数, 上限の和) になり、各区間は上限を超えない", () => {
    const cases = [
      [10, [10, 1], [3, 100]],
      [50, [1, 1, 1, 1], [5, 5, 5, 5]],
      [7, [0.7, 1.3], [2, 9]],
      [100, [1, 2, 3], [4, 4, 4]]
    ];
    for (const [total, weights, caps] of cases) {
      const out = Array.from(cgAllocate(total, weights, caps));
      const sum = out.reduce((x, y) => x + y, 0);
      assert.equal(sum, Math.min(total, caps.reduce((x, y) => x + y, 0)));
      out.forEach((v, i) => assert.ok(v >= 0 && v <= caps[i], `caps超過 ${v} > ${caps[i]}`));
    }
  });

  test("上限に届かなければ重みの比で割る", () => {
    assert.deepEqual(Array.from(cgAllocate(8, [1, 1, 2], [100, 100, 100])), [2, 2, 4]);
  });

  test("上限に届いた区間は固定し、余りを他の区間へ回す", () => {
    assert.deepEqual(Array.from(cgAllocate(10, [10, 1], [3, 100])), [3, 7]);
  });

  test("重みが0・上限が0の区間には配らない", () => {
    assert.deepEqual(Array.from(cgAllocate(4, [0, 1, 1], [5, 0, 5])), [0, 0, 4]);
  });
});

describe("譜面の難易度表示（cgEstimateLevel）", () => {
  test("難易度が上がるほどLvが下がらない（新旧どちらの方式でも、1〜20の範囲）", () => {
    for (const gen of ["1", "2"]) {
      for (const id of Object.keys(SONGS)) {
        const levels = DIFF_IDS.map(diff => cgEstimateLevel(generate(id, { diff, chartGen: gen })));
        levels.forEach(v => assert.ok(Number.isInteger(v) && v >= 1 && v <= 20, `${id}/gen${gen}: ${v}`));
        for (let i = 1; i < levels.length; i++) {
          assert.ok(levels[i] >= levels[i - 1], `${id}/gen${gen}: ${DIFF_IDS[i - 1]}=${levels[i - 1]} > ${DIFF_IDS[i]}=${levels[i]}`);
        }
      }
    }
  });

  test("空の譜面は Lv.1", () => {
    assert.equal(cgEstimateLevel([]), 1);
    assert.equal(cgEstimateLevel(null), 1);
  });
});

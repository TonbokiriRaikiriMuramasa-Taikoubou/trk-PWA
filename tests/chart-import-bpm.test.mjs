// SPDX-License-Identifier: GPL-3.0-or-later
/* F-33: 共有譜面JSON（.shadow-taiko.json）の bpm は、昔は「有限の数か」しか見ていなかった。
   bpm が負だと小節線の描画ループ（render.js の drawMeasureLines・stage.js・modes.js の ORBIT 拍線）の
   間隔が負になり、そのループが終わらずタブが固まる（1e9 のような巨大な正値でも毎フレーム数百万回回る）。
   ここでは、入口（validateChartData）が範囲を弾くこと・0（小節線なし。bpm の無い譜面を書き出すと 0）は
   通ること・3つのループが自分でも範囲を確かめることを検査する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const media = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const pick = (start, end) => {
  const a = media.indexOf(start), b = media.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `${start} … ${end} is present in js/media.js`);
  return media.slice(a, b);
};
const src = pick("function parseNote(", "/* 譜面データを確認する") +
  pick("function validateChartData(", "/* 確認した譜面を今の譜面にする");
const ctx = vm.createContext({ core:{ fingerprint:"fp", video:{ duration:60 } }, isFinite });
vm.runInContext(src, ctx);
const check = bpm => {
  const data = bpm === undefined
    ? { format:"shadow-taiko-chart", offset:0, notes:[[1000, 0], [2000, 1]] }
    : { format:"shadow-taiko-chart", bpm, offset:0, notes:[[1000, 0], [2000, 1]] };
  return vm.runInContext("validateChartData(data)", Object.assign(ctx, { data }));
};

test("chart import rejects bpm values that would leave the measure-line loops running", () => {
  for (const bad of [-1, -15000, 0.5, 1001, 1e9, Infinity, NaN, "120", null, true])
    assert.equal(check(bad).key, "importInvalid", `bpm ${String(bad)} must be refused`);
  /* 0 は「小節線なし」で、bpm の無い古い譜面を書き出すと 0 になる。取り込めなくなると往復できない。 */
  for (const ok of [0, 1, 60, 128, 174.5, 300, 1000]) assert.ok(check(ok).notes, `bpm ${ok} stays valid`);
  assert.ok(check(undefined).notes, "a chart without a bpm key still imports");
  assert.equal(check(-1).notes, undefined, "a refused chart never returns notes");
});

test("every measure-line loop checks the bpm range itself (defence in depth)", () => {
  const read = f => fs.readFileSync(`${ROOT}/js/${f}`, "utf8");
  assert.ok(read("render.js").includes("if (!(core.chartMeta.bpm >= 1 && core.chartMeta.bpm <= 1000)) return;"),
    "render.js drawMeasureLines");
  assert.ok(read("stage.js").includes("if (core.chartMeta.bpm >= 1 && core.chartMeta.bpm <= 1000) {"),
    "stage.js measure lines");
  assert.ok(read("modes.js").includes("const bpmOk = core.chartMeta.bpm >= 1 && core.chartMeta.bpm <= 1000;"),
    "modes.js ORBIT beat lines");
  /* 3つのループはいまも「間隔ぶん進んで travel を超えたら抜ける」形で、間隔が正であることが終了条件。
     ガードが外れたら（m が負なら）終わらないことを、ここで実際に数えて示す。 */
  const iterations = bpm => {
    const m = 240000 / bpm, travel = 900, offset = 0, now = 0;
    let k = Math.ceil((now - offset) / m), n = 0;
    for (; n < 1e6; k++) { const u = offset + k * m - now; if (u > travel) break; n++; }
    return n;
  };
  assert.ok(iterations(120) < 10, "a normal bpm leaves the loop after a few steps");
  assert.equal(iterations(-1), 1e6, "a negative bpm never leaves it (this is what the guard prevents)");
  assert.ok(iterations(1e9) > 1e5, "an absurdly high bpm wastes the frame without the guard");
});

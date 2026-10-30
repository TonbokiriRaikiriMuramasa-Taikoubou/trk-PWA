// SPDX-License-Identifier: GPL-3.0-or-later
/* trk129: 記録とゴーストのキー（chartKeyOf）は、MIRROR／RANDOM を掛けた後の lane ではなく、掛ける前の lane
   （resetRun が残す origLane）で作る。掛けた後で作ると、同じ譜面なのに MOD の有無でキーが変わり、
   ①記録の行とベストが分かれ ②ゴーストは beforePlay（＝resetRun の前）にキーを引くため、MOD を変えた直後に出なくなる。
   ここでは実際の chartKeyOf を game.js から切り出して動かし、MOD の有無で同じキーになることを確かめる。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT, loadBrowserData } from "./helpers/browser-data.mjs";

const game = fs.readFileSync(`${ROOT}/js/game.js`, "utf8");
const line = game.split("\n").find(l => l.includes("const chartKeyOf ="));
assert.ok(line, "chartKeyOf is declared in js/game.js");
const { hashString } = loadBrowserData();

const chart = () => [
  { time:1000, lane:0 }, { time:1250, lane:1 }, { time:1500, lane:0 }, { time:2500, lane:1 },
];
/* game.js の resetRun と同じ順で MOD を掛ける（origLane を先に残してから lane を書き換える） */
function applyMods(notes, { mirror = false, random = false } = {}) {
  const rand = random ? (() => { let i = 0; return () => (i++ % 2); })() : null;
  notes.forEach(n => {
    n.judged = false; n.result = null;
    if (n.origLane == null) n.origLane = n.lane;
    let l = n.origLane;
    if (mirror) l = 1 - l;
    if (random && rand) l = rand() < 0.5 ? 0 : 1;
    n.lane = l;
  });
  return notes;
}
const keyWith = notes => {
  const ctx = vm.createContext({ core:{ hashString, chart: notes } });
  new vm.Script(line.replace(/^const chartKeyOf = /, "globalThis.__key = ") + "\nglobalThis.__k = __key().toString(36);").runInContext(ctx);
  return ctx.__k;
};

test("the record/ghost key is the same chart with or without MIRROR / RANDOM", () => {
  const plain = keyWith(applyMods(chart()));
  const mirrored = keyWith(applyMods(chart(), { mirror:true }));
  const randomized = keyWith(applyMods(chart(), { random:true }));
  assert.equal(mirrored, plain, "MIRROR must not move the record to another chart key");
  assert.equal(randomized, plain, "RANDOM must not move the record to another chart key");
  /* 使い方を間違える（＝MOD 後の lane で作る）と変わってしまうことを、その場で示しておく */
  const afterMods = chart().map(n => ({ time:n.time, lane:1 - n.lane }));
  const byPlayedLane = vm.createContext({ core:{ hashString, chart: afterMods } });
  new vm.Script(line.replace(/^const chartKeyOf = /, "globalThis.__key = ") + "\nglobalThis.__k = __key().toString(36);").runInContext(byPlayedLane);
  assert.notEqual(byPlayedLane.__k, plain, "the old key (played lane) differs — this is the bug that was fixed");
});

test("resetRun still records origLane before it mirrors, and the key reads it", () => {
  const reset = game.slice(game.indexOf("function resetRun()"), game.indexOf("async function startGame()"));
  assert.ok(reset.includes("if (n.origLane == null) n.origLane = n.lane;"), "origLane is kept before mirroring");
  assert.ok(reset.indexOf("n.origLane == null") < reset.indexOf("n.lane = l;"), "origLane is written before lane is replaced");
  assert.ok(line.includes("n.origLane ?? n.lane"), "the key falls back to lane when no run started (title screen)");
  /* ゴーストは resetRun の前（beforePlay）にキーを引く。だからキーは MOD に依存してはいけない */
  const extras = fs.readFileSync(`${ROOT}/js/extras.js`, "utf8");
  assert.ok(extras.includes('core.on("beforePlay", () => {') && extras.includes("window.Trk.play.chartKeyOf()"), "the ghost looks the key up in beforePlay");
});
/* trk132: 譜面の書き出し（chartToData）も、遊んだ後の lane ではなく元のレーンを書く。
   resetRun は MIRROR／RANDOM で n.lane を書き換えるので、結果画面から書き出したり曲パックに入れたりすると
   MOD 後の譜面が共有されていた（chartKeyOf と同じ問題）。 */
test("trk132: exporting after a MIRROR/RANDOM play writes the original lanes", () => {
  const media = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
  const a = media.indexOf("function chartToData("), b = media.indexOf("\n}\n", a);
  assert.ok(a >= 0 && b > a, "chartToData can be isolated from js/media.js");
  const ctx = vm.createContext({ core: { mediaName:"x", fingerprint:"", video:{ duration:1 }, chartMeta:{ bpm:120, offset:0 }, $: () => ({ value:"" }) }, estimateLevel: () => 1 });
  vm.runInContext(media.slice(a, b + 3), ctx);
  const exportLanes = notes => { ctx.__n = notes; return Array.from(vm.runInContext("chartToData(__n, 'normal').notes", ctx), n => n[1]); };
  const original = chart().map(n => n.lane);
  assert.deepEqual(exportLanes(applyMods(chart(), { mirror:true })), original, "MIRROR must not change the exported chart");
  /* RANDOM は乱数で並ぶので、元と違う並びになる例をその場で作って確かめる（同じ並びだと検査にならない） */
  const randomized = chart(); randomized.forEach((n, i) => { n.origLane = n.lane; n.lane = i < 2 ? 1 : 0; });
  assert.notDeepEqual(randomized.map(n => n.lane), original, "the RANDOM example really differs from the original");
  assert.deepEqual(exportLanes(randomized), original, "RANDOM must not change the exported chart");
  assert.deepEqual(exportLanes(chart()), original, "a chart that was never played is written as it is");
  /* 曲パックの書き出し（custom.js）も同じ関数を通る＝そちらも直っている */
  assert.ok(fs.readFileSync(`${ROOT}/js/custom.js`, "utf8").includes("window.Trk.media.chartToData("), "the song pack shares this function");
});

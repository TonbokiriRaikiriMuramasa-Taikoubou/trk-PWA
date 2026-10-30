// SPDX-License-Identifier: GPL-3.0-or-later
/* Exercise the real loadMedia() decision branch without decoding audio or a DOM. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const media = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const constants = [
  media.match(/const ANALYZE_MAX\s*=\s*[^;]+;/)?.[0],
  media.match(/const ANALYZE_MAX_SEC\s*=\s*[^;]+;/)?.[0],
  media.match(/const ANALYZE_LITE_MAX_SEC\s*=\s*[^;]+;/)?.[0],
];
const loadStart = media.indexOf("async function loadMedia(file, opts = {}) {");
const loadEnd = media.indexOf("\n}\n\n/* ---------- 解析結果", loadStart);
assert.ok(constants.every(Boolean), "media analysis caps are declared");
assert.ok(loadStart >= 0 && loadEnd > loadStart, "loadMedia() can be isolated for a dependency-free behavior test");
const loadMediaSource = media.slice(loadStart, loadEnd + 2);
/* loadMedia() は失敗時に理由を調べる（trk195）。その下調べ一式も同じ VM に入れて、本物の関数を動かす。 */
const probeSource = media.slice(
  media.indexOf("/* ---------- 🎞 コンテナとコーデックの下調べ"),
  media.indexOf("/* ---------- 曲の読み込み ----------"),
);

async function run({ minutes, lite = false, noAnalyze = false, size = 1024 }) {
  const handlers = Object.create(null);
  const status = [];
  const calls = { analyze:0, chart:0 };
  const core = {
    phase:"title", loadToken:0, videoReady:false, analysis:null, chart:[], chartMode:"generated", fingerprint:"",
    mediaURL:"", mediaName:"", video:{ duration:minutes * 60,
      pause(){}, addEventListener(name, fn){ handlers[name] = fn; }, removeEventListener(name){ delete handlers[name]; },
      set src(value){ this.source = value; }, load(){ handlers.loadedmetadata?.(); } },
    emit(){}, setStatus(key, value){ if (key === "loadStatus") status.push(value); }, updateChartButtons(){},
    baseName(name){ return name; }, $(id){ return id === "songTitle" ? { textContent:"" } : null; },
  };
  const sandbox = {
    core,
    TrkLite: { active:() => lite, noAnalyze:() => noAnalyze },
    URL: { createObjectURL:() => "blob:smoke-test", revokeObjectURL(){} },
    setTimeout(fn){ fn(); return 1; },
    analyzeAudioCached:async () => { calls.analyze++; return { test:true }; },
    buildChart(){ calls.chart++; },
    window:{}, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${constants.join("\n")}\n${probeSource}\n${loadMediaSource}\nwindow.__loadMedia = loadMedia;`, sandbox, { filename:"js/media.js#loadMedia" });
  const loaded = await sandbox.window.__loadMedia({ name:"test audio", size });
  return { loaded, status:status.at(-1), analysis:core.analysis, calls };
}

test("light mode caps audio analysis at 10 minutes without changing normal-mode or other skip rules", async () => {
  const normal19 = await run({ minutes:19, lite:false });
  assert.equal(normal19.loaded, true);
  assert.equal(normal19.calls.analyze, 1, "a 19-minute track still analyzes in normal mode");
  assert.equal(normal19.status, "loaded");

  const normalOver20 = await run({ minutes:20 + 1 / 60, lite:false });
  assert.equal(normalOver20.calls.analyze, 0);
  assert.equal(normalOver20.analysis, null);
  assert.equal(normalOver20.status, "analysisSkippedLong");

  const liteAt10 = await run({ minutes:10, lite:true });
  assert.equal(liteAt10.calls.analyze, 1, "exactly 10 minutes stays within the lite cap");
  assert.equal(liteAt10.status, "loaded");

  const liteOver10 = await run({ minutes:10 + 1 / 60, lite:true });
  assert.equal(liteOver10.calls.analyze, 0);
  assert.equal(liteOver10.analysis, null);
  assert.equal(liteOver10.status, "analysisSkippedLiteLong");
  assert.equal(liteOver10.calls.chart, 1, "skipping analysis still produces the BPM-grid chart");

  const litePrefSkip = await run({ minutes:8, lite:true, noAnalyze:true });
  assert.equal(litePrefSkip.calls.analyze, 0);
  assert.equal(litePrefSkip.status, "analysisSkippedLite", "the user preference stays distinct from the duration cap");

  const largeFile = await run({ minutes:5, lite:true, size:96 * 1024 * 1024 + 1 });
  assert.equal(largeFile.calls.analyze, 0);
  assert.equal(largeFile.status, "analysisSkipped", "the existing 96 MiB limit keeps precedence");
});

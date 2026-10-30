// SPDX-License-Identifier: GPL-3.0-or-later
/* Verify that loadMedia renders local MIDI to WAV before using the regular audio path. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const media = fs.readFileSync(`${ROOT}/js/media.js`, "utf8");
const index = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const library = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const analysisConstants = [
  media.match(/const ANALYZE_MAX\s*=\s*[^;]+;/)?.[0],
  media.match(/const ANALYZE_MAX_SEC\s*=\s*[^;]+;/)?.[0],
  media.match(/const ANALYZE_LITE_MAX_SEC\s*=\s*[^;]+;/)?.[0],
];
const loadStart = media.indexOf("async function loadMedia(file, opts = {}) {");
const loadEnd = media.indexOf("\n}\n\n/* ---------- 解析結果", loadStart);
assert.ok(analysisConstants.every(Boolean), "media analysis caps are declared");
assert.ok(loadStart >= 0 && loadEnd > loadStart, "loadMedia() can be isolated for a dependency-free behavior test");
const loadMediaSource = media.slice(loadStart, loadEnd + 2);
/* loadMedia() は失敗時に理由を調べる（trk195）。その下調べ一式も同じ VM に入れて、本物の関数を動かす。 */
const probeSource = media.slice(
  media.indexOf("/* ---------- 🎞 コンテナとコーデックの下調べ"),
  media.indexOf("/* ---------- 曲の読み込み ----------"),
);

async function runMidi({ errorCode = "", progress = [], loadAgainDuringRender = false } = {}) {
  const handlers = Object.create(null);
  const statuses = [];
  const objectUrlFiles = [];
  const calls = { render:0, analyze:0, chart:0, analyzedFile:null, profileId:"", abortBefore:null, abortAfter:null, percents:[] };
  const playbackFile = new Blob(["rendered wav"], { type:"audio/wav" });
  const video = {
    duration:2,
    pause(){},
    addEventListener(name, fn){ handlers[name] = fn; },
    removeEventListener(name){ delete handlers[name]; },
    set src(value){ this.source = value; },
    load(){ handlers.loadedmetadata?.(); }
  };
  const core = {
    phase:"title", loadToken:0, video, videoReady:false, analysis:null, chart:[], chartMode:"generated", fingerprint:"",
    mediaURL:"", mediaName:"", settings:{ midiSoundProfile:"trk_neon" }, emit(){},
    setStatus(key, value, vars){ if (key !== "loadStatus") return; statuses.push(value); if (value === "midiRenderingProgress") calls.percents.push(vars && vars.p); },
    updateChartButtons(){}, baseName(name){ return name.replace(/\.[^.]+$/, ""); },
    $(){ return { textContent:"" }; }
  };
  const midi = {
    isMidiFile(file){ return /\.mid(?:i)?$/i.test(file.name); },
    async renderFile(_file, options){
      calls.render++;
      calls.profileId = options && options.profileId;
      for (const value of progress) options.onProgress(value);
      calls.abortBefore = options.shouldAbort();
      if (loadAgainDuringRender) core.loadToken++;   // the user picked another song while this one rendered
      calls.abortAfter = options.shouldAbort();
      if (errorCode) { const error = new Error(errorCode); error.code = errorCode; throw error; }
      return playbackFile;
    }
  };
  const sandbox = {
    core,
    window:{ Trk:{ midi } },
    URL:{
      createObjectURL(file){ objectUrlFiles.push(file); return `blob:test-${objectUrlFiles.length}`; },
      revokeObjectURL(){}
    },
    setTimeout(fn){ fn(); return 1; },
    analyzeAudioCached:async file => { calls.analyze++; calls.analyzedFile = file; return { test:true }; },
    buildChart(){ calls.chart++; },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(`${analysisConstants.join("\n")}\n${probeSource}\n${loadMediaSource}\nwindow.__loadMedia = loadMedia;`, sandbox, { filename:"js/media.js#loadMedia" });
  const loaded = await sandbox.window.__loadMedia({ name:"th06_01.mid", size:128, type:"audio/midi" });
  return { loaded, statuses, objectUrlFiles, playbackFile, calls, core };
}

test("index wires MIDI parsing before media playback and accepts MIDI in the local library", () => {
  const midiProfiles = index.indexOf('<script src="js/midi-profiles.js"></script>');
  const midiPlayer = index.indexOf('<script src="js/midi-player.js"></script>');
  const mediaPlayer = index.indexOf('<script src="js/media.js"></script>');
  const themeData = index.indexOf('<script src="js/touhou-theme-data.js"></script>');
  const catalog = index.indexOf('<script src="js/catalog.js"></script>');
  assert.ok(midiProfiles >= 0 && midiProfiles < midiPlayer && midiPlayer < mediaPlayer, "MIDI profiles and parser load before media.js");
  assert.ok(themeData >= 0 && themeData < catalog, "pinned titles load before the catalogue");
  assert.match(index, /accept="video\/\*,audio\/\*,\.mid,\.midi(?:,\.[a-z0-9]+)*"/);
  assert.match(library, /const MEDIA_EXT = \[[^\]]*"mid", "midi"\]/);
});

test("loadMedia renders MIDI locally, then analyzes and plays the generated WAV", async () => {
  const result = await runMidi();
  assert.equal(result.loaded, true);
  assert.equal(result.calls.render, 1);
  assert.equal(result.calls.profileId, "trk_neon", "loadMedia forwards the saved local MIDI profile to the renderer");
  assert.equal(result.objectUrlFiles[0], result.playbackFile, "the video element receives generated WAV, not the original MIDI");
  assert.equal(result.calls.analyzedFile, result.playbackFile, "audio analysis uses the generated WAV");
  assert.equal(result.statuses.at(-1), "midiLoaded");
  assert.equal(result.core.mediaName, "th06_01.mid", "the original filename remains the library identity");
});

test("loadMedia gives bounded-render failures a localized status without creating a playback URL", async () => {
  const result = await runMidi({ errorCode:"midi-too-dense" });
  assert.equal(result.loaded, false);
  assert.deepEqual(result.statuses, ["midiRendering", "midiTooDense"], "length × polyphony has its own message");
  assert.equal(result.objectUrlFiles.length, 0);
  assert.equal(result.calls.analyze, 0);
  for (const code of ["midi-event-limit", "midi-track-limit"]) {
    assert.deepEqual((await runMidi({ errorCode:code })).statuses, ["midiRendering", "midiTooComplex"], code);
  }
});

test("loadMedia shows MIDI render progress in 5% steps and aborts when another song is loaded", async () => {
  const result = await runMidi({ progress:[0.01, 0.1, 0.12, 0.5, 0.49, 1] });
  assert.deepEqual(result.calls.percents, [10, 50], "small, repeated, backwards and 100% updates are skipped");
  assert.equal(result.calls.abortBefore, false);
  assert.equal(result.statuses.at(-1), "midiLoaded");
  const replaced = await runMidi({ loadAgainDuringRender:true, errorCode:"midi-aborted" });
  assert.equal(replaced.calls.abortAfter, true, "the renderer is told to stop once loadToken changes");
  assert.equal(replaced.loaded, false);
  assert.deepEqual(replaced.statuses, ["midiRendering"], "an aborted render shows no error for the old song");
});

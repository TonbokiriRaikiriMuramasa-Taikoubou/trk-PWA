// SPDX-License-Identifier: GPL-3.0-or-later
/* trk173: 🌊 波形シークバー（PLAYER-ROADMAP #14）。解析キャッシュ（core.analysis＝端末内・trk_analysis_cache_v1）の
   rms 包絡をシークバーに重ねる。waveColumns（包絡の計算）と drawWave（描画）を vm で抜き出して実動検証し、
   構築（canvas＋吹き出し＋ResizeObserver）・tick・設定トグル・4言語・core.js の既定値・CSS を走査する。
   ホバーサムネ（動画フレーム）は別デコード経路が要るので見送り＝時刻の吹き出しで代替（docs に注記）。
   材料は端末内の解析だけ＝送信なし・ファイル読み取りもしない（描画は既存の core.analysis を読むだけ）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const playerSrc = fs.readFileSync(`${ROOT}/js/media-player-mode.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const cssSrc = fs.readFileSync(`${ROOT}/css/style.css`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

const fnWave = (() => {
  const m = playerSrc.match(/function waveColumns\(a, cols\) \{[\s\S]*?\n\}\nfunction drawWave\(\) \{[\s\S]*?\n\}/);
  assert.ok(m, "waveColumns()+drawWave() can be isolated from js/media-player-mode.js");
  return m[0];
})();

/* ---------- waveColumns：包絡の計算（純粋関数） ---------- */
function colSandbox() {
  const sandbox = { window: {}, Float32Array, Math, Number, console };
  vm.createContext(sandbox);
  vm.runInContext(`${fnWave}\nwindow.__cols = waveColumns;`, sandbox, { filename: "js/media-player-mode.js#wave" });
  return sandbox.window;
}

test("waveColumns(): 列ごとに区間の最大 rms、maxRms で正規化、ガンマ 0.7", () => {
  const api = colSandbox();
  const a = { rms: new Float32Array([0, 1, 0, 0.5]), frames: 4, maxRms: 1 };
  const cols = api.__cols(a, 2);
  assert.equal(cols.length, 2);
  assert.equal(cols[0], 1, "max of frames 0-1 is 1 → normalized 1");
  assert.ok(Math.abs(cols[1] - Math.pow(0.5, 0.7)) < 1e-6, `0.5^0.7 ≈ ${cols[1]}`);
});

test("waveColumns(): 多いフレームは列へ折りたたむ・cache 復元ふうのただの配列もOK・1 を超えない", () => {
  const api = colSandbox();
  const a = { rms: [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6], frames: 8, maxRms: 1 };   /* IndexedDB 復元はただの配列 */
  const cols = api.__cols(a, 4);
  assert.equal(cols.length, 4);
  assert.ok(Math.abs(cols[0] - Math.pow(0.9, 0.7)) < 1e-6, "column max, not average");
  assert.ok(Math.abs(cols[1] - Math.pow(0.8, 0.7)) < 1e-6);
  const loud = api.__cols({ rms: new Float32Array([2, 4]), frames: 2, maxRms: 2 }, 1);
  assert.equal(loud[0], 1, "clamped at 1 even when a frame exceeds maxRms");
});

test("waveColumns(): 解析が無ければ null（描かない＝ふつうのバーのまま）", () => {
  const api = colSandbox();
  assert.equal(api.__cols(null, 100), null);
  assert.equal(api.__cols({ rms: null, frames: 4, maxRms: 1 }, 100), null);
  assert.equal(api.__cols({ rms: new Float32Array(4), frames: 0, maxRms: 1 }, 100), null);
  assert.equal(api.__cols({ rms: new Float32Array(4), frames: 4, maxRms: 1 }, 0), null);
});

/* ---------- drawWave：描画（偽 canvas） ---------- */
function drawSandbox({ analysis = null, videoReady = false, currentTime = 0, duration = 0, mediaWave = true, width = 20, height = 8 } = {}) {
  const calls = { clear: 0, fills: [] };
  const ctx = {
    fillStyle: "",
    clearRect: () => { calls.clear++; },
    fillRect: (x, y, w, h) => { calls.fills.push({ x, y, w, h, fill: ctx.fillStyle }); },
  };
  const state = {
    analysis, videoReady, currentTime, duration, mediaWave,
    songKey: "k1",
    node: { hidden: true, clientWidth: width, clientHeight: height, width: 0, height: 0, getContext: () => ctx },
    tip: { hidden: true },
  };
  const sandbox = {
    window: { devicePixelRatio: 1 },
    core: {
      settings: { get mediaWave() { return state.mediaWave; } },
      get analysis() { return state.analysis; },
      get videoReady() { return state.videoReady; },
      video: { get currentTime() { return state.currentTime; }, get duration() { return state.duration; } },
      get currentSong() { return { key: state.songKey }; },
    },
    Float32Array, Math, Number, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(`let waveNode = null, waveTipNode = null, waveCols = null, waveSig = "";\n${fnWave}\nwindow.__draw = () => { waveNode = __node; waveTipNode = __tip; drawWave(); };\n`,
    sandbox, { filename: "js/media-player-mode.js#drawwave" });
  sandbox.__node = state.node; sandbox.__tip = state.tip;
  return { state, calls, draw: sandbox.window.__draw };
}
const flatAnalysis = (n = 40, v = 0.5) => ({ rms: new Float32Array(n).fill(v), frames: n, frameMs: 10, maxRms: v });

test("drawWave(): 解析も再生準備もあれば描く。再生済み＝アンバー、未再生＝水色（250ms tick の塗り分け）", () => {
  const h = drawSandbox({ analysis: flatAnalysis(), videoReady: true, currentTime: 50, duration: 100 });
  h.draw();
  assert.equal(h.state.node.hidden, false, "canvas is shown");
  assert.equal(h.calls.clear, 1);
  assert.equal(h.calls.fills.length, 20, "one bar per device pixel column (20 css px × dpr 1)");
  const amber = h.calls.fills.filter(f => f.fill.includes("255,209,102"));
  const blue = h.calls.fills.filter(f => f.fill.includes("160,190,255"));
  assert.equal(amber.length, 10, "halfway → half the columns are played");
  assert.equal(blue.length, 10);
  assert.ok(h.calls.fills.every(f => f.h >= 1 && f.w === 1), "bars are at least 1px tall");
});

test("drawWave(): 解析なし・準備前・長さ不明・設定オフでは隠す（吹き出しも消す）", () => {
  for (const opts of [
    { analysis: null, videoReady: true, duration: 100 },                 /* 解析が無い（長い曲・軽量化） */
    { analysis: flatAnalysis(), videoReady: false, duration: 100 },      /* まだ準備中 */
    { analysis: flatAnalysis(), videoReady: true, duration: 0 },         /* 長さが分からない */
    { analysis: flatAnalysis(), videoReady: true, duration: 100, mediaWave: false },   /* 設定オフ */
  ]) {
    const h = drawSandbox(opts);
    h.state.node.hidden = false; h.state.tip.hidden = false;
    h.draw();
    assert.equal(h.state.node.hidden, true, `hidden for ${JSON.stringify(Object.keys(opts))}`);
    assert.equal(h.state.tip.hidden, true);
    assert.equal(h.calls.fills.length, 0, "nothing drawn");
  }
});

test("drawWave(): 静かな曲でも描く（ガンマ補正）・無音の列は飛ばす", () => {
  const quiet = { rms: new Float32Array([0.001, 0.001, 0.2, 0.2]), frames: 4, maxRms: 0.2 };
  const h = drawSandbox({ analysis: quiet, videoReady: true, currentTime: 0, duration: 10, width: 8 });   /* ⚠ 幅8未満は drawWave の最小幅ガードで描かない */
  h.draw();
  assert.equal(h.calls.fills.length, 8);
  assert.ok(h.calls.fills.every(f => f.h >= 1), "even the quiet columns stay visible (gamma 0.7 + 1px floor)");
  const silent = { rms: new Float32Array(8), frames: 8, maxRms: 1 };
  const s = drawSandbox({ analysis: silent, videoReady: true, currentTime: 0, duration: 10, width: 8 });
  s.draw();
  assert.equal(s.calls.fills.length, 0, "all-zero columns are skipped (clear only)");
});

/* ---------- 配線の走査 ---------- */
test("media-player-mode.js: 🌊 構築・ホバー吹き出し・tick・設定トグルの配線", () => {
  assert.ok(playerSrc.includes("waveWrapNode.append(waveNode, progressNode, waveTipNode)"), "canvas overlays the range inside a wrapper");
  assert.ok(playerSrc.includes("progressRow.append(waveWrapNode, timeNode)"), "the wrapper replaces the bare range in the row");
  assert.ok(playerSrc.includes('waveNode.setAttribute("aria-hidden", "true")'), "the canvas is decorative for AT (the range stays the control)");
  assert.ok(playerSrc.includes('waveWrapNode.addEventListener("pointermove"'), "hover shows the time bubble");
  assert.ok(playerSrc.includes('waveWrapNode.addEventListener("pointerleave"'), "the bubble hides again");
  assert.ok(playerSrc.includes("new ResizeObserver(() => { waveCols = null; waveSig = \"\"; drawWave(); })"), "resizing recomputes the envelope");
  assert.ok(playerSrc.includes("drawWave();               /* 🌊 波形シークバー（trk173"), "the 250ms tick repaints the played split");
  assert.ok(playerSrc.includes("core.settings.mediaWave = waveCheck.checked; core.saveUserPrefs(); drawWave();"), "the toggle saves and repaints at once");
  assert.ok(playerSrc.includes("anchor.after(panel, wallPanel, wakePanel, wavePanel)"), "the setting sits next to 🔆 keep-screen-on");
  for (const key of ["mediaWaveTitle:", "mediaWaveHint:", "mediaWaveToggle:"]) {
    const n = (playerSrc.match(new RegExp(key, "g")) || []).length;
    assert.equal(n, 4, `${key} in 4 languages`);
  }
});

test("core.js / css / sw.js: 既定値（初期オン）・見た目・キャッシュ更新", () => {
  assert.ok(coreSrc.includes("mediaWave: prefs.mediaWave !== false,"), "on by default, opt-out via prefs");
  assert.equal((coreSrc.match(/settings\.mediaWave = true;/g) || []).length, 2, "both reset lists restore the default");
  assert.ok(cssSrc.includes(".mediaWave{position:absolute;") && cssSrc.includes("pointer-events:none"), "the canvas never steals pointer events from the range");
  assert.ok(cssSrc.includes(".mediaProgressWrap{position:relative;") && cssSrc.includes(".mediaWaveTip{"), "wrapper and bubble are styled");
  assert.match(swSrc, /^const CACHE = "trk-v[\d.]+-trk\d+";$/m);
});

// SPDX-License-Identifier: GPL-3.0-or-later
/* trk102: 埋め込みジャケットのスペクトラム／TV・譜面背景の表示設定を検査する。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const coreSource = read("js/core.js");
const indexSource = read("index.html");
const mainSource = read("js/main.js");
const optionsSource = read("js/i18n-options.js");
const spectrumSource = read("js/spectrum.js");
const renderSource = read("js/render.js");
const tvDockSource = read("js/tv-dock.js");
const tvPresetsSource = read("js/tv-presets.js");

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `start marker not found: ${start}`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `end marker not found: ${end}`);
  return source.slice(a, b);
}

const drawChartArtworkSource = between(renderSource, "function drawChartArtwork(image) {", "\nfunction drawVideo()");
const drawVideoSource = between(renderSource, "function drawVideo() {", "\nfunction drawScanlines()");
const drawArtworkInsetSource = between(spectrumSource, "function drawArtworkInset(g, W, H, dpr) {", "\n\n/* ============ 描き続けるかどうか ============ */");
const tvDockRenderSource = between(tvDockSource, "function render(skinChanged) {", "\n    powLed.classList.toggle");

function drawVideo({ wallpaper = false, hideDuringChart = false, phase = "playing", videoWidth = 0, zoom = 1, image = { naturalWidth:2, naturalHeight:1 }, ownField:ownFieldMode = false } = {}) {
  const calls = { images:[], clips:[], fills:[], strokes:[] };
  const video = { videoWidth, videoHeight:videoWidth ? 180 : 0, readyState:2 };
  const core = {
    videoReady:true, phase, video,
    settings:{ videoStyle:"color", videoZoom:zoom, artWallpaperBg:wallpaper, hideArtworkDuringChart:hideDuringChart },
    bgImage:image,
    vctx:{
      clearRect() {}, save() {}, beginPath() {}, clip() {}, restore() {},
      rect(...args) { calls.clips.push(args); },
      fillRect(...args) { calls.fills.push(args); },
      strokeRect(...args) { calls.strokes.push(args); },
      drawImage(...args) { calls.images.push(args); },
    },
  };
  const sandbox = {
    core,
    window:{ Trk:{ data:{ W:1920, H:1080 } } },
    ownField:() => ownFieldMode,
    layout:() => ({ video:{ x:110, y:210, w:500, h:250 } }),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${drawChartArtworkSource}\n${drawVideoSource}\nglobalThis.runDrawVideo = drawVideo;`, context, { filename:"js/render.js#drawVideo" });
  sandbox.runDrawVideo();
  return { calls, image, video };
}
function drawSpectrumArtwork({ enabled = false, hideDuringChart = false, phase = "title" } = {}) {
  const image = { naturalWidth:400, naturalHeight:300 };
  const calls = { images:[] };
  const core = {
    currentSong:{ key:"song" }, bgImage:image, phase,
    settings:{ specArtwork:enabled, hideArtworkDuringChart:hideDuringChart },
  };
  const g = {
    save() {}, restore() {}, setTransform() {}, beginPath() {}, roundRect() {}, clip() {},
    fillRect() {}, strokeRect() {}, drawImage(...args) { calls.images.push(args); },
  };
  const context = vm.createContext({ core });
  vm.runInContext(`${drawArtworkInsetSource}\nglobalThis.runInset = drawArtworkInset;`, context, { filename:"js/spectrum.js#drawArtworkInset" });
  context.runInset(g, 800, 300, 2);
  return { calls, image };
}

test("譜面オプション3種は既定オフで、謎設定に置き、4言語で配線する", () => {
  for (const key of ["artWallpaperBg", "useStudyArtwork", "hideArtworkDuringChart"]) {
    assert.match(coreSource, new RegExp(`${key}: prefs\\.${key} === true`), `${key} defaults to false`);
    assert.match(indexSource, new RegExp(`<input id="${key}" type="checkbox">`), `${key} has a checkbox`);
    assert.match(mainSource, new RegExp(`\\["${key}", "${key}"\\]`), `${key} persists on change`);
    assert.equal((optionsSource.match(new RegExp(`\\b${key}:`, "g")) || []).length, 4, `${key} is localized in four languages`);
  }
  const videoExport = between(coreSource, "function exportPrefs(kind) {", "\nfunction parseHashParams");
  const videoReset = between(coreSource, "function resetVideoPrefs() {", "\nfunction resetAudioPrefs");
  const safeMode = between(coreSource, "function enterSafeMode() {", "\nfunction resetKeysPrefs");
  for (const key of ["artWallpaperBg", "useStudyArtwork", "hideArtworkDuringChart", "specArtwork"]) {
    assert.match(videoExport, new RegExp(`out\\.${key} = settings\\.${key}`), `${key} is in video settings export`);
    assert.match(videoReset, new RegExp(`settings\\.${key}\\s*=\\s*false`), `${key} resets to false`);
    assert.match(safeMode, new RegExp(`settings\\.${key}\\s*=\\s*false`), `${key} is disabled in safe mode`);
  }
  const mystery = indexSource.indexOf('data-i18n="secMystery"');
  const controls = indexSource.indexOf('id="artWallpaperBg"');
  const end = indexSource.indexOf("</details>", mystery);
  assert.ok(mystery < controls && controls < end, "artwork options stay inside the mystery section");
  assert.match(optionsSource, /artWallpaperBg:"🖼 ジャケット画像を全画面にする"/);
  for (const phrase of ["タイマーの下", "below the top-right timer", "右上角计时器下方", "오른쪽 위 타이머 아래"]) {
    assert.ok(optionsSource.includes(phrase), `artwork placement hint is localized: ${phrase}`);
  }
});

test("スペクトラムのサムネイル設定は曲名バナー設定の直下で既定オフ", () => {
  assert.match(coreSource, /specArtwork: prefs\.specArtwork === true/);
  const skin = spectrumSource.indexOf('host.append(mkCheck("specSkin"');
  const art = spectrumSource.indexOf('host.append(mkCheck("specArtwork"');
  assert.ok(skin >= 0 && art > skin, "thumbnail checkbox follows the song-banner spectrum option");
  assert.match(spectrumSource, /specArtwork:\s*"🎨 楽曲のサムネイルを表示する"/);
});

test("スペクトラムには設定オンのときだけ、右上に小さなジャケットを重ねる", () => {
  assert.equal(drawSpectrumArtwork({ enabled:false }).calls.images.length, 0);
  const visible = drawSpectrumArtwork({ enabled:true });
  assert.equal(visible.calls.images.length, 1);
  assert.equal(visible.calls.images[0][0], visible.image);
  assert.equal(drawSpectrumArtwork({ enabled:true, hideDuringChart:true, phase:"playing" }).calls.images.length, 0);
});

test("譜面中のジャケットは右上のタイマー直下に置き、原寸を超えて拡大しない", () => {
  const { calls, image } = drawVideo();
  assert.equal(calls.images.length, 1);
  assert.equal(calls.images[0][0], image);
  assert.deepEqual(calls.fills, [[1682, 76, 168, 168]], "the framed artwork aligns with the 70px right margin below the timer");
  assert.deepEqual(calls.clips[0], [1686, 80, 160, 160], "the artwork stays inside its fixed square");
  assert.deepEqual(Array.from(calls.images[0].slice(1)), [1765, 159.5, 2, 1], "small artwork keeps its native pixels inside the frame");
  assert.deepEqual(calls.strokes, [[1686, 80, 160, 160]], "the cover gets a subtle frame");
});

test("譜面中の大きなジャケットは右上の枠へ縮小し、videoZoomの影響を受けない", () => {
  const { calls } = drawVideo({ image:{ naturalWidth:1000, naturalHeight:500 }, zoom:2 });
  assert.deepEqual(Array.from(calls.images[0].slice(1)), [1686, 120, 160, 80]);
});

test("選曲中は従来どおり、ジャケットを拡大せず動画枠の中央に表示する", () => {
  const { calls, image } = drawVideo({ phase:"title" });
  assert.equal(calls.images.length, 1);
  assert.equal(calls.images[0][0], image);
  assert.deepEqual(calls.clips[0], [110, 210, 500, 250], "title artwork stays in the normal video region");
  assert.deepEqual(Array.from(calls.images[0].slice(1)), [359, 334.5, 2, 1], "small art stays at native size and is centered");
});

test("プレイ中は中央フィールドを使うモードでもジャケットの位置を右上に固定する", () => {
  const { calls } = drawVideo({ ownField:true });
  assert.deepEqual(calls.clips[0], [1686, 80, 160, 160]);
  assert.deepEqual(Array.from(calls.images[0].slice(1)), [1765, 159.5, 2, 1]);
});

test("全画面設定オンでは動画の代わりに静止画を従来どおり全画面へ広げる", () => {
  const { calls, image } = drawVideo({ wallpaper:true, videoWidth:320 });
  assert.equal(calls.images.length, 1);
  assert.equal(calls.images[0][0], image);
  assert.deepEqual(calls.clips[0], [0, 0, 1920, 1080]);
  assert.deepEqual(Array.from(calls.images[0].slice(1)), [-120, 0, 2160, 1080], "full-screen mode preserves the old cover/crop fit");
});

test("TVの選択フィルターはTVドックの静止ジャケットにも反映する", () => {
  assert.match(tvDockRenderSource, /coverImg\.style\.filter\s*=\s*newVideoFilter\(\)/);
  assert.match(tvDockSource, /function newVideoFilter\(\)/);
  const monoPreset = between(tvPresetsSource, 'id:"mono",', "\n  },");
  assert.match(monoPreset, /filter:"grayscale\(1\) contrast\(1\.6\)"/);
});

test("譜面時は設定で静止画を隠せるが、元の動画再生は隠さない", () => {
  assert.equal(drawVideo({ hideDuringChart:true }).calls.images.length, 0);
  const video = drawVideo({ hideDuringChart:true, videoWidth:320 });
  assert.equal(video.calls.images.length, 1);
  assert.equal(video.calls.images[0][0], video.video);
});

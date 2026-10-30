// SPDX-License-Identifier: GPL-3.0-or-later
/* trk203: 🎬 画面へのドラッグ＆ドロップでも、動画は「🎬 動画を読み込む」と同じ道を通す。
   いままでは全部 addSongFiles に渡していて、映像の下調べ（videoWidth）を通らず、
   .mkv/.mpg が音として扱われていた（trk199 のメモに残っていた穴）。
   tests で確かめること：振り分け（映像らしい拡張子・MIME）・曲は今までどおり・
   ドロップでは全画面ビューアを勝手に開かない・JSON の取り込みは今までどおり */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const mainSrc = fs.readFileSync(`${ROOT}/js/main.js`, "utf8");
const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");

/* main.js のドロップ処理だけを取り出して、偽の window.Trk で動かす */
const dropBlock = mainSrc.slice(mainSrc.indexOf('addEventListener("drop"'), mainSrc.indexOf("/* ============ 起動 ============ */"));

function runDrop(files) {
  const calls = { songs: [], vids: [], opts: null, charts: [] };
  const listeners = {};
  const sandbox = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    core: { phase: "title", extOf: name => String(name).split(".").pop().toLowerCase() },
    window: {
      Trk: {
        library: {
          VIDEO_EXT: ["mp4", "m4v", "mov", "webm", "mkv", "avi", "ogv", "3gp", "mpg", "mpeg", "mpe", "m2v", "m2ts"],
          addSongFiles: async list => { calls.songs.push(...list.map(f => f.name)); },
          addVideoFiles: async (list, opts) => { calls.vids.push(...list.map(f => f.name)); calls.opts = opts || null; },
        },
        media: { importChartFile: async f => { calls.charts.push(f.name); } },
      },
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(dropBlock, context);
  const event = { preventDefault() {}, dataTransfer: { files } };
  return listeners.drop(event).then(() => calls);
}

const file = (name, type = "") => ({ name, type });

test("trk203: a dropped video goes through the 🎬 path, a song stays on the song path", async () => {
  const calls = await runDrop([file("clip.mkv"), file("movie.MPG"), file("song.mp3"), file("take.m4a")]);
  assert.deepEqual(calls.vids, ["clip.mkv", "movie.MPG"], "映像らしいものは動画の道へ");
  assert.deepEqual(calls.songs, ["song.mp3", "take.m4a"], "曲は今までどおり");
  assert.equal(calls.opts && calls.opts.openViewer, false, "ドロップでは全画面ビューアを勝手に開かない");
});

test("trk203: a video MIME without a known extension still counts as video", async () => {
  const calls = await runDrop([file("capture", "video/mp4"), file("voice", "audio/mpeg")]);
  assert.deepEqual(calls.vids, ["capture"]);
  assert.deepEqual(calls.songs, ["voice"]);
});

test("trk203: dropping JSON still imports a chart, and drops outside the title screen do nothing", async () => {
  const calls = await runDrop([file("chart.json", "application/json")]);
  assert.deepEqual(calls.charts, ["chart.json"]);
  assert.deepEqual(calls.songs, []);
  /* 曲・動画のときだけ addVideoFiles の第2引数（opts）が付く */
  assert.ok(/addVideoFiles\(vids, \{ openViewer:false \}\)/.test(mainSrc));
  const lib = libSrc.slice(libSrc.indexOf("async function addVideoFiles(list, opts)"), libSrc.indexOf("function removeAdded(it)"));
  assert.ok(/if \(!first\.video \|\| options\.openViewer === false\) return;/.test(lib), "library 側も受け付ける");
  assert.ok(/const options = opts \|\| \{\};/.test(lib));
});

test("trk203: the drop handler keeps the phase guard", () => {
  assert.ok(/if \(!files\.length \|\| core\.phase !== "title"\) return;/.test(dropBlock), "選曲中だけ受け付ける");
  assert.ok(/e\.preventDefault\(\);/.test(dropBlock), "ブラウザーがファイルを開かないように");
});

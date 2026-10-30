// SPDX-License-Identifier: GPL-3.0-or-later
/* 「旧譜面の生成の再現」用のゴールデンデータを作る（一度だけ実行する道具）。
 *
 *   node tests/capture-legacy-golden.mjs [git-ref]     … 既定は ca84a19（旧 generateNotes を持つ版）
 *
 * git-ref の js/media.js に書かれた旧 generateNotes を vm で実行し、合成曲ごとの出力を
 * tests/fixtures/chart-legacy-golden.json に書く。node --test の旧譜面テストはこの値と照合する。
 * 旧方式の挙動を変えない限り、このファイルは再生成しないこと。 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { ROOT, loadBrowserData } from "./helpers/browser-data.mjs";
import { SYNTH_SONGS, synthAnalysis } from "./helpers/synth.mjs";

const ref = process.argv[2] || "ca84a19";
const legacySrc = execFileSync("git", ["show", `${ref}:js/media.js`], { cwd: ROOT, encoding: "utf8" });
const { DIFF_IDS, DIFFS, hashString, mulberry32 } = loadBrowserData();

const cases = [];
const songs = { ...SYNTH_SONGS, noAnalysis: { durSec: 90, bpm: 128, ampAt: () => 0.2, none: true } };
for (const [songId, song] of Object.entries(songs)) {
  for (const diff of DIFF_IDS) for (const seed of ["834271", "ab"]) for (const offset of [0, 250]) {
    const sb = { console, Math, Float32Array, Float64Array, Array, Object, Number, String, JSON, Set, Map, Date, DIFFS, DIFF_IDS, hashString, mulberry32,
      video: { duration: song.durSec }, videoReady: true, analysis: song.none ? null : synthAnalysis(song, 7), levelOverride: null };
    vm.createContext(sb);
    vm.runInContext(legacySrc, sb, { filename: "js/media.js(legacy)" });
    const notes = vm.runInContext(`generateNotes(${JSON.stringify(diff)}, ${song.bpm}, ${offset}, ${JSON.stringify(seed)})`, sb);
    const level = vm.runInContext("estimateLevel(generated)", Object.assign(sb, { generated: notes }));
    const sha = crypto.createHash("sha256").update(JSON.stringify(notes)).digest("hex");
    cases.push({ song: songId, diff, bpm: song.bpm, offset, seed, count: notes.length, sha256: sha, level, head: notes.slice(0, 6) });
  }
}
const out = { source: `${ref}:js/media.js generateNotes・estimateLevel（旧方式）`, note: "合成曲の出力のハッシュ（notes）と、その譜面の Lv（level）。旧譜面の再現テストが照合する。", cases };
const file = path.join(ROOT, "tests/fixtures/chart-legacy-golden.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${path.relative(ROOT, file)} · ${cases.length} cases`);

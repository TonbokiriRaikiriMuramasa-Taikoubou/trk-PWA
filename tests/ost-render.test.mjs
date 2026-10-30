// SPDX-License-Identifier: GPL-3.0-or-later
/* trk180: OST スコアの描画は決定論的（同じスコアは何度描いても同じバイト、クリップなし）。
   同梱の全曲がスコアから描け、ABC の小節数がコードと合う。描画先は OS の一時フォルダ（Repoを汚さない）。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./helpers/browser-data.mjs";

function render(score, outDir) {
  const out = execFileSync(process.execPath,
    [`${ROOT}/tools/make-trk-song.mjs`, `${ROOT}/tools/ost-scores/${score}.json`, "--out", outDir, "--no-abc"],
    { encoding: "utf8" });
  return JSON.parse(out);
}

test("rendering the same score twice produces identical bytes without clipping", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-ost-render-"));
  try {
    const a = render("ost-02-popcorn-smile", path.join(dir, "a"));
    const b = render("ost-02-popcorn-smile", path.join(dir, "b"));
    assert.equal(a.clippedSamples, 0);
    assert.equal(a.seconds, 61.4);
    assert.equal(a.bars, 32);
    const { wav: _wa, ...statsA } = a;
    const { wav: _wb, ...statsB } = b;
    assert.deepEqual(statsA, statsB, "the reported stats are stable too");
    const wa = fs.readFileSync(path.join(dir, "a", "ost-02-popcorn-smile.wav"));
    const wb = fs.readFileSync(path.join(dir, "b", "ost-02-popcorn-smile.wav"));
    assert.ok(wa.equals(wb), "deterministic synth output");
    assert.ok(wa.length > 1000000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every OST track renders from its committed score and its ABC bars match the chords", () => {
  /* trk185: the audio moved to music-library; the scores stay here (tools/ost-scores/)
     and are the track list. The same scores ship in music-library's scores/. */
  const keys = fs.readdirSync(`${ROOT}/tools/ost-scores`).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort();
  assert.ok(keys.length >= 5);
  const manifest = { tracks: keys.map(key => ({ key })) };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trk-ost-pair-"));
  try {
    for (const t of manifest.tracks) {
      const stats = render(t.key, dir);
      assert.equal(stats.clippedSamples, 0, `${t.key}: no clipping`);
      assert.ok(stats.seconds > 10, `${t.key}: a complete song, not a sketch`);
      const score = JSON.parse(fs.readFileSync(`${ROOT}/tools/ost-scores/${t.key}.json`, "utf8"));
      const abc = fs.readFileSync(`${ROOT}/tools/ost-scores/${t.key}.abc`, "utf8");
      assert.equal(abc.split("|").length - 1, score.chords.length, `${t.key}: ABC bars match the chords`);
      assert.ok(abc.includes(`Q:1/4=${score.bpm}`), `${t.key}: ABC tempo matches the score`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

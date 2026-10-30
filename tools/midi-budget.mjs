#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Measure how much rendering work local .mid/.midi files need, using the same planner as the app
 * (js/midi-player.js → estimateRender). Nothing is uploaded or written: the files are only read.
 * Use it to check the render budget against your own MIDI files (for example Touhou MIDI from a
 * game you own) without adding them to the repository.
 *
 *   node tools/midi-budget.mjs path/to/song.mid [more.mid ...] [--profile=studio_gm] [--render]
 *
 * --render also synthesizes in memory and reports the time it took on this machine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const files = args.filter(arg => !arg.startsWith("--"));
const profileArg = args.find(arg => arg.startsWith("--profile="));
const profileId = profileArg ? profileArg.slice("--profile=".length) : "studio_gm";
const doRender = args.includes("--render");

if (!files.length) {
  console.log("usage: node tools/midi-budget.mjs <file.mid> [...] [--profile=<id>] [--render]");
  process.exit(0);
}

/* Evaluate the browser scripts in this realm (a vm context makes the synth loop much slower). */
const load = rel => fs.readFileSync(path.join(root, rel), "utf8");
const trk = new Function("window", `${load("js/midi-profiles.js")}\n${load("js/midi-player.js")}\nreturn window.Trk;`)({});
const { midi, midiProfiles } = trk;
if (!midiProfiles.get(profileId)) {
  console.error(`unknown profile "${profileId}". Known: ${midiProfiles.list().map(p => p.id).join(", ")}`);
  process.exit(2);
}

const million = n => (n / 1e6).toFixed(1) + "M";
let failed = 0;
for (const file of files) {
  let bytes;
  try { bytes = fs.readFileSync(file); }
  catch (error) { console.log(`${file}: cannot read (${error.code || error.message})`); failed++; continue; }
  try {
    const parsed = midi.parseMidi(bytes);
    const est = midi.estimateRender(parsed, { profileId });
    const share = (est.voiceSamples / est.maxVoiceSamples * 100).toFixed(0);
    const verdict = est.withinLimit ? "OK" : (est.voiceSamples > est.maxVoiceSamples ? "TOO DENSE" : "TOO LONG");
    let line = `${path.basename(file)}: ${verdict} — ${est.durationSeconds.toFixed(1)} s, ${est.notes} notes, ` +
      `${million(est.voiceSamples)} of ${million(est.maxVoiceSamples)} voice-samples (${share}%), ` +
      `~${est.averageVoices.toFixed(1)} voices sounding on average`;
    if (doRender && est.withinLimit) {
      const started = performance.now();
      const wav = await midi.renderParsedMidi(parsed, { profileId });
      const seconds = (performance.now() - started) / 1000;
      line += `; rendered in ${seconds.toFixed(1)} s here (${million(est.voiceSamples / seconds)}/s, ${(wav.size / 1e6).toFixed(1)} MB WAV in memory)`;
    }
    console.log(line);
  } catch (error) {
    console.log(`${path.basename(file)}: ${error.code || error.message}`);
    failed++;
  }
}
process.exit(failed ? 1 : 0);

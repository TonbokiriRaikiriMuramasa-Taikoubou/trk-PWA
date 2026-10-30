// SPDX-License-Identifier: GPL-3.0-or-later
/* Local Standard MIDI parsing/rendering; no third-party audio or game data. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const context = { window: {}, ArrayBuffer, Uint8Array, DataView, Blob, File, setTimeout };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/midi-profiles.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/midi-player.js"), "utf8"), context);
const profiles = context.window.Trk.midiProfiles;
const midi = context.window.Trk.midi;

const u16 = n => [n >> 8 & 255, n & 255];
const u32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
const text = s => [...Buffer.from(s, "ascii")];
const vlq = value => {
  let n = Math.max(0, Math.floor(value));
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
function midiFile(trackBytes, { format = 0, tracks = [trackBytes], division = 480 } = {}) {
  const header = [...text("MThd"), ...u32(6), ...u16(format), ...u16(tracks.length), ...u16(division)];
  const chunks = tracks.flatMap(track => [...text("MTrk"), ...u32(track.length), ...track]);
  return Uint8Array.from([...header, ...chunks]);
}
function oneNoteMidi() {
  return midiFile([
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // 500,000 us per quarter note
    0x00, 0xc0, 0x00,                         // program change: piano
    0x00, 0x90, 0x3c, 0x64,                   // middle C on
    0x83, 0x60, 0x80, 0x3c, 0x00,             // middle C off after one quarter
    0x00, 0xff, 0x2f, 0x00                    // end of track
  ]);
}
function expectMidiError(code, fn) {
  assert.throws(fn, error => error && error.code === code);
}

describe("Code-generated MIDI timbre profiles", () => {
  test("exposes exactly 24 unique immutable profiles: 10 reference-inspired and 14 trk originals", () => {
    const list = profiles.list();
    assert.equal(list.length, 24);
    assert.equal(list.filter(profile => profile.category === "reference").length, 10);
    assert.equal(list.filter(profile => profile.category === "trk").length, 14);
    assert.equal(new Set(list.map(profile => profile.id)).size, 24);
    assert.equal(profiles.defaultId, "studio_gm");
    assert.equal(profiles.normalize("not-a-profile"), profiles.defaultId);
    assert.ok(Object.isFrozen(list));
    for (const profile of list) {
      assert.match(profile.id, /^[a-z0-9_]{1,40}$/);
      assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.synth) && Object.isFrozen(profile.mixChain));
      assert.ok(profile.name.ja && profile.name.en && profile.name.zh && profile.name.ko);
      assert.ok(profile.mixChain.every(effect => effect && typeof effect.type === "string"));
    }
  });
});

describe("Standard MIDI File parsing", () => {
  test("reads a valid type-0 track and applies tempo to ticks", () => {
    const parsed = midi.parseMidi(oneNoteMidi());
    assert.equal(parsed.format, 0);
    assert.equal(parsed.trackCount, 1);
    assert.equal(parsed.division, 480);
    assert.equal(parsed.durationSeconds, 0.5);
    assert.deepEqual(Array.from(parsed.events, e => e.kind), ["tempo", "channel", "channel", "channel"]);
    assert.equal(parsed.events.find(e => e.command === 0x9).a, 60);
    assert.equal(parsed.events.find(e => e.command === 0x8).seconds, 0.5);
  });

  test("supports running status for channel events", () => {
    const parsed = midi.parseMidi(midiFile([
      0, 0x90, 60, 100,
      0, 64, 90,       // running-status note-on
      0x83, 0x60, 0x80, 60, 0,
      0, 64, 0,         // running-status note-off
      0, 0xff, 0x2f, 0
    ]));
    assert.equal(parsed.events.filter(e => e.kind === "channel").length, 4);
    assert.deepEqual(Array.from(parsed.events.filter(e => e.command === 0x9), e => e.a), [60, 64]);
    assert.deepEqual(Array.from(parsed.events.filter(e => e.command === 0x8), e => e.a), [60, 64]);
  });

  test("merges type-1 tracks and applies later global tempo changes", () => {
    const tempoTrack = [
      0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20,
      0x83, 0x60, 0xff, 0x51, 3, 0x0f, 0x42, 0x40,
      0, 0xff, 0x2f, 0
    ];
    const noteTrack = [
      0, 0x90, 69, 100,
      0x87, 0x40, 0x80, 69, 0, // 960 ticks, spanning both tempo regions
      0, 0xff, 0x2f, 0
    ];
    const parsed = midi.parseMidi(midiFile(tempoTrack, { format: 1, tracks: [tempoTrack, noteTrack] }));
    assert.equal(parsed.durationSeconds, 1.5);
    assert.equal(parsed.events.find(e => e.command === 0x8).seconds, 1.5);
  });

  test("rejects malformed headers, type 2, SMPTE timing, and unbounded duration", () => {
    expectMidiError("midi-invalid", () => midi.parseMidi(Uint8Array.of(1, 2, 3)));
    expectMidiError("midi-unsupported-format", () => midi.parseMidi(midiFile([0, 0xff, 0x2f, 0], { format: 2 })));
    expectMidiError("midi-smpte-unsupported", () => midi.parseMidi(midiFile([0, 0xff, 0x2f, 0], { division: 0xe728 })));
    const longTrack = [
      0, 0x90, 60, 100,
      ...vlq(1200 * 960), 0x80, 60, 0,
      0, 0xff, 0x2f, 0
    ];
    expectMidiError("midi-too-long", () => midi.parseMidi(midiFile(longTrack)));
  });

  test("enforces the MIDI input-size ceiling before parsing", () => {
    expectMidiError("midi-too-large", () => midi.parseMidi(new Uint8Array(8 * 1024 * 1024 + 1)));
  });

  test("counts tempo meta-events against the event ceiling", () => {
    const flood = [];
    for (let i = 0; i < 100001; i++) flood.push(0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20);
    expectMidiError("midi-event-limit", () => midi.parseMidi(midiFile(flood)));
  });
});

describe("Local MIDI rendering", () => {
  test("renders a WAV blob with audible PCM and correct RIFF headers", async () => {
    const wav = await midi.renderMidi(oneNoteMidi(), { sampleRate: 8000 });
    assert.equal(wav.type, "audio/wav");
    const buffer = await wav.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    assert.equal(Buffer.from(bytes.slice(0, 4)).toString("ascii"), "RIFF");
    assert.equal(Buffer.from(bytes.slice(8, 12)).toString("ascii"), "WAVE");
    const view = new DataView(buffer);
    assert.equal(view.getUint32(24, true), 8000);
    assert.equal(view.getUint16(34, true), 16);
    let energy = 0;
    for (let i = 44; i < bytes.length; i += 2) energy += Math.abs(view.getInt16(i, true));
    assert.ok(energy > 1000, "rendered audio contains non-silent samples");
  });

  test("uses the selected procedural profile and falls back safely for unknown IDs", async () => {
    const neutral = await midi.renderMidi(oneNoteMidi(), { sampleRate:8000, profileId:"studio_gm" });
    const fallback = await midi.renderMidi(oneNoteMidi(), { sampleRate:8000, profileId:"not-a-profile" });
    const pixel = await midi.renderMidi(oneNoteMidi(), { sampleRate:8000, profileId:"trk_pixel" });
    const [neutralBytes, fallbackBytes, pixelBytes] = await Promise.all([neutral, fallback, pixel].map(blob => blob.arrayBuffer()));
    assert.deepEqual(Buffer.from(fallbackBytes), Buffer.from(neutralBytes), "unknown profile IDs use the neutral default");
    assert.notDeepEqual(Buffer.from(pixelBytes), Buffer.from(neutralBytes), "different selected profiles produce different code-generated PCM");
  });

  test("does not accept silent, malformed, or note-dense input as playable audio", async () => {
    await assert.rejects(midi.renderMidi(midiFile([0, 0xff, 0x2f, 0])), error => error.code === "midi-no-notes");
    const file = new File([oneNoteMidi()], "th06_01.mid", { type: "audio/midi" });
    assert.equal(midi.isMidiFile(file), true);
    assert.equal(midi.isMidiFile({ name: "song.mp3", type: "audio/mpeg" }), false);
    const wavFile = await midi.renderFile(file, { sampleRate: 8000 });
    assert.equal(wavFile.name, "th06_01.wav");
    assert.equal(wavFile.type, "audio/wav");
  });
});

/* trk114: the render budget counts only audible work, is checked before synthesis, and is
   reported separately from the event/track limits ("too long or too many notes at once"). */
const trackOf = rows => [...rows.flatMap(([delta, ...bytes]) => [...vlq(delta), ...bytes]), 0, 0xff, 0x2f, 0];
const TICKS_PER_SECOND = 960; // division 480 at the default 120 BPM
function chordLoop(minutes) {
  const rows = [[0, 0xc0, 0]];
  const shapes = [[60, 64, 67, 72], [57, 60, 64, 69], [62, 65, 69, 74], [55, 59, 62, 67]];
  for (let i = 0; i < Math.round(minutes * 60 * 4); i++) {
    const notes = shapes[i % 4];
    for (const note of notes) rows.push([0, 0x90, note, 100]);
    notes.forEach((note, k) => rows.push([k === 0 ? TICKS_PER_SECOND / 4 : 0, 0x80, note, 0]));
  }
  return midiFile(trackOf(rows));
}

describe("MIDI render budget", () => {
  test("exports the limit and estimates without synthesizing audio", () => {
    assert.equal(midi.maxVoiceSamples, 200 * 1000 * 1000);
    const estimate = midi.estimateRender(oneNoteMidi());
    assert.equal(estimate.notes, 1);
    assert.equal(estimate.maxVoiceSamples, midi.maxVoiceSamples);
    assert.ok(estimate.withinLimit && estimate.voiceSamples > 0 && estimate.voiceSamples < 22050);
  });

  test("a 9.5-minute four-note chord loop (rejected before trk114) is within the limit", () => {
    const parsed = midi.parseMidi(chordLoop(9.5));
    assert.ok(parsed.durationSeconds > 569 && parsed.durationSeconds < 600);
    const estimate = midi.estimateRender(parsed);
    assert.equal(estimate.notes, 9120);
    assert.ok(estimate.withinLimit, `needs ${estimate.voiceSamples} voice-samples`);
    assert.ok(estimate.voiceSamples > 80 * 1000 * 1000, "the old 80M budget really was exceeded");
  });

  test("many long simultaneous notes are rejected as midi-too-dense before any audio is made", async () => {
    const rows = [];
    for (let channel = 0; channel < 16; channel++) {
      if (channel === 9) continue;
      rows.push([0, 0xc0 | channel, 48]);
      for (let note = 0; note < 16; note++) rows.push([0, 0x90 | channel, 40 + note, 90]);
    }
    let first = true;
    for (let channel = 0; channel < 16; channel++) {
      if (channel === 9) continue;
      for (let note = 0; note < 16; note++) { rows.push([first ? 590 * TICKS_PER_SECOND : 0, 0x80 | channel, 40 + note, 0]); first = false; }
    }
    const parsed = midi.parseMidi(midiFile(trackOf(rows)));
    const estimate = midi.estimateRender(parsed);
    assert.equal(estimate.withinLimit, false);
    assert.ok(estimate.voiceSamples > midi.maxVoiceSamples);
    const started = Date.now();
    await assert.rejects(midi.renderParsedMidi(parsed), error => error.code === "midi-too-dense");
    assert.ok(Date.now() - started < 2000, "the budget is checked before synthesis");
  });

  test("inaudible tails are not counted: undamped drum hits and a held piano note", () => {
    const drums = [];
    for (let i = 0; i < 200; i++) drums.push([i ? TICKS_PER_SECOND * 0.3 : 0, 0x99, 42, 100]);   // closed hi-hat, never released
    drums.push([TICKS_PER_SECOND * 3, 0x80, 60, 0]);
    const drumEstimate = midi.estimateRender(midiFile(trackOf(drums)));
    assert.ok(drumEstimate.voiceSamples < 200 * 0.5 * 22050, `drum work ${drumEstimate.voiceSamples}`);

    const piano = midiFile(trackOf([[0, 0xc0, 0], [0, 0x90, 60, 100], [300 * TICKS_PER_SECOND, 0x80, 60, 0]]));
    const pianoEstimate = midi.estimateRender(piano);
    assert.ok(pianoEstimate.voiceSamples > 11 * 22050 && pianoEstimate.voiceSamples < 12 * 22050,
      `the piano decay is 72 dB down after ~11.6 s (got ${pianoEstimate.voiceSamples / 22050} s)`);
  });

  test("reports progress and stops when the caller aborts", async () => {
    const rows = [[0, 0xc0, 0]];
    for (let i = 0; i < 600; i++) rows.push([i ? 48 : 0, 0x90, 48 + (i % 24), 100], [48, 0x80, 48 + (i % 24), 0]);
    const parsed = midi.parseMidi(midiFile(trackOf(rows)));
    const seen = [];
    await midi.renderParsedMidi(parsed, { sampleRate: 8000, onProgress: value => seen.push(value) });
    assert.ok(seen.length >= 2, "progress is reported at each yield");
    assert.ok(seen.every((value, i) => value > 0 && value <= 1 && (i === 0 || value >= seen[i - 1])));
    await assert.rejects(midi.renderParsedMidi(parsed, { sampleRate: 8000, shouldAbort: () => true }),
      error => error.code === "midi-aborted");
  });
});

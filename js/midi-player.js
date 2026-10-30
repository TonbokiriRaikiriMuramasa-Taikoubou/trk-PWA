// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Local Standard MIDI File reader and code-generated General-MIDI-style renderer.
 * It supports 24 original timbre profiles; no SF2/SF3 bank, sample audio, ROM data,
 * game audio, or external MIDI package is bundled.
 */
(() => {
  "use strict";

  const MAX_MIDI_BYTES = 8 * 1024 * 1024;
  const MAX_TRACKS = 128;
  const MAX_EVENTS = 100000;
  const MAX_TICKS = 0x7fffffff;
  const DEFAULT_SAMPLE_RATE = 22050;
  const MAX_DURATION_SECONDS = 10 * 60;
  /* Work budget = Σ(rendered seconds of every voice) × sample rate. It bounds CPU time, not memory
     (the output buffer depends only on the song length). trk114 calibration with synthetic SMFs
     (tools/midi-budget.mjs measures real files): a 9.5-minute 4-note chord loop needs ~87M, a dense
     4-minute game-BGM-style arrangement averaging ~37 sounding voices ~196M. The renderer did about
     7M voice-samples/s on the development container (≈29 s at the limit; phones are slower), so the
     caller shows progress and can abort (renderParsedMidi options). */
  const MAX_RENDERED_VOICE_SAMPLES = 200 * 1000 * 1000;
  const NOTE_RELEASE_SECONDS = 0.18;
  /* A decaying voice stops being rendered once its timbre decay is 72 dB down (ln 4096): below
     one 16-bit step for the loudest single voice, so cutting there is inaudible. Drum hits use the
     slowest decay of their own components (see drumAudibleSeconds), which also keeps drum notes
     without a note-off from sounding — and costing — until the end of the song. */
  const TAIL_CUTOFF_LOG = Math.log(4096);
  const YIELD_EVERY_VOICE_SAMPLES = 1000 * 1000;
  const TWO_PI = 2 * Math.PI;
  /* Interpolated sine table: max error ≈ 3e-7 (about −130 dB), far below the 16-bit output step.
     The size is a power of two (fastSin masks the index); the extra entry is sin(2π) for i + 1. */
  const SINE_TABLE_SIZE = 4096;
  const SINE_SCALE = SINE_TABLE_SIZE / TWO_PI;
  const SINE_TABLE = (() => {
    const table = new Float64Array(SINE_TABLE_SIZE + 1);
    for (let i = 0; i < table.length; i++) table[i] = Math.sin(TWO_PI * i / SINE_TABLE_SIZE);
    return table;
  })();
  const DEFAULT_SYNTH_PROFILE = Object.freeze({
    waveform: "sine", blend: 0.05, cutoff: 15800, attack: 1, decay: 1, release: 1,
    detune: 0.7, unison: 0.02, vibrato: 0.004, vibratoRate: 5.2, drive: 0.005,
    space: 0.06, bits: 16, noise: 0
  });

  function selectedProfile(options = {}) {
    const api = window.Trk && window.Trk.midiProfiles;
    if (!api || typeof api.get !== "function") return { id: "studio_gm", synth: DEFAULT_SYNTH_PROFILE };
    const id = options && typeof options.profileId === "string" ? options.profileId
      : options && typeof options.soundProfileId === "string" ? options.soundProfileId : api.defaultId;
    return api.get(id) || api.get(api.defaultId) || { id: "studio_gm", synth: DEFAULT_SYNTH_PROFILE };
  }

  function midiError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function byteView(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw midiError("midi-read-failed");
  }

  function readU16(view, offset) {
    if (offset < 0 || offset + 2 > view.byteLength) throw midiError("midi-invalid");
    return view.getUint16(offset, false);
  }

  function readU32(view, offset) {
    if (offset < 0 || offset + 4 > view.byteLength) throw midiError("midi-invalid");
    return view.getUint32(offset, false);
  }

  function readTag(bytes, offset) {
    return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  }

  function readVlq(bytes, offset, end) {
    let value = 0;
    for (let count = 0; count < 4; count++) {
      if (offset >= end) throw midiError("midi-invalid");
      const byte = bytes[offset++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return { value, offset };
    }
    throw midiError("midi-invalid");
  }

  function parseMidi(input) {
    const bytes = byteView(input);
    if (bytes.byteLength > MAX_MIDI_BYTES) throw midiError("midi-too-large");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.byteLength < 14 || readTag(bytes, 0) !== "MThd") throw midiError("midi-invalid");

    const headerLength = readU32(view, 4);
    if (headerLength < 6 || 8 + headerLength > bytes.byteLength) throw midiError("midi-invalid");
    const format = readU16(view, 8);
    const trackCount = readU16(view, 10);
    const division = readU16(view, 12);
    if (format > 1 || !trackCount || (format === 0 && trackCount !== 1)) throw midiError("midi-unsupported-format");
    if (trackCount > MAX_TRACKS) throw midiError("midi-track-limit");
    if (!division || (division & 0x8000)) throw midiError("midi-smpte-unsupported");

    let offset = 8 + headerLength;
    let order = 0;
    const events = [];
    for (let track = 0; track < trackCount; track++) {
      if (offset + 8 > bytes.byteLength || readTag(bytes, offset) !== "MTrk") throw midiError("midi-invalid");
      const trackLength = readU32(view, offset + 4);
      const trackStart = offset + 8;
      const trackEnd = trackStart + trackLength;
      if (trackEnd > bytes.byteLength || trackEnd < trackStart) throw midiError("midi-invalid");
      offset = trackEnd;
      let cursor = trackStart;
      let tick = 0;
      let runningStatus = 0;

      while (cursor < trackEnd) {
        const delta = readVlq(bytes, cursor, trackEnd);
        cursor = delta.offset;
        tick += delta.value;
        if (!Number.isSafeInteger(tick) || tick > MAX_TICKS) throw midiError("midi-invalid");
        if (cursor >= trackEnd) throw midiError("midi-invalid");

        const first = bytes[cursor++];
        let status = first;
        let firstData = -1;
        if (first < 0x80) {
          if (!runningStatus) throw midiError("midi-invalid");
          status = runningStatus;
          firstData = first;
        } else if (status < 0xf0) {
          runningStatus = status;
        } else {
          runningStatus = 0;
        }

        if (status === 0xff) {
          if (cursor >= trackEnd) throw midiError("midi-invalid");
          const metaType = bytes[cursor++];
          const metaLength = readVlq(bytes, cursor, trackEnd);
          cursor = metaLength.offset;
          if (metaLength.value > trackEnd - cursor) throw midiError("midi-invalid");
          if (metaType === 0x51) {
            if (metaLength.value !== 3) throw midiError("midi-invalid");
            const microsPerQuarter = (bytes[cursor] << 16) | (bytes[cursor + 1] << 8) | bytes[cursor + 2];
            if (!microsPerQuarter) throw midiError("midi-invalid");
            events.push({ tick, order: order++, kind: "tempo", microsPerQuarter });
            if (events.length > MAX_EVENTS) throw midiError("midi-event-limit");
          }
          cursor += metaLength.value;
          continue;
        }

        if (status === 0xf0 || status === 0xf7) {
          const sysexLength = readVlq(bytes, cursor, trackEnd);
          cursor = sysexLength.offset;
          if (sysexLength.value > trackEnd - cursor) throw midiError("midi-invalid");
          cursor += sysexLength.value;
          continue;
        }
        if (status >= 0xf0) throw midiError("midi-unsupported-format");

        const command = status >> 4;
        const channel = status & 0x0f;
        if (command < 0x8 || command > 0xe) throw midiError("midi-invalid");
        const dataLength = command === 0xc || command === 0xd ? 1 : 2;
        let a;
        let b = 0;
        if (firstData >= 0) a = firstData;
        else {
          if (cursor >= trackEnd) throw midiError("midi-invalid");
          a = bytes[cursor++];
        }
        if (dataLength === 2) {
          if (cursor >= trackEnd) throw midiError("midi-invalid");
          b = bytes[cursor++];
        }
        if (a > 0x7f || b > 0x7f) throw midiError("midi-invalid");
        events.push({ tick, order: order++, kind: "channel", command, channel, a, b });
        if (events.length > MAX_EVENTS) throw midiError("midi-event-limit");
      }
    }

    if (offset > bytes.byteLength) throw midiError("midi-invalid");
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    let currentTick = 0;
    let currentSeconds = 0;
    let microsPerQuarter = 500000;
    for (const event of events) {
      currentSeconds += (event.tick - currentTick) * microsPerQuarter / (1000000 * division);
      if (!Number.isFinite(currentSeconds) || currentSeconds > MAX_DURATION_SECONDS) throw midiError("midi-too-long");
      currentTick = event.tick;
      event.seconds = currentSeconds;
      if (event.kind === "tempo") microsPerQuarter = event.microsPerQuarter;
    }
    return { format, trackCount, division, events, durationSeconds: currentSeconds };
  }

  function releaseVoice(voice, seconds) {
    if (voice && voice.stopSeconds == null) voice.stopSeconds = seconds;
  }

  function closeChannelVoices(active, held, channel, seconds, hard) {
    for (const [key, queue] of active) {
      if (!key.startsWith(channel + ":")) continue;
      for (const voice of queue) {
        releaseVoice(voice, seconds);
        if (hard) voice.hardStop = true;
      }
      queue.length = 0;
    }
    for (const voice of held[channel]) {
      releaseVoice(voice, seconds);
      if (hard) voice.hardStop = true;
    }
    held[channel].length = 0;
  }

  function collectVoices(parsed) {
    const active = new Map();
    const held = Array.from({ length: 16 }, () => []);
    const sustain = new Array(16).fill(false);
    const programs = new Array(16).fill(0);
    const volume = new Array(16).fill(127);
    const expression = new Array(16).fill(127);
    const voices = [];
    let lastEventSeconds = parsed.durationSeconds;

    for (const event of parsed.events) {
      if (event.seconds > lastEventSeconds) lastEventSeconds = event.seconds;
      if (event.kind !== "channel") continue;
      const { command, channel, a, b, seconds } = event;
      if (command === 0xc) {
        programs[channel] = a;
      } else if (command === 0xb) {
        if (a === 7) volume[channel] = b;
        else if (a === 11) expression[channel] = b;
        else if (a === 64) {
          const down = b >= 64;
          if (sustain[channel] && !down) {
            for (const voice of held[channel]) releaseVoice(voice, seconds);
            held[channel].length = 0;
          }
          sustain[channel] = down;
        } else if (a === 120) {
          closeChannelVoices(active, held, channel, seconds, true);
          sustain[channel] = false;
        } else if (a === 123) {
          closeChannelVoices(active, held, channel, seconds, false);
        }
      } else if (command === 0x9 && b > 0) {
        const voice = {
          channel, note: a, velocity: b, program: programs[channel],
          volume: volume[channel] * expression[channel] / (127 * 127),
          startSeconds: seconds, stopSeconds: null, hardStop: false
        };
        const key = channel + ":" + a;
        if (!active.has(key)) active.set(key, []);
        active.get(key).push(voice);
        voices.push(voice);
      } else if (command === 0x8 || (command === 0x9 && b === 0)) {
        const key = channel + ":" + a;
        const queue = active.get(key);
        if (!queue || !queue.length) continue;
        const voice = queue.shift();
        if (sustain[channel]) held[channel].push(voice);
        else releaseVoice(voice, seconds);
      }
    }

    for (const queue of active.values()) for (const voice of queue) releaseVoice(voice, lastEventSeconds);
    for (const list of held) for (const voice of list) releaseVoice(voice, lastEventSeconds);
    return voices;
  }

  const FAMILY_PIANO = 0, FAMILY_BELL = 1, FAMILY_ORGAN = 2, FAMILY_GUITAR = 3, FAMILY_BASS = 4,
    FAMILY_STRINGS = 5, FAMILY_BRASS = 6, FAMILY_REED = 7, FAMILY_SYNTH = 8, FAMILY_ETHNIC = 9, FAMILY_PERCUSSION = 10;

  function programFamily(program) {
    if (program <= 7) return FAMILY_PIANO;
    if (program <= 15) return FAMILY_BELL;
    if (program <= 23) return FAMILY_ORGAN;
    if (program <= 31) return FAMILY_GUITAR;
    if (program <= 39) return FAMILY_BASS;
    if (program <= 55) return FAMILY_STRINGS;
    if (program <= 63) return FAMILY_BRASS;
    if (program <= 79) return FAMILY_REED;
    if (program <= 103) return FAMILY_SYNTH;
    if (program <= 111) return FAMILY_ETHNIC;
    if (program <= 119) return FAMILY_BELL;
    return FAMILY_PERCUSSION;
  }

  function releaseSecondsFor(voice, profile) {
    if (voice.hardStop) return 0.025;
    const family = programFamily(voice.program);
    const base = family === FAMILY_STRINGS || family === FAMILY_ORGAN || family === FAMILY_SYNTH ? 0.32 : NOTE_RELEASE_SECONDS;
    return Math.max(0.035, Math.min(1.25, base * (Number(profile && profile.release) || 1)));
  }

  /* Per-second exponential decay of the melodic timbre (before the profile's decay scale). */
  function familyDecay(family) {
    return family === FAMILY_PIANO ? 0.72
      : family === FAMILY_GUITAR || family === FAMILY_BELL ? 1.45
        : family === FAMILY_BASS ? 0.35 : 0.08;
  }

  function fastSin(x) {
    const p = x * SINE_SCALE;
    const whole = Math.floor(p);
    const i = whole & (SINE_TABLE_SIZE - 1);
    const a = SINE_TABLE[i];
    return a + (SINE_TABLE[i + 1] - a) * (p - whole);
  }

  /* Exactly 2/π·asin(sin(phase)), computed from the phase instead of two transcendental calls. */
  function triangleWave(phase) {
    let u = phase / TWO_PI;
    u -= Math.floor(u);
    return u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
  }

  function sawWave(phase) {
    const cycle = phase / TWO_PI;
    return 2 * (cycle - Math.floor(0.5 + cycle));
  }

  /* brightness = exp(−1.2·age) (piano) and stringVibrato = sin(2π·5.2·age)·0.025 (strings) are
     passed in, because they depend only on the note age and are shared by the detuned copy. */
  function melodicSample(phase, family, brightness, stringVibrato) {
    if (family === FAMILY_PIANO) {
      return fastSin(phase) * 0.73 + fastSin(phase * 2) * (0.22 * brightness) + fastSin(phase * 3.01) * 0.07;
    }
    if (family === FAMILY_BELL) {
      return fastSin(phase) * 0.62 + fastSin(phase * 2.71) * 0.27 + fastSin(phase * 5.14) * 0.11;
    }
    if (family === FAMILY_ORGAN) {
      return fastSin(phase) * 0.60 + fastSin(phase * 2) * 0.27 + fastSin(phase * 3) * 0.13;
    }
    if (family === FAMILY_GUITAR) {
      return fastSin(phase) * 0.72 + fastSin(phase * 2.01) * 0.2 + fastSin(phase * 3) * 0.08;
    }
    if (family === FAMILY_BASS) {
      return fastSin(phase) * 0.78 + fastSin(phase * 2) * 0.17 + fastSin(phase * 3) * 0.05;
    }
    if (family === FAMILY_STRINGS) {
      const p = phase + stringVibrato;
      return fastSin(p) * 0.61 + sawWave(p) * 0.27 + fastSin(p * 2) * 0.12;
    }
    if (family === FAMILY_BRASS || family === FAMILY_SYNTH) {
      return fastSin(phase) * 0.48 + sawWave(phase) * 0.4 + fastSin(phase * 2) * 0.12;
    }
    if (family === FAMILY_REED || family === FAMILY_ETHNIC) {
      return fastSin(phase) * 0.72 + triangleWave(phase) * 0.28;
    }
    return fastSin(phase);
  }

  const WAVE_SINE = 0, WAVE_TRIANGLE = 1, WAVE_SAW = 2, WAVE_SQUARE = 3, WAVE_PULSE = 4,
    WAVE_FM = 5, WAVE_METAL = 6, WAVE_ORGAN = 7, WAVE_REED = 8;
  const WAVEFORM_CODES = Object.freeze({ sine: WAVE_SINE, triangle: WAVE_TRIANGLE, saw: WAVE_SAW, square: WAVE_SQUARE,
    pulse: WAVE_PULSE, fm: WAVE_FM, metal: WAVE_METAL, organ: WAVE_ORGAN, reed: WAVE_REED });

  /* Harmonic shapes are generated mathematically; the small blend keeps each GM program's family audible. */
  function profileWaveSample(phase, waveform) {
    if (waveform === WAVE_SINE) return fastSin(phase);
    if (waveform === WAVE_TRIANGLE) return triangleWave(phase);
    if (waveform === WAVE_SAW || waveform === WAVE_SQUARE || waveform === WAVE_PULSE) {
      const angle = phase - Math.floor(phase / TWO_PI) * TWO_PI;
      if (waveform === WAVE_SAW) return angle / Math.PI - 1;
      /* The sign test stays on Math.sin so that edges landing exactly on a zero crossing keep the same side. */
      if (waveform === WAVE_SQUARE) return Math.sin(phase) >= 0 ? 1 : -1;
      return angle < Math.PI * 0.58 ? 1 : -0.58 / 0.42;
    }
    if (waveform === WAVE_FM) return fastSin(phase + fastSin(phase * 2.01) * 0.68);
    if (waveform === WAVE_METAL) return fastSin(phase) * 0.64 + fastSin(phase * 2.76) * 0.24 + fastSin(phase * 5.13) * 0.12;
    if (waveform === WAVE_ORGAN) return fastSin(phase) * 0.60 + fastSin(phase * 2) * 0.27 + fastSin(phase * 3) * 0.13;
    if (waveform === WAVE_REED) return fastSin(phase) * 0.72 + triangleWave(phase) * 0.28;
    return fastSin(phase);
  }

  const DRUM_KICK = 0, DRUM_SNARE = 1, DRUM_CYMBAL = 2, DRUM_OTHER = 3;
  function drumKind(note) {
    if (note === 35 || note === 36) return DRUM_KICK;
    if (note === 38 || note === 40 || note === 39) return DRUM_SNARE;
    if ((note >= 42 && note <= 46) || note === 49 || note === 51 || note === 57) return DRUM_CYMBAL;
    return DRUM_OTHER;
  }

  /* Seconds until the slowest exponential in drumSample() for this note is 72 dB down. */
  function drumAudibleSeconds(note) {
    const kind = drumKind(note);
    const slowest = kind === DRUM_KICK ? 8
      : kind === DRUM_SNARE ? (note === 39 ? 11 : 13)
        : kind === DRUM_CYMBAL ? (note === 46 || note === 49 ? 4.2 : 18) : 9;
    return TAIL_CUTOFF_LOG / slowest;
  }

  function drumSample(note, kind, age, seedState) {
    let state = seedState.value;
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    seedState.value = state;
    const noise = state / 2147483648 - 1;
    if (kind === DRUM_KICK) {
      const pitch = Math.max(38, 110 - age * 80);
      return fastSin(TWO_PI * pitch * age) * Math.exp(-age * 8) * 0.9 + noise * Math.exp(-age * 45) * 0.1;
    }
    if (kind === DRUM_SNARE) {
      return noise * Math.exp(-age * (note === 39 ? 11 : 15)) * 0.75 + fastSin(TWO_PI * 185 * age) * Math.exp(-age * 13) * 0.25;
    }
    if (kind === DRUM_CYMBAL) {
      return noise * Math.exp(-age * (note === 46 || note === 49 ? 4.2 : 18)) * 0.88;
    }
    const frequency = 90 + (note % 24) * 13;
    return fastSin(TWO_PI * frequency * age) * Math.exp(-age * 9) * 0.65 + noise * Math.exp(-age * 20) * 0.35;
  }

  function encodeWav(samples, sampleRate, bitDepth = 16) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeAscii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    writeAscii(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
    writeAscii(8, "WAVE"); writeAscii(12, "fmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeAscii(36, "data"); view.setUint32(40, samples.length * 2, true);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const scale = peak > 0.92 ? 0.92 / peak : 1;
    const bits = Math.max(5, Math.min(16, Math.floor(Number(bitDepth) || 16)));
    const levels = Math.pow(2, bits - 1);
    for (let i = 0; i < samples.length; i++) {
      let value = Math.max(-1, Math.min(1, samples[i] * scale));
      if (bits < 16) value = Math.round(value * levels) / levels;  // optional, intentional code-only bit reduction
      view.setInt16(44 + i * 2, value < 0 ? Math.round(value * 32768) : Math.round(value * 32767), true);
    }
    return buffer;
  }

  function addAlgorithmicRoom(samples, sampleRate, amount) {
    const mix = Math.max(0, Math.min(0.6, Number(amount) || 0));
    if (mix < 0.005) return samples;
    const taps = [[0.037, 0.25], [0.061, 0.19], [0.097, 0.13], [0.151, 0.08]];
    const tailFrames = Math.ceil(sampleRate * (0.16 + mix * 0.46));
    const output = new Float32Array(samples.length + tailFrames);
    for (let i = 0; i < samples.length; i++) output[i] = samples[i] * (1 - mix * 0.09);
    for (const [seconds, gain] of taps) {
      const offset = Math.max(1, Math.round(seconds * sampleRate));
      const tapGain = mix * gain;
      for (let i = 0; i < samples.length; i++) output[i + offset] += samples[i] * tapGain;
    }
    return output;
  }

  function synthSettings(options) {
    const sampleRate = Math.max(8000, Math.min(48000, Math.floor(Number(options.sampleRate) || DEFAULT_SAMPLE_RATE)));
    const maxDuration = Math.max(1, Math.min(MAX_DURATION_SECONDS, Number(options.maxDurationSeconds) || MAX_DURATION_SECONDS));
    const selected = selectedProfile(options);
    const profile = selected && selected.synth || DEFAULT_SYNTH_PROFILE;
    const bounded = (key, min, max, fallback) => {
      const value = Number(profile[key]);
      return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    };
    const drive = bounded("drive", 0, 0.5, 0);
    const cutoff = Math.min(bounded("cutoff", 1800, 22000, 16000), sampleRate * 0.46);
    return {
      sampleRate, maxDuration,
      blend: bounded("blend", 0, 0.8, 0),
      detuneRatio: Math.pow(2, bounded("detune", 0, 24, 0) / 1200),
      unison: bounded("unison", 0, 0.5, 0),
      vibrato: bounded("vibrato", 0, 0.2, 0),
      vibratoRate: bounded("vibratoRate", 0, 16, 5.2),
      attackScale: bounded("attack", 0.25, 3, 1),
      decayScale: bounded("decay", 0.2, 3, 1),
      releaseScale: bounded("release", 0.25, 3, 1),
      drive, driveScale: 1 + drive * 4,
      noise: bounded("noise", 0, 0.02, 0),
      space: bounded("space", 0, 0.6, 0),
      bitDepth: bounded("bits", 5, 16, 16),
      filterAlpha: 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate),
      waveform: Object.prototype.hasOwnProperty.call(WAVEFORM_CODES, profile.waveform) ? WAVEFORM_CODES[profile.waveform] : WAVE_SINE
    };
  }

  /* Plans every voice (gate, release and the audible span that is actually rendered) and totals the
     work. Shared by renderParsedMidi and estimateRender so a limit message always matches the render. */
  function planVoices(parsed, settings) {
    const voices = collectVoices(parsed);
    let duration = Math.max(0.25, parsed.durationSeconds);
    let voiceSamples = 0;
    for (const voice of voices) {
      const stop = voice.stopSeconds == null ? parsed.durationSeconds : voice.stopSeconds;
      const gate = Math.max(0.045, stop - voice.startSeconds);
      voice.gateSeconds = gate;
      voice.releaseSeconds = releaseSecondsFor(voice, { release: settings.releaseScale });
      voice.family = programFamily(voice.program);
      voice.decayRate = familyDecay(voice.family) * settings.decayScale;
      const audible = voice.channel === 9 ? drumAudibleSeconds(voice.note) : TAIL_CUTOFF_LOG / voice.decayRate;
      voice.renderSeconds = Math.min(gate + voice.releaseSeconds, audible);
      duration = Math.max(duration, voice.startSeconds + voice.renderSeconds);
      voiceSamples += Math.ceil(voice.renderSeconds * settings.sampleRate);
    }
    duration += 0.12 + Math.min(0.45, settings.space * 0.62);
    return { voices, duration, voiceSamples };
  }

  /* Cheap pre-flight: how much rendering a parsed MIDI needs, without synthesizing audio. */
  function estimateRender(input, options = {}) {
    const parsed = input && Array.isArray(input.events) ? input : parseMidi(input);
    const settings = synthSettings(options);
    const plan = planVoices(parsed, settings);
    return {
      notes: plan.voices.length,
      durationSeconds: plan.duration,
      voiceSamples: plan.voiceSamples,
      maxVoiceSamples: MAX_RENDERED_VOICE_SAMPLES,
      averageVoices: plan.duration > 0 ? plan.voiceSamples / (plan.duration * settings.sampleRate) : 0,
      withinLimit: plan.voices.length > 0 && plan.voiceSamples <= MAX_RENDERED_VOICE_SAMPLES && plan.duration <= settings.maxDuration
    };
  }

  /* options.shouldAbort(): return true to stop (throws "midi-aborted"); options.onProgress(0..1). */
  async function renderParsedMidi(parsed, options = {}) {
    const settings = synthSettings(options);
    const { sampleRate, blend, detuneRatio, unison, vibrato, vibratoRate, attackScale, drive, driveScale,
      noise, space, bitDepth, filterAlpha, waveform } = settings;
    const driveNorm = drive > 0 ? Math.tanh(driveScale) : 1;
    const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const { voices, duration, voiceSamples } = planVoices(parsed, settings);
    if (!voices.length) throw midiError("midi-no-notes");
    if (voiceSamples > MAX_RENDERED_VOICE_SAMPLES) throw midiError("midi-too-dense");
    if (!Number.isFinite(duration) || duration > settings.maxDuration) throw midiError("midi-too-long");
    const frameCount = Math.ceil(duration * sampleRate);
    let samples = new Float32Array(frameCount);
    const useUnison = unison > 0.001 && detuneRatio > 1;
    const useFilter = filterAlpha < 0.999;
    const vibratoOmega = TWO_PI * vibratoRate;
    const brightnessStep = Math.exp(-1.2 / sampleRate);
    let done = 0, sinceYield = 0;

    for (let index = 0; index < voices.length; index++) {
      const voice = voices[index];
      const start = Math.max(0, Math.floor(voice.startSeconds * sampleRate));
      const end = Math.min(frameCount, Math.ceil((voice.startSeconds + voice.renderSeconds) * sampleRate));
      const omega = 2 * Math.PI * (440 * Math.pow(2, (voice.note - 69) / 12));
      const family = voice.family;
      const isDrum = voice.channel === 9;
      const kind = isDrum ? drumKind(voice.note) : -1;
      const amplitude = (voice.velocity / 127) * voice.volume * 0.15;
      const baseAttack = family === FAMILY_STRINGS || family === FAMILY_SYNTH ? 0.035 : 0.008;
      const attackSeconds = Math.max(0.003, Math.min(0.3, baseAttack * attackScale));
      const gate = voice.gateSeconds, release = voice.releaseSeconds, hardStop = voice.hardStop;
      const decayStep = Math.exp(-voice.decayRate / sampleRate);
      const seedState = { value: (Math.imul(voice.note + 1, 2654435761) ^ start ^ index) >>> 0 };
      let filterState = 0, decay = 1, brightness = 1;
      for (let frame = start; frame < end; frame++) {
        const age = (frame - start) / sampleRate;
        let envelope = age < attackSeconds ? age / attackSeconds : 1;
        if (age > gate) {
          envelope *= Math.max(0, 1 - (age - gate) / release);
          if (hardStop) envelope *= Math.max(0, 1 - (age - gate) / 0.025);
        }
        let timbre;
        if (isDrum) {
          timbre = drumSample(voice.note, kind, age, seedState);
        } else {
          const phase = omega * age + (vibrato > 0 ? fastSin(vibratoOmega * age) * vibrato : 0);
          const stringVibrato = family === FAMILY_STRINGS ? fastSin(age * TWO_PI * 5.2) * 0.025 : 0;
          let native = melodicSample(phase, family, brightness, stringVibrato);
          if (useUnison) {
            const detuned = melodicSample(phase * detuneRatio, family, brightness, stringVibrato);
            native = native * (1 - unison) + detuned * unison;
          }
          const color = blend > 0 ? profileWaveSample(phase, waveform) : 0;
          timbre = (native * (1 - blend) + color * blend) * decay;
          decay *= decayStep;
          brightness *= brightnessStep;
          if (noise > 0) {
            let state = seedState.value;
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            seedState.value = state;
            timbre += (state / 2147483648 - 1) * noise;
          }
          if (drive > 0) {   /* tanh(x) = 1 − 2/(e^2x + 1): the same curve with one exp instead of Math.tanh */
            const e2 = Math.exp(2 * timbre * driveScale);
            timbre = (1 - 2 / (e2 + 1)) / driveNorm;
          }
          if (useFilter) {
            filterState += filterAlpha * (timbre - filterState);
            timbre = filterState;
          }
        }
        samples[frame] += timbre * envelope * amplitude;
      }
      const span = Math.max(0, end - start);
      done += span; sinceYield += span;
      if (sinceYield >= YIELD_EVERY_VOICE_SAMPLES || (index && index % 256 === 0)) {
        sinceYield = 0;
        await new Promise(resolve => setTimeout(resolve, 0));
        if (shouldAbort && shouldAbort()) throw midiError("midi-aborted");
        if (onProgress) { try { onProgress(Math.min(1, done / Math.max(1, voiceSamples))); } catch (_) {} }
      }
    }
    samples = addAlgorithmicRoom(samples, sampleRate, space);
    return new Blob([encodeWav(samples, sampleRate, bitDepth)], { type: "audio/wav" });
  }

  async function renderMidi(input, options = {}) {
    const parsed = parseMidi(input);
    return renderParsedMidi(parsed, options);
  }

  function isMidiFile(file) {
    if (!file) return false;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase().split(";")[0].trim();
    return /\.(?:mid|midi)$/.test(name) || type === "audio/midi" || type === "audio/x-midi" || type === "audio/mid";
  }

  async function renderFile(file, options = {}) {
    if (!isMidiFile(file) || !file || typeof file.arrayBuffer !== "function") throw midiError("midi-read-failed");
    if (Number(file.size) > MAX_MIDI_BYTES) throw midiError("midi-too-large");
    const source = await file.arrayBuffer();
    const audio = await renderMidi(source, options);
    const FileConstructor = typeof File !== "undefined" ? File : null;
    const name = String(file.name || "song.mid").replace(/\.(?:mid|midi)$/i, "") + ".wav";
    return FileConstructor ? new FileConstructor([audio], name, { type: "audio/wav", lastModified: Number(file.lastModified) || Date.now() }) : audio;
  }

  const api = Object.freeze({
    isMidiFile, parseMidi, renderMidi, renderParsedMidi, renderFile, estimateRender,
    maxBytes: MAX_MIDI_BYTES, maxDurationSeconds: MAX_DURATION_SECONDS, sampleRate: DEFAULT_SAMPLE_RATE,
    maxVoiceSamples: MAX_RENDERED_VOICE_SAMPLES
  });
  window.Trk = window.Trk || {};
  window.Trk.midi = api;
})();

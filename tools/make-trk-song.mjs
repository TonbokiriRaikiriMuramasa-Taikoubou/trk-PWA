#!/usr/bin/env node
/* 🎹 trk OST スコア → WAV/ABC レンダラ。
   テキストのスコア（tools/ost-scores/*.json）を読んで、決定論的チップシンセで WAV を描き、
   メロディ＋コードの ABC 譜を書き出す。「記号で作曲、音で創造」する道具。
   使いかた: node tools/make-trk-song.mjs tools/ost-scores/ost-01-sunrise-dash.json [--out dir] [--no-abc]
   WAV は `--out`（既定 assets/trk-ost-preview/）へ。*.wav は .gitignore のため Git には入らない。
   ABC はスコアと同じフォルダへ出し、Git に入れる（人が読む・YuE2 等へ渡す材料）。
   MP3 化は別手順（tools/ost-scores/README.md）。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SR = 22050;

const fail = (msg) => { console.error(`make-trk-song: ${msg}`); process.exit(1); };
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/* ---------- 音名・コード ---------- */
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(String(name || ""));
  if (!m) fail(`bad note name ${JSON.stringify(name)} (want like C5, F#4, Bb3)`);
  const midi = SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  if (midi < 12 || midi > 108) fail(`note out of range: ${name}`);
  return midi;
}
/* コード名 → { root: 低音のMIDI, triad: [半音オフセット...] }。triad[1] が短3度ならマイナー。 */
const CHORDS = {
  C: { root: 36, triad: [0, 4, 7] }, G: { root: 43, triad: [0, 4, 7] },
  F: { root: 41, triad: [0, 4, 7] }, Am: { root: 45, triad: [0, 3, 7] },
  Dm: { root: 38, triad: [0, 3, 7] }, Em: { root: 40, triad: [0, 3, 7] },
  D: { root: 38, triad: [0, 4, 7] }, E: { root: 40, triad: [0, 4, 7] },
  A: { root: 45, triad: [0, 4, 7] }, Bm: { root: 47, triad: [0, 3, 7] },
  Bb: { root: 46, triad: [0, 4, 7] }, Gm: { root: 43, triad: [0, 3, 7] },
};
const DRUM_PATTERNS = ["build", "drive", "outro", "soft", "lullaby", "blaze", "vocaloid"];
/* 長調のキー。ABC の臨時記号と下方3度ハーモニーはここから決まる（C/G/F だけ。増やすときは表を足す）。 */
const KEY_PCS = { C: [0, 2, 4, 5, 7, 9, 11], G: [0, 2, 4, 6, 7, 9, 11], F: [0, 2, 4, 5, 7, 9, 10], D: [1, 2, 4, 6, 7, 9, 11] };
/* pc → ABC の音字。調号でまかなえる音に臨時記号は付けない（G の F# は素の F、F の Bb は素の B）。 */
const KEY_PITCH = {
  C: ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"],
  G: ["C", "^C", "D", "^D", "E", "=F", "F", "G", "^G", "A", "^A", "B"],
  F: ["C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "B", "=B"],
  D: ["=C", "C", "D", "^D", "E", "=F", "F", "G", "^G", "A", "^A", "B"],
};
const LEAD_WAVES = { pulse: 0.15, tri: 0.26, square: 0.1, saw: 0.09, sine: 0.3 };   /* リードの波形 → 既定の大きさ */
const BASS_WAVES = { saw: 0.15, tri: 0.3, sine: 0.32, square: 0.09, pulse: 0.13 };   /* ベースの波形 → 既定の大きさ */
const PAD_WAVES = ["square", "tri", "sine"];   /* スタブ（コードの強打・パッド）の波形 */
const BASS_STYLES = ["drive8", "soft"];   /* drive8＝8分刻み、soft＝1・3拍の全音符寄り */
function parseKey(key) {
  const m = /^([A-G])\s+major$/.exec(String(key || ""));
  if (!m || !KEY_PCS[m[1]]) fail(`only C/D/F/G major for now (got ${JSON.stringify(key)})`);
  return m[1];
}

/* ---------- Track（tools/make-trk-ost.mjs と同型＋ビブラート/クラッシュ） ---------- */
class Track {
  constructor(sec) {
    this.d = new Float32Array(Math.ceil(sec * SR));
    this.seed = 123456789 + Math.floor(sec * 1000);
  }
  rnd() { this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff; return this.seed / 0x7fffffff; }
  /* wave: sine|tri|square|pulse|saw。vib: {rate, cents} ビブラート。 */
  tone(t, midi, dur, g, wave, o = {}) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const N = Math.max(1, Math.floor(dur * SR)), s0 = Math.floor(t * SR);
    if (s0 >= this.d.length) return;
    const a = Math.floor((o.a ?? 0.005) * SR), r = Math.floor((o.r ?? 0.05) * SR);
    const vibRate = o.vib?.rate ?? 0, vibCents = o.vib?.cents ?? 0;
    let phase = 0;
    for (let i = 0; i < N; i++) {
      const gi = s0 + i;
      if (gi >= this.d.length) break;
      const inst = f * Math.pow(2, (vibCents * Math.sin(2 * Math.PI * vibRate * (i / SR))) / 1200);
      phase += (2 * Math.PI * inst) / SR;
      const p = (phase / (2 * Math.PI)) % 1;
      let v;
      if (wave === "sine") v = Math.sin(phase);
      else if (wave === "tri") v = 4 * Math.abs(p - 0.5) - 1;
      else if (wave === "square") v = p < 0.5 ? 1 : -1;
      else if (wave === "pulse") v = p < 0.25 ? 1 : -0.35;
      else v = 2 * p - 1;
      let e = 1;
      if (i < a) e = i / Math.max(1, a);
      else if (i > N - r) e = Math.max(0, (N - i) / Math.max(1, r));
      this.d[gi] += v * g * e;
    }
  }
  noise(t, dur, g, hp = 0, o = {}) {
    const N = Math.max(1, Math.floor(dur * SR)), s0 = Math.floor(t * SR);
    if (s0 >= this.d.length) return;
    let last = 0;
    const r = Math.floor((o.r ?? 0) * SR);
    for (let i = 0; i < N; i++) {
      const gi = s0 + i;
      if (gi >= this.d.length) break;
      let v = this.rnd() * 2 - 1;
      if (hp) { const y = v - last; last = v; v = y; }
      let e = 1 - i / N;
      if (r && i > N - r) e *= (N - i) / r;
      this.d[gi] += v * g * e;
    }
  }
  kick(t, g = 0.9) {
    const N = Math.floor(0.12 * SR), s0 = Math.floor(t * SR);
    let phase = 0;
    for (let i = 0; i < N; i++) {
      const gi = s0 + i;
      if (gi >= this.d.length) break;
      phase += (2 * Math.PI * (150 - 100 * (i / N))) / SR;
      this.d[gi] += Math.sin(phase) * g * (1 - i / N);
    }
  }
  snare(t, g = 0.5) {
    this.noise(t, 0.09, g, 0);
    this.tone(t, 71, 0.07, g * 0.5, "tri");
  }
  hat(t, g = 0.16, open = false) { this.noise(t, open ? 0.18 : 0.045, g, 1); }
  crash(t, g = 0.3) { this.noise(t, 0.7, g, 1); this.noise(t, 0.35, g * 0.5, 0); }
  space(mix = 0.18) {
    const out = new Float32Array(this.d.length);
    const d1 = Math.floor(SR * 0.28), d2 = Math.floor(SR * 0.41), g = mix;
    for (let i = 0; i < this.d.length; i++) {
      let v = this.d[i];
      if (i >= d1) v += out[i - d1] * g;
      if (i >= d2) v += out[i - d2] * g * 0.6;
      out[i] = v;
    }
    this.d = out;
  }
  level(t, dur) {
    const s0 = Math.floor(t * SR), N = Math.floor(dur * SR);
    let s = 0, n = 0, peak = 0;
    for (let i = s0; i < Math.min(s0 + N, this.d.length); i++) {
      const v = this.d[i];
      s += v * v; n++;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    return { rms: n ? Math.sqrt(s / n) : 0, peak };
  }
  finalize(target = 0.88) {
    let peak = 0;
    for (const v of this.d) if (Math.abs(v) > peak) peak = Math.abs(v);
    const k = peak > 0 ? target / peak : 1;
    for (let i = 0; i < this.d.length; i++) this.d[i] = Math.tanh(this.d[i] * k);
    return { peakBefore: peak, gain: k };
  }
  writeWav(file, force = false) {
    if (fs.existsSync(file) && !force) fail(`exists (refusing to overwrite): ${file}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const n = this.d.length, buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
    buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
    buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36);
    buf.writeUInt32LE(n * 2, 40);
    let over = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, this.d[i]));
      if (Math.abs(this.d[i]) > 1) over++;
      buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
    }
    fs.writeFileSync(file, buf);
    return { bytes: buf.length, over };
  }
}

/* ---------- スコアの検証 ---------- */
function loadScore(file) {
  if (!fs.existsSync(file)) fail(`score not found: ${file}`);
  let s;
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { fail(`score is not JSON: ${e.message}`); }
  if (s.version !== 1) fail("score.version must be 1");
  for (const k of ["id", "title", "artist"]) {
    if (typeof s[k] !== "string" || !s[k].trim()) fail(`score.${k} must be a non-empty string`);
  }
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(s.id)) fail(`score.id must be [a-z0-9-] (≤48): ${s.id}`);
  if (!isNum(s.bpm) || s.bpm < 60 || s.bpm > 260) fail("score.bpm must be 60..260");
  if (s.beatsPerBar !== 4) fail("only 4/4 (beatsPerBar: 4) is supported for now");
  const keyName = parseKey(s.key);
  if (s.leadWave != null && !LEAD_WAVES[s.leadWave]) {
    fail(`leadWave must be one of ${Object.keys(LEAD_WAVES).join("/")} (got ${JSON.stringify(s.leadWave)})`);
  }
  if (s.leadVib != null && (!isNum(s.leadVib.rate) || !isNum(s.leadVib.cents) ||
      s.leadVib.rate < 0 || s.leadVib.rate > 12 || s.leadVib.cents < 0 || s.leadVib.cents > 50)) {
    fail("leadVib must be { rate: 0..12, cents: 0..50 }");
  }
  if (s.bassStyle != null && !BASS_STYLES.includes(s.bassStyle)) fail(`bassStyle must be drive8/soft (got ${JSON.stringify(s.bassStyle)})`);
  if (s.bassWave != null && !BASS_WAVES[s.bassWave]) {
    fail(`bassWave must be one of ${Object.keys(BASS_WAVES).join("/")} (got ${JSON.stringify(s.bassWave)})`);
  }
  if (s.arpRate != null && s.arpRate !== 8 && s.arpRate !== 16) fail("arpRate must be 8 or 16");
  if (s.padWave != null && !PAD_WAVES.includes(s.padWave)) fail(`padWave must be square/tri/sine (got ${JSON.stringify(s.padWave)})`);
  if (!Array.isArray(s.chords) || !s.chords.length) fail("score.chords must be a non-empty array");
  s.chords.forEach((c, i) => { if (!CHORDS[c]) fail(`unknown chord at bar ${i}: ${JSON.stringify(c)}`); });
  const nBars = s.chords.length;
  if (!Array.isArray(s.form) || !s.form.length) fail("score.form must be a non-empty array");
  let expectBar = 0;
  for (const sec of s.form) {
    if (typeof sec.name !== "string" || !sec.name) fail("form section needs a name");
    if (!Array.isArray(sec.bars) || sec.bars[0] !== expectBar || !(sec.bars[1] > sec.bars[0])) {
      fail(`form section ${sec.name}: bars must continue from ${expectBar} without gaps`);
    }
    expectBar = sec.bars[1];
    if (!DRUM_PATTERNS.includes(sec.drums)) fail(`form section ${sec.name}: unknown drums ${JSON.stringify(sec.drums)}`);
    if (!["all", "first2", "none", undefined].includes(sec.arp)) fail(`form section ${sec.name}: bad arp`);
    if (sec.harmony != null && sec.harmony !== "thirdBelow") fail(`form section ${sec.name}: bad harmony`);
  }
  if (expectBar !== nBars) fail(`form covers ${expectBar} bars but chords has ${nBars}`);
  if (!Array.isArray(s.melody)) fail("score.melody must be an array");
  const seen = new Set();
  for (const ev of s.melody) {
    if (!Array.isArray(ev) || ev.length !== 4) fail(`melody event must be [bar, beat, note, len]: ${JSON.stringify(ev)}`);
    const [bar, beat, note, len] = ev;
    if (!Number.isInteger(bar) || bar < 0 || bar >= nBars) fail(`melody bar out of range: ${JSON.stringify(ev)}`);
    if (!isNum(beat) || !isNum(len) || beat < 0 || len <= 0 || beat + len > 4 + 1e-9) {
      fail(`melody event spills out of its bar: ${JSON.stringify(ev)}`);
    }
    const midi = noteToMidi(note);
    ev.push(midi);
    const k = `${bar}:${beat}`;
    if (seen.has(k)) fail(`melody overlap at bar ${bar} beat ${beat}`);
    seen.add(k);
  }
  const ring = s.ending?.ringOutSec ?? 1.2;
  if (!isNum(ring) || ring < 0 || ring > 5) fail("ending.ringOutSec must be 0..5");
  return { s, nBars, ring, keyName };
}

/* 調の下方3度ハーモニー（ダイアトニック限定。外れたら失敗） */
function thirdBelow(midi, keyName) {
  const pcs = KEY_PCS[keyName];
  const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12);
  const idx = pcs.indexOf(pc);
  if (idx < 0) fail(`thirdBelow needs ${keyName}-major diatonic notes (got midi ${midi})`);
  const ni = (((idx - 2) % 7) + 7) % 7, no = oct + (idx - 2 < 0 ? -1 : 0);
  return no * 12 + pcs[ni];
}

/* ---------- 編曲 ---------- */
function sectionOf(form, bar) { return form.find((sec) => bar >= sec.bars[0] && bar < sec.bars[1]); }

function renderDrums(tr, score, bar, sec, spb) {
  const t0 = bar * 4 * spb, e = (i) => t0 + i * spb * 0.5;
  const isFirst = bar === sec.bars[0], isLast = bar === sec.bars[1] - 1;
  const kick4 = () => { for (const i of [0, 2, 4, 6]) tr.kick(e(i)); };
  const hats8 = (g = 0.13) => { for (let i = 0; i < 8; i++) tr.hat(e(i), i % 2 ? g * 0.8 : g); };
  const backbeat = () => { tr.snare(e(2)); tr.snare(e(6)); };
  if (sec.drums === "build") {
    hats8(0.1);
    if (bar >= sec.bars[0] + 2) kick4();
    if (isLast) backbeat();
  } else if (sec.drums === "drive") {
    kick4(); hats8();
    if (isLast) { for (let i = 4; i < 8; i++) tr.snare(e(i), 0.45); tr.snare(e(6), 0.6); }
    else backbeat();
    if (isFirst && sec.crashIn) tr.crash(t0);
  } else if (sec.drums === "outro") {
    const at = bar - sec.bars[0];
    if (at === 0) { tr.kick(e(0)); hats8(0.1); }
    else if (at === 1) { kick4(); for (let i = 0; i < 8; i++) tr.snare(e(i), i % 2 ? 0.3 : 0.42); hats8(0.11); }
    else if (at === 2) { kick4(); for (let i = 0; i < 8; i++) tr.snare(e(i), 0.45); hats8(0.14); }
    else { tr.kick(e(0), 1); tr.crash(e(0), 0.34); }
  } else if (sec.drums === "blaze") {
    kick4(); backbeat();
    for (let i = 0; i < 16; i++) tr.hat(t0 + i * spb * 0.25, i % 2 ? 0.06 : 0.085);
    if (isLast) { for (let i = 4; i < 8; i++) tr.snare(e(i), 0.45); }
    if (isFirst && sec.crashIn) tr.crash(t0);
  } else if (sec.drums === "vocaloid") {
    tr.kick(e(0), 0.95);
    tr.snare(e(4), 0.55);
    for (let i = 0; i < 16; i++) tr.hat(t0 + i * spb * 0.25, i % 4 === 0 ? 0.1 : 0.065);
    if (isLast) { for (let i = 4; i < 8; i++) tr.snare(e(i), 0.5); tr.kick(e(2), 0.8); }
    if (isFirst && sec.crashIn) tr.crash(t0);
  } else if (sec.drums === "soft") {
    tr.kick(e(0), 0.55);
    for (const i of [0, 2, 4, 6]) tr.hat(e(i), 0.055);
    tr.snare(e(4), 0.22);
    if (isLast) tr.snare(e(6), 0.18);
  } else if (sec.drums === "lullaby") {
    const at = bar - sec.bars[0];
    for (const i of [0, 2, 4, 6]) tr.hat(e(i), 0.05);
    tr.kick(e(0), at === 3 ? 0.6 : 0.5);
    if (at === 1 || at === 2) tr.snare(e(4), 0.2);
    /* 最終小節にクラッシュは無し。共有のトニック強打＋リードの保持で静かに閉じる */
  }
}

function renderBar(tr, score, bar, sec, spb, keyName) {
  const t0 = bar * 4 * spb;
  const ch = CHORDS[score.chords[bar]];
  const isFinalBar = bar === score.chords.length - 1;
  renderDrums(tr, score, bar, sec, spb);
  /* ベース：drive8＝8分刻み R R 8va R …／soft＝1・3拍に根音・5度を長く置く（最終小節は全音符で踏む） */
  const bassWave = score.bassWave || "saw";
  const bassGain = BASS_WAVES[bassWave];
  if (isFinalBar && (score.bassStyle || "drive8") === "soft") {
    tr.tone(t0, ch.root, 4 * spb, bassGain * 1.2, bassWave, { a: 0.01, r: 1.2 });
  } else if (isFinalBar) {
    tr.tone(t0, ch.root, 4 * spb, 0.2, "saw", { a: 0.01, r: 1.0 });
    tr.tone(t0, ch.root, 4 * spb, 0.25, "sine", { a: 0.01, r: 1.0 });
  } else if ((score.bassStyle || "drive8") === "soft") {
    tr.tone(t0, ch.root, spb * 1.9, bassGain, bassWave, { a: 0.01, r: 0.15 });
    tr.tone(t0 + 2 * spb, ch.root + 7, spb * 1.9, bassGain * 0.9, bassWave, { a: 0.01, r: 0.15 });
  } else {
    const pat = [0, 0, 12, 0, 0, 0, 12, 7];
    for (let i = 0; i < 8; i++) {
      tr.tone(t0 + i * spb * 0.5, ch.root + pat[i], spb * 0.48, 0.15, "saw", { a: 0.004, r: 0.03 });
    }
    for (const b of [0, 2]) tr.tone(t0 + b * spb, ch.root, spb * 0.9, 0.16, "sine", { a: 0.005, r: 0.05 });
  }
  /* アルペジオ：16分で駆け上がる（outro は前半2小節だけ） */
  const arpOn = sec.arp === "all" || (sec.arp === "first2" && bar - sec.bars[0] < 2);
  if (arpOn && !isFinalBar) {
    const tones = [ch.root + 24, ch.root + 24 + ch.triad[1], ch.root + 24 + 7, ch.root + 36];
    if ((score.arpRate || 16) === 8) {
      const cyc8 = [0, 1, 2, 1];
      for (let i = 0; i < 8; i++) {
        tr.tone(t0 + i * spb * 0.5, tones[cyc8[i % 4]], spb * 0.46, 0.05, "tri", { a: 0.005, r: 0.05 });
      }
    } else {
      const cyc = [0, 1, 2, 3, 2, 1];
      for (let i = 0; i < 16; i++) {
        tr.tone(t0 + i * spb * 0.25, tones[cyc[i % 6]], spb * 0.23, 0.045, "square", { a: 0.003, r: 0.02 });
      }
    }
  }
  /* リード＋（コーラスのみ）下方3度 */
  for (const ev of score.melody) {
    if (ev[0] !== bar) continue;
    const [, beat, , len, midi] = ev;
    const t = t0 + beat * spb, dur = len * spb;
    const leadWave = score.leadWave || "pulse";
    const leadVib = score.leadVib || { rate: 5.5, cents: 14 };
    tr.tone(t, midi, dur * 0.94, LEAD_WAVES[leadWave], leadWave, {
      a: 0.008, r: isFinalBar ? 0.9 : 0.07, vib: leadVib,
    });
    if (sec.harmony === "thirdBelow") {
      tr.tone(t, thirdBelow(midi, keyName), dur * 0.94, 0.07, "square", { a: 0.008, r: 0.07 });
    }
  }
  /* サビ頭のスタブ＋最終小節のトニック強打 */
  if ((sec.stabIn && bar === sec.bars[0]) || isFinalBar) {
    const padWave = score.padWave || "square";
    /* 最終小節の強打はテンポに追従（速い曲で ring をはみ出して尻切れにならないよう） */
    const stabLen = isFinalBar ? Math.min(1.6, spb * 4 * 1.2) : 0.4;
    for (const off of ch.triad) tr.tone(t0, ch.root + 12 + off, stabLen, 0.1, padWave, { a: 0.004, r: 0.3 });
    if (!isFinalBar && sec.drums !== "soft" && sec.drums !== "lullaby") tr.kick(t0, 0.9);
  }
}

/* ---------- ABC ---------- */
function midiToAbc(midi, keyName) {
  const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12) - 1;
  const m = /^([\^_=]*)([A-G])$/.exec(KEY_PITCH[keyName][pc]);
  const abcOct = (b, o) => {
    if (o >= 5) return b.toLowerCase() + "'".repeat(Math.max(0, o - 5));
    return b + ",".repeat(Math.max(0, 4 - o));
  };
  return m[1] + abcOct(m[2], oct);
}
function abcLen(lenBeats) {
  const sixteenths = Math.round(lenBeats * 4);
  if (Math.abs(sixteenths - lenBeats * 4) > 1e-9) fail(`ABC needs 16th-note grid (len ${lenBeats})`);
  if (sixteenths === 2) return "";
  if (sixteenths === 1) return "/";
  if (sixteenths % 2 === 0) return String(sixteenths / 2);
  return `${sixteenths}/2`;
}
function toAbc(score) {
  const nBars = score.chords.length;
  const keyName = parseKey(score.key);
  const lines = [
    "X:1", `T:${score.title}`, `C:${score.artist}`, "M:4/4", "L:1/8",
    `Q:1/4=${score.bpm}`, `K:${keyName}`,
  ];
  const body = [];
  for (let bar = 0; bar < nBars; bar++) {
    const evs = score.melody.filter((ev) => ev[0] === bar).sort((a, b) => a[1] - b[1]);
    let cur = 0, txt = `"${score.chords[bar]}" `;
    for (const [, beat, , len, midi] of evs) {
      if (beat > cur + 1e-9) txt += `z${abcLen(beat - cur)}`;
      txt += `${midiToAbc(midi, keyName)}${abcLen(len)} `;
      cur = beat + len;
    }
    if (cur < 4 - 1e-9) txt += `z${abcLen(4 - cur)}`;
    if (cur > 4 + 1e-9) fail(`bar ${bar}: melody overruns the bar`);
    body.push(`${txt.trim()} |`);
    if (bar % 4 === 3) body.push("\n");
  }
  return lines.join("\n") + "\n" + body.join(" ").replace(/\n /g, "\n").trim() + "\n";
}

/* ---------- 実行 ---------- */
function main(argv) {
  const args = argv.slice(2);
  const scorePath = args.find((a) => !a.startsWith("--"));
  if (!scorePath) fail("usage: node tools/make-trk-song.mjs <score.json> [--out dir] [--no-abc] [--force]");
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : "assets/trk-ost-preview";
  if (outIdx >= 0 && !outDir) fail("--out needs a directory");
  const noAbc = args.includes("--no-abc");
  const force = args.includes("--force");
  const absScore = path.isAbsolute(scorePath) ? scorePath : path.join(root, scorePath);

  const { s, nBars, ring, keyName } = loadScore(absScore);
  const spb = 60 / s.bpm, musicEnd = nBars * 4 * spb;
  const tr = new Track(musicEnd + ring);
  for (let bar = 0; bar < nBars; bar++) renderBar(tr, s, bar, sectionOf(s.form, bar), spb, keyName);
  tr.space(0.16);

  /* 腕試し：セクションごとの無音チェック（作曲ミス・描画ミスを落とす） */
  for (const sec of s.form) {
    const { rms } = tr.level(sec.bars[0] * 4 * spb, (sec.bars[1] - sec.bars[0]) * 4 * spb);
    if (!(rms > 1e-4)) fail(`section ${sec.name} is silent (arrangement bug?)`);
  }
  const fin = tr.finalize(0.88);
  const wavPath = path.resolve(root, outDir, `${s.id}.wav`);
  const wrote = tr.writeWav(wavPath, force);
  let abcPath = null;
  if (!noAbc) {
    abcPath = path.join(path.dirname(absScore), `${s.id}.abc`);
    fs.writeFileSync(abcPath, toAbc(s));
  }
  const total = tr.level(0, musicEnd + ring);
  console.log(JSON.stringify({
    id: s.id, title: s.title, bpm: s.bpm, bars: nBars,
    seconds: Math.round((musicEnd + ring) * 100) / 100,
    peakBeforeNorm: Math.round(fin.peakBefore * 1000) / 1000,
    rms: Math.round(total.rms * 10000) / 10000,
    wav: path.relative(root, wavPath), bytes: wrote.bytes, clippedSamples: wrote.over,
    abc: abcPath ? path.relative(root, abcPath) : null,
  }, null, 2));
}

main(process.argv);

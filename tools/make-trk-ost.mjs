// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! tools/make-trk-ost.mjs — 🎓 trk's OST Vol.1  Procedural composer

   5つの「作曲ルール」×2曲＝10曲を、外部依存なし（Node標準のみ）で合成して
   assets/trk-ost/*.wav に書き出します。出力の .wav は .gitignore でGit外です
   （リポジトリにはこの生成スクリプトだけが入ります）。

   ルール
     1. code-progressions  : コード進行の規則（I–V–vi–IV / 小室・王道進行 等）
     2. stochastic         : 確率・統計モデル（マルコフ連鎖・確率過程）
     3. evolutionary       : 進化的アルゴリズム（遺伝的アルゴリズムで旋律を淘汰）
     4. deep-learning      : 深層学習（小さな多層パーセプトロンを勾配降下で訓練）
     5. free               : 完全自由（手作曲）

   使い方:  node tools/make-trk-ost.mjs
   ========================================================================== */
"use strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 22050;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "trk-ost");
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 小さい乱数（再現性のためシード可） ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 打楽器ノイズ用の決定的な乱数（毎実行で同一のドラム音色にする） */
const _noiseRnd = mulberry32(0x5eed9a17);

/* ---------- 音の高さ ---------- */
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

/* ---------- トラック（イベントを溜めて最後に合成） ---------- */
class Track {
  constructor(sec) { this.len = Math.ceil(SR * sec); this.buf = new Float32Array(this.len); }
  tone(midi, t, d, o = {}) {
    const { type = "sine", g = 0.2, a = 0.008, r = 0.18, det = 0, cut = 0 } = o;
    const f = hz(midi) * Math.pow(2, det / 1200);
    const s0 = Math.max(0, Math.floor(t * SR)), n = Math.floor(d * SR);
    const rel = Math.floor(r * SR), at = Math.max(1, Math.floor(a * SR));
    let ph = 0; const w = 2 * Math.PI * f / SR;
    for (let i = 0; i < n && s0 + i < this.len; i++) {
      let env;
      if (i < at) env = g * (i / at);
      else if (i > n - rel) env = g * Math.max(0, (n - i) / rel);
      else env = g;
      let v = 0;
      const p = ph;
      if (type === "sine") v = Math.sin(p);
      else if (type === "tri") v = 2 / Math.PI * Math.asin(Math.sin(p));
      else if (type === "square") v = Math.sin(p) >= 0 ? 0.6 : -0.6;
      else if (type === "saw") v = 2 * ((p / (2 * Math.PI)) % 1) - 1;
      else if (type === "pulse") v = Math.sin(p) >= 0.3 ? 0.5 : -0.5;
      this.buf[s0 + i] += v * env * (cut ? 0.7 : 1);
      ph += w;
    }
  }
  noise(t, d, g = 0.2, hp = 0) {
    const s0 = Math.floor(t * SR), n = Math.floor(d * SR);
    let prev = 0;
    for (let i = 0; i < n && s0 + i < this.len; i++) {
      const e = g * Math.pow(1 - i / n, 2);
      const w = _noiseRnd() * 2 - 1;
      const v = hp ? (w - prev) : w; prev = w;
      this.buf[s0 + i] += v * e;
    }
  }
  kick(t, g = 0.5) {
    const s0 = Math.floor(t * SR), n = Math.floor(0.16 * SR);
    let ph = 0;
    for (let i = 0; i < n && s0 + i < this.len; i++) {
      const f = 120 * Math.pow(2, -3 * i / n) ;
      ph += 2 * Math.PI * f / SR;
      this.buf[s0 + i] += Math.sin(ph) * g * Math.pow(1 - i / n, 1.5);
    }
  }
  hat(t, g = 0.12) { this.noise(t, 0.05, g, 1); }
  snare(t, g = 0.25) { this.noise(t, 0.12, g, 0); this.tone(64, t, 0.1, { type: "tri", g: g * 0.5 }); }
  /* ゆるいフィードバック遅延で空間を出す */
  space(mix = 0.22, dt = 0.28, fb = 0.3) {
    const dl = Math.floor(dt * SR), d = new Float32Array(this.len);
    for (let i = 0; i < this.len; i++) {
      const e = this.buf[i] + (i >= dl ? d[i - dl] * fb : 0);
      d[i] = e; this.buf[i] = this.buf[i] + e * mix;
    }
  }
  finalize() {
    let peak = 0; for (let i = 0; i < this.len; i++) peak = Math.max(peak, Math.abs(this.buf[i]));
    const g = peak > 0 ? 0.88 / peak : 1;
    const out = Buffer.alloc(44 + this.len * 2);
    out.write("RIFF", 0); out.writeUInt32LE(36 + this.len * 2, 4); out.write("WAVE", 8);
    out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
    out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
    out.write("data", 36); out.writeUInt32LE(this.len * 2, 40);
    for (let i = 0; i < this.len; i++) {
      let v = Math.tanh(this.buf[i] * g * 1.1);
      out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
    }
    return out;
  }
}

/* ---------- 音楽の小道具 ---------- */
const CH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function note(n) { const m = n.match(/^([A-G]#?)(\d)$/); return 12 * (+m[2] + 1) + CH[m[1][0]] + (m[1][1] ? 1 : 0); }
const MAJ = [0, 4, 7], MIN = [0, 3, 7];
function triad(root, q, oct) { return q.map(iv => root + iv + 12 * oct); }

/* ==========================================================================
   1) コード進行の規則
   ========================================================================== */
function trackProgression1() {
  const t = new Track(21); const bpm = 100, spb = 60 / bpm, bar = spb * 4;
  const prog = [0, 7, 9, 5];            /* I V vi IV (C) */
  const scale = [0, 2, 4, 5, 7, 9, 11];
  for (let b = 0; b < 5; b++) for (let c = 0; c < 4; c++) {
    const root = 48 + prog[c];
    const tt = b * bar + c * spb;
    triad(root, MAJ, 1).forEach(m => t.tone(m, tt, spb * 0.95, { type: "tri", g: 0.11 }));   /* パッド */
    t.tone(root - 12, tt, spb * 0.9, { type: "sine", g: 0.3 });                              /* ベース */
    for (let e = 0; e < 4; e++) {                                                            /* アルペジオ */
      const m = triad(root, MAJ, 2)[e % 3];
      t.tone(m, tt + e * spb / 2, spb / 2 * 0.9, { type: "square", g: 0.06 });
    }
    if (c % 2 === 0) t.kick(tt); if (c % 2 === 1) t.snare(tt);
    t.hat(tt + spb / 2, 0.08);
  }
  /* メロディ：コードトーン＋スケール経過音 */
  let m = 72;
  for (let e = 0; e < 40; e++) {
    const c = prog[Math.floor(e / 4) % 4];
    const chord = triad(60 + c, MAJ, 1);
    if (e % 2 === 0) m = chord[e % 3] + 12; else m += scale[(e * 3) % 7] - scale[(e * 3) % 7] + (Math.sin(e) > 0 ? 2 : -2);
    t.tone(Math.max(67, Math.min(84, m)), e * spb / 2, spb / 2 * 0.9, { type: "square", g: 0.14 });
  }
  t.space(); return t;
}
function trackProgression2() {
  const t = new Track(21); const bpm = 84, spb = 60 / bpm, bar = spb * 4;
  const prog = [9, 5, 7, 4];            /* vi IV V iii 風（王道進行 A minor 寄り） */
  for (let b = 0; b < 5; b++) for (let c = 0; c < 4; c++) {
    const root = 45 + prog[c];
    const tt = b * bar + c * spb;
    triad(root, MIN, 1).forEach(m => t.tone(m, tt, spb * 0.95, { type: "sine", g: 0.13, a: 0.05 }));
    t.tone(root - 12, tt, spb, { type: "tri", g: 0.28 });
    for (let e = 0; e < 8; e++) t.tone(triad(root, MIN, 2)[e % 3], tt + e * spb / 2, spb / 2 * 0.8, { type: "tri", g: 0.07 });
    t.kick(tt); t.hat(tt + spb / 2, 0.07);
  }
  const mel = [69, 72, 76, 74, 72, 69, 67, 69, 71, 74, 72, 71, 69, 67, 64, 67];
  mel.forEach((m, i) => t.tone(m, i * spb / 2 + 0.02, spb / 2 * 1.1, { type: "sine", g: 0.2, a: 0.02 }));
  t.space(0.26, 0.33, 0.34); return t;
}

/* ==========================================================================
   2) 確率・統計モデル
   ========================================================================== */
function trackMarkov() {
  const rnd = mulberry32(7); const t = new Track(20);
  const penta = [0, 3, 5, 7, 10];
  const seed = [0, 3, 5, 7, 5, 3, 0, -2, 0, 5, 7, 10, 7, 5, 3, 0];
  const trans = {};
  for (let i = 0; i < seed.length - 1; i++) (trans[seed[i]] = trans[seed[i]] || []).push(seed[i + 1]);
  let cur = 0; const spb = 60 / 96;
  for (let e = 0; e < 64; e++) {
    const opts = trans[cur] || [0];
    cur = opts[Math.floor(rnd() * opts.length)];
    const m = 69 + cur;
    if (rnd() > 0.18) t.tone(m, e * spb / 2, spb / 2 * 0.9, { type: "tri", g: 0.18 });
    if (e % 8 === 0) t.tone(57 + (e % 16 === 0 ? 0 : 3), e * spb / 2, spb * 1.8, { type: "sine", g: 0.25 });
    if (rnd() > 0.6) t.hat(e * spb / 2, 0.06);
  }
  t.space(0.2); return t;
}
function trackRandomWalk() {
  const rnd = mulberry32(21); const t = new Track(20); const spb = 60 / 110;
  let p = 72; const mean = 72;
  for (let e = 0; e < 80; e++) {
    const on = rnd() < 0.62;
    p += (rnd() - 0.5) * 4 + (mean - p) * 0.12;         /* 平均回帰つき乱歩 */
    p = Math.max(64, Math.min(84, p));
    if (on) t.tone(Math.round(p), e * spb / 2, spb / 2 * 0.85, { type: "saw", g: 0.1 });
    if (e % 4 === 0) t.kick(e * spb / 2, 0.4);
    if (e % 8 === 4) t.snare(e * spb / 2, 0.2);
    if (rnd() > 0.5) t.hat(e * spb / 2, 0.05);
  }
  t.space(0.18); return t;
}

/* ==========================================================================
   3) 進化的アルゴリズム（遺伝的アルゴリズム）
   ========================================================================== */
function evolveMelody(rnd, chords, bars) {
  const L = bars * 4;
  const gen = () => Array.from({ length: L }, () => ({ d: rnd() < 0.2 ? 0 : 1, p: 60 + Math.floor(rnd() * 16) }));
  const fit = mel => {
    let s = 0;
    for (let i = 0; i < mel.length; i++) {
      const c = chords[Math.floor(i / 4) % chords.length];
      if (mel[i].d) {
        const iv = (mel[i].p - c) % 12;
        s += [0, 4, 7, 3, 5].includes(iv) ? 2 : -1;              /* 協和 */
        if (i && mel[i - 1].d) s -= Math.min(3, Math.abs(mel[i].p - mel[i - 1].p) > 5 ? 1 : 0);  /* 滑らかさ */
      }
      s += 0.3 * Math.sin(i * 0.7 + mel[i].p * 0.1);
    }
    return s;
  };
  let pop = Array.from({ length: 40 }, gen);
  for (let g = 0; g < 80; g++) {
    pop.sort((a, b) => fit(b) - fit(a));
    const next = pop.slice(0, 8);
    while (next.length < 40) {
      const a = pop[Math.floor(rnd() * 10)], b = pop[Math.floor(rnd() * 10)];
      const ch = a.map((v, i) => rnd() < 0.5 ? v : b[i]).map(v => rnd() < 0.12 ? { d: rnd() < 0.2 ? 0 : 1, p: Math.max(60, Math.min(84, v.p + Math.round((rnd() - 0.5) * 4))) } : v);
      next.push(ch);
    }
    pop = next;
  }
  pop.sort((a, b) => fit(b) - fit(a));
  return pop[0];
}
function trackGA1() {
  const rnd = mulberry32(5); const t = new Track(20); const spb = 60 / 100, bar = spb * 4;
  const chords = [48, 53, 57, 55];
  for (let b = 0; b < 5; b++) for (let c = 0; c < 4; c++) {
    const tt = b * bar + c * spb;
    triad(chords[c], MAJ, 1).forEach(m => t.tone(m, tt, spb * 0.9, { type: "tri", g: 0.1 }));
    t.tone(chords[c] - 12, tt, spb, { type: "sine", g: 0.28 }); t.kick(tt, 0.4);
  }
  const mel = evolveMelody(rnd, chords.map(c => c + 12), 5);
  mel.forEach((n, i) => { if (n.d) t.tone(n.p + 12, i * spb / 2, spb / 2 * 0.9, { type: "square", g: 0.13 }); });
  t.space(0.2); return t;
}
function trackGA2() {
  const rnd = mulberry32(11); const t = new Track(20); const spb = 60 / 120;
  const fit = g => { let s = 0; for (let i = 0; i < 32; i++) { if (g[i] === 1) s += (i % 4 === 2 ? 2 : 0.5); if (g[i] === 2) s += (i % 8 === 4 ? 2 : 0); } return s - Math.abs(g.filter(x => x).length - 14) * 0.4; };
  let pop = Array.from({ length: 30 }, () => Array.from({ length: 32 }, () => [0, 0, 0, 1, 2][Math.floor(rnd() * 5)]));
  for (let g = 0; g < 60; g++) {
    pop.sort((a, b) => fit(b) - fit(a));
    const next = pop.slice(0, 6);
    while (next.length < 30) { const a = pop[Math.floor(rnd() * 6)], b = pop[Math.floor(rnd() * 6)]; next.push(a.map((v, i) => rnd() < 0.5 ? v : b[i]).map(v => rnd() < 0.1 ? [0, 1, 2][Math.floor(rnd() * 3)] : v)); }
    pop = next;
  }
  const pat = pop[0];
  for (let r = 0; r < 3; r++) pat.forEach((v, i) => {
    const tt = (r * 32 + i) * spb / 4;
    if (v === 1) t.kick(tt, 0.45); else if (v === 2) t.snare(tt, 0.22); else if (rnd() > 0.6) t.hat(tt, 0.06);
  });
  for (let i = 0; i < 96; i += 2) t.tone(45 + [0, 0, 3, 5][Math.floor(i / 24) % 4], i * spb / 4, spb / 4, { type: "saw", g: 0.16 });
  t.space(0.15); return t;
}

/* ==========================================================================
   4) 深層学習（小さな多層パーセプトロンを勾配降下で訓練して_next_を生成）
   ========================================================================== */
function tinyMLPTrain(corpus, epochs, rnd) {
  const V = 12, H = 14, IN = V * 2;               /* 直前2音をone-hot */
  const W1 = Array.from({ length: H }, () => Array.from({ length: IN }, () => (rnd() - 0.5) * 0.6));
  const b1 = new Array(H).fill(0);
  const W2 = Array.from({ length: V }, () => Array.from({ length: H }, () => (rnd() - 0.5) * 0.6));
  const b2 = new Array(V).fill(0);
  const pairs = [];
  for (let i = 2; i < corpus.length; i++) pairs.push([corpus[i - 2], corpus[i - 1], corpus[i]]);
  for (let e = 0; e < epochs; e++) for (const [a, b, c] of pairs) {
    const x = new Array(IN).fill(0); x[a] = 1; x[V + b] = 1;
    const h = W1.map((w, j) => Math.tanh(w.reduce((s, wv, i) => s + wv * x[i], 0) + b1[j]));
    const o = W2.map((w, j) => w.reduce((s, wv, i) => s + wv * h[i], 0) + b2[j]);
    const mx = Math.max(...o); const ex = o.map(v => Math.exp(v - mx)); const sx = ex.reduce((s, v) => s + v, 0);
    const dO = ex.map((v, i) => v / sx - (i === c ? 1 : 0));
    const dH = new Array(H).fill(0);
    for (let j = 0; j < H; j++) { let s = 0; for (let k = 0; k < V; k++) s += W2[k][j] * dO[k]; dH[j] = s * (1 - h[j] * h[j]); }
    const lr = 0.08;
    for (let k = 0; k < V; k++) { for (let j = 0; j < H; j++) W2[k][j] -= lr * dO[k] * h[j]; b2[k] -= lr * dO[k]; }
    for (let j = 0; j < H; j++) { for (let i = 0; i < IN; i++) W1[j][i] -= lr * dH[j] * x[i]; b1[j] -= lr * dH[j]; }
  }
  return (a, b, temp) => {
    const x = new Array(IN).fill(0); x[a] = 1; x[V + b] = 1;
    const h = W1.map((w, j) => Math.tanh(w.reduce((s, wv, i) => s + wv * x[i], 0) + b1[j]));
    const o = W2.map((w, j) => w.reduce((s, wv, i) => s + wv * h[i], 0) + b2[j]).map(v => v / temp);
    const mx = Math.max(...o); const ex = o.map(v => Math.exp(v - mx)); const sx = ex.reduce((s, v) => s + v, 0);
    let r = rnd() * sx;
    for (let i = 0; i < V; i++) { r -= ex[i]; if (r <= 0) return i; }
    return V - 1;
  };
}
function trackDL(base, temp, seed, lead) {
  const rnd = mulberry32(seed); const t = new Track(20); const spb = 60 / (base ? 92 : 118);
  const scale = [0, 2, 4, 7, 9];
  const corpus = []; let c = 0;
  for (let i = 0; i < 48; i++) { c = Math.max(0, Math.min(11, c + Math.round((rnd() - 0.5) * 4))); if (rnd() < 0.7) c = scale[c % 5] + (c > 6 ? 7 : 0); corpus.push(c); }
  const next = tinyMLPTrain(corpus, 220, rnd);
  let a = corpus[0], b = corpus[1];
  for (let e = 0; e < 64; e++) {
    const d = next(a, b, temp);
    a = b; b = d;
    const m = 69 + scale[d % 5] + (d > 6 ? 12 : 0);
    if (rnd() > 0.15) t.tone(m, e * spb / 2, spb / 2 * 0.9, { type: lead, g: 0.15 });
    if (e % 8 === 0) t.tone(45 + scale[(e / 8) % 5], e * spb / 2, spb * 1.6, { type: "sine", g: 0.26 });
    if (e % 4 === 0) t.kick(e * spb / 2, 0.35); if (rnd() > 0.5) t.hat(e * spb / 2, 0.05);
  }
  t.space(0.2); return t;
}

/* ==========================================================================
   5) 完全自由（手作曲）
   ========================================================================== */
function trackFreeNocturne() {
  const t = new Track(24); const spb = 60 / 70;
  /* D Dorian のアルペジオ伴奏＋歌う旋律 */
  const arp = [50, 57, 62, 65, 62, 57];
  for (let i = 0; i < 96; i++) t.tone(arp[i % 6] + (i % 48 >= 24 ? 5 : 0), i * spb / 4, spb / 4 * 1.4, { type: "tri", g: 0.08, a: 0.02 });
  const mel = [[74, 3], [72, 1], [69, 2], [70, 2], [72, 4], [67, 2], [69, 6], [65, 2], [67, 2], [69, 4], [64, 6]];
  let tt = 0.2;
  for (const [m, l] of mel) { t.tone(m, tt, l * spb / 2 * 1.05, { type: "sine", g: 0.24, a: 0.04 }); tt += l * spb / 2; }
  t.space(0.3, 0.4, 0.36); return t;
}
function trackFreeChip() {
  const t = new Track(20); const spb = 60 / 150;
  const bass = [33, 33, 36, 33, 31, 31, 38, 38];
  const lead = [69, 72, 76, 79, 76, 72, 74, 77, 81, 77, 74, 72, 69, 72, 74, 76];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 32; i++) {
    const tt = (r * 32 + i) * spb / 4;
    t.tone(bass[(i >> 2) % 8], tt, spb / 4 * 0.9, { type: "saw", g: 0.16 });
    if (i % 2 === 0) t.hat(tt, 0.07);
    if (i % 8 === 4) t.snare(tt, 0.2); if (i % 8 === 0) t.kick(tt, 0.45);
    if (r >= 1) t.tone(lead[i % 16] + (r === 3 ? 3 : 0), tt, spb / 4 * 0.9, { type: "pulse", g: 0.13 });
  }
  t.space(0.14); return t;
}

/* ---------- 書き出し ---------- */
const tracks = [
  ["01-progression-pop", trackProgression1, "コード進行 I–V–vi–IV"],
  ["02-progression-royal", trackProgression2, "コード進行（王道進行）"],
  ["03-markov", trackMarkov, "マルコフ連鎖"],
  ["04-random-walk", trackRandomWalk, "平均回帰ランダムウォーク"],
  ["05-ga-melody", trackGA1, "遺伝的アルゴリズム（旋律）"],
  ["06-ga-groove", trackGA2, "遺伝的アルゴリズム（グルーヴ）"],
  ["07-mlp-ballad", () => trackDL(true, 0.8, 3, "sine"), "tiny MLP（しっとり）"],
  ["08-mlp-dance", () => trackDL(false, 1.4, 9, "square"), "tiny MLP（アップテンポ）"],
  ["09-free-nocturne", trackFreeNocturne, "自由作曲（夜想曲）"],
  ["10-free-chip", trackFreeChip, "自由作曲（チップチューン）"],
];
const meta = [];
for (const [name, fn, rule] of tracks) {
  const t = fn();
  const wav = t.finalize();
  fs.writeFileSync(path.join(OUT, name + ".wav"), wav);
  meta.push({ file: name + ".wav", rule, seconds: +(t.len / SR).toFixed(1) });
  console.log("wrote", name + ".wav", (wav.length / 1024).toFixed(0) + "KB", rule);
}
fs.writeFileSync(path.join(OUT, "tracklist.json"), JSON.stringify({ kind: "trk's OST Vol.1 procedural sketches", tracks: meta }, null, 2));
/* 任意OSTビルドのマニフェスト。アプリは js/library.js の AGENT_OST_MANIFEST_INCLUDED=true の場合だけ読む。 */
const manifest = {
  version: 1, enabled: true, kind: "trk-agent-ost-v1",
  tracks: meta.map((m, i) => ({
    key: String(i + 1).padStart(2, "0"), file: m.file,
    title: `Original ${String(i + 1).padStart(2, "0")} — ${m.rule}`,
  })),
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("done ->", OUT);
console.log("任意の試験／配布ビルドで再生する場合は、音源とmanifestを同梱したうえで js/library.js の AGENT_OST_MANIFEST_INCLUDED を true にしてください。");

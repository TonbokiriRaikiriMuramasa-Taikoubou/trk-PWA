// SPDX-License-Identifier: GPL-3.0-or-later
/* 譜面生成のテスト用：音源を使わず、決まった包絡線から作る「合成の曲」の解析データ。
   本物の analyzeAudio() と同じ形（rms／onset／ratio／frames／frameMs／maxRms／scale）を返す。
   乱数は線形合同法で固定しているので、何度作っても同じ値になる。 */

export const SYNTH_SONGS = {
  /* 静かなイントロ → Aメロ → 大きなサビ（「後半偏り」の再現用） */
  introChorus: { durSec: 180, bpm: 120, ampAt: t => (t < 30 ? 0.08 : t < 90 ? 0.2 : 0.6) },
  /* 音量がほぼ一定（偏りが出ないはずの基準） */
  flat: { durSec: 120, bpm: 140, ampAt: () => 0.3 },
  /* 最初の6秒は無音 → 以後は通常の音量（開始位置の判定の検査） */
  silentLead: { durSec: 90, bpm: 100, ampAt: t => (t < 6 ? 0 : t < 60 ? 0.25 : 0.5) },
  /* 冒頭が最大音量の約6%（旧方式の開始位置の閾値付近）で、そこから盛り上がる */
  quietIntro: { durSec: 150, bpm: 110, ampAt: t => (t < 20 ? 0.04 : t < 75 ? 0.25 : 0.6) },
  /* 90秒の小さな音のあと、30秒だけ大きな音（区間係数の上限・下限に届くほどの差） */
  contrast: { durSec: 120, bpm: 120, ampAt: t => (t < 90 ? 0.05 : 1.0) },
  /* 5分かけて少しずつ盛り上がる */
  longRamp: { durSec: 300, bpm: 174, ampAt: t => 0.05 + 0.5 * Math.min(1, t / 240) }
};

export function makeLcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export function synthAnalysis({ durSec, bpm, ampAt }, seed = 1) {
  const rnd = makeLcg(seed);
  const frameMs = 10, frames = Math.floor(durSec * 1000 / frameMs);
  const rms = new Float32Array(frames), onset = new Float32Array(frames), ratio = new Float32Array(frames);
  const beat = 60 / bpm;
  for (let f = 0; f < frames; f++) {
    const t = f * frameMs / 1000, amp = ampAt(t);
    const ph = (t / beat) % 1;
    rms[f] = amp * (0.75 + 0.25 * Math.cos(2 * Math.PI * ph)) * (0.9 + 0.2 * rnd());
    const nearMs = Math.min(ph, 1 - ph) * beat * 1000;   // 拍の頭からの距離（ms）
    onset[f] = nearMs < 15 ? amp * (0.6 + 0.4 * rnd()) * 0.5 : amp * 0.02 * rnd();
    ratio[f] = 0.2 + 0.6 * rnd();
  }
  let maxRms = 0;
  for (let f = 0; f < frames; f++) if (rms[f] > maxRms) maxRms = rms[f];
  const pos = Array.from(onset).filter(v => v > 0).sort((a, b) => a - b);
  const scale = pos.length ? pos[Math.floor(pos.length * 0.95)] || pos[pos.length - 1] : 1;
  return { rms, onset, ratio, frames, frameMs, maxRms: maxRms || 1, scale: scale || 1 };
}

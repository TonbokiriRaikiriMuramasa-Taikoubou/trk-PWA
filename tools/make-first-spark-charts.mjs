#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * FIRST SPARK（30秒チュートリアルデモ）の手づくり譜面をつくる道具。
 *
 *   node tools/make-first-spark-charts.mjs           … assets/optional-demo-audio/ へ3つ書き出す
 *   node tools/make-first-spark-charts.mjs --check   … 同梱JSONが下のルールと一致するか確かめる（差分なら終了コード1）
 *
 * 依存パッケージ不要。譜面のデータはこの文件的な「小節構成＋密度」から決まるので、音源を再エンコードしても同じ譜面が使えます。
 *
 * ── 根拠（2026-10-07 に同梱MP3をPCMへ展開して測った実測）──────────────────
 *   ・128 BPM ／ 4/4 ／ 16小節（30.04秒）。16分音符＝117.1875 ms、1小節＝1875 ms。1小節目頭＝0 ms。
 *   ・1〜8・11〜16小節：キックが4分音符でずっと鳴る（いわゆる4つ打ち）。裏拍（8分のオフビート）に高音のシンセが乗る。
 *     各拍の立ち上がりはほぼ同じ強さ（ドンだけの4つ打ちで、スネアによる2・4拍目の裏打ちはない）。
 *   ・9〜10小節：ブレイク。キックが抜けて高音だけ（立ち上がりの強さが他の小節の1/5前後）。
 *   ・16小節目の4拍目に一曲で一番大きいアクセント、そのまま 30.04 秒で終わり。
 *   ・拍頭の実測は理論グリッドと ±15 ms 以内（Perfect判定幅 50 ms に入る）なので、譜面は理論グリッドに置いています。
 *
 * ── 配置のきまり ────────────────────────────────────────────────
 *   ・初級 easy   = 1小節に2つ（4分の2拍＝1・3拍目）
 *   ・中級 normal = 1小節に4つ（4分の4拍＝すべての拍）
 *   ・上級 hard   = 1小節に8つ（8分の8拍＝8分音符）
 *   ・1小節目はイントロ（ノーツを置かない＝画面が流れて見える間の余白）
 *   ・ブレイク（9・10小節目）は密度を1段階下げる（easy=休符／normal=1拍目のみ／hard=4分音符）
 *   ・ドン／カッは小節の中で交互。上級の8分では「ドン＝キック」「カッ＝裏拍のシンセ」にちょうど重なります。
 *   ・曲の最後のノーツは必ずドン（決め）。
 *   ・達人 master と RUSH は手づくり譜面を置きません（Seedからの自動生成のまま）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = "assets/optional-demo-audio";

export const BPM = 128;
export const BARS = 16;
export const SONG_TITLE = "FIRST SPARK — Tutorial";
export const CHART_DIFFS = ["easy", "normal", "hard"];
export const chartFileName = diff => `first-spark-tutorial.${diff}.json`;

const STEP = 60000 / BPM / 4;   // 16分音符1つ分の長さ（ms）

/* 小節の役割（1〜16小節目）。intro=前振り／pulse=4つ打ち／break=ブレイク／final=締め */
export const BAR_KINDS = [
  "intro",
  "pulse", "pulse", "pulse", "pulse", "pulse", "pulse", "pulse",
  "break", "break",
  "pulse", "pulse",
  "pulse", "pulse", "pulse",
  "final"
];

/* 小節の役割 × 難易度 → 置く位置（16分音符の番号 0〜15。0＝1拍目、4＝2拍目…） */
const POS = {
  easy:   { intro: [],          pulse: [0, 8],          break: [],       final: [0, 8, 12] },
  normal: { intro: [],          pulse: [0, 4, 8, 12],   break: [0],      final: [0, 4, 8, 12] },
  hard:   { intro: [],          pulse: [0, 2, 4, 6, 8, 10, 12, 14], break: [0, 4, 8, 12], final: [0, 2, 4, 6, 8, 10, 12] }
};

/** 3難易度の譜面データ（shadow-taiko-chart 形式）を作って { easy, normal, hard } で返す */
export function buildCharts() {
  const out = {};
  for (const diff of CHART_DIFFS) {
    const notes = [];
    for (let bar = 0; bar < BARS; bar++) {
      const kind = BAR_KINDS[bar];
      const pos = POS[diff][kind] || [];
      let i = 0;                      // 小節の中の何番目のノーツか（ドン／カッを交互にする）
      for (const p of pos) {
        const time = Math.round((bar * 16 + p) * STEP);
        notes.push([time, i % 2]);     // 偶数=ドン(0)、奇数=カッ(1)
        i++;
      }
    }
    if (notes.length) notes[notes.length - 1][1] = 0;   // 最後は必ずドン（決め）
    out[diff] = {
      format: "shadow-taiko-chart",
      version: 2,
      app: "trk!",
      title: SONG_TITLE,
      charter: "trk!",
      charterNote: "Four-on-the-floor chart hand-placed on the 128 BPM grid (see tools/make-first-spark-charts.mjs).",
      media: { name: "FIRST_SPARK_Tutorial_30s.mp3", duration: +(BARS * 4 * 60 / BPM).toFixed(3) },
      bpm: BPM,
      offset: 0,
      difficulty: diff,
      level: estimateLevel(notes),
      notes
    };
  }
  return out;
}

/* js/media.js の estimateLevel と同じ式（Lv.表示の初期値だけを作る。実際の表示はアプリ側で計算し直される） */
function estimateLevel(notes) {
  if (!notes.length) return 1;
  const last = notes[notes.length - 1][0], first = notes[0][0];
  const span = Math.max(10, (last - first) / 1000);
  const nps = notes.length / span;
  let peak = 0, j = 0;
  for (let i = 0; i < notes.length; i++) {
    while (notes[i][0] - notes[j][0] > 2500) j++;
    peak = Math.max(peak, (i - j + 1) / 2.5);
  }
  let fast = 0, trill = 0, ultra = 0;
  for (let i = 1; i < notes.length; i++) {
    const gap = notes[i][0] - notes[i - 1][0];
    if (gap <= 220) {
      fast++;
      if (gap <= 100) ultra++;
      if (notes[i][1] !== notes[i - 1][1] && i >= 2 &&
          notes[i - 1][1] !== notes[i - 2][1] && notes[i - 1][0] - notes[i - 2][0] <= 220) trill++;
    }
  }
  const denom = notes.length - 1 || 1;
  const base = nps * 0.88 + peak * 0.38 + 0.5;
  const tech = (fast / denom) * 1.8 + (trill / denom) * 1.5 + (ultra / denom) * 2.2;
  return Math.max(1, Math.min(20, Math.round(base + tech)));
}

/** 書き出し用の文字列（ノーツは1行に1つ＝差分が見やすい） */
export function chartText(data) {
  const { notes, ...rest } = data;
  const head = Object.entries(rest).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
  const body = notes.map(([t, lane]) => `    [${t}, ${lane}]`).join(",\n");
  return `{\n${head},\n  "notes": [\n${body}\n  ]\n}\n`;
}

/* このファイルを実行したときだけ書き出し・照合をする（tools/check-repo.mjs からは import して使う） */
function main() {
  const charts = buildCharts();
  if (process.argv.includes("--check")) {
    let bad = 0;
    for (const diff of CHART_DIFFS) {
      const file = path.join(root, OUT_DIR, chartFileName(diff));
      let stored = null;
      try { stored = JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) {}
      if (!stored || JSON.stringify(stored) !== JSON.stringify(charts[diff])) {
        bad++;
        console.error(`FAIL  ${OUT_DIR}/${chartFileName(diff)} は tools/make-first-spark-charts.mjs の結果と違います（node tools/make-first-spark-charts.mjs で再生成してください）`);
      }
    }
    if (bad) process.exit(1);
    console.log(`OK    First Spark hand-made charts match the generator (${CHART_DIFFS.map(d => `${d}:${charts[d].notes.length}`).join(" / ")})`);
    return;
  }
  for (const diff of CHART_DIFFS) {
    const file = path.join(root, OUT_DIR, chartFileName(diff));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, chartText(charts[diff]));
    console.log(`write ${OUT_DIR}/${chartFileName(diff)}  (${charts[diff].notes.length} notes · Lv.${charts[diff].level})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

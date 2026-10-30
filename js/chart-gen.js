(() => {
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 自動譜面の生成（純関数）============
   js/media.js の generateNotes から「音声解析の値とSeedの乱数を受け取って譜面を作る」部分だけを切り出した。
   ブラウザのグローバル（video／analysis／settings）には触らないので、node --test から同じ関数を検査できる。

   譜面の作り方（chartGen）。アプリ設定の既定は "4"（Bタイプ。core.js）。純関数として未指定なら旧方式1（"1"）:
     "1" … 旧方式1。ca84a19 までと同じ出力を保つ（曲全体の最大音量で正規化し、曲全体で上位を選ぶ）。
           譜面の指紋（chartKeyOf＝ノーツ列のハッシュ）で記録が結び付く。旧方式1で作った譜面を再生成するときに使う。
           tests/fixtures/chart-legacy-golden.json で旧譜面の再現を検査する。
     "2" … 旧方式2。前後4秒の局所正規化、8小節ごとの区間配分（長さ×密度を先に決め、盛り上がりは 0.7〜1.3 倍で残す。最大音量の6%未満の静かな区間は、難易度順の上限表まで候補数を絞る）。
     "3" … Aタイプ（従来の新方式）。音の立ち上がりと拍のアクセントを評価し、4小節ごとに密度を配分。各区間では強い候補を優先しつつ近接ノーツを抑え、目標密度へ近づける。
     "4" … 方式4（試験中）。遊びの文法：同じフレーズは同じ配置、休み、サビの山場、聞こえる音だけの裏拍、難易度ごとの連続の上限と色の語彙
           （cgBuildFun。調査は research/chart-fun-ja.md）。楽しさの代理指標 cgChartMetrics で方式3と比べられる（tools/chart-compare.mjs）。
   ⚠ 旧方式1（cgBuildLegacy）と旧方式2（cgBuildSectioned）の出力を変えない。方式3（cgBuildPhraseAware）の出力も tests の固定値で守る。
     新しい調整は方式4（cgBuildFun）に加える。
   ⚠ 関数名・定数名は classic script の共有スコープに載るので、他ファイルと重ならないよう cg 接頭辞を付ける。 */

const CG_SECTION_BARS = 8;          // 旧方式2の区間の長さ（小節）
const CG_PHRASE_BARS = 4;           // 新方式のフレーズ長（小節）
const CG_QUIET_REL = 0.06;          // 区間の平均音量÷曲の最大音量。これ未満を「静かな区間」とみなす（絶対音量ゲート）
/* 静かな区間の候補上限。難易度順に単調な表にした（trk91。それまでは上級25%を基準に density に比例させ、
   初級22.9% > 中級20% と逆転していた）。DIFFS の density とは切り離したので、両者を揃える必要はない */
const CG_QUIET_CAPS = { easy: .15, normal: .20, hard: .25, master: .34, rush: .40 };
const CG_SILENCE_REL = 0.01;        // 曲の最大音量に対してこれ未満は「無音」（旧方式2・新方式の開始／終了判定）
const CG_LOCAL_HALF_S = 4;          // 局所正規化の窓（前後の秒数）

/* 旧方式1・2と新方式の入口。p = { analysis, durationMs, diff, spec(DIFFS[diff]), bpm, offset, rand, chartGen } */
function buildChartNotes(p) {
  const method = String(p.chartGen == null ? "1" : p.chartGen);
  if (method === "4") return cgBuildFun(p);
  if (method === "3") return cgBuildPhraseAware(p);
  return method === "2" ? cgBuildSectioned(p) : cgBuildLegacy(p);
}

/* ---------- 解析データの読み取り（media.js の rmsAt／onsetAt／ratioAt と同じ式。analysis を引数で受ける） ---------- */
function cgFrameOf(a, t) { return Math.round(t / a.frameMs); }
function cgRmsAt(a, t) { return a.rms[Math.min(a.frames - 1, Math.max(0, cgFrameOf(a, t)))]; }
function cgOnsetAt(a, t) {
  const f = cgFrameOf(a, t); let m = 0;
  for (let i = Math.max(0, f - 3); i <= Math.min(a.frames - 1, f + 3); i++) if (a.onset[i] > m) m = a.onset[i];
  return m;
}
function cgRatioAt(a, t) {
  const f = cgFrameOf(a, t); let s = 0, c = 0;
  for (let i = Math.max(0, f); i <= Math.min(a.frames - 1, f + 4); i++) { s += a.ratio[i]; c++; }
  return c ? s / c : 0;
}

/* ---------- 旧方式（ca84a19 の generateNotes をそのまま移したもの。出力を変えないこと） ---------- */
function cgBuildLegacy(p) {
  const { analysis, bpm, offset, rand, spec: d } = p;
  const step = 60000 / bpm / d.div;
  let startMs = 600, endMs = p.durationMs - 400;
  if (analysis) {
    const thr = analysis.maxRms * .06; let f0 = 0, f1 = analysis.frames - 1;
    while (f0 < f1 && analysis.rms[f0] < thr) f0++;
    while (f1 > f0 && analysis.rms[f1] < thr) f1--;
    startMs = Math.max(300, f0 * analysis.frameMs - 30); endMs = Math.min(endMs, f1 * analysis.frameMs + 30);
  }
  const cands = [];
  for (let k = Math.ceil((startMs - offset) / step); ; k++) {
    const t = offset + k * step; if (t > endMs) break; if (t < startMs) continue;
    const sub = ((k % d.div) + d.div) % d.div, beatIdx = Math.floor(k / d.div);
    const onBeat = sub === 0, onBar = onBeat && ((beatIdx % 4) + 4) % 4 === 0;
    let s, loud = 0.5;
    if (analysis) {
      loud = cgRmsAt(analysis, t) / (analysis.maxRms || 1);
      if (loud < .05) continue;
      s = Math.min(1.6, cgOnsetAt(analysis, t) / (analysis.scale || 1)) + loud * .35;
    } else s = rand() * .6;
    s *= onBar ? 1.6 : onBeat ? 1.3 : (sub % 2 === 0 ? 1.1 : 0.95);
    s += rand() * .1;
    cands.push({ t, s, onBar, onBeat, sub, k, loud });
  }

  let sel;
  if (p.diff === "easy" || p.diff === "normal") {
    const count = Math.round(cands.length * d.density);
    sel = cands.slice().sort((a, b) => b.s - a.s).slice(0, count).sort((a, b) => a.t - b.t);
  } else {
    // 上級・達人・RUSH：音楽的フレーズ構造（8分音符骨格＋16分連打・トリル）
    const targetCount = d.target ? Math.min(cands.length, d.target) : Math.round(cands.length * d.density);
    const chosen = new Set();
    for (const c of cands) {
      if ((c.onBeat || c.sub % 2 === 0) && (c.loud > 0.22 || c.s > 0.75)) {
        chosen.add(c);
      }
    }
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const loudThreshold = (p.diff === "master" || p.diff === "rush") ? 0.30 : 0.50;
      if (c.loud > loudThreshold && c.s > 0.8) {
        const isDense = (p.diff === "master" || p.diff === "rush");
        const burstLen = isDense ? (rand() < 0.45 ? 7 : (rand() < 0.5 ? 5 : 3)) : (rand() < 0.35 ? 5 : 3);
        for (let b = 0; b < burstLen && i + b < cands.length; b++) {
          chosen.add(cands[i + b]);
        }
      }
    }
    let list = Array.from(chosen);
    if (list.length < targetCount) {
      const remaining = cands.filter(c => !chosen.has(c)).sort((a, b) => b.s - a.s);
      list = list.concat(remaining.slice(0, targetCount - list.length));
    } else if (list.length > targetCount && p.diff !== "rush") {
      list.sort((a, b) => b.s - a.s);
      list = list.slice(0, targetCount);
    }
    sel = list.sort((a, b) => a.t - b.t);
  }
  return cgPlace(sel, p);
}

/* ---------- 旧方式2（chartGen 2。ロジックは互換性のため変更しない） ---------- */
/* 曲を先頭から読み、各時刻の「前後 CG_LOCAL_HALF_S 秒」の代表値を秒ごとに1つ作る。
   rms は90パーセンタイル（ふだんの音量）、onset は正の値の95パーセンタイル（立ち上がりの強さ）。 */
function cgLocalNorm(a) {
  const N = Math.max(1, Math.ceil(a.frames * a.frameMs / 1000));
  const ref = new Float32Array(N), scl = new Float32Array(N);
  for (let s = 0; s < N; s++) {
    const f0 = Math.max(0, Math.floor((s - CG_LOCAL_HALF_S) * 1000 / a.frameMs));
    const f1 = Math.min(a.frames, Math.ceil((s + CG_LOCAL_HALF_S + 1) * 1000 / a.frameMs));
    const r = new Float32Array(Math.max(0, f1 - f0));
    for (let j = 0; j < r.length; j++) r[j] = a.rms[f0 + j];
    r.sort();
    ref[s] = r.length ? r[Math.floor((r.length - 1) * .9)] : 0;
    const o = [];
    for (let f = f0; f < f1; f++) if (a.onset[f] > 0) o.push(a.onset[f]);
    const oa = Float32Array.from(o).sort();
    scl[s] = oa.length ? oa[Math.min(oa.length - 1, Math.floor(oa.length * .95))] : 0;
  }
  return { ref, scl, N };
}
function cgSecOf(norm, t) { return Math.min(norm.N - 1, Math.max(0, Math.floor(t / 1000))); }
/* 局所の大きさ（その区間のふだんの音量に対する比）。無音に近いところは 0 に近づく */
function cgLocalLoud(a, norm, t) {
  const floor = (a.maxRms || 1) * CG_SILENCE_REL;
  return cgRmsAt(a, t) / Math.max(norm.ref[cgSecOf(norm, t)], floor);
}
function cgLocalScale(a, norm, t) {
  return norm.scl[cgSecOf(norm, t)] || a.scale || 1;
}

/* 配分：total 個を weights の比で caps 以下に割る（最大剰余法。上限に届いた区間は固定して残りを配り直す） */
function cgAllocate(total, weights, caps) {
  const out = new Array(weights.length).fill(0);
  let remaining = Math.min(total, caps.reduce((x, y) => x + y, 0));
  const active = new Set();
  for (let i = 0; i < weights.length; i++) if (caps[i] > 0 && weights[i] > 0) active.add(i);
  while (remaining > 0 && active.size) {
    let wsum = 0;
    for (const i of active) wsum += weights[i];
    const capped = [];
    for (const i of active) if (remaining * weights[i] / wsum >= caps[i] - out[i]) capped.push(i);
    if (capped.length) {
      for (const i of capped) { remaining -= caps[i] - out[i]; out[i] = caps[i]; active.delete(i); }
      continue;
    }
    let assigned = 0; const rem = [];
    for (const i of active) {
      const share = remaining * weights[i] / wsum, f = Math.floor(share);
      out[i] += f; assigned += f; rem.push([share - f, i]);
    }
    let left = remaining - assigned;
    rem.sort((x, y) => (y[0] - x[0]) || (x[1] - y[1]));
    for (const [, i] of rem) { if (left <= 0) break; if (out[i] < caps[i]) { out[i]++; left--; } }
    break;
  }
  return out;
}

/* 1区間の中から quota 個を選ぶ（旧方式の選び方を区間の中で行う） */
function cgPickSection(list, quota, diff, d, rand) {
  if (diff === "easy" || diff === "normal") {
    return list.slice().sort((a, b) => b.s - a.s).slice(0, quota);
  }
  const set = new Set();
  for (const c of list) {
    if ((c.onBeat || c.sub % 2 === 0) && (c.loud > 0.22 || c.s > 0.75)) set.add(c);
  }
  const loudThreshold = (diff === "master" || diff === "rush") ? 0.30 : 0.50;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.loud > loudThreshold && c.s > 0.8) {
      const isDense = (diff === "master" || diff === "rush");
      const burstLen = isDense ? (rand() < 0.45 ? 7 : (rand() < 0.5 ? 5 : 3)) : (rand() < 0.35 ? 5 : 3);
      for (let b = 0; b < burstLen && i + b < list.length; b++) set.add(list[i + b]);
    }
  }
  let out = Array.from(set);
  if (out.length < quota) {
    const rest = list.filter(c => !set.has(c)).sort((a, b) => b.s - a.s);
    out = out.concat(rest.slice(0, quota - out.length));
  } else if (out.length > quota && diff !== "rush") {
    out.sort((a, b) => b.s - a.s);
    out = out.slice(0, quota);
  }
  return out;
}

function cgBuildSectioned(p) {
  const { analysis, diff, bpm, offset, rand, spec: d } = p;
  const step = 60000 / bpm / d.div;
  let startMs = 600, endMs = p.durationMs - 400;
  let norm = null;
  if (analysis) {
    norm = cgLocalNorm(analysis);
    const thr = analysis.maxRms * CG_SILENCE_REL; let f0 = 0, f1 = analysis.frames - 1;
    while (f0 < f1 && analysis.rms[f0] < thr) f0++;
    while (f1 > f0 && analysis.rms[f1] < thr) f1--;
    startMs = Math.max(300, f0 * analysis.frameMs - 30); endMs = Math.min(endMs, f1 * analysis.frameMs + 30);
  }
  const secTicks = CG_SECTION_BARS * 4 * d.div;     // 8小節ぶんの分割数（k の単位）
  const cands = [];
  for (let k = Math.ceil((startMs - offset) / step); ; k++) {
    const t = offset + k * step; if (t > endMs) break; if (t < startMs) continue;
    const sub = ((k % d.div) + d.div) % d.div, beatIdx = Math.floor(k / d.div);
    const onBeat = sub === 0, onBar = onBeat && ((beatIdx % 4) + 4) % 4 === 0;
    let s, loud = 0.5, rmsAbs = 0;
    if (analysis) {
      loud = cgLocalLoud(analysis, norm, t);
      if (loud < .05) continue;                       // 局所正規化の後で、本当に無音のところだけ落とす
      rmsAbs = cgRmsAt(analysis, t);
      s = Math.min(1.6, cgOnsetAt(analysis, t) / cgLocalScale(analysis, norm, t)) + loud * .35;
    } else s = rand() * .6;
    s *= onBar ? 1.6 : onBeat ? 1.3 : (sub % 2 === 0 ? 1.1 : 0.95);
    s += rand() * .1;
    cands.push({ t, s, onBar, onBeat, sub, k, loud, rmsAbs, sec: Math.floor(k / secTicks) });
  }

  /* 区間ごとに候補を分ける。ノーツ数は「候補数（長さ×密度）× 盛り上がりの係数」で先に決める */
  const bySec = new Map();
  let allRms = 0;
  for (const c of cands) {
    let list = bySec.get(c.sec); if (!list) bySec.set(c.sec, list = []);
    list.push(c); allRms += c.rmsAbs;
  }
  const secKeys = Array.from(bySec.keys()).sort((x, y) => x - y);
  const meanAll = cands.length ? allRms / cands.length : 0;
  const energyFactor = list => {
    if (!analysis || !(meanAll > 0)) return 1;
    let m = 0; for (const c of list) m += c.rmsAbs; m /= list.length;
    if (!(m > 0)) return 0.7;
    return Math.min(1.3, Math.max(0.7, 1 + 0.3 * Math.log2(m / meanAll)));
  };
  const total = d.target ? Math.min(cands.length, d.target) : Math.round(cands.length * d.density);
  const lists = secKeys.map(k => bySec.get(k));
  /* 絶対音量ゲート：区間の平均音量が曲の最大音量の CG_QUIET_REL 未満なら「静かな区間」。
     局所正規化では静かな区間もその区間の普通の音量になるため、候補数の上限を難易度順の表
     （CG_QUIET_CAPS。初級15%・中級20%・上級25%・達人34%・RUSH40%）まで絞る。削った分は他の区間へ回る
     （合計は変えない。全区間の上限に届けば合計は減る）。 */
  const quietCap = list => {
    if (!analysis || !(analysis.maxRms > 0)) return list.length;
    let m = 0; for (const c of list) m += c.rmsAbs; m /= list.length;
    if (m / analysis.maxRms >= CG_QUIET_REL) return list.length;
    const capRate = CG_QUIET_CAPS[diff] != null ? CG_QUIET_CAPS[diff] : CG_QUIET_CAPS.hard;
    return Math.min(list.length, Math.floor(list.length * capRate));
  };
  const quotas = cgAllocate(total, lists.map(l => l.length * energyFactor(l)), lists.map(quietCap));

  const sel = [];
  lists.forEach((list, i) => {
    for (const c of cgPickSection(list, quotas[i], diff, d, rand)) sel.push(c);
  });
  sel.sort((a, b) => a.t - b.t);
  return cgPlace(sel, p);
}

/* ---------- 新方式（chartGen 3）：立ち上がり重視＋4小節フレーズ配分 ---------- */
/*
 * 調査・設計方針：旧方式1は曲全体の音量に、旧方式2は8小節区間の平均エネルギーに主に依存する。
 * 新方式は拍グリッドを維持しつつ、局所 onset（音の立ち上がり）と拍位置を候補ごとに採点する。
 * 4小節ごとに局所活動量で目標数を配り、区間内はピークを優先して隣接ノーツを控えめにする。
 * 最後に余った枠を高スコア候補で埋めるため、難易度の目標数と上限を守りながらストリームも残せる。
 * 旧方式1・2と共通の lane 配置（cgPlace）はそのまま使う。
 */
function cgPickPhrase(list, quota, step, diff) {
  if (quota <= 0 || !list.length) return [];
  const ranked = list.slice().sort((a, b) => (b.s - a.s) || (a.t - b.t));
  const peaks = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i], left = i ? list[i - 1].s : -Infinity, right = i + 1 < list.length ? list[i + 1].s : -Infinity;
    if (c.s >= left && c.s > right) peaks.push(c);
  }
  peaks.sort((a, b) => (b.s - a.s) || (a.t - b.t));
  const gapFactor = { easy:1.75, normal:1.25, hard:.85, master:.55, rush:.25 }[diff] ?? 1;
  const minGap = step * gapFactor;
  const selected = [], chosen = new Set();
  const take = (candidates, enforceGap) => {
    for (const c of candidates) {
      if (selected.length >= quota) break;
      if (chosen.has(c)) continue;
      if (enforceGap && selected.some(x => Math.abs(x.t - c.t) < minGap)) continue;
      selected.push(c); chosen.add(c);
    }
  };
  take(peaks, true);
  take(ranked, true);
  take(ranked, false);     // 難易度の密度目標を優先し、必要なら spacing 制約を緩める
  return selected;
}
function cgBuildPhraseAware(p) {
  const { analysis, diff, bpm, offset, rand, spec:d } = p;
  const step = 60000 / bpm / d.div;
  let startMs = 600, endMs = p.durationMs - 400, norm = null;
  if (analysis) {
    norm = cgLocalNorm(analysis);
    const thr = analysis.maxRms * CG_SILENCE_REL; let f0 = 0, f1 = analysis.frames - 1;
    while (f0 < f1 && analysis.rms[f0] < thr) f0++;
    while (f1 > f0 && analysis.rms[f1] < thr) f1--;
    startMs = Math.max(300, f0 * analysis.frameMs - 30);
    endMs = Math.min(endMs, f1 * analysis.frameMs + 30);
  }
  const phraseTicks = CG_PHRASE_BARS * 4 * d.div;
  const cands = [];
  for (let k = Math.ceil((startMs - offset) / step); ; k++) {
    const t = offset + k * step; if (t > endMs) break; if (t < startMs) continue;
    const sub = ((k % d.div) + d.div) % d.div, beatIdx = Math.floor(k / d.div);
    const onBeat = sub === 0, onBar = onBeat && ((beatIdx % 4) + 4) % 4 === 0;
    let loud = 0.5, rmsAbs = 0, attack = 0, energy = 0.5, s;
    if (analysis) {
      loud = cgLocalLoud(analysis, norm, t);
      if (loud < .05) continue;
      rmsAbs = cgRmsAt(analysis, t);
      attack = Math.min(1.5, cgOnsetAt(analysis, t) / cgLocalScale(analysis, norm, t));
      energy = Math.min(1.5, loud);
      const accent = onBar ? 1 : onBeat ? .72 : sub % 2 === 0 ? .46 : .20;
      s = (attack / 1.5) * .55 + Math.sqrt(energy / 1.5) * .20 + accent * .25 + rand() * .04;
    } else {
      const accent = onBar ? 1 : onBeat ? .72 : sub % 2 === 0 ? .46 : .20;
      s = accent * .8 + rand() * .2;
    }
    cands.push({ t, s, onBar, onBeat, sub, k, loud, rmsAbs, attack, energy, phrase:Math.floor(k / phraseTicks) });
  }

  const byPhrase = new Map();
  for (const c of cands) {
    let list = byPhrase.get(c.phrase); if (!list) byPhrase.set(c.phrase, list = []);
    list.push(c);
  }
  const phraseKeys = Array.from(byPhrase.keys()).sort((a, b) => a - b);
  const lists = phraseKeys.map(k => byPhrase.get(k));
  const phraseWeight = list => {
    if (!analysis || !list.length) return list.length;
    let attack = 0, rms = 0;
    for (const c of list) { attack += c.attack; rms += c.rmsAbs; }
    const a = attack / list.length / 1.5;
    const e = rms / list.length / (analysis.maxRms || 1);
    return list.length * (.55 + .70 * a + .30 * Math.sqrt(Math.max(0, Math.min(1, e))));
  };
  const quietCap = list => {
    if (!analysis || !(analysis.maxRms > 0) || !list.length) return list.length;
    let mean = 0; for (const c of list) mean += c.rmsAbs; mean /= list.length;
    if (mean / analysis.maxRms >= CG_QUIET_REL) return list.length;
    const rate = CG_QUIET_CAPS[diff] != null ? CG_QUIET_CAPS[diff] : CG_QUIET_CAPS.hard;
    return Math.min(list.length, Math.floor(list.length * rate));
  };
  const targetDensity = Math.round(cands.length * d.density);
  const total = diff === "rush"
    ? Math.min(cands.length, Math.max(d.target || 0, targetDensity))
    : d.target ? Math.min(cands.length, d.target) : targetDensity;
  const quotas = cgAllocate(total, lists.map(phraseWeight), lists.map(quietCap));
  const sel = [];
  lists.forEach((list, i) => sel.push(...cgPickPhrase(list, quotas[i], step, diff)));
  sel.sort((a, b) => a.t - b.t);
  return cgPlace(sel, p);
}

/* ---------- 方式4（chartGen 4）：遊びの文法（反復・休み・山場・読みやすさ） ---------- */
/*
 * 調査（research/chart-fun-ja.md）を2レーン太鼓風譜面へ翻訳した規則。方式1〜3の出力は変えない。
 *  1. 拍グリッドは16分（1拍=4目）。難易度ごとに「最短間隔」を目の倍数で決め、BPMが速い曲ではミリ秒の下限で粗くする
 *     （osu!taiko の基準は約180BPM想定で、速い曲・遅い曲は換算する、という考え方を借りた）。
 *  2. 聞こえる音に置く：裏拍（8分裏・16分裏）は音の立ち上がりがある目にだけ置く。表拍は拍の流れとして置ける。
 *  3. 曲の展開：4小節フレーズごとの音量から「静・平・盛・山」の4段階を決め、密度に強めの差をつける。
 *     段階が上がるフレーズの頭（サビの入り）には必ずドンを置き、上級以上はその直前の拍にフィルを許す。
 *  4. 同じフレーズは同じ配置：音の立ち上がりの並び（4小節＝64目）が前のフレーズと似ていれば、配置と色をそのまま再利用する。
 *     密度の段階が違うときだけ、元の配置を土台に足す（上位集合）／削る（下位集合）。
 *     ループ崩れの防止：フレーズの4小節目が直前と同じ小節の4連目になるときは、最後の拍にフィルを足して変化をつける（全経路）。
 *  5. 休み：難易度ごとに「何拍ごとに、何拍の休み」を保証する（フレーズの終わりを優先して空ける）。
 *  6. 読みやすさと公平性：最短間隔の連続（連打・複合）の長さに上限。上級の長い16分は色替え1回まで（頭か終わり）。
 *     孤立した16分裏は置かない（達人以上で強い音だけ例外）。
 *  7. ドン／カッ：高域の割合（ratio）が曲とフレーズの中央値より高い音をカッ、低い音をドン。小節頭はドン寄り、2・4拍目はカッ寄り。
 *     連続部分は難易度ごとの「色の語彙」（単色・交互・2-2・3-1・頭/終わりだけ替える）のうち、音に一番近いものへ寄せる。
 * Seed は同点の候補の順番と、色の語彙の同点だけに使う（反復の一致は Seed を変えても崩れない）。
 */
const CG4_TPB = 4;                  // 1拍あたりの目（16分）
const CG4_BAR = 16;                 // 1小節あたりの目（4/4 前提）
const CG4_PHRASE_BARS = 4;
const CG4_DIFF = {
  /* minT：最短間隔（目）。minMs：最短間隔のミリ秒下限（速い曲ではここで粗くなる）。
     run：最短間隔の連続の上限（ノーツ数）。runLow：静・平フレーズでの上限。
     restBeats／restEvery：restEvery 拍ごとに restBeats 拍以上の休みを1回は入れる。
     mul：静・平・盛・山の密度係数。cap：1小節で使ってよい目の割合の上限（段階別）。 */
  easy:   { minT: 4, minMs: 230, run: 7,  runLow: 4, restBeats: 3,   restEvery: 32, mul: [.40, .75, 1, 1.25], cap: [.30, .55, .75, .90] },
  normal: { minT: 2, minMs: 150, run: 7,  runLow: 3, restBeats: 2,   restEvery: 32, mul: [.40, .75, 1, 1.25], cap: [.30, .50, .70, .85] },
  hard:   { minT: 1, minMs: 85,  run: 5,  runLow: 3, restBeats: 1.5, restEvery: 32, mul: [.40, .75, 1, 1.25], cap: [.30, .50, .70, .80] },
  master: { minT: 1, minMs: 60,  run: 9,  runLow: 5, restBeats: 1,   restEvery: 16, mul: [.45, .78, 1, 1.20], cap: [.35, .55, .75, .85] },
  rush:   { minT: 1, minMs: 45,  run: 24, runLow: 9, restBeats: .5,  restEvery: 16, mul: [.55, .82, 1, 1.12], cap: [.45, .70, .90, .97] }
};
const CG4_SIM = 0.78;
/* 刻み（音の弱い8分裏を拍の流れとして置くもの）の1小節あたりの上限。段階（静・平・盛・山）ごと。
   全部を埋めると「ドカカカ」の一本調子になるので、上級は半分まで */
const CG4_PULSE = { hard: [0, 1, 3, 4], master: [0, 1, 4, 4], rush: [2, 3, 4, 4] };               // フレーズの似ている度合い（音の立ち上がりの並びの相関）。これ以上で「同じフレーズ」

/* 1目ごとの解析値（音の立ち上がり 0〜1、高域の割合、局所音量、無音か） */
function cg4OnsetAt(a, t, w) {
  const f = cgFrameOf(a, t); let m = 0;
  for (let i = Math.max(0, f - w); i <= Math.min(a.frames - 1, f + w); i++) if (a.onset[i] > m) m = a.onset[i];
  return m;
}
function cg4Ticks(p, norm, k0, k1, tickMs) {
  const { analysis: a, offset } = p, n = k1 - k0 + 1;
  /* 立ち上がりを探す幅：±50ms まで（ただし16分の半分を超えない）。offset が数十ms ずれた曲でも「候補を落とさない」ための幅で、
     ノーツの時刻は入力の BPM／offset のグリッドのまま（時間合わせの補正ではない） */
  const w = Math.max(3, Math.min(5, Math.floor(tickMs / 2 / a.frameMs)));
  const att = new Float32Array(n), rat = new Float32Array(n), eng = new Float32Array(n), live = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = offset + (k0 + i) * tickMs;
    /* 無音の判定も±w フレームで見る（歯切れのよい曲で、拍の直前の1フレームだけ静かでも候補を落とさない。
       方式1〜3は1フレームだけで判定するので、offset が10〜20ms早いとノーツが大きく減ることがある） */
    let loud = 0;
    for (let j = -w; j <= w; j++) { const v = cgLocalLoud(a, norm, t + j * a.frameMs); if (v > loud) loud = v; }
    if (loud < .05) continue;
    live[i] = 1;
    att[i] = Math.min(1.5, cg4OnsetAt(a, t, w) / cgLocalScale(a, norm, t)) / 1.5;
    rat[i] = cgRatioAt(a, t);
    eng[i] = cgRmsAt(a, t) / (a.maxRms || 1);
  }
  return { att, rat, eng, live };
}
/* 小節内の位置ごとの拍の強さ（小節頭・3拍目・2/4拍目・8分裏・16分裏） */
function cg4Accent(pos) { return pos === 0 ? 1 : pos === 8 ? .8 : pos % 4 === 0 ? .7 : pos % 2 === 0 ? .42 : .2; }
/* 平均を引いた相関（-1〜1）。全部同じ値なら 0 */
function cg4Corr(x, y) {
  const n = Math.min(x.length, y.length); if (!n) return 0;
  let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; } mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 1e-12 && syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : 0;
}
/* 大津の方法：値の集まりを2群に分ける閾値（群間分散が最大）。値が少ないときは中央値 */
function cg4Otsu(arr) {
  if (arr.length < 8) return cg4Median(arr);
  const s = Float64Array.from(arr).sort(), n = s.length;
  let total = 0; for (const v of s) total += v;
  let left = 0, best = -1, thr = s[Math.floor(n / 2)];
  for (let i = 0; i < n - 1; i++) {
    left += s[i];
    if (s[i + 1] - s[i] < 1e-12) continue;
    const w0 = (i + 1) / n, w1 = 1 - w0, m0 = left / (i + 1), m1 = (total - left) / (n - i - 1);
    const v = w0 * w1 * (m0 - m1) * (m0 - m1);
    if (v > best) { best = v; thr = (s[i] + s[i + 1]) / 2; }
  }
  return thr;
}
function cg4Median(arr) {
  if (!arr.length) return 0;
  const s = Float64Array.from(arr).sort(); return s[Math.floor((s.length - 1) / 2)];
}
/* 連続部分の色の語彙。len 個の 0/1 列を返す。kind で難易度ごとの許可範囲を分ける */
function cg4Vocab(len, kind) {
  const out = [], seen = new Set();
  const add = a => { const k = a.join(""); if (!seen.has(k)) { seen.add(k); out.push(a); } };
  for (const c of [0, 1]) {
    add(Array.from({ length: len }, () => c));                                  // 単色
    if (kind === "hard") {                                                       // 色替えは頭か終わりの1回だけ
      add(Array.from({ length: len }, (_, i) => i === 0 ? 1 - c : c));
      add(Array.from({ length: len }, (_, i) => i === len - 1 ? 1 - c : c));
      continue;
    }
    add(Array.from({ length: len }, (_, i) => (c + i) % 2));                     // 交互（ドカドカ）
    add(Array.from({ length: len }, (_, i) => (c + (i >> 1)) % 2));              // 2-2
    add(Array.from({ length: len }, (_, i) => i % 4 === 3 ? 1 - c : c));         // 3-1
    add(Array.from({ length: len }, (_, i) => i === 0 ? 1 - c : c));
    add(Array.from({ length: len }, (_, i) => i === len - 1 ? 1 - c : c));
    for (let cut = 1; cut < len; cut++) add(Array.from({ length: len }, (_, i) => i < cut ? c : 1 - c));   // 前半・後半で1回替える
    if (kind === "free" && len <= 5) {                                           // 短い連続は自由（2回替えまで）
      for (let m = 0; m < (1 << len); m++) {
        const a = Array.from({ length: len }, (_, i) => (m >> i) & 1);
        let ch = 0; for (let i = 1; i < len; i++) if (a[i] !== a[i - 1]) ch++;
        if (ch <= 2) add(a);
      }
    }
  }
  return out;
}

function cgBuildFun(p) {
  if (!p.analysis) return cgBuildPhraseAware(p);              // 解析が無いときは方式3と同じ（拍の強さだけでは文法を作れない）
  const { analysis: a, diff, bpm, offset, rand, spec: d } = p;
  const cfg = CG4_DIFF[diff] || CG4_DIFF.hard;
  const beatMs = 60000 / bpm, tickMs = beatMs / CG4_TPB;
  /* 最短間隔：難易度の分割（DIFFS.div）より細かくせず、ミリ秒の下限も守る（1・2・4・8目のどれか） */
  let stepT = Math.max(cfg.minT, CG4_TPB / (d.div || 4));
  while (stepT < 8 && stepT * tickMs < cfg.minMs) stepT *= 2;

  const norm = cgLocalNorm(a);
  let startMs = 600, endMs = p.durationMs - 400;
  { const thr = a.maxRms * CG_SILENCE_REL; let f0 = 0, f1 = a.frames - 1;
    while (f0 < f1 && a.rms[f0] < thr) f0++;
    while (f1 > f0 && a.rms[f1] < thr) f1--;
    startMs = Math.max(300, f0 * a.frameMs - 30); endMs = Math.min(endMs, f1 * a.frameMs + 30); }
  const k0 = Math.ceil((startMs - offset) / tickMs), k1 = Math.floor((endMs - offset) / tickMs);
  if (!(k1 >= k0)) return [];
  const T = cg4Ticks(p, norm, k0, k1, tickMs);
  const idx = k => k - k0;                                   // 目 k の配列位置
  const inRange = k => k >= k0 && k <= k1;
  const onStep = k => ((k % stepT) + stepT) % stepT === 0;
  const posOf = k => ((k % CG4_BAR) + CG4_BAR) % CG4_BAR;
  const barOf = k => Math.floor(k / CG4_BAR);

  /* ---- 小節とフレーズ ---- */
  const b0 = barOf(k0), b1 = barOf(k1), nBars = b1 - b0 + 1;
  const barE = new Float64Array(nBars), barA = new Float64Array(nBars), barLive = new Int32Array(nBars);
  for (let k = k0; k <= k1; k++) {
    const i = idx(k), b = barOf(k) - b0; if (!T.live[i]) continue;
    barE[b] += T.eng[i]; barA[b] += T.att[i]; barLive[b]++;
  }
  for (let b = 0; b < nBars; b++) if (barLive[b]) { barE[b] /= barLive[b]; barA[b] /= barLive[b]; }
  const phOf = b => Math.floor((b + b0) / CG4_PHRASE_BARS) - Math.floor(b0 / CG4_PHRASE_BARS);   // 拍頭（offset）基準の4小節
  const nPh = phOf(nBars - 1) + 1;
  const phE = new Float64Array(nPh), phN = new Int32Array(nPh);
  for (let b = 0; b < nBars; b++) if (barLive[b]) { phE[phOf(b)] += barE[b]; phN[phOf(b)]++; }
  let maxPhE = 0;
  for (let q = 0; q < nPh; q++) { if (phN[q]) phE[q] /= phN[q]; if (phE[q] > maxPhE) maxPhE = phE[q]; }
  /* 段階（0静・1平・2盛・3山）：曲で一番大きいフレーズに対する音量比の平方根で分ける（音量一定の曲は全部同じ段階になる） */
  const level = new Int8Array(nPh);
  for (let q = 0; q < nPh; q++) {
    const r = maxPhE > 0 ? Math.sqrt(phE[q] / maxPhE) : 1;
    level[q] = r < .45 ? 0 : r < .65 ? 1 : r < .85 ? 2 : 3;
  }
  for (let q = 1; q + 1 < nPh; q++) {                        // 1フレーズだけの凹み・出っ張りはならす（チラつき防止）
    if (level[q - 1] === level[q + 1] && Math.abs(level[q] - level[q - 1]) === 1) level[q] = level[q - 1];
  }
  let finale = -1;                                           // 最後の「山」フレーズ（見せ場）
  for (let q = nPh - 1; q >= 0; q--) if (phN[q] && level[q] === 3) { finale = q; break; }
  const rise = q => q > 0 && level[q] > level[q - 1];        // 段階が上がるフレーズ＝サビの入りなど

  /* ---- 目標ノーツ数（方式3と同じ数え方。Lv が方式3と大きくずれないようにする） ---- */
  const divT = CG4_TPB / (d.div || 4);
  let candCount = 0;
  for (let k = k0; k <= k1; k++) if (((k % divT) + divT) % divT === 0 && T.live[idx(k)]) candCount++;
  const targetDensity = Math.round(candCount * d.density);
  const total = diff === "rush" ? Math.min(candCount, Math.max(d.target || 0, targetDensity))
    : d.target ? Math.min(candCount, d.target) : targetDensity;

  /* ---- 小節ごとの枠（段階×音の活動量で配る。段階ごとの上限つき） ---- */
  let maxA = 0, maxE = 0; for (let b = 0; b < nBars; b++) { if (barA[b] > maxA) maxA = barA[b]; if (barE[b] > maxE) maxE = barE[b]; }
  const slots = new Int32Array(nBars);
  for (let k = k0; k <= k1; k++) if (onStep(k) && T.live[idx(k)]) slots[barOf(k) - b0]++;
  const weights = [], caps = [];
  for (let b = 0; b < nBars; b++) {
    const q = phOf(b), lv = level[q];
    const fin = q === finale ? 1.12 : 1;
    /* 段階に加え、小節そのものの立ち上がりと音量も少し効かせる（同じ段階の中でも大きい小節ほど多く） */
    weights.push(slots[b] ? slots[b] * cfg.mul[lv] * fin * (.6 + .4 * (maxA > 0 ? barA[b] / maxA : 1)) * (.55 + .45 * (maxE > 0 ? barE[b] / maxE : 1)) : 0);
    caps.push(Math.floor(slots[b] * Math.min(1, cfg.cap[lv] * fin)));
  }
  const quota = cgAllocate(total, weights, caps);

  /* ---- 1小節の配置を作る ---- */
  const chosen = new Map();                                  // 目 k → { lane, s }
  const has = k => chosen.has(k);
  const runAround = k => {                                   // k を置いたときの最短間隔の連続の長さ
    let n = 1;
    for (let j = k - stepT; has(j); j -= stepT) n++;
    for (let j = k + stepT; has(j); j += stepT) n++;
    return n;
  };
  const scoreOf = (k, bonus) => {
    const i = idx(k);
    return T.att[i] * .62 + cg4Accent(posOf(k)) * .28 + Math.min(1, T.eng[i] * 2) * .10 + (bonus || 0) + rand() * .03;
  };
  /* 「音がある」とみなす立ち上がりの下限。音声解析の立ち上がりはキック・スネアの拍に強く出て、
     ハイハット・アルペジオなど裏の音は小さく出る。そこで曲ごとに「8分裏の目の中央値」を基準にし、0.025〜0.14 に収める
     （初級は少し厳しめ）。16分裏は多くの曲でこの基準より小さいので、強い音のときだけ通る */
  const attFloor = (() => {
    const v = []; for (let k = k0; k <= k1; k++) { const i = idx(k); if (T.live[i] && posOf(k) % 4 === 2) v.push(T.att[i]); }
    const base = Math.min(.14, Math.max(.025, cg4Median(v)));
    return diff === "easy" ? Math.min(.18, base * 1.5) : base;
  })();
  /* 置いてよい目か：表拍はいつでも、裏拍は音の立ち上がりがあるときだけ（聞こえない音に置かない）。
     ただし上級以上の「盛・山」フレーズでは、8分裏も拍の流れ（刻み）として置ける（RUSH は常に）。16分裏は音があるときだけ */
  const audible = k => {
    const i = idx(k); if (!inRange(k) || !T.live[i]) return false;
    const pos = posOf(k);
    if (pos % CG4_TPB === 0 || T.att[i] >= attFloor) return true;
    const lv = level[phOf(barOf(k) - b0)];
    if (pos % 2 === 0 && (diff === "rush" || ((diff === "hard" || diff === "master") && lv >= 2))) return true;
    /* 16分裏：達人は盛・山で少し弱い音まで、RUSH（体力勝負のモード）は盛・山なら刻みとして置ける */
    if (diff === "master" && lv >= 2 && T.att[i] >= attFloor * .35) return true;
    /* 上級の山：かすかでも音のある16分裏は、隣の8分と組にして「ドドン」「ドコ」の形で置ける（1小節2つまで） */
    if (diff === "hard" && lv >= 3 && T.att[i] >= attFloor * .35) return true;
    if (diff === "rush" && (lv >= 2 || T.att[i] >= attFloor * .5)) return true;
    return false;
  };
  /* 写すときは少し甘く：元のフレーズで置いた位置なら、立ち上がりが下限の半分あれば同じ音型とみなす
     （サビ直後の小節は前後4秒の正規化でハイハットが小さく見えるため、写し損ねて配置が崩れるのを防ぐ） */
  const audibleCopy = k => audible(k) || (inRange(k) && T.live[idx(k)] && T.att[idx(k)] >= attFloor * .5);
  const runLimit = q => (level[q] >= 2 || q === finale) ? cfg.run : cfg.runLow;
  /* 16分裏の孤立：前後1目に相方がいない16分裏は読みにくい（達人以上で強い音だけ許す） */
  const lonely16 = k => stepT === 1 && posOf(k) % 2 === 1 && !has(k - 1) && !has(k + 1) &&
    !((diff === "master" || diff === "rush") && T.att[idx(k)] >= .6);
  const isPulseTick = k => posOf(k) % CG4_TPB !== 0 && T.att[idx(k)] < attFloor;
  /* 16分裏（奇数位置）の1小節あたりの上限。上級は「8分が主、16分はときどき」（osu!taiko の Muzukashii の考え方） */
  /* 達人・RUSH も段階で差をつける（静・平では少なく、山で多く）。全部の小節が上限まで埋まると密度の山が消えるため */
  const odd16Cap = q => stepT !== 1 ? 0 : diff === "hard" ? (q === finale ? 3 : 2)
    : diff === "master" ? [1, 2, 4, 6][level[q]] : [3, 6, 12, 16][level[q]];
  function fillBar(b, want, opts = {}) {
    const q = phOf(b), lim = runLimit(q), kb = (b + b0) * CG4_BAR;
    let placed = 0; for (let k = kb; k < kb + CG4_BAR; k++) if (has(k)) placed++;   // すでに置いた音（サビ入りのドン・写した音）も枠に数える
    /* 小節頭を最優先：前の小節の終わりからの連続が長すぎるなら、前の小節の最後の1つを抜いて頭を残す */
    if (!has(kb) && audible(kb) && T.att[idx(kb)] >= attFloor && placed < want) {
      chosen.set(kb, { lane: -1, s: scoreOf(kb, .3) });
      while (runAround(kb) > lim && has(kb - stepT) && !(chosen.get(kb - stepT).copy)) chosen.delete(kb - stepT);
      if (runAround(kb) > lim) chosen.delete(kb); else placed++;
    }
    const ks = [];
    for (let k = kb; k < kb + CG4_BAR; k++) if (onStep(k) && audible(k) && !has(k)) ks.push(k);
    const sc = new Map(ks.map(k => {
      let bonus = 0;
      if (opts.fill && posOf(k) >= 12) bonus += .22;          // サビ前のフィル（小節の最後の拍）
      return [k, scoreOf(k, bonus)];
    }));
    ks.sort((x, y) => (sc.get(y) - sc.get(x)) || (x - y));
    let odd = 0, pulse = 0;
    for (let k = kb; k < kb + CG4_BAR; k++) if (has(k)) { if (posOf(k) % 2) odd++; else if (isPulseTick(k)) pulse++; }
    const oddCap = odd16Cap(q) + (opts.fill ? 2 : 0);
    const pCap = (CG4_PULSE[diff] || [0, 0, 0, 0])[level[q]] + (q === finale ? 1 : 0);
    const tryPut = (k, enforce) => {
      if (has(k)) return false;
      const isOdd = posOf(k) % 2 === 1, isP = !isOdd && isPulseTick(k);
      if (isOdd && odd >= oddCap) return false;
      if (isP && pulse >= pCap) return false;
      chosen.set(k, { lane: -1, s: sc.get(k) });
      if (runAround(k) > (opts.fill && posOf(k) >= 12 ? Math.max(lim, Math.min(cfg.run, 4)) : lim)) { chosen.delete(k); return false; }
      if (enforce && lonely16(k)) { chosen.delete(k); return false; }
      if (isOdd) odd++; if (isP) pulse++;
      return true;
    };
    for (const k of ks) { if (placed >= want) break; if (tryPut(k, true)) placed++; }
    /* 16分裏を相方つきで置けるように2周目（相方の表側を先に置けたぶん、裏が孤立しなくなる） */
    for (const k of ks) { if (placed >= want) break; if (tryPut(k, true)) placed++; }
    return placed;
  }
  /* 小節の指紋（16目の立ち上がり）。同じ音の小節は同じ配置にする（フレーズの中の反復） */
  const barPrint = b => { const v = new Float32Array(CG4_BAR), kb = (b + b0) * CG4_BAR; for (let x = 0; x < CG4_BAR; x++) if (inRange(kb + x)) v[x] = T.att[idx(kb + x)]; return v; };
  const barPrints = Array.from({ length: nBars }, (_, b) => barPrint(b));
  const built = [];                                           // 作り終えた小節（再利用元の候補）
  function copyBar(b, from) {
    const delta = (b - from) * CG4_BAR, kb = (b + b0) * CG4_BAR; let n = 0;
    for (let k = kb; k < kb + CG4_BAR; k++) {
      const src = chosen.get(k - delta);
      if (src && audibleCopy(k)) { chosen.set(k, { lane: src.lane, s: src.s, copy: true }); n++; }
    }
    return n;
  }
  function similarBar(b) {
    let best = -1, bestS = .9;
    for (const r of built) {
      if (level[phOf(r)] !== level[phOf(b)]) continue;
      const er = barE[r] > 0 ? barE[b] / barE[r] : 0;
      if (er < .75 || er > 1.33) continue;
      if (quota[r] && Math.abs(quota[b] - quota[r]) > Math.max(1, quota[r] * .25)) continue;
      const s = cg4Corr(barPrints[b], barPrints[r]);
      if (s > bestS + 1e-9 || (Math.abs(s - bestS) < 1e-9 && best >= 0 && r > best)) { bestS = s; best = r; }
    }
    return best;
  }

  /* ---- 色（ドン0／カッ1） ---- */
  const allRat = [];
  for (let k = k0; k <= k1; k++) { const i = idx(k); if (T.live[i] && T.att[i] >= attFloor) allRat.push(T.rat[i]); }
  /* 境目は「大津の方法」（2つの山に分ける閾値）。低い山＝キック・ベース系（ドン）、高い山＝スネア・ハイハット系（カッ） */
  const gMed = cg4Otsu(allRat);
  const phMed = new Float64Array(nPh).fill(gMed);
  for (let q = 0; q < nPh; q++) {
    const r = [];
    const kq0 = (q * CG4_PHRASE_BARS + Math.floor(b0 / CG4_PHRASE_BARS) * CG4_PHRASE_BARS) * CG4_BAR;
    for (let k = Math.max(k0, kq0); k < Math.min(k1 + 1, kq0 + CG4_PHRASE_BARS * CG4_BAR); k++) { const i = idx(k); if (T.live[i] && T.att[i] >= attFloor) r.push(T.rat[i]); }
    if (r.length >= 8) phMed[q] = cg4Otsu(r);
  }
  const spread = (() => { const s = allRat.slice().sort((x, y) => x - y); return s.length > 3 ? Math.max(1e-6, s[Math.floor(s.length * .75)] - s[Math.floor(s.length * .25)]) : 1; })();
  const kindOf = () => diff === "hard" ? "hard" : diff === "easy" || diff === "normal" ? "free" : (diff === "master" ? "free" : "long");
  /* 刻み：音の立ち上がりが弱いのに、盛・山フレーズの流れとして置いた8分裏 */
  const isPulse = k => posOf(k) % CG4_TPB !== 0 && T.att[idx(k)] < attFloor;
  const motifs = new Map();
  const leans = new Map();
  const leanOf = q => { if (!leans.has(q)) leans.set(q, rand() < .5 ? 0 : 1); return leans.get(q); };
  const motifOf = q => { if (!motifs.has(q)) motifs.set(q, Math.floor(rand() * 4)); return motifs.get(q); };   // 0同色・1反対色・2カッ・3ドン
  /* 1小節ぶんの色を決める（すでに色がある目は触らない） */
  function colorBar(b) {
    const q = phOf(b), kb = (b + b0) * CG4_BAR, thr = .7 * gMed + .3 * phMed[q];
    const ks = []; for (let k = kb; k < kb + CG4_BAR; k++) if (has(k) && chosen.get(k).lane < 0) ks.push(k);
    if (!ks.length) return;
    const raw = new Map();
    for (const k of ks) {
      const i = idx(k), pos = posOf(k);
      let z = (T.rat[i] - thr) / spread;
      if (pos === 0) z -= .55; else if (pos === 4 || pos === 12) z += .25;   // 小節頭はドン寄り、2・4拍目（スネア）はカッ寄り
      /* 音色がどちらとも言えない音（境目の近く）は、フレーズごとの Seed の向きに寄せる（同じフレーズの中ではそろう） */
      raw.set(k, Math.abs(z - .12) < .25 && pos !== 0 ? leanOf(q) : z > .12 ? 1 : 0);
    }
    /* 刻み（音の弱い8分裏）の色は、フレーズごとの型で決める（同じ型＝同じ手順で叩ける。フレーズが変わると型も変わる） */
    for (const k of ks) {
      if (!isPulse(k)) continue;
      const prev = has(k - 2) ? (chosen.get(k - 2).lane >= 0 ? chosen.get(k - 2).lane : raw.get(k - 2)) : 0;
      const m = motifOf(q);
      raw.set(k, m === 0 ? prev : m === 1 ? 1 - prev : m === 2 ? 1 : 0);
    }
    /* 連続（最短間隔で続く部分）は語彙に寄せる */
    let i = 0;
    while (i < ks.length) {
      let j = i;
      while (j + 1 < ks.length && ks[j + 1] - ks[j] === stepT) j++;
      const len = j - i + 1;
      if (len >= 3 && stepT <= 2) {
        const want = ks.slice(i, j + 1).map(k => raw.get(k));
        const kind = stepT === 2 && diff !== "hard" ? "free" : kindOf();
        let best = null, bestD = Infinity, bestCh = Infinity, bestR = 0;
        for (const cand of cg4Vocab(len, len > 5 && kind === "free" ? "long" : kind)) {
          let dist = 0, ch = 0;
          for (let x = 0; x < len; x++) { if (cand[x] !== want[x]) dist++; if (x && cand[x] !== cand[x - 1]) ch++; }
          const r = rand();
          if (dist < bestD || (dist === bestD && (ch < bestCh || (ch === bestCh && r > bestR)))) { best = cand; bestD = dist; bestCh = ch; bestR = r; }
        }
        for (let x = 0; x < len; x++) chosen.get(ks[i + x]).lane = best[x];
      } else {
        for (let x = i; x <= j; x++) chosen.get(ks[x]).lane = raw.get(ks[x]);
      }
      i = j + 1;
    }
  }

  /* ---- フレーズの「指紋」（4小節＝64目の音の立ち上がり）と反復の検出 ---- */
  const phK0 = q => (q * CG4_PHRASE_BARS + Math.floor(b0 / CG4_PHRASE_BARS) * CG4_PHRASE_BARS) * CG4_BAR;
  const print = q => {
    const v = new Float32Array(CG4_PHRASE_BARS * CG4_BAR), kq = phK0(q);
    for (let x = 0; x < v.length; x++) { const k = kq + x; if (inRange(k)) v[x] = T.att[idx(k)]; }
    return v;
  };
  const prints = Array.from({ length: nPh }, (_, q) => print(q));
  const fullPhrase = q => { const kq = phK0(q); return kq >= k0 && kq + CG4_PHRASE_BARS * CG4_BAR - 1 <= k1; };
  const source = new Int32Array(nPh).fill(-1);               // 再利用元のフレーズ（-1＝新しく作る）
  for (let q = 1; q < nPh; q++) {
    if (!fullPhrase(q) || !phN[q]) continue;
    let best = -1, bestS = CG4_SIM;
    for (let r = q - 1; r >= 0; r--) {
      if (!fullPhrase(r) || !phN[r]) continue;
      const er = phE[r] > 0 ? phE[q] / phE[r] : 0;
      if (er < .6 || er > 1.67) continue;                    // 音量が大きく違えば別物
      const s = cg4Corr(prints[q], prints[r]);
      if (s > bestS + 1e-9) { bestS = s; best = r; }
    }
    if (best >= 0) source[q] = source[best] >= 0 ? source[best] : best;   // 元の元へたどる（全部同じ型に揃う）
  }

  /* ---- 同じ小節の連続を抑える（ループ崩れの防止） ---- */
  const barSig = b => { const kb = (b + b0) * CG4_BAR; let s = ""; for (let k = kb; k < kb + CG4_BAR; k++) if (has(k)) s += posOf(k).toString(16) + Math.max(0, chosen.get(k).lane); return s; };
  const identicalRun = b => { const s = barSig(b); if (!s) return 0; let n = 1; for (let x = b - 1; x >= 0 && barSig(x) === s; x--) n++; return n; };
  /* フレーズの4小節目を少し変える：最後の拍に聞こえる音のフィルを1つ足す。足せなければ後半の弱い音を1つ抜く */
  function varyBar(b) {
    const kb = (b + b0) * CG4_BAR, lim = runLimit(phOf(b));
    const add = [];
    for (let k = kb + 8; k < kb + CG4_BAR; k++) if (onStep(k) && audible(k) && !has(k) && !(posOf(k) % 2 && stepT === 1 && !has(k - 1) && !has(k + 1))) add.push(k);
    add.sort((x, y) => (scoreOf(y, posOf(y) >= 12 ? .2 : 0) - scoreOf(x, posOf(x) >= 12 ? .2 : 0)) || (y - x));
    for (const k of add) {
      chosen.set(k, { lane: -1, s: .5 });
      if (runAround(k) <= lim && !lonely16(k)) { colorBar(b); return true; }
      chosen.delete(k);
    }
    let weak = -1, ws = Infinity;
    for (let k = kb + 8; k < kb + CG4_BAR; k++) if (has(k) && posOf(k) !== 8) { const s = chosen.get(k).s; if (s < ws) { ws = s; weak = k; } }
    if (weak >= 0) { chosen.delete(weak); return true; }
    return false;
  }
  const guardRepeat = (b, lastBar) => { if (lastBar && identicalRun(b) >= 4) varyBar(b); };

  /* ---- フレーズごとに配置を作る ---- */
  const barsOfPh = q => { const out = []; for (let b = 0; b < nBars; b++) if (phOf(b) === q) out.push(b); return out; };
  let sameRun = 0, lastSrc = -2;
  for (let q = 0; q < nPh; q++) {
    const bars = barsOfPh(q), src = source[q];
    const nextRise = q + 1 < nPh && rise(q + 1) && (diff === "hard" || diff === "master" || diff === "rush");
    sameRun = src >= 0 && src === lastSrc ? sameRun + 1 : 0;
    lastSrc = src >= 0 ? src : q;
    /* サビの入り：段階が上がるフレーズの頭にはドンを置く（先に置くので、この小節を写す後の小節もドンになる） */
    if (rise(q) && bars.length) {
      const k = (bars[0] + b0) * CG4_BAR;
      if (inRange(k) && T.live[idx(k)]) chosen.set(k, { lane: 0, s: 1, copy: true });
    }
    if (src >= 0) {
      const delta = (phK0(q) - phK0(src));
      const refreshOf = bi => bi === bars.length - 1 && (nextRise || sameRun >= 3);   // 4小節目：次がサビ入り、または同じ型が16小節以上続くときは作り直す
      let nTot = 0, wantTot = 0;
      bars.forEach((b, bi) => {
        if (refreshOf(bi)) return;
        const kb = (b + b0) * CG4_BAR;
        for (let k = kb; k < kb + CG4_BAR; k++) {
          const from = chosen.get(k - delta);
          if (from && audibleCopy(k) && !has(k)) { chosen.set(k, { lane: from.lane, s: from.s, copy: true }); nTot++; }
        }
        wantTot += quota[b];
      });
      /* 段階が違って数が大きく外れたときだけ、フレーズ全体で足す／削る（多少の過不足は同じ配置を保つほうを優先）。
         削るときは「小節の中の同じ位置」をまとめて抜くので、残った小節どうしは同じ配置のまま */
      const sameLevel = level[q] === level[src];               // 同じ段階なら枠の端数に関係なくそのまま写す（配分の端数は前の小節に寄るため）
      if (!sameLevel && nTot > Math.max(wantTot * 1.3, wantTot + 2)) {
        const byPos = new Map();
        bars.forEach((b, bi) => { if (refreshOf(bi)) return; const kb = (b + b0) * CG4_BAR; for (let k = kb; k < kb + CG4_BAR; k++) if (has(k) && posOf(k) !== 0) { const ps = posOf(k), e = byPos.get(ps) || { s: 0, ks: [] }; e.s += chosen.get(k).s; e.ks.push(k); byPos.set(ps, e); } });
        const order = Array.from(byPos.entries()).sort((x, y) => (x[1].s / x[1].ks.length - y[1].s / y[1].ks.length) || (y[0] - x[0]));
        for (const [, e] of order) { if (nTot <= wantTot) break; for (const k of e.ks) chosen.delete(k); nTot -= e.ks.length; }
      }
      const grow = !sameLevel && nTot < Math.min(wantTot * .75, wantTot - 2);
      bars.forEach((b, bi) => {
        const refresh = refreshOf(bi);
        if (refresh) fillBar(b, quota[b], { fill: nextRise });
        else if (grow) { let n = 0; const kb = (b + b0) * CG4_BAR; for (let k = kb; k < kb + CG4_BAR; k++) if (has(k)) n++; fillBar(b, quota[b], { base: n }); }
        colorBar(b); guardRepeat(b, bi === bars.length - 1); built.push(b);
      });
    } else {
      bars.forEach((b, bi) => {
        const lastBar = bi === bars.length - 1;
        const fill = lastBar && nextRise;
        const from = fill ? -1 : similarBar(b);
        if (from >= 0) copyBar(b, from);
        else fillBar(b, quota[b], { fill });
        colorBar(b); guardRepeat(b, lastBar); built.push(b);
      });
    }
  }

  /* ---- 休み：restEvery 拍ごとに restBeats 拍以上の間をあける（フレーズの終わりを優先） ---- */
  const restT = Math.round(cfg.restBeats * CG4_TPB), groupT = cfg.restEvery * CG4_TPB;
  const sortedKeys = () => Array.from(chosen.keys()).sort((x, y) => x - y);
  {
    const gStart = Math.floor(k0 / groupT) * groupT;
    for (let g = gStart; g <= k1; g += groupT) {
      const keys = sortedKeys();
      const inG = keys.filter(k => k >= g && k < g + groupT);
      if (inG.length < 2) continue;
      /* すでに休みがあるか（グループ内の隣り合うノーツの間、または直後のノーツまで） */
      const after = keys.find(k => k >= g + groupT);
      const seq = after != null ? inG.concat([after]) : inG;
      let ok = false;
      for (let x = 1; x < seq.length; x++) if (seq[x] - seq[x - 1] > restT) { ok = true; break; }
      if (ok) continue;
      /* 候補：各小節の終わり restT 目を空ける。消す音の強さが小さい所。最後の小節（フレーズの終わり）を優先 */
      let bestEnd = -1, bestCost = Infinity;
      /* フレーズ（4小節）の終わりだけを候補にする：同じフレーズの1〜3小節目は崩さず、休みは4小節目に集める */
      for (let e = g + CG4_BAR * CG4_PHRASE_BARS; e <= g + groupT; e += CG4_BAR * CG4_PHRASE_BARS) {
        let cost = 0;
        for (let k = e - restT; k < e; k++) if (has(k)) cost += .2 + chosen.get(k).s;
        if (e !== g + groupT) cost *= 1.4;
        if (cost < bestCost) { bestCost = cost; bestEnd = e; }
      }
      for (let k = bestEnd - restT; k < bestEnd; k++) chosen.delete(k);
    }
  }

  /* ---- 仕上げの検査：連続の上限、孤立した16分裏 ---- */
  {
    let keys = sortedKeys();
    for (let x = 0; x < keys.length;) {
      let y = x; while (y + 1 < keys.length && keys[y + 1] - keys[y] === stepT) y++;
      const len = y - x + 1, lim = runLimit(phOf(barOf(keys[x]) - b0));
      if (len > Math.max(lim, Math.min(cfg.run, 4))) {
        /* 長すぎる連続は、最も弱い音（真ん中寄り）を抜いて分ける */
        let worst = -1, ws = Infinity;
        for (let z = x + 1; z < y; z++) { const s = chosen.get(keys[z]).s + Math.abs(z - (x + y) / 2) * .01; if (s < ws) { ws = s; worst = z; } }
        chosen.delete(keys[worst]); keys = sortedKeys(); x = 0; continue;
      }
      x = y + 1;
    }
    for (const k of sortedKeys()) if (lonely16(k)) chosen.delete(k);
  }

  /* 上級：16分の3連以上は「単色／頭か終わりだけ替える」に直す（小節をまたぐ連続や、写した小節との境目も含めて） */
  if (diff === "hard") {
    const keys = sortedKeys();
    for (let x = 0; x < keys.length;) {
      let y = x; while (y + 1 < keys.length && keys[y + 1] - keys[y] === 1) y++;
      const len = y - x + 1;
      if (len >= 3) {
        const want = keys.slice(x, y + 1).map(k => Math.max(0, chosen.get(k).lane));
        let best = null, bd = Infinity;
        for (const cand of cg4Vocab(len, "hard")) {
          let dist = 0; for (let z = 0; z < len; z++) if (cand[z] !== want[z]) dist++;
          if (dist < bd) { bd = dist; best = cand; }
        }
        for (let z = 0; z < len; z++) chosen.get(keys[x + z]).lane = best[z];
      }
      x = y + 1;
    }
  }
  const out = [];
  for (const k of sortedKeys()) {
    const c = chosen.get(k); if (c.lane < 0) c.lane = 0;
    out.push({ time: Math.round(offset + k * tickMs), lane: c.lane });
  }
  return out;
}

/* ---------- 楽しさの代理指標（方式の比較・テスト用。生成には使わない） ---------- */
/* notes：[{time, lane}]。opts = { bpm, offset, analysis?, durationMs? }。値はどれも「良い悪い」の判定ではなく比較用の数値 */
function cgChartMetrics(notes, opts) {
  const bpm = opts.bpm, offset = opts.offset || 0, beatMs = 60000 / bpm, tickMs = beatMs / CG4_TPB;
  const n = notes ? notes.length : 0;
  const m = { notes: n };
  if (!n) return m;
  const tickOf = t => Math.round((t - offset) / tickMs);
  const ks = notes.map(x => tickOf(x.time));
  const span = Math.max(1, (notes[n - 1].time - notes[0].time) / 1000);
  m.nps = +(n / span).toFixed(2);
  /* 拍裏の割合（拍頭でないノーツ）と16分裏の割合 */
  let off = 0, off16 = 0;
  for (const k of ks) { const p = ((k % 4) + 4) % 4; if (p) off++; if (p % 2) off16++; }
  m.offbeat = +(off / n).toFixed(3); m.offbeat16 = +(off16 / n).toFixed(3);
  /* 連続の長さ：16分間隔（1目）で続く最長と、8分以内（2目以内）で続く最長 */
  const gaps = []; for (let i = 1; i < n; i++) gaps.push(ks[i] - ks[i - 1]);
  m.minGapMs = gaps.length ? +(Math.min(...gaps) * tickMs).toFixed(1) : 0;
  const longest = lim => { let best = 1, r = 1; for (const g of gaps) { r = g <= lim ? r + 1 : 1; if (r > best) best = r; } return best; };
  m.maxRun16 = longest(1); m.maxRun8 = longest(2);
  /* 16分の連続（4ノーツ以上）の数と、その中の交互（トリル）の数 */
  let long16 = 0, trill = 0, run = 1, alt = true;
  for (let i = 1; i <= n; i++) {
    if (i < n && ks[i] - ks[i - 1] === 1) { run++; if (notes[i].lane === notes[i - 1].lane) alt = false; }
    else { if (run >= 4) { long16++; if (alt) trill++; } run = 1; alt = true; }
  }
  m.runs16ge4 = long16; m.trills16 = trill;
  /* 連続部分の色替え率（隣同士で色が変わる割合）と全体のカッの割合 */
  let ch = 0, pairs = 0, ka = 0;
  for (let i = 0; i < n; i++) { if (notes[i].lane === 1) ka++; if (i && ks[i] - ks[i - 1] <= 2) { pairs++; if (notes[i].lane !== notes[i - 1].lane) ch++; } }
  m.kaRatio = +(ka / n).toFixed(3); m.fastColorChange = pairs ? +(ch / pairs).toFixed(3) : 0;
  /* 4小節ごとの密度の変化（変動係数）と、密度の山の高さ（最大÷中央値） */
  const ph = new Map();
  for (const k of ks) { const q = Math.floor(k / 64); ph.set(q, (ph.get(q) || 0) + 1); }
  const qs = Array.from(ph.keys()).sort((x, y) => x - y), qMin = qs[0], qMax = qs[qs.length - 1];
  const counts = []; for (let q = qMin; q <= qMax; q++) counts.push(ph.get(q) || 0);
  const mean = counts.reduce((x, y) => x + y, 0) / counts.length;
  const sd = Math.sqrt(counts.reduce((x, y) => x + (y - mean) ** 2, 0) / counts.length);
  m.phraseDensityCV = +(mean ? sd / mean : 0).toFixed(3);
  const sc = counts.slice().sort((x, y) => x - y), med = sc[Math.floor((sc.length - 1) / 2)] || 1;
  m.peakToMedian = +(Math.max(...counts) / med).toFixed(2);
  /* 休み：休みなしで続く最長の長さ（拍）。chain1＝1拍を超える間、chain2＝2拍以上の間で区切る */
  const chain = minGap => { let best = 0, s0 = ks[0]; for (let i = 1; i < n; i++) if (ks[i] - ks[i - 1] >= minGap) { best = Math.max(best, ks[i - 1] - s0); s0 = ks[i]; } return +(Math.max(best, ks[n - 1] - s0) / 4).toFixed(1); };
  m.chain1 = chain(5); m.chain2 = chain(8);
  /* 反復：小節ごとの配置（目の位置と色）を指紋にし、同じ配置の小節が後で再び現れる割合（すぐ隣以外）と、
     同じ配置が連続する最長の小節数（多すぎると単調＝ループ崩れ） */
  const bars = new Map();
  for (let i = 0; i < n; i++) { const b = Math.floor(ks[i] / 16), p = ((ks[i] % 16) + 16) % 16; bars.set(b, (bars.get(b) || "") + p.toString(16) + notes[i].lane); }
  const bKeys = Array.from(bars.keys()).sort((x, y) => x - y);
  let recur = 0, nonEmpty = 0, sameRun = 1, maxSame = 1;
  const seenAt = new Map();
  for (let i = 0; i < bKeys.length; i++) {
    const b = bKeys[i], sig = bars.get(b);
    if (sig.length >= 4) { nonEmpty++; const prev = seenAt.get(sig); if (prev != null && b - prev >= 2) recur++; if (prev == null) seenAt.set(sig, b); }
    if (i && bKeys[i - 1] === b - 1 && bars.get(bKeys[i - 1]) === sig) { sameRun++; maxSame = Math.max(maxSame, sameRun); } else sameRun = 1;
  }
  m.barRecurrence = nonEmpty ? +(recur / nonEmpty).toFixed(3) : 0;
  m.maxIdenticalBars = maxSame;
  /* 音に合わせた度合い（解析があるとき）：ノーツの位置の立ち上がりの平均、音のある裏拍に置けた割合、
     小節の密度と音量の順位相関、似ている小節どうしの配置一致率（反復一貫性） */
  const a = opts.analysis;
  if (a) {
    const normA = cgLocalNorm(a);
    const attAt = t => Math.min(1.5, cgOnsetAt(a, t) / cgLocalScale(a, normA, t)) / 1.5;
    let sup = 0; for (const x of notes) sup += attAt(x.time);
    m.onsetSupport = +(sup / n).toFixed(3);
    let offN = 0, offAud = 0;
    for (const x of notes) { const k = tickOf(x.time); if (((k % 4) + 4) % 4) { offN++; if (attAt(x.time) >= .14) offAud++; } }
    m.offbeatAudible = offN ? +(offAud / offN).toFixed(3) : 1;
    /* 小節の音量と密度 */
    const b0 = Math.floor(ks[0] / 16), b1 = Math.floor(ks[n - 1] / 16), cnt = new Map();
    for (const k of ks) { const b = Math.floor(k / 16); cnt.set(b, (cnt.get(b) || 0) + 1); }
    const xs = [], ys = [], prints = [];
    for (let b = b0; b <= b1; b++) {
      let e = 0; const v = new Float32Array(16);
      for (let x = 0; x < 16; x++) { const t = offset + (b * 16 + x) * tickMs; e += cgRmsAt(a, t); v[x] = attAt(t); }
      xs.push(e / 16); ys.push(cnt.get(b) || 0); prints.push({ b, v, e: e / 16 });
    }
    /* 順位（同じ値には平均順位）。音量の同じ小節が多くても、並び順で相関が変わらないようにする */
    const rank = arr => {
      const o = arr.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), rr = new Array(arr.length);
      for (let j = 0; j < o.length;) { let e = j; while (e + 1 < o.length && o[e + 1][0] === o[j][0]) e++; const r = (j + e) / 2; for (let x = j; x <= e; x++) rr[o[x][1]] = r; j = e + 1; }
      return rr;
    };
    m.densityEnergyRho = +cg4Corr(rank(xs), rank(ys)).toFixed(3);
    /* 反復一貫性：音（立ち上がりの並び）の相関が0.85以上で音量も近い小節の組のうち、配置が完全一致する割合と平均Jaccard */
    let pairsN = 0, same = 0, jac = 0;
    for (let i = 0; i < prints.length; i++) for (let j = i + 2; j < prints.length; j++) {
      const P = prints[i], Q = prints[j];
      if (!(P.e > 0 && Q.e > 0) || P.e / Q.e < .7 || P.e / Q.e > 1.43) continue;
      if (cg4Corr(P.v, Q.v) < .85) continue;
      const sa = bars.get(P.b) || "", sb = bars.get(Q.b) || "";
      if (!sa && !sb) continue;
      pairsN++; if (sa === sb) same++;
      const A = new Set(sa.match(/../g) || []), B = new Set(sb.match(/../g) || []);
      let inter = 0; for (const x of A) if (B.has(x)) inter++;
      jac += (A.size + B.size - inter) ? inter / (A.size + B.size - inter) : 1;
    }
    m.repeatPairs = pairsN;
    m.repeatExact = pairsN ? +(same / pairsN).toFixed(3) : null;
    m.repeatJaccard = pairsN ? +(jac / pairsN).toFixed(3) : null;
    /* 色と音の一致：カッの位置の高域割合が、ドンの位置より高い割合（AUC風） */
    const rk = [], rd = [];
    for (const x of notes) (x.lane ? rk : rd).push(cgRatioAt(a, x.time));
    if (rk.length && rd.length) {
      rd.sort((p, q) => p - q); let win = 0;
      /* 同じ値は半分の勝ち（一般的な AUC と同じ数え方） */
      const below = v => { let lo = 0, hi = rd.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (rd[mid] < v) lo = mid + 1; else hi = mid; } return lo; };
      const atMost = v => { let lo = 0, hi = rd.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (rd[mid] <= v) lo = mid + 1; else hi = mid; } return lo; };
      for (const v of rk) { const lt = below(v); win += lt + (atMost(v) - lt) / 2; }
      m.colorTimbreAUC = +(win / (rk.length * rd.length)).toFixed(3);
    }
  }
  m.level = cgEstimateLevel(notes);
  return m;
}

/* ---------- 共通の仕上げ：連打・トリルの配置、レーン（ドン／カッ）の決定（旧方式から移したまま） ---------- */
function cgPlace(sel, p) {
  const { analysis, bpm, rand, spec: d, diff } = p;
  // 専門的な音ゲー配置（トリル・連打・複合ストリーム）
  const PAT_3 = [
    [0, 0, 1], // ドドカ
    [1, 1, 0], // カカド
    [0, 1, 0], // ドカド
    [1, 0, 1], // カドカ
    [0, 1, 1], // ドカカ
    [1, 0, 0], // カドド
    [0, 0, 0]  // ドドド
  ];
  const PAT_5 = [
    [0, 0, 1, 1, 0], // ドドカカド
    [1, 1, 0, 0, 1], // カカドドカ
    [0, 1, 0, 1, 0], // 5連トリル
    [0, 1, 1, 0, 1], // ドカカドカ
    [0, 0, 1, 0, 0]  // ドドカドド
  ];

  let med = 0, ratios = null;
  if (analysis && sel.length) {
    ratios = sel.map(c => cgRatioAt(analysis, c.t));
    const sr = ratios.slice().sort((a, b) => a - b);
    med = sr[Math.floor(sr.length / 2)] || 0;
  }

  const L = sel.length;
  const result = new Array(L);
  let idx = 0;
  const fastThresh = (60000 / bpm / d.div) * 1.35;

  while (idx < L) {
    let runEnd = idx;
    while (runEnd + 1 < L && sel[runEnd + 1].t - sel[runEnd].t <= fastThresh) {
      runEnd++;
    }
    const runLen = runEnd - idx + 1;

    if (runLen >= 3 && (diff === "hard" || diff === "master" || diff === "rush")) {
      const isTrill = (diff === "master" || diff === "rush") ? (rand() < 0.52) : (rand() < 0.38);
      if (isTrill || runLen >= 6) {
        let startColor = sel[idx].onBar ? 0 : (rand() < 0.6 ? 0 : 1);
        for (let k = 0; k < runLen; k++) {
          result[idx + k] = { time: Math.round(sel[idx + k].t), lane: (startColor + k) % 2 };
        }
      } else if (runLen === 3) {
        const pat = PAT_3[Math.floor(rand() * PAT_3.length)];
        for (let k = 0; k < 3; k++) {
          result[idx + k] = { time: Math.round(sel[idx + k].t), lane: pat[k] };
        }
      } else if (runLen === 4) {
        const r4 = rand();
        const pat4 = r4 < 0.45 ? [0, 1, 0, 1] : (r4 < 0.75 ? [0, 0, 1, 1] : [0, 1, 1, 0]);
        for (let k = 0; k < 4; k++) {
          result[idx + k] = { time: Math.round(sel[idx + k].t), lane: pat4[k] };
        }
      } else if (runLen === 5) {
        const pat = PAT_5[Math.floor(rand() * PAT_5.length)];
        for (let k = 0; k < 5; k++) {
          result[idx + k] = { time: Math.round(sel[idx + k].t), lane: pat[k] };
        }
      } else {
        const chunk = rand() < 0.5 ? 1 : 2;
        for (let k = 0; k < runLen; k++) {
          result[idx + k] = { time: Math.round(sel[idx + k].t), lane: Math.floor(k / chunk) % 2 };
        }
      }
      idx = runEnd + 1;
    } else {
      let lane;
      if (sel[idx].onBar && rand() < 0.85) lane = 0;
      else if (analysis && ratios) {
        lane = ratios[idx] > med ? 1 : 0;
        if (rand() < 0.10) lane = 1 - lane;
      } else {
        lane = rand() < 0.35 ? 1 : 0;
      }
      result[idx] = { time: Math.round(sel[idx].t), lane };
      idx++;
    }
  }

  return result;
}

/* 譜面の難易度表示（Lv.1〜20）。media.js の estimateLevel（levelOverride を除く本体）と同じ式 */
function cgEstimateLevel(notes) {
  if (!notes || !notes.length) return 1;
  const span = Math.max(10, (notes[notes.length - 1].time - notes[0].time) / 1000);
  const nps = notes.length / span;

  let peak = 0, j = 0;
  for (let i = 0; i < notes.length; i++) {
    while (notes[i].time - notes[j].time > 2500) j++;
    peak = Math.max(peak, (i - j + 1) / 2.5);
  }

  let fastCount = 0, trillCount = 0, ultraFast = 0;
  for (let i = 1; i < notes.length; i++) {
    const gap = notes[i].time - notes[i - 1].time;
    if (gap <= 220) {
      fastCount++;
      if (gap <= 100) ultraFast++;
      if (notes[i].lane !== notes[i - 1].lane && i >= 2 && notes[i - 1].lane !== notes[i - 2].lane && notes[i - 1].time - notes[i - 2].time <= 220) {
        trillCount++;
      }
    }
  }

  const fastRatio = fastCount / (notes.length - 1 || 1);
  const trillRatio = trillCount / (notes.length - 1 || 1);
  const ultraRatio = ultraFast / (notes.length - 1 || 1);

  // 音ゲー標準の Lv. 1 〜 20 スケール（初級 1〜3 / 中級 4〜6 / 上級 7〜11 / 達人 12〜15 / RUSH 16〜20）
  const base = nps * 0.88 + peak * 0.38 + 0.5;
  const tech = fastRatio * 1.8 + trillRatio * 1.5 + ultraRatio * 2.2;

  return Math.max(1, Math.min(20, Math.round(base + tech)));
}

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.buildChartNotes = buildChartNotes;
window.cgEstimateLevel = cgEstimateLevel;
window.cgAllocate = cgAllocate;
window.cgChartMetrics = cgChartMetrics;
/* 領域（window.Trk.chart）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.chart = Object.assign(window.Trk.chart || {}, { buildChartNotes, cgEstimateLevel, cgAllocate, cgChartMetrics });
})();

// SPDX-License-Identifier: GPL-3.0-or-later
/* ==========================================================================
   trk! fx-worklet.js — 🎛 高精度エフェクトの本体（AudioWorklet）

   【中身】
     ・純粋関数（FFT・窓・フィルター係数・ゲイン計算）→ node のテストで検証する
     ・🚪 trk-gate     ノイズゲート（左右リンク・attack/release）
     ・🧹 trk-denoise  スペクトルノイズ消し（1024フレームFFT・hop 512・遅れ1024サンプル
                        ＝自動補正の対象。「いまの音をノイズとして覚える」2秒学習。
                        Audacity・ReaFir・Bertom Denoiser Classic の"概念"の自前実装）
     ・🎚 trk-dyneq    ダイナミックEQ（バンドの音量に反応してその帯域だけ減らす。
                        TDR Nova・Ozone の"概念"の自前実装）

   【権利】着想元の名前は概念の説明のためだけに使う。コード・UI・名称は一切コピーしない
          （詳細は NOTICE.md）。FFT・RBJフィルター・スペクトル減算は教科書的な公開アルゴリズム。

   【読み込み】fx.js から audioContext.audioWorklet.addModule("js/fx-worklet.js")。
     <script> では読まない（AudioWorkletProcessor がないのでエラーになる）。
     process は必ず true を返す（fx.js が使い終わったら disconnect する）。
   ========================================================================== */
"use strict";

/* ============ 純粋関数（テスト対象。ここではオーディオに触らない） ============ */
function fftRadix2(re, im) {   // in-place 基数2 FFT（長さは2のべき）
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {         // ビット反転入れ替え
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr0 = Math.cos(ang), wi0 = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const xr = re[i + k + half], xi = im[i + k + half];
        const vr = xr * wr - xi * wi, vi = xr * wi + xi * wr;
        const ur = re[i + k], ui = im[i + k];
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const nwr = wr * wr0 - wi * wi0; wi = wr * wi0 + wi * wr0; wr = nwr;
      }
    }
  }
}
function ifftRadix2(re, im) {  // in-place 逆FFT（IFT(X)=conj(FFT(conj(X)))/N）
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fftRadix2(re, im);
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}
function hannWindow(n) {       // √ハン窓。解析・合成に同じものを使うと合計がハン窓になり、
  const w = new Float32Array(n);  // 50%オーバーラップで総和1（完全再構成）
  for (let i = 0; i < n; i++) w[i] = Math.sqrt(.5 - .5 * Math.cos(2 * Math.PI * i / n));
  return w;
}
function coefFromMsW(ms, sr) { // ワンポール平滑の係数（ms → 1サンプルあたり）
  return 1 - Math.exp(-1000 / (Math.max(.1, ms) * sr));
}
function dbToLinW(d) { return Math.pow(10, d / 20); }
/* RBJクックブックのフィルター係数（type: highpass / bandpass / peaking） */
function biqCoefW(type, f0, q, gainDb, sr) {
  const A = Math.pow(10, gainDb / 40), w0 = 2 * Math.PI * Math.min(f0, sr * .49) / sr;
  const cw = Math.cos(w0), al = Math.sin(w0) / (2 * Math.max(.05, q));
  let b0, b1, b2, a0, a1, a2;
  if (type === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === "bandpass") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
/* ゲート：しきい値を下回ったら floorDb まで落とす（目標ゲイン） */
function gateTargetW(envDb, thresholdDb, floorDb) { return envDb > thresholdDb ? 1 : dbToLinW(floorDb); }
/* ダイナミックEQ：バンドがしきい値を超えたら −rangeDb まで絞る（目標dB） */
function dynTargetW(envDb, thresholdDb, rangeDb) { return envDb > thresholdDb ? -rangeDb : 0; }
/* ノイズ消し：1ビンぶんのゲイン。px=信号パワー、pn=ノイズパワー、amountDb=消す深さ */
function denoiseGainW(px, pn, amountDb) {
  if (!(pn > 1e-15) || amountDb <= 0) return 1;
  const a = Math.pow(10, amountDb / 20);       // 過減算係数（深いぶんだけ強く引く）
  const g = 1 - a * pn / Math.max(px, 1e-15);
  return Math.max(g, .015);                    // −36.5dBまで（穴あき音を防ぐ床）
}

/* ============ 🚪 ノイズゲート ============ */
class TrkGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -50, minValue: -90, maxValue: -10, automationRate: "k-rate" },
      { name: "floor",     defaultValue: -30, minValue: -48, maxValue: 0,   automationRate: "k-rate" },
      { name: "attack",    defaultValue: 2,   minValue: .5,  maxValue: 50,  automationRate: "k-rate" },
      { name: "release",   defaultValue: 120, minValue: 10,  maxValue: 500, automationRate: "k-rate" },
    ];
  }
  constructor() { super(); this.env2 = 1e-10; this.g = 1; }
  process(inputs, outputs, p) {
    const inp = inputs[0], out = outputs[0];
    if (!out || !out.length) return true;
    if (!inp || !inp.length || !inp[0]) return true;   // 入力がなければ無音のまま
    const thr = p.threshold[0], flr = p.floor[0];
    const aUp = coefFromMsW(p.attack[0], sampleRate), aDn = coefFromMsW(p.release[0], sampleRate);
    const ch = inp.length, n = out[0].length;
    for (let i = 0; i < n; i++) {
      let s = 0;                                        // 左右を足してリンク（片方だけ閉じない）
      for (let c = 0; c < ch; c++) s += inp[c][i] * inp[c][i];
      const x = s / ch;
      this.env2 = x > this.env2 ? this.env2 + aUp * (x - this.env2) : this.env2 + aDn * (x - this.env2);
      const target = gateTargetW(10 * Math.log10(this.env2 + 1e-12), thr, flr);
      const co = target > this.g ? aUp : aDn;
      this.g += co * (target - this.g);
      for (let c = 0; c < out.length; c++) out[c][i] = inp[c % ch][i] * this.g;
    }
    return true;
  }
}

/* ============ 🧹 スペクトルノイズ消し ============
   フレーム1024・hop 512（50%オーバーラップ）。出力は入力よりちょうど1024サンプル遅れる
   （最初の1024サンプルは無音 → fx.js のタイミング自動補正がこの分を足す）。
   学習：port に {type:"learn", ms} → その間の左chの平均パワースペクトルを覚えて
   {type:"profile", pow, frames} を返す。fx.js が全ノードに配る（セッションの間だけ）。 */
const DN_F = 1024, DN_H = 512, DN_BINS = DN_F / 2 + 1;
class TrkDenoise extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "amount", defaultValue: 10, minValue: 0, maxValue: 24, automationRate: "k-rate" }];
  }
  constructor(options) {
    super();
    const prof = options && options.processorOptions && options.processorOptions.profile;
    this.noisePow = prof && prof.length === DN_BINS ? new Float32Array(prof) : null;
    this.win = hannWindow(DN_F);
    this.re = new Float32Array(DN_F); this.im = new Float32Array(DN_F);
    this.inQ = []; this.ola = []; this.outQ = [];       // inQ=受け取り、ola=重ね合わせ、outQ=完成ぶん
    this.inLen = 0; this.outRead = 0;
    this.gPrev = null;                                   // ビン別ゲインのスムージング（立ち上がり遅く・落ちるのは速く）
    this.learning = false; this.learnEnd = 0;
    this.learnSum = new Float64Array(DN_BINS); this.learnN = 0;
    this.port.onmessage = e => {
      const d = e.data || {};
      if (d.type === "learn") { this.learning = true; this.learnEnd = currentTime + (Number(d.ms) || 2000) / 1000 + .4; this.learnSum.fill(0); this.learnN = 0; }
      else if (d.type === "profile") {
        this.noisePow = d.pow && d.pow.length === DN_BINS ? new Float32Array(d.pow) : null;
        this.gPrev = null;                               // ノイズ像が変わったらスムージングもリセット
      }
    };
  }
  initCh(ch) {
    this.inQ = []; this.ola = []; this.outQ = [];
    /* 出力キューの先頭に DN_F ぶんの無音を入れておく → 全体がちょうど1024サンプル遅れる */
    for (let c = 0; c < ch; c++) { this.inQ.push([]); this.ola.push(new Float32Array(DN_F)); this.outQ.push(new Array(DN_F).fill(0)); }
    this.inLen = 0; this.outRead = 0;
    this.gPrev = new Float32Array(ch * DN_BINS); this.gPrev.fill(1);
  }
  finalizeLearn() {
    this.learning = false;
    const pow = this.learnN > 0 ? Float32Array.from(this.learnSum, v => v / this.learnN) : null;
    this.port.postMessage({ type: "profile", pow, frames: this.learnN });
  }
  process(inputs, outputs, p) {
    const inp = inputs[0], out = outputs[0];
    if (!out || !out.length) return true;
    const n = out[0].length, amount = p.amount[0];
    const ch = (inp && inp.length && inp[0]) ? inp.length : 0;
    if (!ch) { for (let c = 0; c < out.length; c++) out[c].fill(0); return true; }
    if (this.inQ.length !== ch) this.initCh(ch);
    for (let c = 0; c < ch; c++) { const src = inp[c], q = this.inQ[c]; for (let i = 0; i < n; i++) q.push(src[i]); }
    this.inLen += n;
    /* フレームがそろうたびに1フレーム処理（hop ずつ進む） */
    while (this.inLen >= DN_F) {
      for (let c = 0; c < ch; c++) {
        const buf = this.inQ[c];
        for (let i = 0; i < DN_F; i++) { this.re[i] = buf[i] * this.win[i]; this.im[i] = 0; }
        fftRadix2(this.re, this.im);
        if (this.learning && c === 0) {                 // ゲインをかける前のスペクトルを覚える
          let fr = 0;
          for (let k = 0; k < DN_BINS; k++) { const px = this.re[k] * this.re[k] + this.im[k] * this.im[k]; this.learnSum[k] += px; fr += px; }
          if (fr > 1e-9) this.learnN++;                 // 完全な無音は数に入れない
        }
        if (amount > 0 && this.noisePow) {
          if (!this.gPrev || this.gPrev.length !== ch * DN_BINS) { this.gPrev = new Float32Array(ch * DN_BINS); this.gPrev.fill(1); }
          const off = c * DN_BINS;
          for (let k = 0; k < DN_BINS; k++) {
            const px = this.re[k] * this.re[k] + this.im[k] * this.im[k];
            let g = denoiseGainW(px, this.noisePow[k], amount);
            const gp = this.gPrev[off + k];
            g = g > gp ? gp + .3 * (g - gp) : gp + .7 * (g - gp);
            this.gPrev[off + k] = g;
            const kk = (k === 0 || k === DN_BINS - 1) ? k : DN_F - k;
            this.re[k] *= g; this.im[k] *= g; if (kk !== k) { this.re[kk] *= g; this.im[kk] *= g; }
          }
        }
        ifftRadix2(this.re, this.im);
        const ola = this.ola[c], oq = this.outQ[c];
        for (let i = 0; i < DN_F; i++) ola[i] += this.re[i] * this.win[i];
        for (let i = 0; i < DN_H; i++) oq.push(ola[i]);  // いちばん新しいフレームが済んだ → 前 hop が完成
        ola.copyWithin(0, DN_H); ola.fill(0, DN_F - DN_H);
      }
      for (let c = 0; c < ch; c++) this.inQ[c].splice(0, DN_H);
      this.inLen -= DN_H;
    }
    if (this.learning && currentTime >= this.learnEnd) this.finalizeLearn();
    /* 出力：完成ぶんから n 個。まだなければ無音（これが1024サンプルの遅れ） */
    for (let i = 0; i < n; i++) {
      const src = (this.outRead + i < this.outQ[0].length);
      for (let c = 0; c < out.length; c++) out[c][i] = src ? this.outQ[c < ch ? c : 0][this.outRead + i] : 0;
    }
    this.outRead += n;
    if (this.outRead > 8192) { for (const q of this.outQ) q.splice(0, this.outRead); this.outRead = 0; }
    return true;
  }
}

/* ============ 🎚 ダイナミックEQ ============
   検出：bandpass（左右の平均）→ 包絡 → dB。しきい値を超えたら peaking を −range dB まで
   絞る（絞る方向=attack、戻る方向=release。係数はブロックごとに作り直す）。 */
class TrkDynEQ extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "freq",      defaultValue: 5000, minValue: 20,   maxValue: 12000, automationRate: "k-rate" },
      { name: "q",         defaultValue: 3,    minValue: .1,   maxValue: 18,    automationRate: "k-rate" },
      { name: "threshold", defaultValue: -30,  minValue: -60,  maxValue: 0,     automationRate: "k-rate" },
      { name: "range",     defaultValue: 8,    minValue: 0,    maxValue: 24,    automationRate: "k-rate" },
      { name: "attack",    defaultValue: 3,    minValue: .5,   maxValue: 50,    automationRate: "k-rate" },
      { name: "release",   defaultValue: 120,  minValue: 10,   maxValue: 500,   automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.bp = [this.mkSt(), this.mkSt()]; this.pk = [this.mkSt(), this.mkSt()];
    this.env2 = 1e-10; this.gDb = 0; this.co = null; this.coKey = "";
  }
  mkSt() { return { x1: 0, x2: 0, y1: 0, y2: 0 }; }
  run(st, x, c) {
    const y = c.b0 * x + c.b1 * st.x1 + c.b2 * st.x2 - c.a1 * st.y1 - c.a2 * st.y2;
    st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y; return y;
  }
  process(inputs, outputs, p) {
    const inp = inputs[0], out = outputs[0];
    if (!out || !out.length) return true;
    if (!inp || !inp.length || !inp[0]) return true;
    const bp = biqCoefW("bandpass", p.freq[0], p.q[0], 0, sampleRate);
    const aUp = coefFromMsW(p.attack[0], sampleRate), aDn = coefFromMsW(p.release[0], sampleRate);
    const n = out[0].length, ch = inp.length;
    for (let s = 0; s < n; s += 128) {
      const block = Math.min(128, n - s);
      let envDbNow = -120;
      for (let i = s; i < s + block; i++) {
        let acc = 0;
        for (let c = 0; c < ch; c++) acc += this.run(this.bp[Math.min(c, 1)], inp[c][i], bp);
        const x2 = (acc / ch) ** 2;                    /* 2乗してから平滑（ゲートと同じ形） */
        this.env2 = x2 > this.env2 ? this.env2 + aUp * (x2 - this.env2) : this.env2 + aDn * (x2 - this.env2);
        envDbNow = 10 * Math.log10(this.env2 + 1e-12);
      }
      const target = dynTargetW(envDbNow, p.threshold[0], p.range[0]);
      const co = Math.min(1, (target < this.gDb ? aUp : aDn) * block);   // ブロックぶん一気に進める
      this.gDb += co * (target - this.gDb);
      if (Math.abs(this.gDb) < .01) this.gDb = 0;
      const key = p.freq[0] + "|" + p.q[0] + "|" + Math.round(this.gDb * 20);
      if (key !== this.coKey) { this.co = biqCoefW("peaking", p.freq[0], p.q[0], this.gDb, sampleRate); this.coKey = key; }
      for (let i = s; i < s + block; i++)
        for (let c = 0; c < out.length; c++) out[c][i] = this.run(this.pk[Math.min(c, 1)], inp[c % ch][i], this.co);
    }
    return true;
  }
}

registerProcessor("trk-gate", TrkGate);
registerProcessor("trk-denoise", TrkDenoise);
registerProcessor("trk-dyneq", TrkDynEQ);

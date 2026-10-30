// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! frame-interp.js — ✨ フレーム補完（動き補償・光学フロー / MEMC）

   ・24〜30fps の動画から中間のフレームを作り、表示をなめらかにします。
   ・仕組み：ピラミッド型ブロックマッチングの光学フローを**フラグメント
     シェーダーだけで**計算し（外部のモデル・ライブラリ・通信は一切なし）、
     前後のフレームを逆向きにワープして合成します。
       - 前方フロー vf：A の画素が B でどこへ動くか（A→B の動き）
       - 後方フロー vb：B→A の動き
       - 中間フレーム：A を x - t·vf から、B を x - (1-t)·vb からサンプル
       - 前後の一致度が低い（隠れた／現れた）場所はクロスフェードに逃がす
   ・処理はすべて端末の GPU の中だけ。動画や画像を外部へ送りません。
   ・かなり重い処理なので、既定は「オフ」。重いときは自動で軽くします。
   ・表示は約1フレームぶん遅れます（次のフレームを待つため。仕様です）。

   参考にした考え方（コードは借用していません）：
     ・Sundaram らの forward/backward consistency（遮蔽の検出）
     ・粗→細(coarse-to-fine)のブロックマッチング＋時間方向のシード
     ・ゼロベクトルバイアス（平坦部・静止UIでベクトルが暴れないようにする）
   ============================================================================ */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章（接頭辞 mediaInterp…） ============ */
Object.assign(TEXT.ja, {
  mediaInterpTitle: "✨ フレーム補完（綺麗になりますが、動画の読み込みが遅くなります）",
  mediaInterpHint: "GPUが中間のフレームを作って、カクつきをなめらかにします。処理はすべて端末の中だけで、動画を外部へ送ることはありません。映像の表示は約1フレーム（30fpsなら約33ミリ秒）遅れます。映像酔いしやすい方はオフのままがおすすめです。",
  mediaInterpMode: "モード",
  mediaInterpOff: "オフ", mediaInterpBlend: "なめらか（ブレンド）", mediaInterpFlow: "高品質（動き補償・光学フロー）",
  mediaInterpStrength: "動き補償の強さ",
  mediaInterpUnsupported: "このブラウザーはWebGL2に対応していないため、フレーム補完は使えません。",
  mediaInterpStat: "ソース {src}fps → 表示 {out}fps ／ 処理 {w}×{h}",
  mediaInterpDegraded: "重かったので自動的に軽くしました",
  mediaInterpWarmup: "準備中…",
  mediaInterpBlocked: "この動画は保護されているため（別サイトの動画など）、フレーム補完を使えません。",
  mediaStageNoVideo: "音声のみの曲です（映像はありません）"
});
Object.assign(TEXT.en, {
  mediaInterpTitle: "✨ Frame interpolation (smoother, but slower to load)",
  mediaInterpHint: "Your GPU builds the in-between frames so motion looks smooth. Everything happens on this device — the video never leaves it. Picture is delayed by about one frame (~33 ms at 30 fps). If you get motion sickness easily, keep it off.",
  mediaInterpMode: "Mode",
  mediaInterpOff: "Off", mediaInterpBlend: "Smooth (blend)", mediaInterpFlow: "High quality (motion compensated)",
  mediaInterpStrength: "Motion compensation strength",
  mediaInterpUnsupported: "This browser has no WebGL2, so frame interpolation is unavailable.",
  mediaInterpStat: "Source {src} fps → shown at {out} fps · process {w}×{h}",
  mediaInterpDegraded: "Auto-lightened because it was too heavy",
  mediaInterpWarmup: "Preparing…",
  mediaInterpBlocked: "This video is protected (for example, hosted on another site), so frame interpolation cannot be used.",
  mediaStageNoVideo: "Audio only — there is no video to show"
});
Object.assign(TEXT.zh, {
  mediaInterpTitle: "✨ 帧补全（画面更平滑，但视频加载会变慢）",
  mediaInterpHint: "由 GPU 生成中间帧，让画面更顺滑。全部处理都在设备内完成，视频不会发送到外部。画面会延迟约一帧（30fps 约 33 毫秒）。容易晕动的人建议保持关闭。",
  mediaInterpMode: "模式",
  mediaInterpOff: "关闭", mediaInterpBlend: "平滑（混合）", mediaInterpFlow: "高画质（运动补偿·光流）",
  mediaInterpStrength: "运动补偿强度",
  mediaInterpUnsupported: "此浏览器不支持 WebGL2，无法使用帧补全。",
  mediaInterpStat: "源 {src}fps → 显示 {out}fps ／ 处理 {w}×{h}",
  mediaInterpDegraded: "因负载过重已自动降低画质",
  mediaInterpWarmup: "准备中…",
  mediaInterpBlocked: "该视频受保护（例如来自其他网站），无法使用帧补全。",
  mediaStageNoVideo: "这是纯音频曲目（没有视频）"
});
Object.assign(TEXT.ko, {
  mediaInterpTitle: "✨ 프레임 보간 (부드러워지지만, 영상 로딩이 느려집니다)",
  mediaInterpHint: "GPU가 중간 프레임을 만들어 움직임을 부드럽게 합니다. 모든 처리는 이 기기 안에서만 이루어지며 영상은 외부로 보내지 않습니다. 영상은 약 한 프레임(30fps에서 약 33밀리초) 늦게 나옵니다. 멀미가 쉬운 분은 끄고 쓰세요.",
  mediaInterpMode: "모드",
  mediaInterpOff: "끔", mediaInterpBlend: "부드럽게 (블렌드)", mediaInterpFlow: "고화질 (움직임 보정·옵티컬 플로)",
  mediaInterpStrength: "움직임 보정 세기",
  mediaInterpUnsupported: "이 브라우저는 WebGL2를 지원하지 않아 프레임 보간을 쓸 수 없습니다.",
  mediaInterpStat: "소스 {src}fps → 표시 {out}fps ／ 처리 {w}×{h}",
  mediaInterpDegraded: "무거워서 자동으로 가볍게 했습니다",
  mediaInterpWarmup: "준비 중…",
  mediaInterpBlocked: "이 영상은 보호되어 있어(다른 사이트의 영상 등) 프레임 보간을 쓸 수 없습니다.",
  mediaStageNoVideo: "소리만 있는 곡입니다 (영상이 없습니다)"
});

const videoEl = document.getElementById("video");
if (!videoEl) return;

/* ============ 設定・状態 ============ */
const MODES = ["off", "blend", "flow"];
const QUALITY_MAXW = [512, 768, 1152];      // light / balanced / high（処理する幅の上限）
const MAX_LEVELS = 5;
const CUT_THRESHOLD = 34;                   // シーンチェンジ判定（0-255の輝度差の平均）
const FLOW_RANGE = 64;                      // 8bitテクスチャ時に保持できる flow の最大値（flow解像度px）
const FLOW_LAMBDA = 0.010;                  // 平坦部で大きなベクトルを拾わないための変位ペナルティ（full-res px あたり）

const mode = () => (MODES.includes(core.settings.frameInterp) ? core.settings.frameInterp : "off");
const strength = () => Math.max(0, Math.min(1, Number(core.settings.frameInterpStrength)));

let gl = null, glc = null, ok2 = false, initTried = false, blocked = false;
let prog = {};
let vao = null;
let capCv = null, capCtx = null;            // 動画を作業解像度に落とす2Dキャンバス
let tinyCv = null, tinyCtx = null, tinyPrev = null;
let W = 0, H = 0, levels = 0;
let frameTex = [null, null], idxA = 0, idxB = 1;
let pyrTex = [], pyrFbo = [];
let sets = [[], [], []], setFbo = [];       // 3組のフローピラミッド（現在／前回／作業用）
let iCur = 0, iPrev = 1, iScratch = 2;
let zeroTex = null;
let raf = 0;
let havePair = false, cutFlag = false, lastCapAt = 0, pairAt = 0, pairInterval = 33.4;
let lastFrames = -1, lastCT = -1, rvfPending = false;
let quality = 2, degraded = false;
let outStamps = [], lastTune = 0, srcFps = 0, outFps = 0;
let lastRenderKey = -1, lastStampAt = 0;   // 表示先が複数でも1フレーム1回にまとめる
const surfaces = new Map();
const watchers = new Set();

const notify = () => { for (const fn of [...watchers]) { try { fn(mode()); } catch (_) {} } };

/* ============ WebGL の準備 ============ */
const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/* 輝度のペア（R=A, G=B）を作る／縮小する */
const FS_PACK = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 oCol;
float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(){
  float a = 0.0, b = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 o = (vec2(float(i), float(j)) - 0.5) * uTexel;
      a += lum(texture(uA, vUv + o).rgb);
      b += lum(texture(uB, vUv + o).rgb);
    }
  }
  oCol = vec4(a * 0.25, b * 0.25, 0.0, 1.0);
}`;
const FS_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 oCol;
void main(){
  vec2 s = vec2(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      s += texture(uSrc, vUv + (vec2(float(i), float(j)) - 0.5) * uTexel).rg;
    }
  }
  oCol = vec4(s * 0.25, 0.0, 1.0);
}`;

/* 粗→細のブロックマッチング（前方・後方を同時に＝MRT）
   ・5×5 の平均SAD ＋ λ×変位 のペナルティ（平坦な所で暴走しない＝実装でいうゼロベクトルバイアス）
   ・粗いレベルのフローは小数のまま種にする（丸めると倍々に誤差が増える）
   ・前のペアのフローも候補に入れる（時間方向のシード。速いパンの精度が上がる）
   ・仕上げに ±1 → ±0.5 の小数山登り
   ・後方ベクトルは −前方 を出発点に9通りだけ検証（遮蔽の検出に使う） */
const FS_FLOW = `#version 300 es
precision highp float;
uniform sampler2D uPyr;      // R=A, G=B（このレベルの輝度）
uniform sampler2D uSeedF;    // ひとつ粗いレベルの前方フロー
uniform sampler2D uSeedB;
uniform sampler2D uPrevF;    // 前のペアのフロー（時間方向のシード）
uniform sampler2D uPrevB;
uniform vec2 uTexel;         // 1/このレベルのサイズ
uniform float uSeedScale;    // 粗いレベルがあるとき 2.0、無いとき 0.0
uniform float uRadius;       // 種の周りを探す範囲（このレベルのpx）
uniform float uRange;        // 保持できる flow の最大値
uniform float uFloatTex;
uniform float uTemp;
uniform float uBias;         // λ × このレベルの1pxぶんの full-res px 数
in vec2 vUv;
layout(location = 0) out vec4 oF;
layout(location = 1) out vec4 oB;

vec2 dec(vec2 v){ return uFloatTex > 0.5 ? v : (v - 0.5) * (2.0 * uRange); }
vec4 enc(vec2 v){ return uFloatTex > 0.5 ? vec4(v, 0.0, 1.0) : vec4(v / (2.0 * uRange) + 0.5, 0.0, 1.0); }
float la(vec2 uv){ return texture(uPyr, uv).r; }
float lb(vec2 uv){ return texture(uPyr, uv).g; }
float bias(vec2 d){ return uBias * (abs(d.x) + abs(d.y)); }
/* A(uv) と B(uv+d) の平均SAD。最小にする d が A→B の動き。 */
float costF(vec2 uv, vec2 d){
  float s = 0.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 o = vec2(float(i), float(j)) * uTexel;
      s += abs(la(uv + o) - lb(uv + o + d * uTexel));
    }
  }
  return s / 25.0 + bias(d);
}
/* B(uv) と A(uv+d) の平均SAD。最小にする d が B→A の動き。 */
float costB(vec2 uv, vec2 d){
  float s = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j)) * uTexel;
      s += abs(lb(uv + o) - la(uv + o + d * uTexel));
    }
  }
  return s / 9.0 + bias(d);
}
void main(){
  vec2 uv = vUv;
  vec2 seed = uSeedScale > 0.5 ? dec(texture(uSeedF, uv).xy) * 2.0 : vec2(0.0);
  vec2 base = floor(seed + 0.5);
  vec2 best = seed;                       // 小数の種をそのまま候補にする
  float bestC = costF(uv, seed);
  float r = uRadius;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      if (abs(float(i)) > r || abs(float(j)) > r) continue;
      vec2 cand = base + vec2(float(i), float(j));
      float c = costF(uv, cand);
      if (c < bestC) { bestC = c; best = cand; }
    }
  }
  if (uTemp > 0.5) {                      // 前のペアの動きがそのまま続いているか
    vec2 pv = floor(dec(texture(uPrevF, uv).xy) + 0.5);
    float c = costF(uv, pv);
    if (c < bestC) { bestC = c; best = pv; }
  }
  float step = 1.0;                       // 小数の山登り（±1 → ±0.5）
  for (int it = 0; it < 2; it++) {
    float bc = bestC;
    vec2 cand = best + vec2(step, 0.0); float c = costF(uv, cand);
    if (c < bc) { bc = c; best = cand; }
    cand = best - vec2(step, 0.0); c = costF(uv, cand);
    if (c < bc) { bc = c; best = cand; }
    cand = best + vec2(0.0, step); c = costF(uv, cand);
    if (c < bc) { bc = c; best = cand; }
    cand = best - vec2(0.0, step); c = costF(uv, cand);
    if (c < bc) { bc = c; best = cand; }
    bestC = min(bc, bestC);
    step *= 0.5;
  }
  vec2 f = best;
  float m = max(abs(f.x), abs(f.y));
  if (m > uRange * 0.9) f *= (uRange * 0.9) / m;
  /* 後方ベクトル：−前方 を出発点に局所検証（前後一致の判定を意味のあるものにする） */
  vec2 b = -f;
  float bc2 = costB(uv, b);
  vec2 cand = b + vec2(1.0, 0.0); float c2 = costB(uv, cand); if (c2 < bc2) { bc2 = c2; b = cand; }
  cand = b - vec2(1.0, 0.0); c2 = costB(uv, cand); if (c2 < bc2) { bc2 = c2; b = cand; }
  cand = b + vec2(0.0, 1.0); c2 = costB(uv, cand); if (c2 < bc2) { bc2 = c2; b = cand; }
  cand = b - vec2(0.0, 1.0); c2 = costB(uv, cand); if (c2 < bc2) { bc2 = c2; b = cand; }
  float mb = max(abs(b.x), abs(b.y));
  if (mb > uRange * 0.9) b *= (uRange * 0.9) / mb;
  oF = enc(f);
  oB = enc(b);
}`;

/* 3×3 の中央値（外れ値をならす） */
const FS_MEDIAN = `#version 300 es
precision highp float;
uniform sampler2D uF;
uniform sampler2D uB;
uniform vec2 uTexel;
uniform float uRange;
uniform float uFloatTex;
in vec2 vUv;
layout(location = 0) out vec4 oF;
layout(location = 1) out vec4 oB;
vec2 dec(vec2 v){ return uFloatTex > 0.5 ? v : (v - 0.5) * (2.0 * uRange); }
vec4 enc(vec2 v){ return uFloatTex > 0.5 ? vec4(v, 0.0, 1.0) : vec4(v / (2.0 * uRange) + 0.5, 0.0, 1.0); }
vec2 med3(vec2 a, vec2 b, vec2 c){ return max(min(a, b), min(max(a, b), c)); }
void main(){
  vec2 f0 = dec(texture(uF, vUv + vec2(-1.0, -1.0) * uTexel).xy);
  vec2 f1 = dec(texture(uF, vUv + vec2(0.0, -1.0) * uTexel).xy);
  vec2 f2 = dec(texture(uF, vUv + vec2(1.0, -1.0) * uTexel).xy);
  vec2 f3 = dec(texture(uF, vUv + vec2(-1.0, 0.0) * uTexel).xy);
  vec2 f4 = dec(texture(uF, vUv).xy);
  vec2 f5 = dec(texture(uF, vUv + vec2(1.0, 0.0) * uTexel).xy);
  vec2 f6 = dec(texture(uF, vUv + vec2(-1.0, 1.0) * uTexel).xy);
  vec2 f7 = dec(texture(uF, vUv + vec2(0.0, 1.0) * uTexel).xy);
  vec2 f8 = dec(texture(uF, vUv + vec2(1.0, 1.0) * uTexel).xy);
  vec2 b0 = dec(texture(uB, vUv + vec2(-1.0, -1.0) * uTexel).xy);
  vec2 b1 = dec(texture(uB, vUv + vec2(0.0, -1.0) * uTexel).xy);
  vec2 b2 = dec(texture(uB, vUv + vec2(1.0, -1.0) * uTexel).xy);
  vec2 b3 = dec(texture(uB, vUv + vec2(-1.0, 0.0) * uTexel).xy);
  vec2 b4 = dec(texture(uB, vUv).xy);
  vec2 b5 = dec(texture(uB, vUv + vec2(1.0, 0.0) * uTexel).xy);
  vec2 b6 = dec(texture(uB, vUv + vec2(-1.0, 1.0) * uTexel).xy);
  vec2 b7 = dec(texture(uB, vUv + vec2(0.0, 1.0) * uTexel).xy);
  vec2 b8 = dec(texture(uB, vUv + vec2(1.0, 1.0) * uTexel).xy);
  oF = enc(med3(med3(f0, f1, f2), med3(f3, f4, f5), med3(f6, f7, f8)));
  oB = enc(med3(med3(b0, b1, b2), med3(b3, b4, b5), med3(b6, b7, b8)));
}`;

/* 合成（ワープ＋クロスフェードへのフォールバック） */
const FS_WARP = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uF;
uniform sampler2D uBk;
uniform vec2 uFlowTexel;
uniform float uT;
uniform float uStrength;
uniform float uCut;
uniform float uRange;
uniform float uFloatTex;
in vec2 vUv;
out vec4 oCol;
vec2 dec(vec2 v){ return uFloatTex > 0.5 ? v : (v - 0.5) * (2.0 * uRange); }
vec3 pick(sampler2D t, vec2 uv){ return texture(t, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb; }
void main(){
  vec2 uv = vUv;
  vec2 vf = dec(texture(uF, uv).xy);
  vec2 qb = uv + vf * (1.0 - uT) * uFlowTexel;
  vec2 vb = dec(texture(uBk, qb).xy);
  float consist = length(vf + vb);
  float conf = 1.0 - smoothstep(0.9, 3.5, consist);
  vec2 uvA = uv - vf * uT * uFlowTexel;
  vec2 uvB = uv - vb * (1.0 - uT) * uFlowTexel;
  vec3 mc = mix(pick(uA, uvA), pick(uB, uvB), uT);
  vec3 cf = mix(pick(uA, uv), pick(uB, uv), uT);
  vec3 col = mix(cf, mc, uStrength * conf);
  col = mix(col, pick(uB, uv), uCut);
  oCol = vec4(col, 1.0);
}`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("[frame-interp] shader:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
function makeProgram(fsSrc) {
  const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("[frame-interp] link:", gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace("[0]", "")] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}
function makeTex(w, h, internal, format, type) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function makeFbo() { return gl.createFramebuffer(); }
function drawFbo(fbo, tex0, tex1) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex0, 0);
  if (tex1) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tex1, 0);
}
function bindTex(unit, tex, loc) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (loc) gl.uniform1i(loc, unit);
}
function drawQuad() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null); }

/* ============ 初期化 ============ */
function tryInit() {
  if (initTried) return ok2;
  initTried = true;
  try {
    glc = document.createElement("canvas");
    gl = glc.getContext("webgl2", { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl) return false;
    prog.pack = makeProgram(FS_PACK);
    prog.down = makeProgram(FS_DOWN);
    prog.flow = makeProgram(FS_FLOW);
    prog.median = makeProgram(FS_MEDIAN);
    prog.warp = makeProgram(FS_WARP);
    if (!prog.pack || !prog.down || !prog.flow || !prog.median || !prog.warp) return false;
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog.pack.p, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    capCv = document.createElement("canvas");
    capCtx = capCv.getContext("2d", { alpha: false });
    tinyCv = document.createElement("canvas");
    tinyCv.width = 32; tinyCv.height = 18;
    tinyCtx = tinyCv.getContext("2d", { alpha: false, willReadFrequently: true });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    ok2 = true;
    return true;
  } catch (e) {
    console.warn("[frame-interp] init failed:", e);
    ok2 = false;
    return false;
  }
}
const floatTex = () => !!gl.getExtension("EXT_color_buffer_float");

function releaseSizes() {
  if (!gl) return;
  const del = t => { if (t) gl.deleteTexture(t); };
  frameTex.forEach(del); frameTex = [null, null];
  pyrTex.forEach(del); pyrTex = [];
  pyrFbo.forEach(f => { if (f) gl.deleteFramebuffer(f); }); pyrFbo = [];
  setFbo.forEach(list => list.forEach(f => { if (f) gl.deleteFramebuffer(f); })); setFbo = [];
  for (const set of sets) for (const lev of set) { del(lev.f); del(lev.b); }
  sets = [[], [], []];
  del(zeroTex); zeroTex = null;
}

function ensureSizes() {
  if (!ok2) return false;
  const vw = videoEl.videoWidth || 0, vh = videoEl.videoHeight || 0;
  if (!vw || !vh) return false;
  const maxW = QUALITY_MAXW[quality];
  let w = Math.min(vw, maxW);
  w = Math.max(160, Math.round(w / 2) * 2);
  let h = Math.max(90, Math.round((w * vh) / vw / 2) * 2);
  if (w === W && h === H && pyrTex.length) return true;
  releaseSizes();
  W = w; H = h; lastRenderKey = -1;
  glc.width = W; glc.height = H;
  capCv.width = W; capCv.height = H;
  const fl = floatTex();
  const flowInternal = fl ? gl.RG16F : gl.RGBA8;
  const flowFormat = fl ? gl.RG : gl.RGBA;
  const flowType = fl ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  frameTex = [makeTex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE), makeTex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE)];
  /* 輝度ピラミッド（レベル0＝作業解像度の1/2） */
  let lw = W >> 1, lh = H >> 1;
  levels = 0;
  while (lw >= 16 && lh >= 16 && levels < MAX_LEVELS) {
    pyrTex.push(makeTex(lw, lh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE));
    const f = makeFbo();
    drawFbo(f, pyrTex[levels], null);
    pyrFbo.push(f);
    levels++;
    lw >>= 1; lh >>= 1;
  }
  if (!levels) { ok2 = false; return false; }
  /* フローの3セット */
  for (let s = 0; s < 3; s++) {
    const list = [];
    for (let l = 0; l < levels; l++) {
      const lw2 = Math.max(1, (W >> 1) >> l), lh2 = Math.max(1, (H >> 1) >> l);
      list.push({ f: makeTex(lw2, lh2, flowInternal, flowFormat, flowType), b: makeTex(lw2, lh2, flowInternal, flowFormat, flowType) });
    }
    sets[s] = list;
    const fbos = [];
    for (let l = 0; l < levels; l++) fbos.push(makeFbo());
    setFbo.push(fbos);
  }
  zeroTex = makeTex(1, 1, flowInternal, flowFormat, flowType);
  gl.bindTexture(gl.TEXTURE_2D, zeroTex);
  if (fl) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RG, gl.HALF_FLOAT, new Float32Array([0, 0]));
  else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 0, 255]));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  iCur = 0; iPrev = 1; iScratch = 2;
  havePair = false; lastFrames = -1; lastCT = -1; tinyPrev = null;
  outStamps = [];
  return true;
}

/* ============ フレームの取り込み ============ */
function captureFrame() {
  const now = performance.now();
  if (lastCapAt) {
    const dt = now - lastCapAt;
    if (dt > 4 && dt < 300) pairInterval = pairInterval * 0.7 + dt * 0.3;
  }
  lastCapAt = now;
  pairAt = now;
  const t = idxA; idxA = idxB; idxB = t;      // 直前のBをAにして、新しいフレームをBへ
  try {
    capCtx.drawImage(videoEl, 0, 0, W, H);
    gl.bindTexture(gl.TEXTURE_2D, frameTex[idxB]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, capCv);
  } catch (e) {
    /* 別サイトの動画は canvas が汚染されて読めない（保護された映像） */
    console.warn("[frame-interp] cannot read video frames:", e);
    blocked = true; stopLoop(); notify();
    return false;
  }
  /* シーンチェンジの検出（32×18に縮小して平均輝度差） */
  cutFlag = false;
  try {
    tinyCtx.drawImage(capCv, 0, 0, 32, 18);
    const d = tinyCtx.getImageData(0, 0, 32, 18).data;
    if (tinyPrev) {
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += Math.abs(d[i] - tinyPrev[i]);
      cutFlag = sum / (d.length / 4) > CUT_THRESHOLD;
    }
    tinyPrev = d.slice();
  } catch (_) {}
  return true;
}

/* ============ フローの計算（新しいフレームが来たときだけ） ============ */
function computeFlow() {
  if (!ok2 || !levels) return;
  const fl = floatTex();
  const uRange = FLOW_RANGE, uFloat = fl ? 1 : 0;
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  /* 1) 輝度ペアのピラミッド */
  gl.useProgram(prog.pack.p);
  gl.uniform1i(prog.pack.u.uA, 0); gl.uniform1i(prog.pack.u.uB, 1);
  gl.uniform2f(prog.pack.u.uTexel, 1 / W, 1 / H);
  gl.viewport(0, 0, W >> 1, H >> 1);
  drawFbo(pyrFbo[0], pyrTex[0], null);
  bindTex(0, frameTex[idxA]); bindTex(1, frameTex[idxB]);
  drawQuad();

  gl.useProgram(prog.down.p);
  gl.uniform1i(prog.down.u.uSrc, 0);
  for (let l = 1; l < levels; l++) {
    const sw = Math.max(1, (W >> 1) >> (l - 1)), sh = Math.max(1, (H >> 1) >> (l - 1));
    gl.uniform2f(prog.down.u.uTexel, 1 / sw, 1 / sh);
    gl.viewport(0, 0, Math.max(1, (W >> 1) >> l), Math.max(1, (H >> 1) >> l));
    drawFbo(pyrFbo[l], pyrTex[l], null);
    bindTex(0, pyrTex[l - 1]);
    drawQuad();
  }

  /* 2) 粗いレベルから順にブロックマッチング */
  const flowProg = prog.flow;
  gl.useProgram(flowProg.p);
  gl.uniform1i(flowProg.u.uPyr, 0);
  gl.uniform1i(flowProg.u.uSeedF, 1);
  gl.uniform1i(flowProg.u.uSeedB, 2);
  gl.uniform1i(flowProg.u.uPrevF, 3);
  gl.uniform1i(flowProg.u.uPrevB, 4);
  gl.uniform1f(flowProg.u.uRange, uRange);
  gl.uniform1f(flowProg.u.uFloatTex, uFloat);
  for (let l = levels - 1; l >= 0; l--) {
    const lw = Math.max(1, (W >> 1) >> l), lh = Math.max(1, (H >> 1) >> l);
    const coarser = l < levels - 1;
    const seed = coarser ? sets[iCur][l + 1] : null;
    gl.uniform2f(flowProg.u.uTexel, 1 / lw, 1 / lh);
    gl.uniform1f(flowProg.u.uSeedScale, coarser ? 2 : 0);
    /* いちばん粗いレベルだけ大きく探し、あとは種の周りを±1（粗→細で伝わるので足りる） */
    gl.uniform1f(flowProg.u.uRadius, l === levels - 1 ? 2 : 1);
    gl.uniform1f(flowProg.u.uBias, FLOW_LAMBDA * (1 << (l + 1)));
    gl.uniform1f(flowProg.u.uTemp, havePair ? 1 : 0);
    gl.viewport(0, 0, lw, lh);
    drawFbo(setFbo[iCur][l], sets[iCur][l].f, sets[iCur][l].b);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    bindTex(0, pyrTex[l]);
    bindTex(1, seed ? seed.f : zeroTex);
    bindTex(2, seed ? seed.b : zeroTex);
    bindTex(3, sets[iPrev][l].f);
    bindTex(4, sets[iPrev][l].b);
    drawQuad();

    /* 3×3 中央値（外れ値をならす）→ いまの集合を入れ替える */
    const mp = prog.median;
    gl.useProgram(mp.p);
    gl.uniform1i(mp.u.uF, 0); gl.uniform1i(mp.u.uB, 1);
    gl.uniform2f(mp.u.uTexel, 1 / lw, 1 / lh);
    gl.uniform1f(mp.u.uRange, uRange);
    gl.uniform1f(mp.u.uFloatTex, uFloat);
    gl.viewport(0, 0, lw, lh);
    drawFbo(setFbo[iScratch][l], sets[iScratch][l].f, sets[iScratch][l].b);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    bindTex(0, sets[iCur][l].f);
    bindTex(1, sets[iCur][l].b);
    drawQuad();
    const tmp = iCur; iCur = iScratch; iScratch = tmp;
    gl.useProgram(flowProg.p);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawBuffers([gl.BACK]);
}

/* ============ 表示（毎フレーム・軽い） ============ */
function renderWarp(t) {
  const fl = floatTex();
  const p = prog.warp;
  gl.useProgram(p.p);
  gl.uniform1i(p.u.uA, 0); gl.uniform1i(p.u.uB, 1);
  gl.uniform1i(p.u.uF, 2); gl.uniform1i(p.u.uBk, 3);
  gl.uniform2f(p.u.uFlowTexel, 1 / Math.max(1, (W >> 1)), 1 / Math.max(1, (H >> 1)));
  gl.uniform1f(p.u.uT, t);
  gl.uniform1f(p.u.uStrength, mode() === "flow" ? strength() : 0);
  gl.uniform1f(p.u.uCut, cutFlag ? 1 : 0);
  gl.uniform1f(p.u.uRange, FLOW_RANGE);
  gl.uniform1f(p.u.uFloatTex, fl ? 1 : 0);
  gl.viewport(0, 0, W, H);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawBuffers([gl.BACK]);
  bindTex(0, frameTex[idxA]);
  bindTex(1, frameTex[idxB]);
  if (mode() === "flow") {
    bindTex(2, sets[iCur][0].f);
    bindTex(3, sets[iCur][0].b);
  } else {
    bindTex(2, zeroTex);
    bindTex(3, zeroTex);
  }
  drawQuad();
}

/* ============ 新しいフレームの検出 ============ */
function useRvfc() {
  if (typeof videoEl.requestVideoFrameCallback !== "function") return false;
  const cb = () => {
    rvfPending = true;
    try { videoEl.requestVideoFrameCallback(cb); } catch (_) {}
  };
  try { videoEl.requestVideoFrameCallback(cb); return true; } catch (_) { return false; }
}
function newFrameArrived() {
  if (rvfcOn) {
    if (rvfPending) { rvfPending = false; return true; }
    return false;
  }
  if (typeof videoEl.getVideoPlaybackQuality === "function") {
    const q = videoEl.getVideoPlaybackQuality();
    if (q && typeof q.totalVideoFrames === "number") {
      const f = q.totalVideoFrames;
      if (lastFrames >= 0 && f !== lastFrames) { lastFrames = f; return true; }
      lastFrames = f;
      return false;
    }
  }
  const ct = videoEl.currentTime || 0;
  const thr = Math.max(0.005, (pairInterval / 1000) * 0.6);
  if (lastCT >= 0 && Math.abs(ct - lastCT) >= thr) { lastCT = ct; return true; }
  lastCT = ct;
  return false;
}
let rvfcOn = false;

/* ============ メインループ（取り込みとフロー計算だけ） ============ */
function tick() {
  raf = 0;
  if (mode() === "off" || surfaces.size === 0) { stopLoop(); return; }
  const ready = !!core.videoReady && !!videoEl.src && !!(videoEl.videoWidth);
  if (!ready) { raf = requestAnimationFrame(tick); return; }
  if (!ensureSizes()) { raf = requestAnimationFrame(tick); return; }
  if (!videoEl.paused && newFrameArrived()) {
    if (captureFrame()) {
      if (mode() === "flow") {
        if (havePair) {
          const t = iPrev; iPrev = iCur; iCur = t; iScratch = 3 - iCur - iPrev;
          computeFlow();
        }
      }
      havePair = true;
    }
  }
  tune();
  raf = requestAnimationFrame(tick);
}
function tune() {
  const now = performance.now();
  if (document.hidden) { outStamps = []; lastTune = now; return; }   // 裏のタブでは測らない
  if (now - (outStamps[0] || 0) > 1000) outStamps = outStamps.filter(x => now - x < 1000);
  outFps = outStamps.length;
  srcFps = pairInterval > 0 ? Math.round(1000 / pairInterval) : 0;
  if (!lastTune) { lastTune = now; return; }
  if (now - lastTune < 2500) return;
  lastTune = now;
  if (outFps > 0 && outFps < 45 && quality > 0) {
    quality--; degraded = true; havePair = false; W = H = 0; ensureSizes();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaInterpDegraded"));
    notify();
  } else if (outFps > 0 && outFps < 45 && quality === 0 && mode() === "flow") {
    core.settings.frameInterp = "blend"; core.saveUserPrefs(); degraded = true; notify();
    if (typeof showToast === "function") window.Trk.play.showToast(tr("mediaInterpDegraded"));
  } else if (outFps >= 57 && quality < 2 && !degraded) {
    quality++; W = H = 0; ensureSizes(); notify();
  }
}
function startLoop() { if (!raf) raf = requestAnimationFrame(tick); }
function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

/* ============ 外へ出す窓口 ============ */
function attach(key, canvas) {
  if (!canvas) return false;
  const existed = surfaces.has(key);
  surfaces.set(key, canvas);
  if (!existed && mode() !== "off") {
    if (!tryInit()) return false;
    startLoop();
  }
  return true;
}
function detach(key) {
  surfaces.delete(key);
  if (!surfaces.size) { stopLoop(); havePair = false; }
}
function drawTo(ctx, w, h) {
  if (mode() === "off" || !ok2) return false;
  if (!w || !h || !W || !H) return false;
  if (!havePair) return false;
  if (!core.videoReady) return false;
  const now = performance.now();
  let t = (now - pairAt) / Math.max(8, pairInterval);
  t = Math.min(1, Math.max(0, t));
  /* プレーヤーの映像エリアと全画面表示が同時に出ていても、同じフレームなら描き直さない */
  const key = Math.round(now / 8);
  if (key !== lastRenderKey) { lastRenderKey = key; renderWarp(t); }
  try {
    const s = Math.min(w / W, h / H);
    const dw = W * s, dh = H * s;
    ctx.drawImage(glc, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } catch (_) { return false; }
  if (now - lastStampAt > 5) { lastStampAt = now; outStamps.push(now); }
  if (outStamps.length > 240) outStamps.shift();
  return true;
}
function setMode(m) {
  const next = MODES.includes(m) ? m : "off";
  if (core.settings.frameInterp === next) return;
  core.settings.frameInterp = next;
  core.saveUserPrefs();
  if (next !== "off" && surfaces.size) {
    if (tryInit()) { W = H = 0; havePair = false; quality = 2; degraded = false; ensureSizes(); startLoop(); }
  }
  notify();
}
function stats() {
  return {
    mode: mode(), supported: ok2 || tryInit(), blocked, srcFps, outFps,
    w: W, h: H, degraded, ready: havePair, levels, attached: surfaces.size
  };
}

window.TrkFrameInterp = Object.freeze({
  version: 1,
  modes: MODES.slice(),
  supported: () => !blocked && (ok2 || tryInit()),
  mode,
  setMode,
  attach,
  detach,
  drawTo,
  stats,
  reset() { W = H = 0; havePair = false; tinyPrev = null; if (ok2) ensureSizes(); },
  blockedReason: () => blocked,
  onChange(fn) { if (typeof fn === "function") watchers.add(fn); return () => watchers.delete(fn); }
});

/* 動画が変わったら作り直す */
core.on("beforeLoad", () => { havePair = false; blocked = false; });
core.on("mediaReady", () => { havePair = false; blocked = false; if (mode() !== "off" && surfaces.size) { W = H = 0; ensureSizes(); } });
addEventListener("DOMContentLoaded", () => { tryInit(); rvfcOn = useRvfc(); });

})();
/* ✅ frame-interp.js 完了 */

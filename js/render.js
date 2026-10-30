(() => {
  const core = window.Trk.core;
// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 統合版：描画・マスコット ============
   対応：MANUAL／TRUCK／ORBIT／STAGE／CATCH・体力・揺れ・キャラ登録・カウントダウン・HIDDEN/SUDDEN
         ステージ演出（stagefx.js）・ゴースト（extras.js）
   キャラクターのマスコットは registerMascot()（data.js）で登録されたものを描きます。
   初音ミクの絵は js/characters/miku.js にあり、このファイルには含まれていません。 */
"use strict";

const layout = () => window.Trk.data.LAYOUTS[core.settings.layout] || window.Trk.data.LAYOUTS.classic;
const vrmState = { loaded:false, credit:"" };      // vrm.js から更新されます
let toast = null;                                  // 画面上部の短い通知
let retryHoldAt = 0;                               // ` 長押し中の開始時刻（main.js が設定）
function showToast(text) { toast = { text, t:performance.now() }; }
/* キー案内：トラックモードはトラック用のキー、それ以外は叩くキー */
const hintKeys = slot => isTruck() ? truckKeysLabel(slot) : core.keysLabel(slot);
const isCatchMode = () => typeof isCatch === "function" && isCatch();
/* 画面の中央を使うモード（レイアウトの設定を使わない） */
const ownField = () => isOrbit() || isStage() || isCatchMode();

/* ---------- 図形の基本 ---------- */
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  core.ctx.beginPath(); core.ctx.moveTo(x + r, y);
  core.ctx.arcTo(x + w, y, x + w, y + h, r); core.ctx.arcTo(x + w, y + h, x, y + h, r);
  core.ctx.arcTo(x, y + h, x, y, r); core.ctx.arcTo(x, y, x + w, y, r); core.ctx.closePath();
}
function shapePath(x, y, r, shape) {
  if (shape === "diamond") {
    const s = r * 1.18; core.ctx.beginPath(); core.ctx.moveTo(x, y - s); core.ctx.lineTo(x + s, y); core.ctx.lineTo(x, y + s); core.ctx.lineTo(x - s, y); core.ctx.closePath();
  } else if (shape === "square") { const s = r * .92; rr(x - s, y - s, s * 2, s * 2, r * .22); }
  else { core.ctx.beginPath(); core.ctx.arc(x, y, r, 0, window.Trk.data.TAU); }
}
function drawLabel(text, x, y, size, color = "#fff") {
  core.ctx.font = `900 ${size}px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.lineJoin = "round";
  core.ctx.lineWidth = Math.max(3, size * .24); core.ctx.strokeStyle = "rgba(0,0,0,.6)"; core.ctx.strokeText(text, x, y);
  core.ctx.fillStyle = color; core.ctx.fillText(text, x, y);
}
function beatPulse(now) {
  if (!core.chartMeta.bpm) return 0;
  const b = 60000 / core.chartMeta.bpm, ph = ((((now - core.chartMeta.offset) % b) + b) % b) / b;
  return Math.max(0, 1 - ph * 3);
}
/* トラックモードの横スクロールでは、ドン＝上段・カッ＝下段 */
function notePos(L, lane, u) {
  const f = u / core.travelMs();
  if (L.vertical) return { x:L.centers[core.laneCol(lane)], y:L.hitY - f * (L.hitY - L.topY) };
  return { x:L.hitX + f * (L.endX - L.hitX), y:isTruck() ? truckRowY(L, lane) : L.laneY };
}
function hitPos(L, lane) {
  if (L.vertical) return { x:L.centers[core.laneCol(lane)], y:L.hitY };
  return { x:L.hitX, y:isTruck() ? truckRowY(L, lane) : L.laneY };
}
/* HIDDEN／SUDDEN：ノーツの見え方（0＝見えない、1＝そのまま）。f は判定位置で0、出現位置で1 */
function noteAlpha(u) {
  if (!core.settings.hidden && !core.settings.sudden) return 1;
  const f = u / core.travelMs(), both = core.settings.hidden && core.settings.sudden;
  const c = both ? Math.min(core.settings.cover, .45) : core.settings.cover;
  let a = 1;
  if (core.settings.hidden) a *= Math.max(0, Math.min(1, (f - c * .35) / (c * .65)));
  if (core.settings.sudden) a *= Math.max(0, Math.min(1, (1 - c - f) / .1));
  return a;
}

/* ---------- 背景（映像。音声だけの曲は曲パックの背景画像。暗さ・ぼかしは core.js の videoFilter） ---------- */
function drawChartArtwork(image) {
  // 1920×1080のステージ上で、タイマー直下・右端に160pxのジャケット枠を置く。
  // 枠の下端は通常レーンの上端より上に収め、どのレイアウトでもノーツに重ねない。
  const size = 160, frame = 4, right = 70, x = window.Trk.data.W - right - size - frame * 2, y = 76;
  const ix = x + frame, iy = y + frame;
  core.vctx.save();
  core.vctx.fillStyle = "rgba(0,0,0,.78)";
  core.vctx.fillRect(x, y, size + frame * 2, size + frame * 2);
  core.vctx.save(); core.vctx.beginPath(); core.vctx.rect(ix, iy, size, size); core.vctx.clip();
  // 既定表示では元画像を拡大せず、枠に収まるときだけ縮小する。
  const scale = Math.min(1, size / image.naturalWidth, size / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  core.vctx.drawImage(image, ix + (size - w) / 2, iy + (size - h) / 2, w, h);
  core.vctx.restore();
  core.vctx.strokeStyle = "rgba(255,255,255,.82)"; core.vctx.lineWidth = 2;
  core.vctx.strokeRect(ix, iy, size, size);
  core.vctx.restore();
}
function drawVideo() {
  core.vctx.clearRect(0, 0, window.Trk.data.W, window.Trk.data.H);
  if (!core.videoReady || core.settings.videoStyle === "off") return;
  const videoOn = !!(core.video.videoWidth && core.video.readyState >= 2);
  const image = core.bgImage && core.bgImage.naturalWidth ? core.bgImage : null;
  const hideImage = !!(image && core.settings.hideArtworkDuringChart && core.phase === "playing");
  const wallpaperImage = !!(image && core.settings.artWallpaperBg && !hideImage);
  const showVideo = videoOn && !wallpaperImage;
  const showImage = !!(image && !showVideo && !hideImage);
  const fullArt = !!(showImage && core.settings.artWallpaperBg);
  const chartArtwork = !!(showImage && core.phase === "playing" && !fullArt);
  const a = ownField() || fullArt ? { x:0, y:0, w:window.Trk.data.W, h:window.Trk.data.H } : layout().video;
  const zoom = Math.max(.5, Math.min(3, Number(core.settings.videoZoom) || 1));
  if (showVideo) {
    const s = Math.min(a.w / core.video.videoWidth, a.h / core.video.videoHeight) * zoom;
    const w = core.video.videoWidth * s, h = core.video.videoHeight * s;
    core.vctx.save(); core.vctx.beginPath(); core.vctx.rect(a.x, a.y, a.w, a.h); core.vctx.clip();
    core.vctx.drawImage(core.video, a.x + (a.w - w) / 2, a.y + (a.h - h) / 2, w, h);
    core.vctx.restore();
  } else if (showImage) {
    if (chartArtwork) drawChartArtwork(image);
    else {
      // Outside gameplay, preserve the source pixels and shrink only when needed to fit the video area.
      // The mystery setting keeps the former full-screen cover/crop behavior for people who prefer it.
      const s = fullArt
        ? Math.max(a.w / image.naturalWidth, a.h / image.naturalHeight) * zoom
        : Math.min(1, a.w / image.naturalWidth, a.h / image.naturalHeight);
      const w = image.naturalWidth * s, h = image.naturalHeight * s;
      core.vctx.save(); core.vctx.beginPath(); core.vctx.rect(a.x, a.y, a.w, a.h); core.vctx.clip();
      core.vctx.drawImage(image, a.x + (a.w - w) / 2, a.y + (a.h - h) / 2, w, h);
      core.vctx.restore();
    }
  }
}
function drawScanlines() { core.ctx.fillStyle = "rgba(0,0,0,.22)"; for (let y = 0; y < window.Trk.data.H; y += 4) core.ctx.fillRect(0, y, window.Trk.data.W, 2); }

/* ---------- レーン（MANUAL・TRUCK） ---------- */
function drawHorizontalField(L, now) {
  const g = core.skin().game, y = L.laneY, p = performance.now(), pulse = beatPulse(now);
  core.ctx.fillStyle = g.lane; rr(L.hitX - 110, y - 84, L.endX - L.hitX + 170, 168, 42); core.ctx.fill();
  if (isTruck()) {
    for (const lane of [0, 1]) {
      const ry = truckRowY(L, lane);
      core.ctx.fillStyle = g.track; rr(L.hitX, ry - 4, L.endX - L.hitX, 8, 4); core.ctx.fill();
      core.ctx.globalAlpha = .8; core.ctx.strokeStyle = core.laneColor(lane); core.ctx.lineWidth = 4;
      core.ctx.beginPath(); core.ctx.arc(L.hitX, ry, 34 + pulse * 3, 0, window.Trk.data.TAU); core.ctx.stroke(); core.ctx.globalAlpha = 1;
    }
    return;
  }
  core.ctx.fillStyle = g.track; rr(L.hitX, y - 5, L.endX - L.hitX, 10, 5); core.ctx.fill();
  const age = p - core.pressH.t;
  if (age < 120) {
    core.ctx.globalAlpha = Math.min(1, .5 * core.gameplayFxPower()) * (1 - age / 120); core.ctx.fillStyle = core.laneColor(core.pressH.lane);
    core.ctx.beginPath(); core.ctx.arc(L.hitX, y, 64, 0, window.Trk.data.TAU); core.ctx.fill(); core.ctx.globalAlpha = 1;
  }
  core.ctx.strokeStyle = g.ink;
  core.ctx.globalAlpha = .9; core.ctx.lineWidth = 6; core.ctx.beginPath(); core.ctx.arc(L.hitX, y, 46 + pulse * 5, 0, window.Trk.data.TAU); core.ctx.stroke();
  core.ctx.globalAlpha = .35; core.ctx.lineWidth = 2; core.ctx.beginPath(); core.ctx.arc(L.hitX, y, 62, 0, window.Trk.data.TAU); core.ctx.stroke();
  core.ctx.globalAlpha = 1;
}
function drawVerticalField(L, now) {
  const g = core.skin().game, p = performance.now(), lw = L.laneW, font = core.fontFamily();
  core.ctx.fillStyle = g.lane; rr(L.panel.x, L.panel.y, L.panel.w, L.panel.h, L.panel.r); core.ctx.fill();
  for (let col = 0; col < 2; col++) {
    const x = L.centers[col], c = core.laneColor(core.slotLane(col));
    core.ctx.globalAlpha = .10; core.ctx.fillStyle = c; core.ctx.fillRect(x - lw / 2, L.topY, lw, L.hitY - L.topY); core.ctx.globalAlpha = 1;
    core.ctx.strokeStyle = g.track; core.ctx.lineWidth = 2; core.ctx.strokeRect(x - lw / 2, L.topY, lw, L.hitY - L.topY);
    const age = p - core.pressFlash[col];
    if (age < 160) {
      const gr = core.ctx.createLinearGradient(0, L.hitY, 0, L.hitY - 460);
      gr.addColorStop(0, window.Trk.data.hexToRgba(c, Math.min(.95, .6 * core.gameplayFxPower()) * (1 - age / 160))); gr.addColorStop(1, window.Trk.data.hexToRgba(c, 0));
      core.ctx.fillStyle = gr; core.ctx.fillRect(x - lw / 2, L.hitY - 460, lw, 460);
    }
  }
  const left = L.centers[0] - lw / 2, right = L.centers[1] + lw / 2;
  core.ctx.fillStyle = g.ink; core.ctx.globalAlpha = .7 + .3 * beatPulse(now);
  core.ctx.fillRect(left, L.hitY - 4, right - left, 8); core.ctx.globalAlpha = 1;
  for (let col = 0; col < 2; col++) {
    const x = L.centers[col], lane = core.slotLane(col), c = core.laneColor(lane), down = p - core.pressFlash[col] < 90;
    rr(x - lw / 2 + 10, L.hitY + 30, lw - 20, 76, 16); core.ctx.fillStyle = down ? c : g.panel; core.ctx.fill();
    core.ctx.lineWidth = 3; core.ctx.strokeStyle = c; core.ctx.stroke();
    if (!core.settings.hideGameplayUI) {
      core.ctx.fillStyle = down ? "#fff" : g.ink; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle";
      core.ctx.font = `900 24px ${font}`; core.ctx.fillText(hintKeys(col), x, L.hitY + 56, lw - 30);
      core.ctx.font = `700 16px ${font}`; core.ctx.fillText(core.laneName(lane), x, L.hitY + 86);
    }
  }
}
function drawMeasureLines(L, now) {
  /* 小節線の間隔 m が負や 0 になると下のループが終わらない（F-33）。入口（validateChartData）でも弾くが、ここでも確かめる */
  if (!(core.chartMeta.bpm >= 1 && core.chartMeta.bpm <= 1000)) return;
  const m = 240000 / core.chartMeta.bpm, travel = core.travelMs(), g = core.skin().game;
  core.ctx.fillStyle = g.track;
  for (let k = Math.ceil((now - core.chartMeta.offset) / m); ; k++) {
    const u = core.chartMeta.offset + k * m - now; if (u > travel) break;
    const f = u / travel;
    if (L.vertical) { const y = L.hitY - f * (L.hitY - L.topY); core.ctx.fillRect(L.centers[0] - L.laneW / 2, y - 1, L.centers[1] - L.centers[0] + L.laneW, 2); }
    else { const x = L.hitX + f * (L.endX - L.hitX); core.ctx.fillRect(x - 1, L.laneY - 62, 2, 124); }
  }
}

/* ---------- ノーツ（MANUAL・TRUCK） ---------- */
function drawHNote(x, y, lane) {
  const g = core.skin().game, c = core.laneColor(lane), sh = core.noteShape(lane), img = noteImage(lane);
  if (g.glow) { core.ctx.shadowColor = c; core.ctx.shadowBlur = 26; }
  if (img) { core.ctx.drawImage(img, x - 42, y - 42, 84, 84); core.ctx.shadowBlur = 0; return; }
  shapePath(x, y, 36, sh); core.ctx.fillStyle = c; core.ctx.fill(); core.ctx.shadowBlur = 0;
  core.ctx.lineWidth = 5; core.ctx.strokeStyle = g.noteBorder; core.ctx.stroke();
  shapePath(x, y, 22, sh); core.ctx.lineWidth = 2; core.ctx.strokeStyle = "rgba(255,255,255,.45)"; core.ctx.stroke();
  if (!core.settings.hideGameplayUI) { const t = core.laneName(lane); drawLabel(t, x, y + 1, t.length > 2 ? 16 : 19); }
}
function drawVNote(x, y, lane, lw) {
  const g = core.skin().game, c = core.laneColor(lane), w = lw - 28, h = 32, img = noteImage(lane);
  if (g.glow) { core.ctx.shadowColor = c; core.ctx.shadowBlur = 22; }
  rr(x - w / 2, y - h / 2, w, h, 10); core.ctx.fillStyle = c; core.ctx.fill(); core.ctx.shadowBlur = 0;
  core.ctx.lineWidth = 3; core.ctx.strokeStyle = g.noteBorder; core.ctx.stroke();
  if (img) { core.ctx.drawImage(img, x - 26, y - 26, 52, 52); return; }
  shapePath(x - w / 2 + 22, y, 8, core.noteShape(lane)); core.ctx.fillStyle = g.noteBorder; core.ctx.fill();
  if (!core.settings.hideGameplayUI) drawLabel(core.laneName(lane), x + 8, y + 1, 18);
}
function drawKeyHintsH(L) {
  if (core.settings.hideGameplayUI || core.settings.autoPlay) return;
  const g = core.skin().game; let x = L.hitX - 100; const y = L.laneY + (L.commentary ? 108 : 122);
  core.ctx.font = `800 20px ${core.fontFamily()}`; core.ctx.textBaseline = "middle"; core.ctx.textAlign = "left";
  for (let slot = 0; slot < 2; slot++) {
    const lane = core.slotLane(slot), txt = `${hintKeys(slot)}  ${core.laneName(lane)}`, w = core.ctx.measureText(txt).width + 32;
    rr(x, y - 20, w, 40, 20); core.ctx.fillStyle = g.lane; core.ctx.fill();
    core.ctx.lineWidth = 3; core.ctx.strokeStyle = core.laneColor(lane); core.ctx.stroke();
    core.ctx.fillStyle = g.ink; core.ctx.fillText(txt, x + 16, y + 1);
    x += w + 14;
  }
}

/* ---------- 解説動画風パネル ---------- */
function drawCommentaryPanel() {
  const g = core.skin().game, p = performance.now(), font = core.fontFamily();
  core.ctx.fillStyle = g.panel; core.ctx.fillRect(0, 740, window.Trk.data.W, 340);
  core.ctx.fillStyle = core.laneColor(0); core.ctx.fillRect(0, 740, window.Trk.data.W / 2, 4); core.ctx.fillStyle = core.laneColor(1); core.ctx.fillRect(window.Trk.data.W / 2, 740, window.Trk.data.W / 2, 4);
  const capOn = core.caption && p - core.caption.t < core.CAPTION_MS;
  for (let i = 0; i < 2; i++) {
    const cx = i ? 292 : 112, c = core.laneColor(i);
    const cy = 880 - Math.max(0, 1 - (p - core.avatarHit[i]) / 200) * 10;
    core.ctx.fillStyle = c; core.ctx.beginPath(); core.ctx.arc(cx, cy, 58, 0, window.Trk.data.TAU); core.ctx.fill();
    core.ctx.lineWidth = 4; core.ctx.strokeStyle = g.noteBorder; core.ctx.stroke();
    for (const dx of [-20, 20]) {
      core.ctx.fillStyle = "#fff"; core.ctx.beginPath(); core.ctx.ellipse(cx + dx, cy - 10, 11, 14, 0, 0, window.Trk.data.TAU); core.ctx.fill();
      core.ctx.fillStyle = "#1b1b22"; core.ctx.beginPath(); core.ctx.arc(cx + dx + (i ? -3 : 3), cy - 8, 6, 0, window.Trk.data.TAU); core.ctx.fill();
    }
    core.ctx.fillStyle = "#1b1b22"; core.ctx.strokeStyle = "#1b1b22"; core.ctx.lineWidth = 4;
    if (capOn && core.caption.speaker === i) {
      core.ctx.beginPath(); core.ctx.ellipse(cx, cy + 24, 12, 4 + Math.abs(Math.sin(p / 70)) * 9, 0, 0, window.Trk.data.TAU); core.ctx.fill();
    } else { core.ctx.beginPath(); core.ctx.arc(cx, cy + 16, 12, .15 * Math.PI, .85 * Math.PI); core.ctx.stroke(); }
    const name = tr(i ? "speakerB" : "speakerA");
    core.ctx.font = `800 20px ${font}`; const tw = Math.max(100, core.ctx.measureText(name).width + 32);
    rr(cx - tw / 2, 962, tw, 38, 19); core.ctx.fillStyle = c; core.ctx.fill();
    core.ctx.fillStyle = "#fff"; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.fillText(name, cx, 982);
  }
  if (capOn) {
    const age = p - core.caption.t;
    core.ctx.globalAlpha = Math.max(0, Math.min(1, age / 120, (core.CAPTION_MS - age) / 300));
    core.ctx.font = `900 44px ${font}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.lineJoin = "round";
    const x = 1145, y = 808;
    core.ctx.lineWidth = 14; core.ctx.strokeStyle = "#111"; core.ctx.strokeText(core.caption.text, x, y, 1400);
    core.ctx.lineWidth = 7; core.ctx.strokeStyle = core.laneColor(core.caption.speaker ? 1 : 0); core.ctx.strokeText(core.caption.text, x, y, 1400);
    core.ctx.fillStyle = "#fff"; core.ctx.fillText(core.caption.text, x, y, 1400);
    core.ctx.globalAlpha = 1;
  }
}

/* ---------- ヒットエフェクト ---------- */
function drawEffects() {
  const k = core.gameplayFxPower(), p = performance.now(), g = core.skin().game;
  const life = 380 * (0.85 + 0.25 * Math.min(k, 2));
  core.effects = core.effects.filter(e => p - e.t < life);
  if (k <= 0) return;
  core.ctx.save();
  for (const e of core.effects) {
    const a = (p - e.t) / life, fade = 1 - a;
    core.ctx.globalCompositeOperation = "lighter";
    const rad = (60 + a * 50) * (0.8 + 0.4 * k);
    const gr = core.ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rad);
    gr.addColorStop(0, window.Trk.data.hexToRgba(e.c, Math.min(1, .55 * k) * fade));
    gr.addColorStop(.45, window.Trk.data.hexToRgba(e.c, Math.min(1, .25 * k) * fade));
    gr.addColorStop(1, window.Trk.data.hexToRgba(e.c, 0));
    core.ctx.fillStyle = gr; core.ctx.beginPath(); core.ctx.arc(e.x, e.y, rad, 0, window.Trk.data.TAU); core.ctx.fill();
    if (e.kind === "perfect" && a < .35) {
      core.ctx.fillStyle = `rgba(255,255,255,${Math.min(.9, .45 * k) * (1 - a / .35)})`;
      core.ctx.beginPath(); core.ctx.arc(e.x, e.y, 30 + a * 40, 0, window.Trk.data.TAU); core.ctx.fill();
    }
    core.ctx.globalCompositeOperation = "source-over";
    core.ctx.globalAlpha = Math.min(1, fade * (0.55 + 0.45 * Math.min(k, 1.5)));
    core.ctx.strokeStyle = e.c; core.ctx.lineWidth = (8 * fade + 2) * (0.7 + 0.3 * k);
    core.ctx.shadowColor = e.c; core.ctx.shadowBlur = 12 * k;
    core.ctx.beginPath(); core.ctx.arc(e.x, e.y, 44 + a * 70 * (0.8 + 0.2 * k), 0, window.Trk.data.TAU); core.ctx.stroke();
    core.ctx.shadowBlur = 0;
    if (e.kind === "perfect") {
      const count = Math.round(8 + 4 * k), size = 4 + 2 * Math.min(k, 2);
      core.ctx.fillStyle = g.perfect;
      for (let i = 0; i < count; i++) {
        const ang = i / count * window.Trk.data.TAU + e.seed, r = 60 + a * 90 * (0.8 + 0.2 * k);
        core.ctx.fillRect(e.x + Math.cos(ang) * r - size / 2, e.y + Math.sin(ang) * r - size / 2, size, size);
      }
    }
    core.ctx.globalAlpha = 1;
  }
  core.ctx.restore();
}
/* タイミングメーター：タイミングで叩くモード（MANUAL・ORBIT・STAGE）だけ。AUTOでは出さない */
function drawErrorMeter() {
  if (!core.settings.errorMeter || core.settings.autoPlay || !["manual", "orbit", "stage"].includes(core.settings.playMode)) return;
  const w = core.windows(), g = core.skin().game, cx = 960, cy = 64, half = 200, p = performance.now();
  core.ctx.fillStyle = "rgba(0,0,0,.35)"; rr(cx - half - 10, cy - 14, half * 2 + 20, 28, 14); core.ctx.fill();
  core.ctx.globalAlpha = .3; core.ctx.fillStyle = g.good; core.ctx.fillRect(cx - half, cy - 4, half * 2, 8);
  const pw = half * w.perfect / w.good; core.ctx.globalAlpha = .55; core.ctx.fillStyle = g.perfect; core.ctx.fillRect(cx - pw, cy - 4, pw * 2, 8);
  core.ctx.globalAlpha = 1; core.ctx.fillStyle = "#fff"; core.ctx.fillRect(cx - 1.5, cy - 12, 3, 24);
  for (const e of core.errors) {
    const age = (p - e.t) / 4000; if (age > 1) continue;
    const x = cx + Math.max(-1, Math.min(1, e.d / w.good)) * half;
    core.ctx.globalAlpha = 1 - age; core.ctx.fillStyle = e.kind === "perfect" ? g.perfect : g.good; core.ctx.fillRect(x - 2, cy - 11, 4, 22);
  }
  core.ctx.globalAlpha = 1;
}

/* ---------- カウントダウン（3・2・1・GO!） ---------- */
function drawCountdown() {
  const p = performance.now(), L = layout();
  let text = null, age = 0, go = false;
  if (leadIn && core.phase === "playing") {
    const k = Math.floor((p - leadIn.start) / leadIn.iv);
    if (k >= 0 && k < 3) { text = String(3 - k); age = (p - leadIn.start - k * leadIn.iv) / leadIn.iv; }
  } else if (goAt && p - goAt < 650) { text = tr("go"); age = (p - goAt) / 650; go = true; }
  if (!text) return;
  let x = 960, y = 640;
  if (isOrbit()) y = 300;
  else if (isStage()) y = 520;
  else if (isCatchMode()) y = 460;
  else if (L.commentary) y = 400;
  else if (L.vertical) { x = (L.centers[0] + L.centers[1]) / 2; y = 520; }
  const s = (go ? 1.1 : 1) * (1.25 - .25 * Math.min(1, age * 3));
  core.ctx.save();
  core.ctx.globalAlpha = Math.max(0, 1 - age * .85);
  core.ctx.translate(x, y); core.ctx.scale(s, s);
  core.ctx.font = `900 ${go ? 190 : 220}px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle"; core.ctx.lineJoin = "round";
  core.ctx.lineWidth = 18; core.ctx.strokeStyle = "rgba(0,0,0,.65)"; core.ctx.strokeText(text, 0, 0);
  core.ctx.fillStyle = go ? core.skin().game.perfect : "#ffffff"; core.ctx.fillText(text, 0, 0);
  core.ctx.restore();
}

/* ---------- 通知・リトライの長押しバー ---------- */
function drawToastAndRetry() {
  const p = performance.now();
  if (toast && p - toast.t < 1400) {
    const a = Math.min(1, (1400 - (p - toast.t)) / 300);
    core.ctx.save(); core.ctx.globalAlpha = a;
    core.ctx.font = `800 26px ${core.fontFamily()}`; core.ctx.textAlign = "center"; core.ctx.textBaseline = "middle";
    const tw = core.ctx.measureText(toast.text).width + 40;
    rr(960 - tw / 2, 102, tw, 44, 22); core.ctx.fillStyle = "rgba(0,0,0,.6)"; core.ctx.fill();
    core.ctx.fillStyle = "#fff"; core.ctx.fillText(toast.text, 960, 125);
    core.ctx.restore();
  }
  if (retryHoldAt) {
    const k = Math.min(1, (p - retryHoldAt) / 350);
    core.ctx.save();
    rr(760, 1000, 400, 14, 7); core.ctx.fillStyle = "rgba(0,0,0,.55)"; core.ctx.fill();
    rr(760, 1000, 400 * k, 14, 7); core.ctx.fillStyle = core.skin().ui["--ui-accent"]; core.ctx.fill();
    core.ctx.restore();
  }
}

/* ---------- マスコット：オレンジ相棒（オリジナル・GPL） ---------- */
function drawBuddy(x, y, st) {
  const p = st.p, r = 60;
  core.ctx.fillStyle = "#c4500f"; rr(x - 36, y + r - 12, 24, 22, 9); core.ctx.fill(); rr(x + 12, y + r - 12, 24, 22, 9); core.ctx.fill();
  const grd = core.ctx.createRadialGradient(x - 22, y - 28, 8, x, y, r * 1.15);
  grd.addColorStop(0, "#ffb27a"); grd.addColorStop(1, "#ff6a1f");
  rr(x - r, y - r, r * 2, r * 2, r * .6); core.ctx.fillStyle = grd; core.ctx.fill();
  core.ctx.lineWidth = 4; core.ctx.strokeStyle = "#7a2e08"; core.ctx.stroke();
  core.ctx.lineCap = "round"; core.ctx.lineWidth = 9; core.ctx.strokeStyle = "#2b2b33";
  core.ctx.beginPath(); core.ctx.arc(x, y - 4, r + 9, Math.PI * 1.1, Math.PI * 1.9); core.ctx.stroke();
  for (const s of [-1, 1]) {
    const cx = x + s * (r + 5);
    rr(cx - 13, y - 24, 26, 46, 10); core.ctx.fillStyle = "#2b2b33"; core.ctx.fill();
    rr(cx - 7, y - 16, 14, 30, 6); core.ctx.fillStyle = core.laneColor(s < 0 ? 0 : 1); core.ctx.fill();
  }
  core.ctx.fillStyle = "#2a1408"; core.ctx.strokeStyle = "#2a1408"; core.ctx.lineWidth = 5;
  if (st.sad) {
    for (const s of [-1, 1]) {
      const ex = x + s * 22, ey = y - 8;
      core.ctx.beginPath(); core.ctx.moveTo(ex + 8 * s, ey - 7); core.ctx.lineTo(ex - 6 * s, ey); core.ctx.lineTo(ex + 8 * s, ey + 7); core.ctx.stroke();
    }
  } else {
    const eh = (p % 3400) < 120 ? 3 : st.happy ? 10 : 16;
    for (const s of [-1, 1]) { rr(x + s * 22 - 5, y - 10 - eh / 2, 10, eh, 3); core.ctx.fill(); }
  }
  core.ctx.globalAlpha = .35; core.ctx.fillStyle = "#ff3b6b";
  for (const s of [-1, 1]) { core.ctx.beginPath(); core.ctx.ellipse(x + s * 38, y + 10, 10, 6, 0, 0, window.Trk.data.TAU); core.ctx.fill(); }
  core.ctx.globalAlpha = 1;
  core.ctx.fillStyle = "#2a1408"; core.ctx.strokeStyle = "#2a1408"; core.ctx.lineWidth = 4;
  if (st.talking) { core.ctx.beginPath(); core.ctx.ellipse(x, y + 20, 9, 3 + Math.abs(Math.sin(p / 70)) * 8, 0, 0, window.Trk.data.TAU); core.ctx.fill(); }
  else if (st.sad) { core.ctx.beginPath(); core.ctx.arc(x, y + 30, 10, 1.15 * Math.PI, 1.85 * Math.PI); core.ctx.stroke(); }
  else { core.ctx.beginPath(); core.ctx.arc(x, y + 12, st.happy ? 14 : 10, .15 * Math.PI, .85 * Math.PI); core.ctx.stroke(); }
}
const BUDDY_DEF = { draw:drawBuddy, top:-74, shadowY:74, border:"#ff7a2f" };

/* ---------- 吹き出し（共通） ---------- */
function drawBubble(anchorX, by, maxW, border, tailRight) {
  const g = core.skin().game, p = performance.now(), age = p - core.caption.t;
  core.ctx.globalAlpha = Math.max(0, Math.min(1, age / 120, (core.CAPTION_MS - age) / 300));
  core.ctx.font = `800 24px ${core.fontFamily()}`;
  const tw = Math.min(maxW, core.ctx.measureText(core.caption.text).width), bw = tw + 44, bh = 56;
  const bx = Math.max(20, anchorX - bw);
  rr(bx, by, bw, bh, 18); core.ctx.fillStyle = g.panel; core.ctx.fill();
  core.ctx.lineWidth = 3; core.ctx.strokeStyle = border; core.ctx.stroke();
  core.ctx.beginPath();
  if (tailRight) { core.ctx.moveTo(bx + bw - 2, by + 14); core.ctx.lineTo(bx + bw + 24, by + 28); core.ctx.lineTo(bx + bw - 2, by + 42); }
  else { const tx = Math.min(bx + bw - 40, anchorX - 54); core.ctx.moveTo(tx, by + bh - 2); core.ctx.lineTo(tx + 12, by + bh + 22); core.ctx.lineTo(tx + 24, by + bh - 2); }
  core.ctx.closePath(); core.ctx.fill();
  core.ctx.fillStyle = g.ink; core.ctx.textAlign = "left"; core.ctx.textBaseline = "middle";
  core.ctx.fillText(core.caption.text, bx + 22, by + bh / 2 + 1, tw);
  core.ctx.globalAlpha = 1;
}
function drawCornerCredit(text) {
  const g = core.skin().game;
  core.ctx.globalAlpha = .75; core.ctx.font = `600 15px ${core.fontFamily()}`;
  core.ctx.textAlign = "right"; core.ctx.textBaseline = "alphabetic"; core.ctx.fillStyle = g.ink;
  core.ctx.fillText(text, window.Trk.data.W - 20, window.Trk.data.H - 16, 700);
  core.ctx.globalAlpha = 1;
}

/* ---------- マスコット全体 ---------- */
function drawVrmOverlay() {
  if (!vrmState.loaded) return;
  const R = window.Trk.data.VRM_RECT[core.settings.layout] || window.Trk.data.VRM_RECT.classic, talking = !!core.caption && performance.now() - core.caption.t < core.CAPTION_MS;
  core.ctx.save();
  if (talking && core.settings.layout !== "commentary") drawBubble(R.x + 40, R.y + 50, 640, core.skin().ui["--ui-accent"], true);
  if (vrmState.credit) drawCornerCredit(vrmState.credit);
  core.ctx.restore();
}
/* 🩷 MMD：3Dは #mmdCanvas が描くので、ここは吹き出しとクレジットだけ */
function drawMmdOverlay() {
  const info = window.TrkMMD && window.TrkMMD.model && window.TrkMMD.model();
  if (!info) return;
  const R = window.Trk.data.VRM_RECT[core.settings.layout] || window.Trk.data.VRM_RECT.classic, talking = !!core.caption && performance.now() - core.caption.t < core.CAPTION_MS;
  core.ctx.save();
  if (talking && core.settings.layout !== "commentary") drawBubble(R.x + 40, R.y + 50, 640, core.skin().ui["--ui-accent"], true);
  const credit = String(core.settings.mmdCredit || "").trim();
  if (credit) drawCornerCredit(tr("mmdCreditPrefix") + " " + credit);
  core.ctx.restore();
}
function drawMascot() {
  const m = core.activeMascot(); if (!m) return;
  if (m === "vrm") { drawVrmOverlay(); return; }
  if (m === "mmd") { drawMmdOverlay(); return; }
  const def = m === "buddy" ? BUDDY_DEF : window.Trk.data.MASCOT_DEFS[m];
  if (!def) return;
  const P = window.Trk.data.MASCOT_POS[core.settings.layout] || window.Trk.data.MASCOT_POS.classic, p = performance.now();
  const hitAge = p - Math.max(core.avatarHit[0], core.avatarHit[1]);
  const st = { p, sad: p - core.lastMissT < 700, happy: hitAge < 300, talking: !!core.caption && p - core.caption.t < core.CAPTION_MS };
  const x = P.x, y = P.y - Math.max(0, 1 - hitAge / 180) * 14 + Math.sin(p / 420) * 4;
  core.ctx.save();
  core.ctx.fillStyle = "rgba(0,0,0,.3)"; core.ctx.beginPath(); core.ctx.ellipse(P.x, P.y + (def.shadowY || 74), 48, 10, 0, 0, window.Trk.data.TAU); core.ctx.fill();
  core.ctx.save();
  try { def.draw(x, y, st); } catch (e) { console.error(e); }
  core.ctx.restore();
  if (st.talking && core.settings.layout !== "commentary") {
    drawBubble(x + 60, y + (def.top || -74) - 70, core.settings.layout === "center" ? 460 : 720, def.border || core.skin().ui["--ui-accent"], false);
  }
  if (typeof def.credit === "function") { const c = def.credit(); if (c) drawCornerCredit(String(c)); }
  core.ctx.restore();
}

/* ---------- 1フレームの描画 ----------
   ORBIT：道と判定点（modes.js）／STAGE：舞台演出＋縦レーン（stagefx.js・stage.js）／CATCH：道路とトラック（catch.js） */
function tiltPivot(L) {
  if (isOrbit()) return { x:ORBIT_CX, y:ORBIT_CY };
  if (isStage()) return { x:STAGE.cx, y:STAGE.hitY };
  if (isCatchMode()) return { x:960, y:CATCH.lineY };
  return lanePivot(L);
}
function drawGame(now) {
  const L = layout(), g = core.skin().game, mode = core.settings.playMode;
  core.ctx.clearRect(0, 0, window.Trk.data.W, window.Trk.data.H);
  if (g.scanlines) drawScanlines();
  if (L.commentary && !ownField()) drawCommentaryPanel();
  if (mode === "stage" && typeof drawStageBackdrop === "function") drawStageBackdrop(now);
  const tilt = laneTilt(now);
  core.ctx.save();
  if (tilt) { const c = tiltPivot(L); core.ctx.translate(c.x, c.y); core.ctx.rotate(tilt); core.ctx.translate(-c.x, -c.y); }
  if (mode === "orbit") drawOrbitField(now);
  else if (mode === "stage") drawStageField(now);
  else if (mode === "catch") drawCatchField(now);
  else {
    const truckMode = mode === "truck";
    if (L.vertical) drawVerticalField(L, now); else drawHorizontalField(L, now);
    if (truckMode) drawLaneTint(L);
    drawMeasureLines(L, now);
    const travel = core.travelMs(); let end = core.nextIdx;
    while (end < core.chart.length && core.chart[end].time - now <= travel) end++;
    for (let i = end - 1; i >= core.nextIdx; i--) {
      const n = core.chart[i]; if (n.judged) continue;
      const u = n.time - now, a = noteAlpha(u);
      if (a <= 0) continue;
      const pos = notePos(L, n.lane, u);
      core.ctx.globalAlpha = a;
      if (L.vertical) drawVNote(pos.x, pos.y, n.lane, L.laneW); else drawHNote(pos.x, pos.y, n.lane);
      core.ctx.globalAlpha = 1;
    }
    if (truckMode) drawTruck(L, now);
    if (!L.vertical) drawKeyHintsH(L);
  }
  drawEffects();
  core.ctx.restore();
  drawErrorMeter(); drawMascot(); drawLives(); drawCountdown(); drawToastAndRetry();
  if (typeof drawFxOverlay === "function") drawFxOverlay(now);          // AP・FC表示、カーテンコール
  if (typeof drawExtrasOverlay === "function") drawExtrasOverlay(now);  // 👻 ゴースト
}
function updateProgress() {
  const d = core.video.duration || 0, ct = core.video.currentTime || 0;
  core.$("progress").style.width = d ? `${ct / d * 100}%` : "0";
  core.$("clock").textContent = `${core.fmtTime(ct)} / ${core.fmtTime(d)}`;
  if (!core.seekDragging && d) core.$("seekBar").value = Math.round(ct / d * 1000);
}
function loop() {
  requestAnimationFrame(loop);
  if (core.phase === "title") return;
  tickClock();                                   // 🕹️ 無音検知・カウントダウンは毎フレーム動かす
  const now = gameTime();
  if (core.phase === "playing" && !core.settings.autoPlay) {
    if (core.settings.playMode === "truck") truckJudge(now);
    else if (core.settings.playMode === "catch") catchJudge(now);
  }
  if (core.phase === "playing") sweepMisses(now);   // AUTOの自動判定もここから（game.js）。ORBIT・STAGEは入力で判定
  /* 🪶 軽量化：ここから下（描くところ）だけを間引く。判定は音声の時計なので、描く回数を減らしてもズレません。
     🎯「ゲーム優先」（settings.liteGameFull）のときは、ここで止めずに今までどおりのフレームレートで描きます */
  if (typeof TrkLite === "object" && !TrkLite.allowGame(performance.now())) return;
  drawVideo(); drawGame(now); updateProgress();
}
/* ✅ render.js 完了 */

/* 公開名は据え置き（名前空間の移行の途中。window.Trk.* への移動は後の段階で行う） */
window.beatPulse = beatPulse;
/* 後から読み込まれるファイルがこの名前を差し替える（window.drawVideo の代入）。内部の呼び出しにも届くよう、アクセサで同じ束縛を指す */
Object.defineProperty(window, "drawVideo", { configurable:true, get:() => drawVideo, set:v => { drawVideo = v; } });
window.hitPos = hitPos;
window.layout = layout;
window.loop = loop;
window.noteAlpha = noteAlpha;
window.ownField = ownField;
Object.defineProperty(window, "retryHoldAt", { configurable:true, get:() => retryHoldAt, set:v => { retryHoldAt = v; } });
window.rr = rr;
window.showToast = showToast;
Object.defineProperty(window, "toast", { configurable:true, get:() => toast, set:v => { toast = v; } });
window.vrmState = vrmState;
/* 領域（window.Trk.play）：公開名の正規の場所。旧名（window.X）は別名として残す（利用者の決定） */
window.Trk = window.Trk || {};
window.Trk.play = Object.assign(window.Trk.play || {}, { PLAY_KEYS, autoPlay, chartKeyOf, currentAcc, currentScore, endGame, handleInput, judgeNote, pauseGame, rateKey, renderRecords, resumeGame, runUnranked, runWasPaused:window.runWasPaused, saveRecords, seekTo, songRec, startGame, sweepMisses, tickClock, toTitle, beatPulse, hitPos, layout, loop, noteAlpha, ownField, rr, showToast, vrmState });
Object.defineProperty(window.Trk.play, "gameTime", { configurable:true, get:() => gameTime, set:v => { gameTime = v; } });
Object.defineProperty(window.Trk.play, "goAt", { configurable:true, get:() => goAt, set:v => { goAt = v; } });
Object.defineProperty(window.Trk.play, "leadIn", { configurable:true, get:() => leadIn, set:v => { leadIn = v; } });
Object.defineProperty(window.Trk.play, "pausedInLeadIn", { configurable:true, get:() => pausedInLeadIn, set:v => { pausedInLeadIn = v; } });
Object.defineProperty(window.Trk.play, "records", { configurable:true, get:() => records, set:v => { records = v; } });
Object.defineProperty(window.Trk.play, "runShort", { configurable:true, get:() => runShort, set:v => { runShort = v; } });
Object.defineProperty(window.Trk.play, "showJudge", { configurable:true, get:() => showJudge, set:v => { showJudge = v; } });
Object.defineProperty(window.Trk.play, "drawVideo", { configurable:true, get:() => drawVideo, set:v => { drawVideo = v; } });
Object.defineProperty(window.Trk.play, "retryHoldAt", { configurable:true, get:() => retryHoldAt, set:v => { retryHoldAt = v; } });
Object.defineProperty(window.Trk.play, "toast", { configurable:true, get:() => toast, set:v => { toast = v; } });
})();

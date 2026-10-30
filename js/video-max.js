// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! video-max.js — 🖥 動画の全画面表示（最大化ビューア）
   ・📺 TVドックの ⛶（＝「次の曲」の右のボタン）と、メディアプレーヤーの
     「全画面で表示」から開きます。
   ・いま流れている動画を、画面いっぱいに映します（縦横比は変えません）。
     音声だけの曲は、曲パックの背景画像を映します。
   ・閉じる：✕ ／ ESC ／ 黒いところのクリック。音の設定は変えません。
   ・ゲームが始まったら自動で閉じます（判定や記録には影響しません）。
   ============================================================================ */
"use strict";
(() => {
  const core = window.Trk.core;

/* ============ 文章（接頭辞 videoMax…） ============ */
Object.assign(TEXT.ja, {
  videoMaxTitle: "🖥 動画の全画面表示",
  videoMaxToast: "🖥 動画を全画面で表示します",
  videoMaxClose: "✕ 閉じる",
  videoMaxPlay: "▶ 再生", videoMaxPause: "⏸ 一時停止",
  videoMaxFull: "⛶ ブラウザーの全画面", videoMaxExitFull: "⛶ ブラウザーの全画面を終了",
  videoMaxNoVideo: "まだ動画がありません。曲を選ぶと、ここに全画面で映します。",
  videoMaxHint: "左右を長押し：巻き戻し／早送り（徐々に加速）　動画をクリック：再生／一時停止　←→：10秒　ホイール：ポインターの位置で拡大・縮小（100〜500%）　ドラッグ：表示位置を動かす　🔍：100%に戻す　⛶：ブラウザーの全画面　ESC か ✕ で閉じます",
  videoMaxZoomReset: "🔍 拡大率 {n}%（クリックで100%に戻す）",
  videoMaxZoomHint: "ホイールで拡大・縮小（1回あたりの量は ⚙ 設定 → 🎨 見た目）"
});
Object.assign(TEXT.en, {
  videoMaxTitle: "🖥 Full-screen video",
  videoMaxToast: "🖥 Showing the video full screen",
  videoMaxClose: "✕ Close",
  videoMaxPlay: "▶ Play", videoMaxPause: "⏸ Pause",
  videoMaxFull: "⛶ Browser full screen", videoMaxExitFull: "⛶ Exit browser full screen",
  videoMaxNoVideo: "No video yet. Pick a song and it plays here full screen.",
  videoMaxHint: "Hold left / right: rewind / forward (accelerates) · Click the video: play / pause · ←→: 10 s · Wheel: zoom at the pointer (100–500%) · Drag: move the view · 🔍: back to 100% · ⛶: browser full screen · ESC or ✕ closes",
  videoMaxZoomReset: "🔍 Zoom {n}% (click to go back to 100%)",
  videoMaxZoomHint: "Wheel to zoom in and out (the step size is in Settings → 🎨 Appearance)"
});
Object.assign(TEXT.zh, {
  videoMaxTitle: "🖥 视频全屏显示",
  videoMaxToast: "🖥 正在全屏显示视频",
  videoMaxClose: "✕ 关闭",
  videoMaxPlay: "▶ 播放", videoMaxPause: "⏸ 暂停",
  videoMaxFull: "⛶ 浏览器全屏", videoMaxExitFull: "⛶ 退出浏览器全屏",
  videoMaxNoVideo: "还没有视频。选择歌曲后会在这里全屏播放。",
  videoMaxHint: "长按左侧／右侧：快退／快进（逐渐加速）　点击视频：播放／暂停　←→：10秒　滚轮：以指针位置为中心放大／缩小（100〜500%）　拖动：移动画面　🔍：回到100%　⛶：浏览器全屏　按 ESC 或 ✕ 关闭",
  videoMaxZoomReset: "🔍 缩放 {n}%（点击回到100%）",
  videoMaxZoomHint: "用滚轮放大／缩小（每次的量在 ⚙ 设置 → 🎨 外观）"
});
Object.assign(TEXT.ko, {
  videoMaxTitle: "🖥 영상 전체 화면",
  videoMaxToast: "🖥 영상을 전체 화면으로 보여 줍니다",
  videoMaxClose: "✕ 닫기",
  videoMaxPlay: "▶ 재생", videoMaxPause: "⏸ 일시정지",
  videoMaxFull: "⛶ 브라우저 전체 화면", videoMaxExitFull: "⛶ 브라우저 전체 화면 끝내기",
  videoMaxNoVideo: "아직 영상이 없습니다. 곡을 고르면 여기 전체 화면으로 보여 줍니다.",
  videoMaxHint: "왼쪽／오른쪽 길게 누르기: 되감기／빨리 감기 (점점 가속)　영상을 클릭: 재생／일시정지　←→: 10초　휠: 포인터 위치를 중심으로 확대·축소 (100〜500%)　드래그: 화면 이동　🔍: 100%로 되돌리기　⛶: 브라우저 전체 화면　ESC 또는 ✕ 로 닫습니다",
  videoMaxZoomReset: "🔍 확대율 {n}% (클릭하면 100%로)",
  videoMaxZoomHint: "휠로 확대·축소 (1회당 양은 ⚙ 설정 → 🎨 모양)"
});

const videoEl = document.getElementById("video");
if (!videoEl) return;

let root = null, canvas = null, ctx = null, stage = null;
let topBar = null, titleNode = null, playNode = null, fsNode = null, closeNode = null;
let noteNode = null, hintNode = null, seekNode = null;   /* ⏩ 長押しシークの中央表示（trk188） */
let subsNode = null;   /* 💬 字幕オーバーレイ（trk169・映像は canvas 描画なので字幕は DOM で重ねる） */
let raf = 0, isOn = false, playedByUs = false, idleTimer = 0;
const watchers = new Set();

/* core.js のグローバル（let 宣言）は、読み込み前・初期化前だと参照できないので必ず守る */
const songTitle = () => { try { const song = core.currentSong; return (song && (typeof songDisplayTitle === "function" ? songDisplayTitle(song) : (song.title || song.name))) || ""; } catch (_) { return ""; } };
const hasFrames = () => { try { return !!videoEl.videoWidth && videoEl.readyState >= 2 && !!videoEl.src; } catch (_) { return false; } };
const packImage = () => { try { return (core.bgImage && core.bgImage.naturalWidth) ? core.bgImage : null; } catch (_) { return null; } };

function notify() { for (const fn of [...watchers]) { try { fn(isOn); } catch (_) {} } }
function setI18n(node, key) { if (!node) return; node.textContent = tr(key); node.dataset.i18n = key; }

/* ---- ブラウザーの全画面（対応しているときだけ） ---- */
const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsCurrent = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function toggleBrowserFullscreen() {
  try {
    if (fsCurrent()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); }
      return;
    }
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!req) return;
    const p = req.call(root);
    if (p && p.catch) p.catch(() => {});   /* 許可されなくても、アプリ内の全画面はそのまま使える */
  } catch (_) {}
}
function syncFsLabel() {
  if (!fsNode) return;
  const on = !!fsCurrent();
  fsNode.classList.toggle("selected", on);
  fsNode.textContent = "⛶";
  fsNode.title = tr(on ? "videoMaxExitFull" : "videoMaxFull");
  fsNode.setAttribute("aria-label", fsNode.title);
  fsNode.setAttribute("aria-pressed", String(on));
}

/* ---- 操作まわり ---- */
function togglePlay() {
  try {
    if (videoEl.paused) { const p = videoEl.play(); if (p && p.catch) p.catch(() => {}); }
    else videoEl.pause();
    playedByUs = false;   /* 自分で操作したあとは、閉じるときに勝手に止めない */
  } catch (_) {}
}
function seekBy(delta) {
  try {
    if (!Number.isFinite(videoEl.duration)) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, (videoEl.currentTime || 0) + delta));
  } catch (_) {}
}

/* ---- ⏩ 全画面の左右長押しシーク（trk188）----
   映像エリア（stage）の左半分＝巻き戻し、右半分＝早送り。負の playbackRate は使わず
   currentTime の移動だけで行う。450ms 後に 2 秒/回で開始し、250ms ごとに、8 回（＝2 秒）
   ごとに 2 秒/回ずつ加速して 20 秒/回で頭打ち。上部のボタンは長押し対象外。 */
let holdPointer = null, holdStartX = 0, holdStartY = 0, holdDirection = 0;
let holdTimer = 0, holdTicks = 0, suppressHoldClick = false;
function holdSeekStep(ticks) {
  return Math.min(20, 2 + Math.floor(Math.max(0, ticks) / 8) * 2);
}
function stopHoldSeek() {
  clearTimeout(holdTimer); holdTimer = 0;
  holdPointer = null;
  if (seekNode) seekNode.hidden = true;
}
function tickHoldSeek() {
  if (!isOn || holdPointer === null || document.hidden) { stopHoldSeek(); return; }
  suppressHoldClick = true;   /* 離したときに出る click で画面を閉じさせない */
  const seconds = holdSeekStep(holdTicks++);
  seekBy(holdDirection * seconds);
  playedByUs = false;
  if (seekNode) { seekNode.hidden = false; seekNode.textContent = `${holdDirection < 0 ? "⏪ −" : "⏩ +"}${seconds}s`; }
  pokeChrome();
  holdTimer = setTimeout(tickHoldSeek, 250);
}
function startHoldSeek(e) {
  if (!isOn) return;
  if (holdPointer !== null) { stopHoldSeek(); suppressHoldClick = true; return; }   /* 2本目：増やさない */
  suppressHoldClick = false;
  if (e.isPrimary === false || (e.button != null && e.button !== 0) || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) return;
  const rect = stage.getBoundingClientRect();
  holdPointer = e.pointerId; holdStartX = e.clientX; holdStartY = e.clientY;
  holdDirection = e.clientX < rect.left + rect.width / 2 ? -1 : 1;
  holdTicks = 0;
  holdTimer = setTimeout(tickHoldSeek, 450);
}
function moveHoldSeek(e) {
  if (e.pointerId !== holdPointer) return;
  if (Math.hypot(e.clientX - holdStartX, e.clientY - holdStartY) > 24) {   /* 指を大きく動かしたら中止 */
    suppressHoldClick = true; stopHoldSeek();
  }
}
function endHoldSeek(e) {
  if (e.pointerId === holdPointer) stopHoldSeek();
}
function pokeChrome() {
  if (!root) return;
  root.classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (isOn && root) root.classList.add("idle"); }, 2600);
}

/* ---- 🔍 拡大・縮小（trk212） ----
   全画面の動画を、**マウスホイール**（ポインターの位置を中心）・**ドラッグ**（つまんで移動）・
   **2本指のピンチ**で拡大・縮小する。100%＝動画の全体が入る大きさ（従来どおり）、上限は500%。
   trk214：ドラッグ中・ピンチ中はポインターを捕まえて、画面の外へ出てもずらしを続ける。
   ピンチのあとに1本だけ残ったときは、そのまま「つまんで移動」に切り替える。
   1ホイールあたりの量は ⚙ 設定 → 🎨 見た目 →「全画面の拡大・縮小（ホイール1回）」の
   2%／5%（既定）／10%。表示位置（ずらし）は「画面の幅・高さに対する割合」で持つので、
   ウィンドウの大きさが変わっても同じ見え方になる。 */
const ZOOM_MIN = 1, ZOOM_MAX = 5;                 /* 100%〜500% */
const ZOOM_STEP_CHOICES = [2, 5, 10];             /* 設定に出す3択（%） */
const WHEEL_NOTCH = 100;                          /* 1ノッチとみなすホイールの量（px 相当） */
const DRAG_START = 6;                             /* これ以上動いたら「つまんで移動」（px） */
let zoomChip = null;                              /* 上部の「🔍 125%」ボタン（押すと100%へ） */
const zoomView = { zoom:1, panX:0, panY:0 };      /* panX/panY は画面の幅・高さに対する割合 */
let wheelAcc = 0;                                 /* ホイールの積み上げ（トラックパッドの細かい動き用） */
let dragState = null, pinchState = null;
const zoomPointers = new Map();
const capturedPointers = new Set();               /* trk214：捕まえているポインター（画面の外でも追う） */

/* trk214：ドラッグ・ピンチが始まったら**そのポインターを stage に捕まえる**。
   捕まえている間は、指やマウスが動画の外（ウィンドウの外）へ出ても pointermove /
   pointerup が stage に届くので、ずらしが途中で止まらない。
   押しただけ（長押しシーク）のときは捕まえない＝外へ出たら長押しシークを止める
   従来の動き（trk188）をそのまま残す。 */
function captureZoomPointer(id) {
  if (id == null || capturedPointers.has(id)) return;
  if (!stage || typeof stage.setPointerCapture !== "function") return;
  try { stage.setPointerCapture(id); capturedPointers.add(id); } catch (_) {}
}
function releaseZoomPointer(id) {
  if (!capturedPointers.has(id)) return;
  capturedPointers.delete(id);
  try { if (stage && typeof stage.releasePointerCapture === "function") stage.releasePointerCapture(id); } catch (_) {}
}

/* 設定の値を 2／5／10 のどれかに寄せる（未設定・壊れた値は既定の5） */
function zoomStepPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  let best = 5, gap = Infinity;
  for (const step of ZOOM_STEP_CHOICES) { const d = Math.abs(step - n); if (d < gap) { gap = d; best = step; } }
  return best;
}
/* 画面に対する、映像を「全体が入る」大きさで映したときの縦横の割合（contain） */
function containSize(aspect, frameAspect) {
  if (!(aspect > 0) || !(frameAspect > 0)) return { w:1, h:1 };
  return aspect >= frameAspect ? { w:1, h:frameAspect / aspect } : { w:aspect / frameAspect, h:1 };
}
/* ずらしてよい量の上限（covered＝画面に対する映像の大きさ）。
   映像が枠より大きいときは端に黒が出ない範囲、小さいときは枠からはみ出さない範囲。 */
function panLimit(covered) {
  const n = Number(covered);
  const free = Math.abs(1 - (Number.isFinite(n) ? n : 1)) / 2;   /* 大きさが分からないときは動かさない */
  return Number.isFinite(free) ? free : 0;
}
function clampPan(value, covered) {
  const limit = panLimit(covered);
  const n = Number(value);
  return Math.max(-limit, Math.min(limit, Number.isFinite(n) ? n : 0));
}
/* ホイールの量を「ノッチ」に直して積み上げる。細かい動き（トラックパッド）も
   合計が1ノッチぶんになったら1段動かす。1回のイベントで動かすのは4段まで。 */
function accumulateWheel(acc, delta) {
  const d = Number(delta);
  const base = Number.isFinite(acc) ? acc : 0;
  if (!Number.isFinite(d) || !d) return { notches:0, acc:base };
  const next = (base === 0 || Math.sign(base) === Math.sign(d)) ? base + d : d;
  const raw = Math.trunc(next / WHEEL_NOTCH);
  const notches = Math.max(-4, Math.min(4, raw)) || 0;   /* -0 を 0 にそろえる */
  return { notches, acc:next - raw * WHEEL_NOTCH };
}
/* ポインターの位置 (fx, fy)＝画面に対する 0〜1 を動かさずに倍率を変える */
function zoomAround(view, next, fx, fy, size) {
  const before = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(view && view.zoom) || ZOOM_MIN));
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(next) || ZOOM_MIN));
  const k = zoom / before;
  const x = Number.isFinite(fx) ? fx : .5, y = Number.isFinite(fy) ? fy : .5;
  /* 100% まで戻したら、ずらしも 0 に戻す（100%＝従来の全体表示を保証する） */
  if (zoom <= ZOOM_MIN + 1e-9) return { zoom, panX:0, panY:0 };
  const panX = (x - .5) - k * ((x - .5) - (Number(view && view.panX) || 0));
  const panY = (y - .5) - k * ((y - .5) - (Number(view && view.panY) || 0));
  const cw = (size && size.w > 0 ? size.w : 1) * zoom, ch = (size && size.h > 0 ? size.h : 1) * zoom;
  return { zoom, panX:clampPan(panX, cw), panY:clampPan(panY, ch) };
}

const videoAspectNow = () => {
  try { return videoEl.videoWidth > 0 && videoEl.videoHeight > 0 ? videoEl.videoWidth / videoEl.videoHeight : 0; } catch (_) { return 0; }
};
const frameAspectNow = () => {
  const w = (canvas && canvas.clientWidth) || window.innerWidth || 1;
  const h = (canvas && canvas.clientHeight) || window.innerHeight || 1;
  return h > 0 ? w / h : 1;
};
const zoomSizeNow = frameAspect => containSize(videoAspectNow(), frameAspect || frameAspectNow());
function syncZoomChip() {
  const zoomed = zoomView.zoom > 1.0001;
  if (root) root.classList.toggle("zoomed", zoomed);
  if (!zoomChip) return;
  const pct = Math.round(zoomView.zoom * 100);
  const text = `🔍 ${pct}%`;
  if (zoomChip.textContent !== text) zoomChip.textContent = text;
  zoomChip.classList.toggle("selected", zoomed);
  /* 100% のときは操作の説明、拡大中は「押すと100%」の説明にする */
  const label = zoomed ? tr("videoMaxZoomReset", { n:pct }) : tr("videoMaxZoomHint");
  if (zoomChip.title !== label) { zoomChip.title = label; zoomChip.setAttribute("aria-label", label); }
}
function resetZoomView() {
  zoomView.zoom = ZOOM_MIN; zoomView.panX = 0; zoomView.panY = 0; wheelAcc = 0;
  syncZoomChip();
}
/* 表示位置を、いまの映像と画面の大きさに合わせて直す（ウィンドウの大きさが変わったとき） */
function reclampZoomView(frameAspect) {
  const size = zoomSizeNow(frameAspect);
  zoomView.panX = clampPan(zoomView.panX, size.w * zoomView.zoom);
  zoomView.panY = clampPan(zoomView.panY, size.h * zoomView.zoom);
}
function zoomTo(next, fx, fy) {
  if (!hasFrames()) return false;
  const before = zoomView.zoom;
  const out = zoomAround(zoomView, next, fx, fy, zoomSizeNow());
  if (Math.abs(out.zoom - before) < 1e-6) return false;
  zoomView.zoom = out.zoom; zoomView.panX = out.panX; zoomView.panY = out.panY;
  syncZoomChip();
  return true;
}
/* 画面に対するポインターの位置（0〜1） */
function zoomFraction(clientX, clientY) {
  const rect = stage ? stage.getBoundingClientRect() : null;
  const w = (rect && rect.width) || window.innerWidth || 1;
  const h = (rect && rect.height) || window.innerHeight || 1;
  return {
    fx: ((Number(clientX) || 0) - (rect ? rect.left : 0)) / (w > 0 ? w : 1),
    fy: ((Number(clientY) || 0) - (rect ? rect.top : 0)) / (h > 0 ? h : 1)
  };
}
function wheelDeltaValue(e) {
  /* deltaMode: 0=px、1=行（Firefox のマウスは 3行＝1ノッチ）、2=ページ。
     34 は「3行で1ノッチ」になるように選んだ値（3×34＝102）。 */
  const unit = e.deltaMode === 1 ? 34 : e.deltaMode === 2 ? WHEEL_NOTCH : 1;
  return (Number(e.deltaY) || 0) * unit;
}
function onZoomWheel(e) {
  if (!isOn) return;
  e.preventDefault();                       /* ページのスクロールやブラウザーのズームへ渡さない */
  const res = accumulateWheel(wheelAcc, wheelDeltaValue(e));
  wheelAcc = res.acc;
  if (!res.notches || !hasFrames()) return;
  const step = zoomStepPercent(core.settings && core.settings.videoMaxWheelStep) / 100;
  const { fx, fy } = zoomFraction(e.clientX, e.clientY);
  /* ホイールを上（画面では deltaY < 0）へ回すと拡大 */
  if (zoomTo(zoomView.zoom - res.notches * step, fx, fy)) pokeChrome();
}
function startZoomGesture(e) {
  if (!isOn) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;   /* 左ボタンだけ */
  zoomPointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (zoomPointers.size === 2) {
    const [a, b] = [...zoomPointers.values()];
    pinchState = { dist:Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom:zoomView.zoom };
    dragState = null;
    if (stage) stage.classList.remove("panning");
    for (const id of zoomPointers.keys()) captureZoomPointer(id);   /* trk214：2本とも捕まえる */
    stopHoldSeek();                 /* 2本指：長押しシークは止める */
    suppressHoldClick = true;       /* ピンチのあとの click で再生／停止しない */
    return;
  }
  if (zoomPointers.size > 2) return;
  dragState = { id:e.pointerId, x:e.clientX, y:e.clientY, panX:zoomView.panX, panY:zoomView.panY, active:false };
}
function moveZoomGesture(e) {
  if (!zoomPointers.has(e.pointerId)) return;
  zoomPointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pinchState && zoomPointers.size >= 2) {
    const [a, b] = [...zoomPointers.values()];
    const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const { fx, fy } = zoomFraction((a.x + b.x) / 2, (a.y + b.y) / 2);
    if (zoomTo(pinchState.zoom * (dist / pinchState.dist), fx, fy)) pokeChrome();
    return;
  }
  if (!dragState || dragState.id !== e.pointerId || !hasFrames()) return;
  const dx = e.clientX - dragState.x, dy = e.clientY - dragState.y;
  if (!dragState.active) {
    if (zoomView.zoom <= 1.0001) return;          /* 100% では動かせない（左右長押しシークを邪魔しない） */
    if (Math.hypot(dx, dy) < DRAG_START) return;
    dragState.active = true;
    captureZoomPointer(e.pointerId);              /* trk214：掴んだら画面の外へ出ても追う */
    stopHoldSeek();
    suppressHoldClick = true;                     /* 離したときの click で再生／停止しない */
    if (stage) stage.classList.add("panning");
  }
  const rect = stage ? stage.getBoundingClientRect() : { width:1, height:1 };
  const size = zoomSizeNow();
  zoomView.panX = clampPan(dragState.panX + dx / Math.max(1, rect.width), size.w * zoomView.zoom);
  zoomView.panY = clampPan(dragState.panY + dy / Math.max(1, rect.height), size.h * zoomView.zoom);
  pokeChrome();
}
function endZoomGesture(e) {
  if (!zoomPointers.has(e.pointerId)) return;
  const wasPinching = !!pinchState;
  zoomPointers.delete(e.pointerId);
  releaseZoomPointer(e.pointerId);
  if (zoomPointers.size < 2) pinchState = null;
  if (dragState && dragState.id === e.pointerId) {
    if (dragState.active && stage) stage.classList.remove("panning");
    dragState = null;
  }
  /* trk214：ピンチのあとに1本だけ残ったら、そのまま「つまんで移動」に切り替える
     （指を置き直さなくても、残った1本でずらせる）。 */
  if (wasPinching && zoomPointers.size === 1 && zoomView.zoom > 1.0001) {
    const [id, p] = [...zoomPointers.entries()][0];
    dragState = { id, x:p.x, y:p.y, panX:zoomView.panX, panY:zoomView.panY, active:true };
    if (stage) stage.classList.add("panning");
    captureZoomPointer(id);
    suppressHoldClick = true;                     /* 離したときの click で再生／停止しない */
  }
}
function clearZoomGesture() {
  for (const id of [...capturedPointers]) releaseZoomPointer(id);
  zoomPointers.clear(); dragState = null; pinchState = null;
  if (stage) stage.classList.remove("panning");
}
/* 動画を描く位置（ズームとずらしを反映）。100%・ずらし無しなら従来と同じ中央。 */
function zoomFrame(W, H) {
  if (!hasFrames()) return null;
  const size = containSize(videoAspectNow(), W / H);
  const z = zoomView.zoom;
  const baseW = size.w * W, baseH = size.h * H;
  const w = baseW * z, h = baseH * z;
  return {
    zoom:z, size, baseX:(W - baseW) / 2, baseY:(H - baseH) / 2, w, h,
    x:(W - w) / 2 + zoomView.panX * W, y:(H - h) / 2 + zoomView.panY * H,
    panX:zoomView.panX, panY:zoomView.panY
  };
}

/* ---- 描画 ---- */
function paint() {
  raf = requestAnimationFrame(paint);
  if (!ctx || !canvas) return;
  const w = canvas.clientWidth || window.innerWidth || 0, h = canvas.clientHeight || window.innerHeight || 0;
  if (!w || !h) return;
  const dpr = typeof TrkLite === "object" ? TrkLite.pixelRatio(2) : Math.min(2, window.devicePixelRatio || 1);   // 🪶 軽量化は描画解像度の上限
  const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  /* 🪶 軽量化：全屏の canvas 書き出しは負荷が大きいので、メニューと同じ上限で間引く
     （描かないフレームは前の絵が残るだけ＝コマ落ちに見える。曲の再生・操作はそのまま） */
  if (typeof TrkLite === "object" && !TrkLite.allow("max", performance.now())) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  let drew = false;
  /* 🔍 trk212：動画は 100%＝全体が入る大きさ。ズーム・ずらしを掛けた位置に描く */
  reclampZoomView(W / H);
  const frame = zoomFrame(W, H);
  const zoomed = !!(frame && (frame.zoom > 1.0001 || frame.panX || frame.panY));
  /* ✨ フレーム補完（js/frame-interp.js）：設定がオンのときは、作った中間フレームを映す */
  const fi = (typeof settings !== "undefined" && core.settings.frameInterp !== "off" && window.TrkFrameInterp) ? window.TrkFrameInterp : null;
  if (fi) {
    /* FI は「画面いっぱい（contain）」で描くので、同じ大きさで描かせてから
       ctx の変換で拡大・移動を掛ける（描き直しを増やさない） */
    try {
      if (zoomed) {
        ctx.save();
        ctx.setTransform(frame.zoom, 0, 0, frame.zoom,
          frame.x - frame.zoom * frame.baseX, frame.y - frame.zoom * frame.baseY);
      }
      drew = fi.drawTo(ctx, W, H);
    } catch (_) { drew = false; }
    finally { if (zoomed) { try { ctx.restore(); } catch (_) {} } }
  }
  if (!drew && frame) {
    try { ctx.drawImage(videoEl, frame.x, frame.y, frame.w, frame.h); drew = true; } catch (_) {}
  }
  if (!drew) {
    const img = packImage();
    if (img) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      try { ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh); drew = true; } catch (_) {}
    }
  }
  if (noteNode) noteNode.hidden = drew;
  const t = songTitle();
  if (titleNode) {
    if (t) { if (titleNode.textContent !== t) { titleNode.textContent = t; titleNode.dataset.i18n = ""; } }
    else if (titleNode.dataset.i18n !== "videoMaxTitle") setI18n(titleNode, "videoMaxTitle");
  }
  const key = videoEl.paused ? "videoMaxPlay" : "videoMaxPause";
  if (playNode && playNode.dataset.i18n !== key) setI18n(playNode, key);
  /* 💬 字幕（trk169）：いまの再生位置のキューをオーバーレイに出す。文言は subtitles.js（読み込みはメディアプレーヤー側） */
  if (subsNode) {
    const api = window.Trk.subtitles;
    const texts = api ? api.currentTexts(videoEl.currentTime || 0).join("\n") : "";
    if (subsNode.textContent !== texts) subsNode.textContent = texts;
    subsNode.hidden = !texts;
  }
}
function startLoop() { if (!raf) raf = requestAnimationFrame(paint); }
function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

/* ---- 開く・閉じる ---- */
function openMax() {
  if (!root) build();
  if (!root || isOn) return false;
  if (window.TrkSafeMode && TrkSafeMode()) return false;
  isOn = true; playedByUs = false;
  resetZoomView();   /* 🔍 trk212：開くたびに 100%（全体が入る大きさ）から */
  if (window.TrkFrameInterp) { try { window.TrkFrameInterp.attach("max", canvas); } catch (_) {} }
  root.hidden = false;
  document.body.classList.add("videoMaxOpen");
  try {
    if (videoEl.paused && videoEl.src) { const p = videoEl.play(); if (p && p.catch) p.catch(() => {}); playedByUs = true; }
  } catch (_) {}
  startLoop(); pokeChrome(); syncFsLabel();
  if (closeNode) closeNode.focus();
  notify();
  if (typeof showToast === "function") window.Trk.play.showToast(tr("videoMaxToast"));
  return true;
}
function closeMax() {
  if (!isOn) return;
  isOn = false;
  stopHoldSeek();   /* ⏩ 長押しシークも止める（trk188） */
  clearZoomGesture();   /* 🔍 trk212：つまんで移動の途中でも後始末する */
  if (window.TrkFrameInterp) { try { window.TrkFrameInterp.detach("max"); } catch (_) {} }
  stopLoop();
  clearTimeout(idleTimer);
  if (root) { root.hidden = true; root.classList.remove("idle"); }
  document.body.classList.remove("videoMaxOpen");
  if (fsCurrent()) { try { const exit = document.exitFullscreen || document.webkitExitFullscreen; if (exit) { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } } catch (_) {} }
  if (playedByUs) { try { videoEl.pause(); } catch (_) {} }
  playedByUs = false;
  notify();
}
function toggleMax() { if (isOn) closeMax(); else openMax(); }

/* ---- 組み立て ---- */
function applyTexts() {
  if (!root) return;
  syncZoomChip();   /* 🔍 trk212：拡大率のボタン（言語が変わっても読み上げを合わせる） */
  if (!songTitle()) setI18n(titleNode, "videoMaxTitle");
  setI18n(noteNode, "videoMaxNoVideo");
  setI18n(hintNode, "videoMaxHint");
  if (playNode) setI18n(playNode, videoEl.paused ? "videoMaxPlay" : "videoMaxPause");
  if (closeNode) { closeNode.title = tr("videoMaxClose"); closeNode.setAttribute("aria-label", closeNode.title); }
  root.setAttribute("aria-label", tr("videoMaxTitle"));
  syncFsLabel();
}
function build() {
  root = core.el("div", "videoMaxView"); root.id = "videoMaxView"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");

  topBar = core.el("div", "videoMaxTop");
  titleNode = core.el("strong", "videoMaxTitle", tr("videoMaxTitle")); titleNode.dataset.i18n = "videoMaxTitle";
  playNode = core.el("button", "videoMaxBtn", tr("videoMaxPlay")); playNode.type = "button"; playNode.dataset.i18n = "videoMaxPlay";
  fsNode = core.el("button", "videoMaxBtn videoMaxFs", "⛶"); fsNode.type = "button";
  fsNode.hidden = !fsSupported();
  zoomChip = core.el("button", "videoMaxBtn videoMaxZoom", "🔍 100%"); zoomChip.type = "button";
  zoomChip.addEventListener("click", () => { resetZoomView(); pokeChrome(); });   /* 🔍 trk212：押すと100%へ */
  closeNode = core.el("button", "videoMaxBtn videoMaxClose", "✕"); closeNode.type = "button";
  const tools = core.el("div", "videoMaxTools"); tools.append(playNode, zoomChip, fsNode, closeNode);
  topBar.append(titleNode, tools);

  stage = core.el("div", "videoMaxStage");
  canvas = document.createElement("canvas"); canvas.className = "videoMaxCanvas";
  noteNode = core.el("p", "videoMaxNote hint", tr("videoMaxNoVideo")); noteNode.dataset.i18n = "videoMaxNoVideo";
  subsNode = core.el("div", "videoMaxSubs"); subsNode.hidden = true;   /* 💬 クリックは通す（pointer-events:none） */
  seekNode = core.el("div", "videoMaxSeek"); seekNode.hidden = true;   /* ⏩ 長押しの方向と秒数（trk188） */
  stage.append(canvas, subsNode, noteNode);
  stage.append(seekNode);

  hintNode = core.el("p", "videoMaxHint hint", tr("videoMaxHint")); hintNode.dataset.i18n = "videoMaxHint";

  root.append(topBar, stage, hintNode);
  document.body.append(root);

  ctx = canvas.getContext("2d");
  /* ⏩ 左右長押しシーク（trk188）。pointerdown でいきなり pointer capture は取らない：
     短タップの click target が stage になり「黒いところをクリックで閉じる」と衝突し得るため、
     window 側の pointerup / pointerleave で掃除する。
     🔍 trk214：**ドラッグ・ピンチが始まったときだけ**（captureZoomPointer）捕まえる。
     そのときは suppressHoldClick が立っているので click の取り違えは起きない。 */
  stage.addEventListener("pointerdown", startHoldSeek);
  stage.addEventListener("pointermove", moveHoldSeek);
  /* 🔍 trk212：ホイールで拡大・縮小（ポインターの位置が中心）、つまんで移動、2本指のピンチ。
     passive:false ＝ preventDefault でページのスクロールへ渡さない。 */
  stage.addEventListener("wheel", onZoomWheel, { passive:false });
  stage.addEventListener("pointerdown", startZoomGesture);
  stage.addEventListener("pointermove", moveZoomGesture);
  stage.addEventListener("pointerleave", () => { if (holdPointer !== null) { suppressHoldClick = true; stopHoldSeek(); } });
  stage.addEventListener("contextmenu", e => e.preventDefault());
  stage.addEventListener("click", e => {
    if (!suppressHoldClick || e.detail === 0) return;   /* e.detail===0 はキーボード等の click なので通す */
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  stage.addEventListener("lostpointercapture", e => capturedPointers.delete(e.pointerId));
  addEventListener("pointerup", endHoldSeek);
  addEventListener("pointerup", endZoomGesture);
  addEventListener("pointercancel", endZoomGesture);
  addEventListener("blur", clearZoomGesture);
  addEventListener("pointercancel", e => {
    if (e.pointerId === holdPointer) { suppressHoldClick = true; stopHoldSeek(); }
  });
  addEventListener("blur", stopHoldSeek);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopHoldSeek(); });
  videoEl.addEventListener("emptied", stopHoldSeek);
  videoEl.addEventListener("loadstart", stopHoldSeek);
  canvas.addEventListener("click", togglePlay);
  stage.addEventListener("click", e => {
    /* 動画の外側（黒いところ）をクリックしたら閉じる。動画が無いときは画面のどこでも閉じる */
    if (e.target === stage || e.target === noteNode) { closeMax(); return; }
    if (e.target === canvas && !hasFrames()) closeMax();
  });
  topBar.addEventListener("click", e => { if (e.target === topBar) closeMax(); });
  playNode.addEventListener("click", togglePlay);
  closeNode.addEventListener("click", () => closeMax());
  fsNode.addEventListener("click", toggleBrowserFullscreen);
  root.addEventListener("pointermove", pokeChrome);
  root.addEventListener("pointerdown", pokeChrome);
  document.addEventListener("fullscreenchange", syncFsLabel);
  document.addEventListener("webkitfullscreenchange", syncFsLabel);
  applyTexts();
}

/* ---- キー（開いている間だけ、先に受け取る） ---- */
addEventListener("keydown", e => {
  if (!isOn || window.Trk.overlay.is("study")) return;
  if (e.code === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeMax(); return; }
  if (e.code === "Space") { e.preventDefault(); e.stopImmediatePropagation(); togglePlay(); return; }
  if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
    e.preventDefault(); e.stopImmediatePropagation();
    seekBy(e.code === "ArrowRight" ? 10 : -10);
  }
}, true);

/* ゲームが始まったら閉じる（判定や記録には影響しない） */
on("songSelected", stopHoldSeek);   /* ⏩ 曲が替わったら長押しシークを止める（trk188） */
on("songSelected", resetZoomView);  /* 🔍 trk212：曲が替わったら 100% に戻す（長押しシークは止める） */
on("phase", p => { if (p === "playing" && isOn) closeMax(); });
on("language", () => { if (isOn || root) applyTexts(); });

window.TrkVideoMax = Object.freeze({
  version: 1,
  open: openMax,
  close: closeMax,
  toggle: toggleMax,
  isOpen: () => isOn,
  onChange(fn) { if (typeof fn === "function") watchers.add(fn); return () => watchers.delete(fn); }
});

})();
/* ✅ video-max.js 完了 */

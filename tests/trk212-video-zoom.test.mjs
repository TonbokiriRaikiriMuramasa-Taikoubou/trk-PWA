// SPDX-License-Identifier: GPL-3.0-or-later
/* 🔍 trk212：全画面表示の動画を、マウスホイールで拡大・縮小する。
   ・ホイール上＝拡大、下＝縮小。**ポインターの位置を中心**に拡大・縮小する（指している所が動かない）
   ・1ホイールあたり 2%／5%（既定）／10%（⚙ 設定 → 🎨 見た目）
   ・拡大中はドラッグで表示位置を動かせる（クリック中の「つまんで移動」）。タッチは2本指のピンチ
   ・100%＝全体が入る大きさ（従来どおり）、上限 500%。上部の 🔍 ボタンで 100% に戻す
   ここで確かめるのは、DOM も実ブラウザーも要らない部分（純関数・関数の中身・配線）。
   実機のホイール・ドラッグ・ピンチの感触は手で確かめること。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const src = read("js/video-max.js");
const css = read("css/style.css");
const html = read("index.html");
const coreSrc = read("js/core.js");
const mainSrc = read("js/main.js");
const swSrc = read("sw.js");

/* video-max.js の「🔍 拡大・縮小」ブロックだけを取り出して VM で動かす
   （関数の定義だけなら DOM は要らない。呼ぶ関数に合わせてスタブを渡す） */
function sandbox(extra = {}) {
  const code = src.slice(src.indexOf("/* ---- 🔍 拡大・縮小（trk212） ----"), src.indexOf("/* ---- 描画 ---- */"));
  assert.ok(code.length > 1000, "the zoom block is extractable");
  const classes = new Set();
  const captures = [];
  const box = {
    window: {}, console, Math, Number, Map,
    isOn: true, root: null, zoomChip: null, suppressHoldClick: false,
    canvas: { clientWidth: 1600, clientHeight: 1000 },
    videoEl: { videoWidth: 1600, videoHeight: 900 },
    hasFrames: () => true,
    pokeChrome() { box.pokes++; }, pokes: 0,
    stopHoldSeek() { box.stops++; }, stops: 0,
    tr: key => key,
    core: { settings: { videoMaxWheelStep: 5 } },
    stage: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }),
      classList: { add: c => classes.add(c), remove: c => classes.delete(c) },
      /* trk214：pointer capture の受け皿（呼ばれた順に記録する） */
      setPointerCapture(id) { captures.push(["set", id]); },
      releasePointerCapture(id) { captures.push(["release", id]); }
    },
    ...extra,
  };
  vm.createContext(box);
  vm.runInContext(`${code}
;globalThis.api = { zoomStepPercent, containSize, panLimit, clampPan, accumulateWheel, zoomAround,
  zoomView, onZoomWheel, zoomFrame, resetZoomView, zoomTo, startZoomGesture, moveZoomGesture, endZoomGesture, clearZoomGesture };`, box);
  return { box, api: box.api, classes, captures };
}
const pointer = (id, x, y, extra = {}) => ({ pointerId: id, clientX: x, clientY: y, pointerType: "mouse", button: 0, isPrimary: id === 1, ...extra });

/* ---------- 1. 1ホイールあたりの量（2／5／10・既定5） ---------- */
test("trk212: the wheel step falls back to the 2 / 5 / 10 choices with 5 as the default", () => {
  const { api } = sandbox();
  assert.equal(api.zoomStepPercent(2), 2);
  assert.equal(api.zoomStepPercent(5), 5);
  assert.equal(api.zoomStepPercent(10), 10);
  assert.equal(api.zoomStepPercent(undefined), 5, "未設定は既定の5");
  assert.equal(api.zoomStepPercent("abc"), 5);
  assert.equal(api.zoomStepPercent(NaN), 5);
  assert.equal(api.zoomStepPercent(7), 5, "近いほうへ寄せる");
  assert.equal(api.zoomStepPercent(9), 10);
  assert.equal(api.zoomStepPercent(100), 10);
  assert.equal(api.zoomStepPercent(-3), 2);
  /* 設定そのもの（core.js）は 1〜20 の数値で持ち、既定は5 */
  assert.match(coreSrc, /videoMaxWheelStep: num\(prefs\.videoMaxWheelStep, 1, 20, 5\)/);
  assert.match(coreSrc, /settings\.videoMaxWheelStep = 5;/, "映像のリセットで5へ戻る");
});

/* ---------- 2. 100% は「全体が入る大きさ」（従来どおり） ---------- */
test("trk212: 100% keeps the old whole-frame fit, and the pan is limited to the edges", () => {
  const { api } = sandbox();
  /* 16:9 の映像を 16:9 の画面へ：ぴったり */
  assert.deepEqual({ ...api.containSize(16 / 9, 16 / 9) }, { w: 1, h: 1 });
  /* 4:3 の映像を 16:9 の画面へ：左右に黒（高さいっぱい） */
  const tall = api.containSize(4 / 3, 16 / 9);
  assert.ok(Math.abs(tall.w - 0.75) < 1e-9 && tall.h === 1);
  /* 21:9 の映像を 16:9 の画面へ：上下に黒 */
  const wide = api.containSize(21 / 9, 16 / 9);
  assert.equal(wide.w, 1);
  assert.ok(Math.abs(wide.h - (16 / 9) / (21 / 9)) < 1e-9);
  /* ずらせる量：ぴったりなら0、2倍なら画面の半分、半分なら4分の1 */
  assert.equal(api.panLimit(1), 0);
  assert.equal(api.panLimit(2), 0.5);
  assert.equal(api.panLimit(0.5), 0.25);
  assert.equal(api.panLimit(NaN), 0, "大きさが分からないときは動かさない");
  assert.equal(api.clampPan(9, 2), 0.5);
  assert.equal(api.clampPan(-9, 2), -0.5);
  assert.equal(api.clampPan(NaN, 2), 0);
  /* 描く位置：100%・ずらし無しは中央（従来と同じ） */
  const frame = api.zoomFrame(1600, 1000);
  assert.equal(frame.zoom, 1);
  assert.equal(frame.x, 0);
  assert.ok(Math.abs(frame.y - 50) < 1e-6, "上下に黒（900px の映像を 1000px の枠の中央へ）");
  assert.ok(Math.abs(frame.w - 1600) < 1e-6 && Math.abs(frame.h - 900) < 1e-6);
});

/* ---------- 3. ポインターの位置を中心に拡大する ---------- */
test("trk212: zooming keeps the pointed-at spot under the pointer", () => {
  const { api } = sandbox();
  const size = { w: 1, h: 0.5625 };
  const out = api.zoomAround({ zoom: 1, panX: 0, panY: 0 }, 2, 0.25, 0.5, size);
  assert.equal(out.zoom, 2);
  assert.ok(Math.abs(out.panX - 0.25) < 1e-9, "左寄りを指したら、その点が残るように右へずれる");
  /* 指した点の「映像の中の位置」が変わっていないこと（fx' = 0.5 + pan + zoom * u） */
  const u = (0.25 - 0.5 - 0) / 1;
  assert.ok(Math.abs(0.5 + out.panX + out.zoom * u - 0.25) < 1e-9);
  /* 中心ならずれない */
  const center = api.zoomAround({ zoom: 1, panX: 0, panY: 0 }, 1.5, 0.5, 0.5, size);
  assert.equal(center.panX, 0);
  assert.equal(center.panY, 0);
  /* 上限・下限 */
  assert.equal(api.zoomAround({ zoom: 1, panX: 0, panY: 0 }, 99, 0.5, 0.5, size).zoom, 5);
  assert.equal(api.zoomAround({ zoom: 3, panX: 0, panY: 0 }, 0.2, 0.5, 0.5, size).zoom, 1);
  /* 100% まで戻したら、ずらしも 0 に戻る（100%＝従来の全体表示） */
  const back = api.zoomAround({ zoom: 1.5, panX: 0.3, panY: 0.2 }, 1, 0.2, 0.5, size);
  assert.equal(back.zoom, 1);
  assert.equal(back.panX, 0);
  assert.equal(back.panY, 0);
  /* ずらした状態から拡大しても、指した点は動かない */
  const from = { zoom: 2, panX: 0.2, panY: 0 };
  const next = api.zoomAround(from, 3, 0.8, 0.5, size);
  const ux = (0.8 - 0.5 - from.panX) / from.zoom;
  assert.ok(Math.abs(0.5 + next.panX + next.zoom * ux - 0.8) < 1e-9);
});

/* ---------- 4. ホイールの量をノッチに直す ---------- */
test("trk212: wheel deltas accumulate into notches (trackpads included) and are capped", () => {
  const { api } = sandbox();
  assert.deepEqual({ ...api.accumulateWheel(0, -100) }, { notches: -1, acc: 0 });
  assert.deepEqual({ ...api.accumulateWheel(0, -50) }, { notches: 0, acc: -50 });
  assert.deepEqual({ ...api.accumulateWheel(-50, -50) }, { notches: -1, acc: 0 });
  assert.deepEqual({ ...api.accumulateWheel(-60, 100) }, { notches: 1, acc: 0 }, "向きが変わったら数え直す");
  assert.deepEqual({ ...api.accumulateWheel(0, 250) }, { notches: 2, acc: 50 });
  assert.deepEqual({ ...api.accumulateWheel(0, 1000) }, { notches: 4, acc: 0 }, "1回で動くのは4段まで");
  assert.deepEqual({ ...api.accumulateWheel(30, 0) }, { notches: 0, acc: 30 });
});

/* ---------- 5. ホイール：上で拡大・下で縮小（設定の％ずつ） ---------- */
test("trk212: wheel up zooms in, wheel down zooms out, by the configured step", () => {
  const run = (deltas, step) => {
    const { box, api } = sandbox();
    box.core.settings.videoMaxWheelStep = step;
    api.resetZoomView();
    const out = [];
    for (const [deltaY, deltaMode = 0] of deltas) {
      let prevented = false;
      api.onZoomWheel({ deltaY, deltaMode, clientX: 800, clientY: 500, preventDefault() { prevented = true; } });
      out.push({ zoom: +api.zoomView.zoom.toFixed(4), prevented });
    }
    return out;
  };
  const by5 = run([[-100], [-100], [100], [100]]);
  assert.deepEqual(by5.map(x => x.zoom), [1.05, 1.1, 1.05, 1], "ホイール上＝拡大、下＝縮小");
  assert.ok(by5.every(x => x.prevented), "ページのスクロールへ渡さない");
  assert.deepEqual(run([[-100]], 2).map(x => x.zoom), [1.02]);
  assert.deepEqual(run([[-100]], 10).map(x => x.zoom), [1.1]);
  /* Firefox などの「行」単位（deltaMode=1）でも1ノッチ＝1段 */
  assert.deepEqual(run([[-3, 1]]).map(x => x.zoom), [1.05]);
  /* 100% より下がらない・500% より上がらない */
  assert.deepEqual(run(Array.from({ length: 5 }, () => [100])).map(x => x.zoom), [1, 1, 1, 1, 1]);
  assert.deepEqual(run(Array.from({ length: 200 }, () => [-100])).slice(-1).map(x => x.zoom), [5]);
});

/* ---------- 6. ドラッグで表示位置を動かす（クリック中の「つまんで移動」） ---------- */
test("trk212: dragging moves the view only above 100%, and a drag no longer toggles play", () => {
  const { box, api, classes } = sandbox();
  /* 100% では何も動かない（左右長押しシークの邪魔をしない） */
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 500, 400));
  api.endZoomGesture(pointer(1, 500, 400));
  assert.equal(api.zoomView.panX, 0);
  assert.equal(api.zoomView.panY, 0);
  assert.equal(box.suppressHoldClick, false, "100% のドラッグは従来どおり（長押しシークを止めない）");
  /* 2倍にしてから：右へ100px動かす＝画面幅の 6.25% */
  api.zoomTo(2, 0.5, 0.5);
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 805, 500));
  assert.equal(api.zoomView.panX, 0, "6px 未満は「まだ押しただけ」");
  api.moveZoomGesture(pointer(1, 900, 500));
  assert.ok(Math.abs(api.zoomView.panX - 0.0625) < 1e-9, "指の動きと同じ向きに動く");
  assert.equal(box.suppressHoldClick, true, "動かしたあとの click で再生／停止しない");
  assert.equal(classes.has("panning"), true, "掴んでいる間は grabbing のカーソル");
  assert.equal(box.stops, 1, "動かし始めたら長押しシークを止める");
  api.endZoomGesture(pointer(1, 900, 500));
  assert.equal(classes.has("panning"), false);
  /* 端を越えて動かしても、黒が出ない範囲で止まる（2倍：±0.5） */
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 1500, 500));
  assert.equal(api.zoomView.panX, 0.5);
  api.endZoomGesture(pointer(1, 1500, 500));
  /* 2本指のピンチで拡大 */
  api.resetZoomView();
  api.startZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  api.startZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
  api.moveZoomGesture(pointer(1, 600, 500, { pointerType: "touch" }));
  api.moveZoomGesture(pointer(2, 1000, 500, { pointerType: "touch", isPrimary: false }));
  assert.ok(Math.abs(api.zoomView.zoom - 2) < 1e-9, "2本指を広げると拡大");
  api.endZoomGesture(pointer(1, 600, 500, { pointerType: "touch" }));
  api.endZoomGesture(pointer(2, 1000, 500, { pointerType: "touch", isPrimary: false }));
  assert.ok(api.zoomView.zoom > 1, "指を離しても倍率はそのまま");
  /* 後始末 */
  api.startZoomGesture(pointer(3, 800, 500));
  api.clearZoomGesture();
  assert.equal(classes.has("panning"), false);
});

/* ---------- 7. 画面上の作り（上部の 🔍 ボタン・ヒント・カーソル） ---------- */
test("trk212: the viewer shows a zoom readout, resets to 100%, and the hint mentions the wheel", () => {
  assert.ok(src.includes('zoomChip = core.el("button", "videoMaxBtn videoMaxZoom", "🔍 100%")'), "上部に倍率のボタン");
  assert.ok(src.includes("tools.append(playNode, zoomChip, fsNode, closeNode)"));
  assert.match(src, /zoomChip\.addEventListener\("click", \(\) => \{ resetZoomView\(\);/);
  assert.match(src, /on\("songSelected", resetZoomView\)/);
  assert.match(src, /function openMax\(\) \{[\s\S]*?resetZoomView\(\)/, "開くたびに100%から");
  assert.match(src, /function closeMax\(\) \{[\s\S]*?clearZoomGesture\(\)/, "閉じるときに後始末");
  assert.match(src, /stage\.addEventListener\("wheel", onZoomWheel, \{ passive:false \}\)/);
  assert.match(src, /stage\.addEventListener\("pointerdown", startZoomGesture\)/);
  assert.match(src, /stage\.addEventListener\("pointermove", moveZoomGesture\)/);
  assert.match(src, /addEventListener\("pointerup", endZoomGesture\)/);
  assert.match(src, /addEventListener\("pointercancel", endZoomGesture\)/);
  /* 4言語の文言（ヒントにホイール・ピンチ／ドラッグの説明、倍率ボタンの読み上げ） */
  const hint = src.match(/videoMaxHint:/g) || [];
  assert.equal(hint.length, 4);
  assert.equal((src.match(/videoMaxZoomReset:/g) || []).length, 4);
  assert.equal((src.match(/videoMaxZoomHint:/g) || []).length, 4);
  for (const word of ["ホイール", "Wheel", "滚轮", "휠"]) assert.ok(src.includes(word), word);
  /* カーソル（拡大中は grab / 掴んでいる間は grabbing） */
  assert.match(css, /#videoMaxView\.zoomed \.videoMaxCanvas\{cursor:grab\}/);
  assert.match(css, /#videoMaxView\.zoomed \.videoMaxStage\.panning \.videoMaxCanvas\{cursor:grabbing\}/);
});

/* ---------- 8. 設定（2／5／10%）の置き場所と保存 ---------- */
test("trk212: the step is a setting with 2 / 5 / 10 and defaults to 5", () => {
  assert.match(html, /<select id="videoMaxWheelStep">\s*<option value="2">2%<\/option>\s*<option value="5">5%<\/option>\s*<option value="10">10%<\/option>/);
  assert.ok(html.includes('<span data-i18n="videoMaxWheelStep"></span>'), "設定の見出し");
  const i18n = read("js/i18n.js");
  assert.equal((i18n.match(/videoMaxWheelStep:/g) || []).length, 4, "4言語にラベルがある");
  assert.match(mainSrc, /core\.\$\("videoMaxWheelStep"\)\.addEventListener\("change"/);
  assert.match(mainSrc, /\[2, 5, 10\]\.includes\(v\) \? v : 5/);
  assert.match(mainSrc, /showVideoMaxWheelStep\(\);/);
});

/* ---------- 9. 実際に描く位置（canvas へ渡す矩形） ---------- */
function paintSandbox({ interp = null, drawToOk = true } = {}) {
  const code = src.slice(src.indexOf("/* ---- 🔍 拡大・縮小（trk212） ----"), src.indexOf("\nfunction startLoop()"));
  const calls = [];
  const ctx = {
    setTransform: (...a) => calls.push(["setTransform", ...a]),
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    fillRect: (...a) => calls.push(["fillRect", ...a]),
    drawImage: (...a) => calls.push(["drawImage", ...a]),
    fillStyle: "#000"
  };
  const box = {
    window: {}, console, Math, Number, Map, ctx, calls,
    canvas: { clientWidth: 1600, clientHeight: 1000, width: 0, height: 0 },
    videoEl: { videoWidth: 1600, videoHeight: 900, currentTime: 0, paused: false },
    hasFrames: () => true,
    isOn: true, root: null, zoomChip: null, suppressHoldClick: false,
    noteNode: null, titleNode: null, playNode: null, subsNode: null,
    songTitle: () => "", packImage: () => null, pokeChrome() {}, stopHoldSeek() {}, tr: k => k,
    TrkLite: undefined,
    core: { settings: { frameInterp: interp ? "blend" : "off" } },
    settings: { frameInterp: interp ? "blend" : "off" },   /* core.js のグローバル（paint が typeof で見る） */
    performance: { now: () => 0 }, requestAnimationFrame: () => 1,
    devicePixelRatio: 1,
    stage: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 1000 }), classList: { add() {}, remove() {} } },
  };
  if (interp) box.window.TrkFrameInterp = { drawTo: () => drawToOk };
  vm.createContext(box);
  vm.runInContext(`${code}\n;globalThis.api = { paint, zoomView, zoomTo, resetZoomView };`, box);
  return { box, api: box.api, calls };
}

const nearAll = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-6, `${label}: ${v} ≒ ${expected[i]}`));
};

test("trk212: the canvas draws the video at the zoomed rectangle (100% unchanged, 200% scaled)", () => {
  /* 100%：従来どおり中央に contain（1600×900 を 1600×1000 の枠の中央へ） */
  const plain = paintSandbox();
  plain.api.paint();
  const first = plain.calls.find(c => c[0] === "drawImage");
  assert.ok(first, "the video is drawn");
  assert.equal(first[1], plain.box.videoEl);
  nearAll(first.slice(2), [0, 50, 1600, 900], "100% は中央");

  /* 200%：全体が2倍・中央のまま（はみ出した分は canvas の外） */
  plain.calls.length = 0;
  plain.api.zoomTo(2, 0.5, 0.5);
  plain.api.paint();
  const scaled = plain.calls.find(c => c[0] === "drawImage");
  nearAll(scaled.slice(2), [-800, -400, 3200, 1800], "200% は2倍");

  /* 中心から左へずらすと、その分だけ右へ動く（画面幅の10%＝160px） */
  plain.calls.length = 0;
  plain.api.zoomView.panX = 0.1;
  plain.api.paint();
  const moved = plain.calls.find(c => c[0] === "drawImage");
  assert.ok(Math.abs(moved[2] - (-800 + 160)) < 1e-6, "ずらした分だけ動く");
});

test("trk212: frame interpolation follows the same zoom through the canvas transform", () => {
  const fi = paintSandbox({ interp: true });
  fi.api.paint();
  assert.ok(!fi.calls.some(c => c[0] === "drawImage"), "100% では従来どおり FI の描画だけ");
  fi.api.zoomTo(2, 0.5, 0.5);
  fi.calls.length = 0;
  fi.api.paint();
  const set = fi.calls.find(c => c[0] === "setTransform" && c[1] !== 1);
  nearAll(set.slice(1), [2, 0, 0, 2, -800, -500], "FI も同じ矩形へ拡大する");
  assert.ok(fi.calls.some(c => c[0] === "restore"), "変換は元に戻す");
});

/* ---------- 10. cache 名 ---------- */
test("trk212: the service worker cache name moves on for this change", () => {
  /* 版が進むたびに直さなくてよいよう「trk212 以降」で見る（trk211 のテストと同じ） */
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "cache 名の形");
  assert.ok(Number(m[2]) >= 212, `cache は trk212 以降（いまは trk${m[2]}）`);
});

/* ---------- 11. trk214：ピンチのあと・画面の外へ出たとき（レビュー反映） ---------- */
test("trk214: a pinch hands the remaining finger over to dragging without lifting it", () => {
  const { api, classes, box } = sandbox();
  api.resetZoomView();
  /* 2本指で広げて 2倍にする */
  api.startZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  api.startZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
  api.moveZoomGesture(pointer(1, 600, 500, { pointerType: "touch" }));
  api.moveZoomGesture(pointer(2, 1000, 500, { pointerType: "touch", isPrimary: false }));
  assert.ok(Math.abs(api.zoomView.zoom - 2) < 1e-9, "2本指を広げると拡大");
  /* 1本離す → 残った1本がそのまま掴んだ状態になる */
  api.endZoomGesture(pointer(2, 1000, 500, { pointerType: "touch", isPrimary: false }));
  assert.equal(classes.has("panning"), true, "残った1本は掴んでいる扱い");
  assert.equal(box.suppressHoldClick, true, "離したときの click で再生／停止しない");
  /* 置き直さずに動かせる（右へ100px＝画面幅の 6.25%） */
  const before = api.zoomView.panX;
  api.moveZoomGesture(pointer(1, 600, 500, { pointerType: "touch" }));
  api.moveZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  assert.ok(Math.abs(api.zoomView.panX - (before + 0.0625)) < 1e-9, `動いた（${before}→${api.zoomView.panX}）`);
  /* 離すと後片付け */
  api.endZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  assert.equal(classes.has("panning"), false);
});

test("trk214: the pinch handoff only happens above 100%, and the last finger still pans", () => {
  const { api, classes } = sandbox();
  api.resetZoomView();
  /* 100% まで縮めてから1本離す → 掴んだ扱いにはしない（動かす余地が無い） */
  api.startZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  api.startZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
  api.endZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
  assert.equal(classes.has("panning"), false, "100% では掴んだ扱いにしない");
  api.endZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  api.clearZoomGesture();
});

test("trk214: dragging and pinching capture the pointer so it keeps tracking outside the video", () => {
  const { api, captures } = sandbox();
  api.resetZoomView();
  /* 押しただけ（100%・長押しシーク）では捕まえない＝外へ出たら長押しシークを止める従来の動き */
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 802, 500));
  assert.deepEqual(captures, [], "押しただけでは捕まえない");
  api.endZoomGesture(pointer(1, 802, 500));
  assert.deepEqual(captures, [], "離しても捕まえていないので何もしない");
  /* 拡大してドラッグを始めたら捕まえる（6px を越えた時点） */
  api.zoomTo(2, 0.5, 0.5);
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 803, 500));
  assert.deepEqual(captures, [], "まだ動かし始めていない");
  api.moveZoomGesture(pointer(1, 900, 500));
  assert.deepEqual(captures, [["set", 1]], "掴んだら捕まえる");
  /* 画面の外（動画の外）でさらに動かしても届く＝ずらしが続く */
  const before = api.zoomView.panX;
  api.moveZoomGesture(pointer(1, 1900, 500));
  assert.ok(api.zoomView.panX > before, "外へ出てもずらしが続く");
  api.endZoomGesture(pointer(1, 1900, 500));
  assert.deepEqual(captures, [["set", 1], ["release", 1]], "離したら返す");
  /* ピンチは2本とも捕まえ、離したほうから返す */
  api.resetZoomView();
  api.startZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  api.startZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
  assert.deepEqual(captures.slice(-2), [["set", 1], ["set", 2]], "2本とも捕まえる");
  api.endZoomGesture(pointer(1, 700, 500, { pointerType: "touch" }));
  assert.deepEqual(captures.slice(-1), [["release", 1]], "離したほうを返す");
  api.endZoomGesture(pointer(2, 900, 500, { pointerType: "touch", isPrimary: false }));
});

test("trk214: blur/release clears every captured pointer", () => {
  const { api, captures, classes } = sandbox();
  api.resetZoomView();
  api.zoomTo(2, 0.5, 0.5);
  api.startZoomGesture(pointer(1, 800, 500));
  api.moveZoomGesture(pointer(1, 900, 500));
  api.startZoomGesture(pointer(2, 1000, 500, { pointerType: "touch", isPrimary: false }));
  assert.deepEqual(captures.filter(c => c[0] === "set").map(c => c[1]), [1, 2], "掴んだ1本目と2本目（同じ指を二重に捕まえない）");
  api.clearZoomGesture();
  assert.deepEqual(captures.filter(c => c[0] === "release").map(c => c[1]).sort(), [1, 2], "全部返す");
  assert.equal(classes.has("panning"), false);
  /* 捕まえていない id を渡しても落ちない */
  api.endZoomGesture(pointer(9, 0, 0));
});

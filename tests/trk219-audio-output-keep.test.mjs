// SPDX-License-Identifier: GPL-3.0-or-later
/* trk219: 🔈 出力デバイス（スピーカー／ヘッドホン／HDMI など）を切り替えても、再生を止めない。
   ① audio-keep.js 全体を vm で動かし、偽の再生要素・時計・タイマーで実際に確かめる
      （アプリが頼んだ停止では再開しない／勝手に止まったら続きから再開する／
        画面が隠れていたら再開しない／終端では再開しない／予算と失敗の休み／
        詰まった（currentTime が進まない）再生のやり直し／AudioContext の resume）
   ② keepPlan() の判断（純関数）。
   ③ 配線（index.html の読み込み順・fx.js の窓口・sw.js の cache）。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const src = fs.readFileSync(`${ROOT}/js/audio-keep.js`, "utf8");
const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const fxSrc = fs.readFileSync(`${ROOT}/js/fx.js`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");

/* ---------- 偽の世界（時計・タイマー・再生要素・AudioContext） ---------- */
function world(opts = {}) {
  let clock = opts.start || 1000;
  const jobs = new Map();
  let seq = 1;
  const timers = {
    setTimeout(fn, ms) { jobs.set(seq, { at: clock + (Number(ms) || 0), fn, every: 0 }); return seq++; },
    clearTimeout(id) { jobs.delete(id); },
    setInterval(fn, ms) { jobs.set(seq, { at: clock + (Number(ms) || 1000), fn, every: Math.max(1, Number(ms) || 1000) }); return seq++; },
    advance(ms) {
      const end = clock + Number(ms);
      let guard = 0;
      for (;;) {
        let due = null;
        for (const [id, j] of jobs) if (j.at <= end && (!due || j.at < due[1].at)) due = [id, j];
        if (!due || guard++ > 5000) break;
        clock = due[1].at;
        if (due[1].every) due[1].at += due[1].every; else jobs.delete(due[0]);
        due[1].fn();
      }
      clock = end;
    },
    get at() { return clock; }
  };

  const listeners = new Map();
  const el = {
    paused: true, ended: false, readyState: 4, currentTime: 0,
    playCalls: 0, pauseCalls: 0, rejectPlay: false,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type) { for (const fn of (listeners.get(type) || []).slice()) fn({ type }); },
    /* ブラウザーが直接止める（アプリの pause() を通らない） */
    systemPause() { this.paused = true; this.dispatch("pause"); },
    play() {
      this.playCalls += 1;
      if (this.rejectPlay) return Promise.reject(new Error("blocked"));
      this.paused = false;
      this.dispatch("play");
      return Promise.resolve();
    },
    pause() {   /* アプリからの停止＝そのまま下の包みが使われる */
      this.pauseCalls += 1; this.paused = true; this.dispatch("pause");
    }
  };

  const doc = { hidden: !!opts.hidden, getElementById: id => (id === "video" ? el : null) };
  const contexts = opts.contexts || [];
  const windowObj = {};
  if (contexts.length) {
    windowObj.Trk = { media: { get audioCtx() { return contexts[0]; } } };
  }
  if (opts.fx) windowObj.TrkFX = opts.fx;
  const mdHandlers = [];
  const mediaDevices = { addEventListener(type, fn) { if (type === "devicechange") mdHandlers.push(fn); } };
  const sandbox = {
    window: windowObj, document: doc, navigator: { mediaDevices },
    performance: { now: () => clock },
    setTimeout: timers.setTimeout.bind(timers), clearTimeout: timers.clearTimeout.bind(timers),
    setInterval: timers.setInterval.bind(timers), clearInterval: timers.clearTimeout.bind(timers),
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "js/audio-keep.js" });
  const fireDeviceChange = () => { for (const fn of mdHandlers.slice()) fn({ type: "devicechange" }); };
  return { sandbox, el, doc, timers, mdHandlers, fireDeviceChange, api: sandbox.window.Trk.audioKeep, contexts };
}

const fakeCtx = () => ({
  state: "suspended", resumes: 0,
  resume() { this.resumes += 1; this.state = "running"; return Promise.resolve(); },
  addEventListener() {}
});

describe("trk219 出力デバイスの切り替えで止まらない", () => {
  test("アプリが pause() したら、勝手に再開しない（利用者の停止を守る）", () => {
    const { el, timers } = world();
    el.play();                                  /* アプリが再生開始 */
    assert.equal(el.playCalls, 1);
    el.pause();                                 /* 利用者の停止（Media Session・UI など） */
    timers.advance(5000);
    assert.equal(el.paused, true, "止まったまま");
    assert.equal(el.playCalls, 1, "勝手に鳴らし直さない");
  });

  test("ブラウザーが勝手に止めたら（出力デバイスの切り替えなど）、続きから再開する", () => {
    const { el, timers } = world();
    el.play();
    el.currentTime = 42.5;
    el.systemPause();                           /* アプリの pause() を通らない停止 */
    timers.advance(250);
    assert.equal(el.paused, false, "再開した");
    assert.equal(el.playCalls, 2);
    assert.equal(el.currentTime, 42.5, "続きから（位置を戻さない）");
  });

  test("曲の切り替え・読み込み直し（loadstart）では、勝手に鳴らさない", () => {
    const { el, timers } = world();
    el.play();
    el.dispatch("loadstart");                   /* 新しい曲の読み込みが始まった */
    el.systemPause();
    timers.advance(5000);
    assert.equal(el.paused, true, "アプリが play() するまで待つ");
    assert.equal(el.playCalls, 1);
    el.play();                                  /* アプリが鳴らし始めれば、また見張る */
    el.systemPause();
    timers.advance(300);
    assert.equal(el.paused, false, "そのあとは今までどおり再開する");
  });

  test("画面が隠れている（別タブ・最小化）ときは再開しない", () => {
    const { el, timers, doc } = world({ hidden: true });
    el.play();
    el.systemPause();
    timers.advance(5000);
    assert.equal(el.paused, true);
    assert.equal(el.playCalls, 1);
    doc.hidden = false;                         /* 戻ってきても、勝手には鳴らさない（pause の取りこぼし対策は下の見張り） */
  });

  test("終端（ended）では再開しない", () => {
    const { el, timers } = world();
    el.play();
    el.ended = true;
    el.systemPause();
    timers.advance(5000);
    assert.equal(el.playCalls, 1);
  });

  test("予算：60秒に6回まで（止まり続けても、鳴らし直しを繰り返さない）", () => {
    const { el, timers } = world();
    el.play();
    for (let i = 0; i < 20; i++) { el.systemPause(); timers.advance(400); }
    const calls = el.playCalls - 1;             /* 最初の play を除く */
    assert.ok(calls <= 6, `再開は6回まで（実際 ${calls}）`);
    assert.ok(calls >= 5, `少なすぎない（実際 ${calls}）`);
  });

  test("play() が3回続けて効かなければ、30秒休む", async () => {
    const { el, timers, api } = world();
    el.rejectPlay = true;
    el.play().catch(() => {});                  /* これも失敗する（拒否） */
    el.systemPause();
    for (let i = 0; i < 10; i++) { el.systemPause(); timers.advance(500); }
    /* 失敗の約束が解決するのを待つ */
    for (let i = 0; i < 5; i++) await Promise.resolve();
    assert.equal(api.state().failStreak >= 3, true, "失敗を数えている");
    assert.equal(api.state().quiet, true, "休みに入った");
    const before = el.playCalls;
    el.systemPause(); timers.advance(5000);
    assert.equal(el.playCalls, before, "休みの間は試さない");
  });

  test("再生中のまま currentTime が進まない（出口が詰まった）ときは play() をやり直す", () => {
    const { el, timers } = world();
    el.play();
    timers.advance(1000);
    const before = el.playCalls;
    assert.equal(before, 1, "ふつうに進んでいるときは何もしない");
    el.paused = false;                          /* 止まってはいないのに時間が進まない */
    timers.advance(4000);
    assert.ok(el.playCalls > before, "やり直した");
  });

  test("AudioContext が止まっていたら resume する", () => {
    const ctx = fakeCtx();
    const { el, timers } = world({ contexts: [ctx] });
    el.play();
    timers.advance(1000);
    assert.equal(ctx.resumes, 1, "音の出口を起こした");
    assert.equal(ctx.state, "running");
  });

  test("devicechange では 🎛 の出口もつなぎ直す（wake(true)）", () => {
    const seen = [];
    const { el, timers, fireDeviceChange } = world({ fx: { wake: force => { seen.push(force); return false; } } });
    el.play();
    timers.advance(1000);
    fireDeviceChange();
    timers.advance(300);
    assert.deepEqual([...seen], [true], "つなぎ直しを頼む");
  });

  test("出力デバイスの増減（devicechange）で、止まった再生と出口を起こし直す", () => {
    const ctx = fakeCtx();
    const { el, timers, fireDeviceChange } = world({ contexts: [ctx] });
    el.play();
    timers.advance(1000);
    assert.equal(ctx.resumes, 1, "最初の見張りで起こしている");
    ctx.state = "suspended";                    /* 出口が止まった */
    el.paused = true;                           /* ブラウザーが止めた（pause の通知は来ない） */
    fireDeviceChange();
    timers.advance(300);
    assert.equal(ctx.state, "running", "出口を起こした");
    assert.equal(el.paused, false, "再生も続いた");
    assert.equal(el.currentTime >= 0, true);
  });

  test("keepPlan(): 判断の表", () => {
    const base = { want: true, hidden: false, ended: false, paused: false, stalled: false,
      contextRunning: true, used: 0, max: 6, sinceAttempt: 9999, retryMs: 250, quiet: false };
    const { api } = world();
    assert.equal(api.plan(base), "none", "なにもしない");
    assert.equal(api.plan({ ...base, paused: true }), "play", "止まっている→鳴らし直す");
    assert.equal(api.plan({ ...base, stalled: true }), "play", "詰まっている→鳴らし直す");
    assert.equal(api.plan({ ...base, contextRunning: false }), "context", "出口→resume");
    assert.equal(api.plan({ ...base, paused: true, hidden: true }), "none", "裏では何もしない");
    assert.equal(api.plan({ ...base, paused: true, ended: true }), "none", "終端では何もしない");
    assert.equal(api.plan({ ...base, paused: true, want: false }), "none", "止めたいときは何もしない");
    assert.equal(api.plan({ ...base, paused: true, used: 6 }), "none", "予算切れ");
    assert.equal(api.plan({ ...base, paused: true, quiet: true }), "none", "休み中");
    assert.equal(api.plan({ ...base, paused: true, sinceAttempt: 100 }), "none", "続けて叩かない");
  });
});

describe("trk219 配線", () => {
  test("index.html は media.js のあとで audio-keep.js を読む", () => {
    const m = html.indexOf('<script src="js/media.js"></script>');
    const k = html.indexOf('<script src="js/audio-keep.js"></script>');
    assert.ok(m > 0 && k > m, "media.js → audio-keep.js の順");
  });

  test("play()／pause() を包んで『頼まれた停止』を覚える（この要素だけ）", () => {
    assert.ok(src.includes("el.play = function play()"), "play を包む");
    assert.ok(src.includes("el.pause = function pause()"), "pause を包む");
    assert.ok(src.includes("askedPauseAt = now()"), "停止を頼んだ時刻を記録");
    assert.ok(!src.includes("HTMLMediaElement.prototype"), "ほかの要素の動きは変えない");
  });

  test("画面が隠れているとき・終端では再開しない", () => {
    assert.ok(src.includes("if (doc.hidden) return;"));
    assert.ok(src.includes("if (el.ended) { want = false; return; }"));
  });

  test("🎛 エフェクトの出口を起こす窓口（TrkFX.wake／context）がある", () => {
    assert.ok(fxSrc.includes("function wakeAudioHard(force)"), "出口を起こす関数");
    assert.ok(fxSrc.includes("context: () => G.ac"));
    assert.ok(fxSrc.includes("wake: wakeAudioHard"));
    assert.ok(src.includes('typeof fx.wake === "function"'), "🎛 の窓口を呼ぶ");
    assert.ok(src.includes("fx.wake(!!force)"), "デバイスの切り替えでは出口もつなぎ直す");
  });

  test("AudioContext の statechange と devicechange を見ている", () => {
    assert.ok(src.includes('ac.addEventListener("statechange"'));
    assert.ok(src.includes('md.addEventListener("devicechange"'));
  });

  test("Service Worker の cache を上げている", () => {
    /* 後の版で番号が進むので「trk219 以降」で見る */
    const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
    assert.ok(m, "版数つきの名前");
    assert.ok(Number(m[2]) >= 219, `trk219 以降の番号で割る（今は ${m[2]}）`);
  });
});

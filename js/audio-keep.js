// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! audio-keep.js — 🔈 出力デバイスを切り替えても、再生を止めない（trk219）

   ・Windows の「サウンド」や OS の出力先（スピーカー／ヘッドホン／HDMI など）を
     切り替えると、ブラウザーが音の出口を作り直す。そのとき、再生中の曲が止まったまま
     戻らなかったり、Web Audio（🎛 エフェクト・📊 スペクトラム・🔊 平準化）の出口が
     黙り込むことがある。これはアプリの都合ではなく、音の出口が替わる瞬間の動き。
   ・ここでは「利用者が止めたのではない停止」を見つけて、続きからもう一度鳴らす。

   【約束】
     ・アプリが自分で止めたとき（pause を呼んだとき）は、絶対に勝手に再開しない。
       → 共有の再生要素（#video）の play()／pause() を包んで「頼まれた停止」を覚える
     ・画面が隠れている（別タブ・最小化）ときは再開しない
     ・短時間に何度も試さない（60秒に6回まで。3回続けて効かなければ30秒休む）
     ・ロック画面・キーボードの再生／停止キーは、アプリ側（Media Session）が受けて
       pause() を呼ぶので「頼まれた停止」になる＝ここでは触らない
     ・音は端末の中だけ。外部へ送るものはない（新しい通信・保存も増やさない）

   【見張り方】
     ① pause が来た（アプリが頼んでいない）→ 少し待って再開
     ② 再生中のまま currentTime が進まない（出口が詰まった）→ play() をやり直す
     ③ AudioContext が running でない → resume（🎛 の出口はつなぎ直しも）
     ④ 出力デバイスの増減（devicechange）→ ①②③を1回ためす
   ============================================================================ */
"use strict";
(() => {
  const doc = document;
  const el = doc.getElementById("video");
  if (!el || typeof el.addEventListener !== "function") return;

  /* 待ち時間と予算（テストからも読めるようにまとめておく） */
  const LIMITS = Object.freeze({
    graceMs: 400,        /* アプリの pause() からこの時間内の pause は「頼まれた停止」 */
    retryMs: 250,        /* 止まったと気づいてから再開するまで */
    stallMs: 2600,       /* 再生中のまま currentTime がこれだけ進まなければ「詰まった」 */
    budgetMs: 60000,     /* 予算を数える窓 */
    budgetMax: 6,        /* 窓の中で再開してよい回数 */
    quietMs: 30000,      /* 続けて失敗したときに休む時間 */
    quietAfter: 3        /* 何回続けて失敗したら休むか */
  });

  const now = () => (typeof performance !== "undefined" && performance && typeof performance.now === "function"
    ? performance.now() : Date.now());

  let want = false;              /* 再生したい（アプリが play した・まだ止めていない） */
  let askedPauseAt = -1e9;       /* アプリが pause() を頼んだ時刻 */
  let attempts = [];             /* 再開を試した時刻（予算） */
  let timer = 0;                 /* 再開の待ち合わせ */
  let stallAt = 0;               /* 最後に currentTime が進んだ時刻 */
  let lastTime = -1;
  let failStreak = 0;            /* play() が続けて効かなかった回数 */
  let quietUntil = 0;            /* 続けて失敗したあと、しばらく何もしない */

  /* ---------- アプリの play()／pause() を包む（この要素だけ） ---------- */
  const rawPlay = el.play, rawPause = el.pause;
  if (typeof rawPlay === "function") {
    el.play = function play() {
      want = true;                       /* 失敗の数え上げ（failStreak）は鳴り始めたとき＝playing で消す */
      return rawPlay.apply(this, arguments);
    };
  }
  if (typeof rawPause === "function") {
    el.pause = function pause() {
      askedPauseAt = now(); want = false;
      if (timer) { clearTimeout(timer); timer = 0; }
      return rawPause.apply(this, arguments);
    };
  }

  /* ---------- 何をすればよいか（純関数。テストで確認する） ---------- */
  function keepPlan(s) {
    if (!s || !s.want || s.hidden || s.ended) return "none";
    if (s.quiet) return "none";
    if (s.used >= s.max) return "none";
    if (s.sinceAttempt < s.retryMs) return "none";
    if (s.paused) return "play";
    if (s.stalled) return "play";
    if (!s.contextRunning) return "context";
    return "none";
  }

  /* ---------- Web Audio の出口 ---------- */
  function contexts() {
    const out = [];
    try {
      const ac = window.Trk && window.Trk.media && window.Trk.media.audioCtx;
      if (ac) out.push(ac);
    } catch (_) {}
    try {
      const fx = window.TrkFX;
      if (fx && typeof fx.context === "function") { const ac = fx.context(); if (ac) out.push(ac); }
    } catch (_) {}
    return out;
  }
  function awake(ac) { return !ac || ac.state === "running" || ac.state === "closed"; }
  function wakeContexts(force) {
    let woke = false;
    for (const ac of contexts()) {
      if (awake(ac) || typeof ac.resume !== "function") continue;
      try {
        const p = ac.resume();
        if (p && typeof p.catch === "function") p.catch(() => {});
        woke = true;
      } catch (_) {}
    }
    try {
      const fx = window.TrkFX;
      if (fx && typeof fx.wake === "function" && fx.wake(!!force)) woke = true;   /* 🎛 は出口のつなぎ直しもする */
    } catch (_) {}
    return woke;
  }

  /* ---------- いまの様子 ---------- */
  function snapshot() {
    const at = now();
    attempts = attempts.filter(t => at - t < LIMITS.budgetMs);
    const paused = !!el.paused;
    const ready = typeof el.readyState !== "number" || el.readyState >= 3;   /* HAVE_FUTURE_DATA＝読み込み待ちではない */
    const stalled = !paused && !el.ended && ready && at - stallAt >= LIMITS.stallMs;
    return {
      at, want, hidden: !!doc.hidden, ended: !!el.ended, paused, stalled,
      contextRunning: contexts().every(awake),
      used: attempts.length, max: LIMITS.budgetMax,
      sinceAttempt: attempts.length ? at - attempts[attempts.length - 1] : Infinity,
      retryMs: LIMITS.retryMs, quiet: at < quietUntil
    };
  }

  /* ---------- 実際に再開する ---------- */
  function recover(reason) {
    const st = snapshot();
    const plan = keepPlan(st);
    if (plan === "none") return false;
    attempts.push(st.at);
    if (plan === "context") return wakeContexts();
    wakeContexts();
    try {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {
        failStreak += 1;
        if (failStreak >= LIMITS.quietAfter) quietUntil = now() + LIMITS.quietMs;
      });
    } catch (_) {
      failStreak += 1;
      if (failStreak >= LIMITS.quietAfter) quietUntil = now() + LIMITS.quietMs;
      return false;
    }
    stallAt = st.at; lastTime = typeof el.currentTime === "number" ? el.currentTime : lastTime;
    return true;
  }

  function schedule(ms) {
    if (timer) return;
    timer = setTimeout(() => { timer = 0; recover("timer"); }, ms);
  }

  /* ---------- 出来事 ---------- */
  function onPause() {
    if (el.ended) { want = false; return; }
    if (now() - askedPauseAt < LIMITS.graceMs) { want = false; return; }   /* アプリが頼んだ停止 */
    if (!want) return;
    if (doc.hidden) return;
    schedule(LIMITS.retryMs);
  }
  el.addEventListener("play", () => {
    want = true; failStreak = 0;
    stallAt = now(); lastTime = typeof el.currentTime === "number" ? el.currentTime : -1;
  });
  el.addEventListener("playing", () => {
    want = true; failStreak = 0;
    stallAt = now(); lastTime = typeof el.currentTime === "number" ? el.currentTime : -1;
  });
  el.addEventListener("timeupdate", () => {
    const t = typeof el.currentTime === "number" ? el.currentTime : -1;
    if (t !== lastTime) { lastTime = t; stallAt = now(); }
  });
  el.addEventListener("ended", () => { want = false; });
  el.addEventListener("pause", onPause);
  /* 曲の切り替え・読み込み直し（src の入れ替え）は「止まった」ではない。
     新しい曲を勝手に鳴らさないよう、ここで望みを下ろし、アプリの play() を待つ。 */
  el.addEventListener("loadstart", () => { want = false; lastTime = -1; stallAt = now(); });
  el.addEventListener("emptied", () => { want = false; });
  el.addEventListener("error", () => { want = false; });

  /* 出力デバイスが増減したとき（イヤホンの抜き差しなど）は、出口も起こし直す */
  try {
    const md = navigator && navigator.mediaDevices;
    if (md && typeof md.addEventListener === "function") {
      md.addEventListener("devicechange", () => {
        wakeContexts(true);              /* 出口（🎛 の G.out）も一度つなぎ直す */
        schedule(LIMITS.retryMs);
      });
    }
  } catch (_) {}

  /* ---------- 見張り（1秒ごと。ふだんは何もしない） ---------- */
  const watched = typeof WeakSet === "function" ? new WeakSet() : null;
  function watchContexts() {
    for (const ac of contexts()) {
      if (!ac || !watched || typeof ac.addEventListener !== "function" || watched.has(ac)) continue;
      watched.add(ac);
      try {
        ac.addEventListener("statechange", () => {
          if (!awake(ac) && want && !doc.hidden) schedule(LIMITS.retryMs);
        });
      } catch (_) {}
    }
  }
  function watch() {
    try { watchContexts(); } catch (_) {}
    if (!want || doc.hidden || el.ended) return;
    const t = typeof el.currentTime === "number" ? el.currentTime : -1;
    if (!el.paused && t !== lastTime) { lastTime = t; stallAt = now(); }
    recover("watch");
  }
  const every = typeof setInterval === "function" ? setInterval(watch, 1000) : 0;
  if (every && typeof every.unref === "function") every.unref();

  /* ---------- 窓口（テストと、ほかのモジュールからの確認用） ---------- */
  window.Trk = window.Trk || {};
  window.Trk.audioKeep = Object.freeze({
    limits: LIMITS,
    plan: keepPlan,
    recover: reason => recover(reason || "manual"),
    state: () => ({
      want, attempts: attempts.length, stalled: now() - stallAt >= LIMITS.stallMs,
      failStreak, quiet: now() < quietUntil, contexts: contexts().length
    })
  });
})();
/* ✅ audio-keep.js 完了 */

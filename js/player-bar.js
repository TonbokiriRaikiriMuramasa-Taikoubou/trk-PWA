// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ 画面の下に出す「再生バー」（js/player-bar.js） ============

   Clementine（PC）や VLC（スマホ・apk）の下部プレイヤーのように、
   「いまの曲名」「再生／一時停止」「曲送り」「再生位置」「音量」を、
   どの画面からでも1か所で扱えるようにします。

   ・出す／出さないは設定（⚙ → 🖥 画面と再生バー）の3つから選べます。
       on   … 曲を選んでいなくても、つねに出す（曲名の欄は案内になる）
       auto … 曲を選んだら出す（既定）
       off  … 出さない
   ・ゲーム中（phase が playing／paused）・再生画面を開いている間・書斎・ほかの窓が開いている間は、
     ステージや操作の邪魔をしないように引っ込みます。
   ・色はスキンが書き換える CSS変数（--ui-*）だけを使います。バー専用の色は持ちません。
   ・音と再生は、本体の仕組み（バナーの再生ボタン・Trk.play・TrkMediaPlayer）をそのまま呼びます。
     独自の再生状態や保存キーは増やしません（設定は core.settings.playerBar だけ）。
   ・キーボードやゲームの入力は奪いません（バーはゲーム中には出ないため）。 */
(() => {
  "use strict";
  const core = window.Trk && window.Trk.core;
  if (!core) return;

  const MODES = ["on", "auto", "off"];
  /* バーを出してよい場面（曲を選ぶ画面と、リザルト） */
  const SHOWN_PHASES = ["title", "ended"];

  /* ---------- 判断（純粋関数。テストで確認する） ---------- */
  function barVisible(ctx) {
    if (ctx.mode === "off") return false;
    if (SHOWN_PHASES.indexOf(ctx.phase) < 0) return false;   /* プレイ中・一時停止中は邪魔しない */
    if (ctx.media || ctx.study || ctx.modal) return false;   /* 全画面の窓があるときは引っ込める */
    if (ctx.mode === "on") return true;
    return !!ctx.hasSong;                                     /* auto：曲を選んだら出す */
  }
  /* スマホのシェルでは、下部ナビの上に載せる（ナビの高さをそのまま下の余白にする） */
  function barOffset(navHeight) {
    const h = Number(navHeight);
    return Number.isFinite(h) && h > 0 ? Math.round(h) : 0;
  }
  const barMode = () => (MODES.includes(core.settings.playerBar) ? core.settings.playerBar : "auto");

  /* ---------- DOM（はじめて必要になったときだけ作る） ---------- */
  let bar = null, artImg = null, artFallback = null, titleNode = null, artistNode = null;
  let prevButton = null, playButton = null, nextButton = null;
  let elapsedNode = null, totalNode = null, seekInput = null, volInput = null;
  let openButton = null, hideButton = null;
  let seekDragging = false, artUrl = "", artKey = "", built = false;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function makeButton(className, text, label) {
    const button = make("button", className, text);
    button.type = "button";
    if (label) button.setAttribute("aria-label", label);
    return button;
  }

  function build() {
    if (built || !document.body) return;
    bar = make("section", "trk-playerbar");
    bar.id = "trkPlayerBar";
    bar.hidden = true;

    /* 再生位置（バーの上端に重ねる細い線。VLC の下部シークバー相当） */
    seekInput = document.createElement("input");
    seekInput.type = "range";
    seekInput.className = "trk-pb-seek";
    seekInput.min = "0"; seekInput.max = "1000"; seekInput.step = "1"; seekInput.value = "0";

    const art = make("div", "trk-pb-art");
    art.setAttribute("aria-hidden", "true");
    artFallback = make("span", "", "♪");
    artImg = document.createElement("img");
    artImg.alt = "";
    artImg.hidden = true;
    art.append(artImg, artFallback);

    const meta = make("div", "trk-pb-meta");
    titleNode = make("strong", "trk-pb-title");
    artistNode = make("span", "trk-pb-artist");
    meta.append(titleNode, artistNode);

    const transport = make("div", "trk-pb-transport");
    prevButton = makeButton("trk-pb-prev", "⏮");
    playButton = makeButton("trk-pb-play", "▶");
    nextButton = makeButton("trk-pb-next", "⏭");
    transport.append(prevButton, playButton, nextButton);

    const time = make("div", "trk-pb-time");
    elapsedNode = make("span", "trk-pb-elapsed", "0:00");
    totalNode = make("span", "trk-pb-total", "--:--");
    time.append(elapsedNode, totalNode);

    const actions = make("div", "trk-pb-actions");
    const volWrap = make("label", "trk-pb-vol");
    const volIcon = make("span", "", "🔊");
    volIcon.setAttribute("aria-hidden", "true");
    volInput = document.createElement("input");
    volInput.type = "range";
    volInput.min = "0"; volInput.max = "1"; volInput.step = "0.01"; volInput.value = "0.7";
    volWrap.append(volIcon, volInput);
    openButton = makeButton("trk-pb-open", "⛶");
    hideButton = makeButton("trk-pb-hide", "✕");
    actions.append(volWrap, openButton, hideButton);

    bar.append(seekInput, art, meta, transport, time, actions);

    prevButton.addEventListener("click", () => step(-1));
    nextButton.addEventListener("click", () => step(1));
    playButton.addEventListener("click", togglePlay);
    openButton.addEventListener("click", openPlayer);
    hideButton.addEventListener("click", hideBar);
    /* つまみを動かしているあいだは、再生位置の更新でつまみを引き戻さない */
    seekInput.addEventListener("pointerdown", () => { seekDragging = true; });
    seekInput.addEventListener("pointerup", () => { seekDragging = false; });
    seekInput.addEventListener("change", () => { seekDragging = false; seekToValue(); });
    seekInput.addEventListener("input", () => { seekDragging = true; seekToValue(); seekReleaseSoon(); });
    volInput.addEventListener("input", () => setVolume(volInput.value));

    document.body.append(bar);
    built = true;
  }

  /* ---------- 文言 ---------- */
  const word = key => (typeof tr === "function" ? tr(key) : key);
  function fmtTime(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return "--:--";
    const whole = Math.floor(value);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const secs = whole % 60;
    const mm = String(minutes).padStart(hours ? 2 : 1, "0");
    const ss = String(secs).padStart(2, "0");
    return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  /* ---------- 画面の重なり ---------- */
  function mediaOpen() { return !!(window.TrkMediaPlayer && window.TrkMediaPlayer.isOpen()); }
  function studyOpen() { return !!(document.body && document.body.classList.contains("study-room-open")); }
  function modalOpen() {
    const nodes = document.querySelectorAll('.plOverlay,.instOverlay,.iosInstall,[role="dialog"][aria-modal="true"]');
    return [...nodes].some(node => {
      if (node.closest && node.closest("[hidden]")) return false;
      if (node.closest && node.closest("#mediaPlayerMode")) return false;   /* 再生画面は別に数える */
      return true;
    });
  }
  function contextNow() {
    return {
      mode: barMode(), phase: core.phase, hasSong: !!core.currentSong,
      media: mediaOpen(), study: studyOpen(), modal: modalOpen()
    };
  }

  /* ---------- 大きさ（ほかの部品が重ならないように測って配る） ---------- */
  function measure() {
    if (!bar) return;
    const root = document.documentElement;
    /* 拡大率（CSS の zoom）がかかっていると offsetHeight は拡大前の値なので、実寸を測る */
    const rectNow = typeof bar.getBoundingClientRect === "function" ? bar.getBoundingClientRect() : null;
    const height = (rectNow && rectNow.height > 0 ? rectNow.height : bar.offsetHeight) || 60;
    root.style.setProperty("--trk-playerbar-h", `${Math.round(height)}px`);
    /* スマホのシェルでは、下部ナビの上に載せる（ナビの高さをそのまま下の余白にする） */
    const nav = document.querySelector(".trk-mobile-nav");
    const navRect = nav && !nav.hidden && typeof nav.getBoundingClientRect === "function" ? nav.getBoundingClientRect() : null;
    const navHeight = nav && !nav.hidden ? ((navRect && navRect.height > 0 ? navRect.height : nav.offsetHeight) || 66) : 0;
    root.style.setProperty("--trk-playerbar-offset", `${barOffset(navHeight)}px`);
    /* PC は 1920×1080 のステージを縮小して見せる。余白は縮小前の座標に直して渡す */
    const shellMode = document.body.classList.contains("trk-mobile");
    const stage = document.getElementById("stage");
    const rect = stage && typeof stage.getBoundingClientRect === "function" ? stage.getBoundingClientRect() : null;
    const scale = !shellMode && rect && rect.height > 0 ? Math.max(0.2, rect.height / 1080) : 1;
    root.style.setProperty("--trk-playerbar-stage-h", `${Math.ceil(height / scale)}px`);
  }

  /* ---------- ジャケット（曲が変わったときだけ読む） ---------- */
  function clearArt() {
    if (artUrl) { try { URL.revokeObjectURL(artUrl); } catch (_) {} artUrl = ""; }
    if (artImg) { artImg.removeAttribute("src"); artImg.hidden = true; }
    if (artFallback) artFallback.hidden = false;
  }
  function syncArt(it) {
    if (!artImg) return;
    const key = it ? String(it.key || "") : "";
    if (key === artKey) return;
    artKey = key;
    clearArt();
    if (!it || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const lib = window.Trk.library;
    if (!lib || typeof lib.loadSongArtwork !== "function") return;
    let job = null;
    try { job = lib.loadSongArtwork(it); } catch (_) { return; }
    if (!job || typeof job.then !== "function") return;
    job.then(blob => {
      if (!blob || artKey !== key) return;
      if (!/^image\/(?:png|jpeg|webp)$/i.test(String(blob.type || ""))) return;
      /* 一覧のサムネイルと同じ上限（大きすぎる画像は飾りに使わない） */
      if (Number(blob.size) > 512 * 1024) return;
      try { artUrl = URL.createObjectURL(blob); } catch (_) { return; }
      artImg.onload = () => { artImg.hidden = false; if (artFallback) artFallback.hidden = true; };
      artImg.onerror = () => clearArt();
      artImg.src = artUrl;
    }).catch(() => {});
  }

  /* ---------- 中身の表示 ---------- */
  function songLabels(it) {
    if (!it) return { title: word("barNoSong"), artist: "" };
    let meta = null;
    try { meta = window.Trk.library && window.Trk.library.songDisplayMeta ? window.Trk.library.songDisplayMeta(it) : null; } catch (_) {}
    const title = (meta && meta.title) || it.base || it.title || it.name || "";
    const artist = (meta && meta.artist) || it.artist || "";
    return { title: String(title), artist: String(artist) };
  }
  function render() {
    if (!bar) return;
    const it = core.currentSong || null;
    const labels = songLabels(it);
    titleNode.textContent = labels.title;
    titleNode.title = labels.title;
    artistNode.textContent = labels.artist;
    artistNode.title = labels.artist;

    syncPlayIcon();

    const canStep = core.phase === "title";
    for (const [button, key] of [[prevButton, "barPrev"], [nextButton, "barNext"]]) {
      button.disabled = !canStep;
      button.title = word(key);
      button.setAttribute("aria-label", button.title);
    }
    seekInput.setAttribute("aria-label", word("barSeek"));
    volInput.setAttribute("aria-label", word("barVolume"));
    const volume = Number(core.settings.musicVolume);
    if (Number.isFinite(volume) && document.activeElement !== volInput) volInput.value = String(volume);
    openButton.title = word("barOpenPlayer");
    openButton.setAttribute("aria-label", openButton.title);
    hideButton.title = word("barHide");
    hideButton.setAttribute("aria-label", hideButton.title);
    openButton.disabled = !(window.TrkMediaPlayer && window.TrkMediaPlayer.open);
    /* 設定の欄（⚙ → 🖥 画面と再生バー）も、いまの値を見せる（工場出荷状態などで変わったとき） */
    const select = document.getElementById("playerBarMode");
    if (select && select.value !== barMode()) select.value = barMode();
    syncArt(it);
    tick();
  }
  /* 再生ボタンは、曲名のバナーにある本物のボタンと同じ見た目・同じ押し心地にする
     （押すと何が起きるか＝プレビュー／ゲームの一時停止の判断は、あちらが持っている） */
  function syncPlayIcon() {
    if (!playButton) return;
    const bannerPlay = document.querySelector("#songBanner .bannerPlayBtn");
    playButton.textContent = bannerPlay ? bannerPlay.textContent : (core.video && !core.video.paused ? "⏸" : "▶");
    playButton.disabled = bannerPlay ? !!bannerPlay.disabled : !core.currentSong;
    const tip = bannerPlay && (bannerPlay.title || bannerPlay.getAttribute("aria-label"));
    const label = tip || word("barPlay");
    if (playButton.title !== label) {
      playButton.title = label;
      playButton.setAttribute("aria-label", label);
    }
  }
  function tick() {
    if (!bar || bar.hidden) return;
    syncPlayIcon();
    const video = core.video || null;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    const position = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    elapsedNode.textContent = fmtTime(position);
    totalNode.textContent = duration ? fmtTime(duration) : "--:--";
    const playing = core.phase === "playing" || core.phase === "paused";
    seekInput.disabled = !(playing && core.videoReady && duration > 0);
    if (seekDragging) return;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
    const value = Math.round(ratio * 1000);
    if (String(value) !== seekInput.value) seekInput.value = String(value);
    seekInput.style.setProperty("--p", `${(ratio * 100).toFixed(2)}%`);
  }

  /* ---------- 操作 ---------- */
  function togglePlay() {
    const bannerPlay = document.querySelector("#songBanner .bannerPlayBtn");
    if (bannerPlay) { bannerPlay.click(); return; }
    if (core.phase === "playing") window.Trk.play.pauseGame();
    else if (core.phase === "paused") window.Trk.play.resumeGame();
  }
  async function step(direction) {
    if (core.phase !== "title") return;
    const lib = window.Trk.library;
    if (!lib) return;
    const next = direction < 0 ? lib.prevSong() : lib.nextSong();
    if (!next) return;
    try { await lib.selectSong(next); } catch (_) {}
    sync();
  }
  function openPlayer() {
    if (window.TrkMediaPlayer && window.TrkMediaPlayer.open) window.TrkMediaPlayer.open();
  }
  function hideBar() {
    setMode("off", { say: true });
  }
  function setVolume(raw) {
    const value = Math.min(1, Math.max(0, Number(raw)));
    if (!Number.isFinite(value)) return;
    core.settings.musicVolume = value;
    if (typeof core.rememberMusicVolume === "function" && value > 0) core.rememberMusicVolume(value);
    if (core.video) core.video.volume = value;
    const legacy = document.getElementById("volume");
    if (legacy && legacy !== volInput) legacy.value = String(value);
    if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
  }
  function seekToValue() {
    const video = core.video;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration || !(core.phase === "playing" || core.phase === "paused")) return;
    const target = (Number(seekInput.value) / 1000) * duration;
    if (!Number.isFinite(target)) return;
    if (window.Trk.play && typeof window.Trk.play.seekTo === "function") window.Trk.play.seekTo(target);
  }
  /* ポインタが外へ出たまま離されたときも、いつかは再生位置の追従へ戻す */
  let seekReleaseTimer = 0;
  function seekReleaseSoon() {
    clearTimeout(seekReleaseTimer);
    seekReleaseTimer = setTimeout(() => { seekDragging = false; }, 900);
  }
  function toast(message) {
    try {
      const lib = window.Trk.library;
      if (lib && typeof lib.plToast === "function") lib.plToast(message);
    } catch (_) {}
  }
  function setMode(mode, { save = true, say = false } = {}) {
    const nextMode = MODES.includes(mode) ? mode : "auto";
    core.settings.playerBar = nextMode;
    if (save && typeof core.saveUserPrefs === "function") core.saveUserPrefs();
    const select = document.getElementById("playerBarMode");
    if (select && select.value !== nextMode) select.value = nextMode;
    if (say && nextMode === "off") toast(word("barHidden"));
    sync();
  }

  /* ---------- まとめ ---------- */
  function sync() {
    if (!document.body) return;
    build();
    if (!bar) return;
    const show = barVisible(contextNow());
    bar.hidden = !show;
    document.body.classList.toggle("trk-playerbar", show);
    if (!show) return;
    measure();
    render();
  }

  /* 再生画面（メディアプレーヤー）は core のイベントを出さないので、重ね表示の窓口を包んで受け取る */
  function watchOverlay() {
    const overlay = window.Trk && window.Trk.overlay;
    if (!overlay || typeof overlay.set !== "function" || overlay.__trkPlayerBarWatched) return;
    const original = overlay.set;
    overlay.set = function (name, openState) {
      const result = original.call(overlay, name, openState);
      if (name === "media") sync();
      return result;
    };
    try { Object.defineProperty(overlay, "__trkPlayerBarWatched", { value: true }); } catch (_) {}
  }

  /* 画面の形（スマホ型／PC型）が切り替わると、下部ナビの有無でバーの載る位置が変わります。
     JS が測って配るので、切り替わったら測り直します（バーが隠れているときは何もしない）。 */
  function watchShell() {
    if (typeof MutationObserver !== "function" || !document.body) return;
    try {
      new MutationObserver(records => {
        if (!bar || bar.hidden) return;
        const nav = document.querySelector(".trk-mobile-nav");
        const relevant = records.some(record => {
          /* body の印（画面の形）と、下部ナビの出入り・表示（ナビが隠れると下の余白が0になる） */
          if (record.type === "attributes") return record.target === document.body || record.target === nav;
          const kids = [...record.addedNodes, ...record.removedNodes];
          return kids.some(node => node.nodeType === 1 &&
            ((node.classList && node.classList.contains("trk-mobile-nav")) ||
             (node.querySelector && node.querySelector(".trk-mobile-nav"))));
        });
        if (relevant) measure();
      }).observe(document.body, { attributes: true, attributeFilter: ["class", "hidden"], childList: true, subtree: true });
    } catch (_) { /* MutationObserver が使えなくても、次の sync で測り直す */ }
  }

  function init() {
    build();
    const select = document.getElementById("playerBarMode");
    if (select) {
      select.value = barMode();
      select.addEventListener("change", () => setMode(select.value));
    }
    watchOverlay();
    watchShell();
    sync();
    /* 再生位置は、動いているあいだだけ細かく見る（止まっているときは何もしない） */
    setInterval(() => { if (!bar || bar.hidden) return; if (core.video && !core.video.paused) tick(); }, 250);
  }

  for (const name of ["language", "settings", "settingsClose", "phase", "screen", "songSelected", "songTags", "nowPlaying", "mediaReady", "studyOpen", "studyClose", "skin", "lite"]) {
    core.on(name, sync);
  }
  if (core.video) for (const name of ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange"]) core.video.addEventListener(name, tick);
  window.addEventListener("resize", () => { if (bar && !bar.hidden) measure(); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  window.Trk = window.Trk || {};
  window.Trk.playerBar = Object.freeze({
    /* テストで確かめる純粋な判断 */
    decide: barVisible,
    offset: barOffset,
    formatTime: fmtTime,
    mode: barMode,
    setMode,
    sync,
    visible: () => !!(bar && !bar.hidden)
  });
})();

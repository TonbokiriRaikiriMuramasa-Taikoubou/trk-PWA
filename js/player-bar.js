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
   ・キーボードやゲームの入力は奪いません（バーはゲーム中には出ないため）。

   🎵 trk226：バーそのものを、もう少し「プレイヤー」にしました。
     ・再生位置の線を、ライブラリの画面でも触って動かせます（映像はそのまま、位置だけ動きます）。
       「触れたくない」人のために、❓謎設定「バーに触れても位置を移動しない」を用意しました（既定オフ）。
     ・🎲 シャッフルと 🔁 リピート（なし／1曲／全曲）を足しました。値は本体の設定
       （mediaShuffle／mediaRepeat）だけを使い、再生画面（js/media-player-mode.js）と同じ1つを共有します。
     ・⧉ 操作パネルを別窓に出す（PC型のみ。trk226 の js/player-panel.js。Document PiP が無ければ予備の小窓）。

   🎵 trk225：置き場所と「隠さない」を設定できるようにしました。
     ・settings.playerBarPos … スマホ型での置き場所。bottom（既定）＝画面のいちばん下（操作パネルはその上へ）／
       above＝操作パネルの上（trk221〜trk224 までと同じ）。PC型は下部ナビが無いので、どちらでも同じ（いちばん下）。
       これまではナビの上に載せていたため、ナビのぶんバーが押し上げられ、途中に浮いているように見えました。
     ・settings.playerBarLock … オンにすると ✕ を出さない（誤ってバーを消してしまう対策）。
       設定の「表示しない」は本人が選んだ操作なので、こちらは止めません（✕ だけを止める）。 */
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
  /* バーの置き場所（スマホ型）。bottom＝画面のいちばん下、above＝下部ナビの上。
     未設定・知らない値は bottom（trk225 の既定）。 */
  const POSITIONS = ["bottom", "above"];
  function barPos() {
    return POSITIONS.includes(core.settings.playerBarPos) ? core.settings.playerBarPos : "bottom";
  }
  /* バーの bottom（px）。下部ナビの上に置くときだけ、ナビの高さぶん持ち上げる。
     position を省いたときは「ナビの上」（呼び出し側の取り違えでバーがナビに重ならないように）。 */
  function barOffset(navHeight, position) {
    const h = Number(navHeight);
    const nav = Number.isFinite(h) && h > 0 ? Math.round(h) : 0;
    return position === "above" ? nav : 0;
  }
  /* バーを隠さない設定か（true なら ✕ を出さず、✕ からの「表示しない」もしない） */
  const barLocked = () => core.settings.playerBarLock === true;
  /* ❓謎設定「バーに触れても位置を移動しない」（trk226。既定オフ＝触れれば動く） */
  const seekLocked = () => core.settings.playerBarSeekLock === true;
  /* 再生位置の線を触れる状態か（純粋関数。テストで確かめる）
     ・位置が分かっている（duration > 0・読み込み済み）
     ・謎設定で止めていない
     ・プレイ中・一時停止中・曲を選んだタイトル画面のとき（リザルトでは動かさない） */
  function seekEnabled(ctx) {
    if (!ctx || ctx.locked) return false;
    if (!ctx.ready || !(Number(ctx.duration) > 0)) return false;
    return ctx.phase === "title" || ctx.phase === "playing" || ctx.phase === "paused";
  }
  /* リピートの段（既定は なし → 1曲 → 全曲 → なし）
     ❓trk227「リピートボタンを単曲リピートのみにする」がオンのときは なし ⇄ 1曲 の2段だけ */
  const REPEATS = ["off", "one", "all"];
  const repeatOneOnly = () => core.settings.playerBarRepeatOneOnly === true;
  const repeatChoices = oneOnly => (oneOnly ? ["off", "one"] : REPEATS);
  function nextRepeat(value, oneOnly) {
    const list = repeatChoices(oneOnly === true);
    const i = list.indexOf(value);
    return list[(i + 1) % list.length] || "off";
  }
  /* いまのリピート。単曲のみの設定で「全曲」が残っていたら「なし」として扱う（押せば 1曲 へ） */
  const repeatNow = () => {
    const value = core.settings.mediaRepeat;
    if (!REPEATS.includes(value)) return "off";
    return repeatOneOnly() && value === "all" ? "off" : value;
  };
  const shuffleNow = () => core.settings.mediaShuffle === true;
  /* ❓trk227「シャッフルは、いまの一覧（プレイリスト）の中から選ぶ」（既定オフ＝ライブラリ全体から） */
  const shuffleInList = () => core.settings.playerBarShuffleInList === true;
  /* シャッフルの ⏭ で選ぶ曲（純粋関数。テストで確かめる）
     ・シャッフルがオフ、または一覧が無ければ null（＝これまでどおり前後の曲）
     ・いまの曲を除いた中から選ぶ（1曲しか無ければその曲） */
  function shufflePick(list, currentKey, random = Math.random) {
    const items = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!items.length) return null;
    const other = items.filter(it => String(it.key) !== String(currentKey));
    const pool = other.length ? other : items;
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(Number(random()) * pool.length) || 0));
    return pool[index];
  }
  const barMode = () => (MODES.includes(core.settings.playerBar) ? core.settings.playerBar : "auto");

  /* ---------- DOM（はじめて必要になったときだけ作る） ---------- */
  let bar = null, artImg = null, artFallback = null, titleNode = null, artistNode = null;
  let prevButton = null, playButton = null, nextButton = null;
  let elapsedNode = null, totalNode = null, seekInput = null, volInput = null;
  let openButton = null, hideButton = null, shuffleButton = null, repeatButton = null, panelButton = null;
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
    /* 🎲 シャッフル・🔁 リピート（trk226）。値は再生画面と同じ設定を1つだけ使う */
    shuffleButton = makeButton("trk-pb-shuffle", "🎲");
    shuffleButton.setAttribute("aria-pressed", "false");
    repeatButton = makeButton("trk-pb-repeat", "🔁");
    repeatButton.setAttribute("aria-pressed", "false");
    transport.append(prevButton, playButton, nextButton, shuffleButton, repeatButton);

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
    /* ⧉ 操作パネルを別窓に出す（PC型のみ。trk226） */
    panelButton = makeButton("trk-pb-panel", "⧉");
    panelButton.hidden = true;
    hideButton = makeButton("trk-pb-hide", "✕");
    actions.append(volWrap, openButton, panelButton, hideButton);

    bar.append(seekInput, art, meta, transport, time, actions);

    prevButton.addEventListener("click", () => step(-1));
    nextButton.addEventListener("click", () => step(1));
    shuffleButton.addEventListener("click", toggleShuffle);
    repeatButton.addEventListener("click", cycleRepeat);
    panelButton.addEventListener("click", openPanel);
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
    /* 🎵 trk225：置き場所を **測る前に** body の印へ反映する。
       印が付くと「いちばん下」用に、バー自身が env(safe-area-inset-bottom) のぶん下余白を空けるので、
       先に測ると、その分だけ高さを低く見積もってしまう（iPhone でナビがバーに重なる）。 */
    const atBottom = barPos() === "bottom";
    if (document.body) document.body.classList.toggle("trk-playerbar-at-bottom", atBottom);
    /* 拡大率（CSS の zoom）がかかっていると offsetHeight は拡大前の値なので、実寸を測る */
    const rectNow = typeof bar.getBoundingClientRect === "function" ? bar.getBoundingClientRect() : null;
    const height = (rectNow && rectNow.height > 0 ? rectNow.height : bar.offsetHeight) || 60;
    root.style.setProperty("--trk-playerbar-h", `${Math.round(height)}px`);
    /* スマホのシェルでは、下部ナビとの前後を設定で選べる（trk225）。
       bottom＝画面のいちばん下（ナビはバーの高さぶん上へ。css/player-bar.css が動かす）
       above ＝下部ナビの上（ナビの高さをそのまま下の余白にする＝trk221〜trk224 までと同じ） */
    const nav = document.querySelector(".trk-mobile-nav");
    const navRect = nav && !nav.hidden && typeof nav.getBoundingClientRect === "function" ? nav.getBoundingClientRect() : null;
    const navHeight = nav && !nav.hidden ? ((navRect && navRect.height > 0 ? navRect.height : nav.offsetHeight) || 66) : 0;
    root.style.setProperty("--trk-playerbar-offset", `${barOffset(navHeight, atBottom ? "bottom" : "above")}px`);
    /* PC は 1920×1080 のステージを縮小して見せる。余白は縮小前の座標に直して渡す。
       🖥 trk223（2026-10-31 レビュー②）：拡大率を入れたので、ステージの「設計の高さ」は 1080 とは限らない
       （125% なら 864px、50% なら 2160px）。/1080 で割ると 125% では余白が足りず、50% では余りすぎるので、
       実際の設計の高さ（offsetHeight＝transform の影響を受けない）で割る。 */
    const shellMode = document.body.classList.contains("trk-mobile");
    const stage = document.getElementById("stage");
    const rect = stage && typeof stage.getBoundingClientRect === "function" ? stage.getBoundingClientRect() : null;
    const designH = stage && stage.offsetHeight > 0 ? stage.offsetHeight : 1080;
    const scale = !shellMode && rect && rect.height > 0 ? Math.max(0.05, rect.height / designH) : 1;
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
  /* 設定の欄（⚙ → 🖥 画面と再生バー）に、いまの値を見せる。
     バーを出していないとき（表示しない・プレイ中）にも呼べるよう、バーの中身には触りません。 */
  function syncControls() {
    const select = document.getElementById("playerBarMode");
    if (select && select.value !== barMode()) select.value = barMode();
    const posSelect = document.getElementById("playerBarPos");
    if (posSelect && posSelect.value !== barPos()) posSelect.value = barPos();
    const lockBox = document.getElementById("playerBarLock");
    if (lockBox && lockBox.checked !== barLocked()) lockBox.checked = barLocked();
    const seekLockBox = document.getElementById("playerBarSeekLock");
    if (seekLockBox && seekLockBox.checked !== seekLocked()) seekLockBox.checked = seekLocked();
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
    /* 🎲 シャッフル（trk226）：押されている状態を見た目と読み上げの両方に出す */
    const shuffled = shuffleNow();
    shuffleButton.setAttribute("aria-pressed", String(shuffled));
    shuffleButton.title = word("barShuffle") + (shuffled ? `（${word("barShuffleOn")}）` : `（${word("barShuffleOff")}）`);
    shuffleButton.setAttribute("aria-label", shuffleButton.title);
    shuffleButton.classList.toggle("is-on", shuffled);
    /* 🔁 リピート（trk226）：なし／1曲／全曲の3段。アイコンに段を出す */
    const repeat = repeatNow();
    repeatButton.textContent = repeat === "one" ? "🔂" : "🔁";
    repeatButton.setAttribute("aria-pressed", String(repeat !== "off"));
    repeatButton.classList.toggle("is-on", repeat !== "off");
    const repeatWord = word(repeat === "one" ? "barRepeatOne" : repeat === "all" ? "barRepeatAll" : "barRepeatOff");
    repeatButton.title = `${word("barRepeat")}（${repeatWord}）`;
    repeatButton.setAttribute("aria-label", repeatButton.title);
    /* ⧉ 別窓の操作パネル（PC型のみ。js/player-panel.js） */
    const canPanel = panelAvailable();
    panelButton.hidden = !canPanel;
    if (canPanel) {
      panelButton.title = word("barPanel");
      panelButton.setAttribute("aria-label", panelButton.title);
      panelButton.setAttribute("aria-pressed", String(panelOpen()));
      panelButton.classList.toggle("is-on", panelOpen());
    }
    seekInput.disabled = !seekEnabled({ phase: core.phase, ready: core.videoReady, duration: core.video ? core.video.duration : 0, locked: seekLocked() });
    seekInput.classList.toggle("is-locked", seekLocked());
    syncControls();
    /* 🔒 隠さない設定のときは ✕ を出さない（押せないボタンより、無いほうが迷わない） */
    hideButton.hidden = barLocked();
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
    /* 🎵 trk226：位置の線は、ライブラリの画面（試聴中）でも触れる。
       触れたくない人は ❓謎設定「バーに触れても位置を移動しない」で止められる。 */
    seekInput.disabled = !seekEnabled({ phase: core.phase, ready: core.videoReady, duration, locked: seekLocked() });
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
    /* 🎲 シャッフル中は、一覧の前後ではなく「ほかの曲から1つ」を選ぶ（再生画面と同じ考え方） */
    let next = null;
    if (shuffleNow()) {
      /* ❓trk227：範囲の設定がオンなら「いまの一覧（プレイリスト）」から、オフなら全体から */
      const pool = shuffleInList() && typeof lib.shufflePool === "function"
        ? lib.shufflePool()
        : (typeof lib.allSongs === "function" ? lib.allSongs() : []);
      next = shufflePick(pool, core.currentSong && core.currentSong.key);
    }
    if (!next) next = direction < 0 ? lib.prevSong() : lib.nextSong();
    if (!next) return;
    try { await lib.selectSong(next); } catch (_) {}
    sync();
  }
  /* ---------- 🎲 シャッフル・🔁 リピート（trk226。値は再生画面と同じ設定を1つだけ使う） ---------- */
  function announceOptions() {
    /* 再生画面（js/media-player-mode.js）と別窓のパネルへ「設定が変わった」を知らせる */
    try { if (typeof core.emit === "function") core.emit("mediaOptions"); } catch (_) {}
  }
  function toggleShuffle() {
    core.settings.mediaShuffle = !shuffleNow();
    if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
    toast(word(core.settings.mediaShuffle ? "barShuffleOnToast" : "barShuffleOffToast"));
    announceOptions();
    sync();
  }
  function cycleRepeat() {
    core.settings.mediaRepeat = nextRepeat(repeatNow(), repeatOneOnly());
    if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
    const now = repeatNow();
    toast(word(now === "one" ? "barRepeatOneToast" : now === "all" ? "barRepeatAllToast" : "barRepeatOffToast"));
    announceOptions();
    sync();
  }
  /* ---------- ⧉ 操作パネルを別窓に出す（PC型のみ） ---------- */
  function panelApi() { return window.Trk && window.Trk.playerPanel ? window.Trk.playerPanel : null; }
  function panelOpen() { const panel = panelApi(); return !!(panel && typeof panel.isOpen === "function" && panel.isOpen()); }
  /* 別窓を出せるか（純粋関数。テストで確かめる）
     ・スマホ型では出さない（下部ナビと重なるうえ、Document PiP は端末で使えない）
     ・js/player-panel.js が読めている
     ・窓を開く手段がある（Document PiP か、小窓） */
  function panelAllowed(ctx) {
    return !!(ctx && ctx.desktop && ctx.panel && ctx.openable);
  }
  function panelAvailable() {
    const panel = panelApi();
    if (!panel) return false;
    return panelAllowed({
      desktop: document.body ? !document.body.classList.contains("trk-mobile") : true,
      panel: true,
      openable: typeof panel.available === "function" ? panel.available() : false
    });
  }
  function openPanel() {
    const panel = panelApi();
    if (!panel || typeof panel.open !== "function") return;
    if (panel.isOpen && panel.isOpen()) { panel.close(); return; }
    try { panel.open(); } catch (_) {}
    sync();
  }
  function openPlayer() {
    if (window.TrkMediaPlayer && window.TrkMediaPlayer.open) window.TrkMediaPlayer.open();
  }
  function hideBar() {
    /* 🔒 「再生バーを隠さない」がオンのときは、✕ を出していない（念のためここでも止める） */
    if (barLocked()) { toast(word("barLocked")); return; }
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
    if (!seekEnabled({ phase: core.phase, ready: core.videoReady, duration, locked: seekLocked() })) return;
    const target = (Number(seekInput.value) / 1000) * duration;
    if (!Number.isFinite(target)) return;
    if (core.phase === "playing" || core.phase === "paused") {
      if (window.Trk.play && typeof window.Trk.play.seekTo === "function") window.Trk.play.seekTo(target);
      return;
    }
    /* 🎵 trk226：ライブラリの画面（試聴中・一時停止中）は、映像の位置だけを動かす。
       再生中ならそのまま鳴り続け、止まっていれば止まったまま位置だけ変わる。 */
    try { video.currentTime = target; } catch (_) {}
    tick();
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

  /* ---------- 別窓のパネルに渡す、いまの様子（trk226） ----------
     js/player-panel.js は、この1つの関数だけを見て絵を描き直します（状態を二重に持たない）。 */
  function snapshot() {
    const it = core.currentSong || null;
    const labels = songLabels(it);
    const video = core.video || null;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    const position = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const canSeek = seekEnabled({ phase: core.phase, ready: core.videoReady, duration, locked: seekLocked() });
    return {
      title: labels.title, artist: labels.artist,
      elapsed: fmtTime(position), total: duration ? fmtTime(duration) : "--:--",
      ratio: duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0,
      playing: !!(video && !video.paused && !video.ended),
      shuffle: shuffleNow(), repeat: repeatNow(),
      volume: Math.min(1, Math.max(0, Number(core.settings.musicVolume) || 0)),
      canSeek, seekLocked: seekLocked(), canStep: core.phase === "title",
      hasSong: !!it
    };
  }
  /* 別窓のパネルからの操作（どれもバーと同じ道を通る） */
  function seekToRatio(ratio) {
    const video = core.video;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    if (!seekEnabled({ phase: core.phase, ready: core.videoReady, duration, locked: seekLocked() })) return false;
    const value = Math.min(1, Math.max(0, Number(ratio) || 0));
    if (core.phase === "playing" || core.phase === "paused") {
      if (window.Trk.play && typeof window.Trk.play.seekTo === "function") window.Trk.play.seekTo(value * duration);
    } else {
      try { video.currentTime = value * duration; } catch (_) { return false; }
    }
    tick();
    return true;
  }
  function playPause() { togglePlay(); render(); }

  /* ---------- まとめ ---------- */
  function sync() {
    if (!document.body) return;
    build();
    if (!bar) return;
    const show = barVisible(contextNow());
    bar.hidden = !show;
    document.body.classList.toggle("trk-playerbar", show);
    syncControls();
    if (!show) { document.body.classList.remove("trk-playerbar-at-bottom"); return; }
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
     JS が測って配るので、切り替わったら測り直します（バーが隠れているときは何もしない）。
     ついでに、窓（ようこそ・確認・インストール案内）の開閉でも出し入れをやり直します。 */
  /* バーの出し入れに関わる窓か（modalOpen() と同じ顔ぶれ） */
  function isOverlayNode(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!(node.matches && node.matches('.plOverlay,.instOverlay,.iosInstall,[role="dialog"][aria-modal="true"],#welcomeBox'));
  }
  function watchShell() {
    if (typeof MutationObserver !== "function" || !document.body) return;
    try {
      new MutationObserver(records => {
        if (!bar) return;
        /* 🖥 trk223（2026-10-31 レビュー）：窓が閉じたときこそバーを出し直す必要があるので、
           「バーが隠れている」では早期に戻らない。ここは先に見る。 */
        if (records.some(record => record.type === "attributes" && isOverlayNode(record.target))) { sync(); return; }
        if (bar.hidden) return;
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
    /* 🎵 trk225：置き場所（スマホ型）と、隠さない設定 */
    const posSelect = document.getElementById("playerBarPos");
    if (posSelect) {
      posSelect.value = barPos();
      posSelect.addEventListener("change", () => {
        core.settings.playerBarPos = POSITIONS.includes(posSelect.value) ? posSelect.value : "bottom";
        if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
        sync();
      });
    }
    const lockBox = document.getElementById("playerBarLock");
    if (lockBox) {
      lockBox.checked = barLocked();
      lockBox.addEventListener("change", () => {
        core.settings.playerBarLock = lockBox.checked === true;
        if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
        sync();
      });
    }
    watchOverlay();
    watchShell();
    sync();
    /* 再生位置は、動いているあいだだけ細かく見る（止まっているときは何もしない） */
    setInterval(() => { if (!bar || bar.hidden) return; if (core.video && !core.video.paused) tick(); }, 250);
  }

  /* 🖥 trk223（レビュー②）：拡大率が変わるとステージの設計サイズが変わるので、測り直が要ります */
  for (const name of ["language", "settings", "settingsClose", "phase", "screen", "songSelected", "songTags", "nowPlaying", "mediaReady", "studyOpen", "studyClose", "skin", "lite", "uiscale", "mediaOptions"]) {
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
    position: barPos,
    locked: barLocked,
    positions: POSITIONS,
    /* 🎵 trk226：位置の線・シャッフル・リピート・別窓のパネル */
    seekEnabled,
    seekLocked,
    nextRepeat,
    repeatChoices,
    repeatOneOnly,
    shuffleInList,
    shufflePick,
    panelAllowed,
    seekToRatio,
    snapshot,
    playPause,
    step,
    setVolume,
    shuffle: toggleShuffle,
    repeat: cycleRepeat,
    shuffled: shuffleNow,
    repeatMode: repeatNow,
    panelOpen: openPanel,
    formatTime: fmtTime,
    mode: barMode,
    setMode,
    sync,
    visible: () => !!(bar && !bar.hidden)
  });
})();

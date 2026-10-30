// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ スマホ用の画面シェル（iPhone / Android のブラウザ・ホーム画面アプリ） ============

   これまでの trk! は PC の広い画面を前提にしていて、スマホでは
   「曲リスト」「曲の詳細」「設定」が縦に長く並ぶだけで、行き来に指のスクロールが要りました。
   このファイルは、選曲画面に下部ナビゲーション（ライブラリ／エフェクト／再生／書斎／ゲーム）を足し、
   1画面に1つの役割だけを出します。ゲーム中（phase が play）は今までどおりのステージです。

   ・端末の判定は js/lite.js の TrkLite.info()（同じ判定を2か所に書かない）。
   ・PC では body に trk-mobile を付けず、ナビも作りません（デスクトップの見た目は変えません）。
   ・画面の移動は既存の窓口（core.showScreen / TrkMediaPlayer / TrkStudyRoom）を呼ぶだけで、
      新しい状態や保存キーは増やしません。
   ・エフェクト画面の EQ は、設定（⚙）の #fxPanel にある本物のスライダーを映す鏡です。
      二重の保存はせず、値を写して input を送るだけです。 */
(() => {
  "use strict";
  const core = window.Trk.core;
  if (!core) return;

  /* ---------- 端末の判定（スマホ・タブレットのときだけ働く） ---------- */
  function isMobile() {
    try {
      const info = window.TrkLite && typeof window.TrkLite.info === "function" ? window.TrkLite.info() : null;
      if (info) return !!info.mobile;
    } catch (_) { /* TrkLite が読めないときは下の控えで判定する */ }
    try {
      return !!(window.matchMedia && (window.matchMedia("(pointer:coarse)").matches || window.matchMedia("(hover:none)").matches)) ||
        /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(String(navigator.userAgent || ""));
    } catch (_) { return false; }
  }
  if (!isMobile()) return;
  document.body.classList.add("trk-mobile");

  const labels = {
    ja: { nav: ["ライブラリ", "エフェクト", "再生", "書斎", "ゲーム"], navLabel: "メインナビゲーション", import: "＋ コンテンツを追加", game: "ゲームモードへ", sound: "音のエフェクト", soundHint: "音楽や動画の音に適用します。", eq: "かんたんEQ", eqHint: "調整するとエフェクトがオンになります。", eqReset: "EQをリセット", off: "オフ", previous: "前のプリセット", next: "次のプリセット", video: "映像のエフェクト", videoHint: "映像の色調を変更します。一部の映像演出はゲーム画面向けです。", advanced: "詳細設定（再生画面を閉じる）", current: "現在のカスタム設定", play: "再生", pause: "一時停止", noTrack: "曲を選んで再生すると、ここでも操作できます。", rotateTitle: "横向きにしてください", rotateHint: "ゲームは横長の画面で遊ぶのがいちばん快適です。端末を横向きにすると、この案内は消えます。" },
    en: { nav: ["Library", "Effects", "Player", "Study", "Game"], navLabel: "Main navigation", import: "＋ Add content", game: "Go to game mode", sound: "Audio effects", soundHint: "Applied to music and video audio.", eq: "Quick EQ", eqHint: "Adjusting EQ turns effects on.", eqReset: "Reset EQ", off: "Off", previous: "Previous preset", next: "Next preset", video: "Video effects", videoHint: "Change the video color. Some visual overlays are for gameplay only.", advanced: "Advanced settings (closes player)", current: "Current custom setting", play: "Play", pause: "Pause", noTrack: "Choose and play a track to control it here.", rotateTitle: "Turn your device sideways", rotateHint: "The game is happiest on a wide screen. This note disappears in landscape." },
    zh: { nav: ["媒体库", "音效", "播放", "书斋", "游戏"], navLabel: "主导航", import: "＋ 添加内容", game: "进入游戏模式", sound: "声音效果", soundHint: "应用于音乐和视频的声音。", eq: "简易均衡器", eqHint: "调整均衡器会启用音效。", eqReset: "重置均衡器", off: "关闭", previous: "上一个预设", next: "下一个预设", video: "视频效果", videoHint: "改变画面色调。部分视觉效果仅用于游戏画面。", advanced: "详细设置（关闭播放器）", current: "当前自定义设置", play: "播放", pause: "暂停", noTrack: "选择并播放曲目后可在此操作。", rotateTitle: "请把设备横过来", rotateHint: "游戏在宽屏上最舒服。横过来后这条提示就消失。" },
    ko: { nav: ["라이브러리", "효과", "재생", "서재", "게임"], navLabel: "메인 내비게이션", import: "＋ 콘텐츠 추가", game: "게임 모드로", sound: "오디오 효과", soundHint: "음악과 동영상의 소리에 적용합니다.", eq: "간단 EQ", eqHint: "EQ를 조정하면 효과가 켜집니다.", eqReset: "EQ 초기화", off: "끄기", previous: "이전 프리셋", next: "다음 프리셋", video: "영상 효과", videoHint: "영상의 색감을 바꿉니다. 일부 영상 효과는 게임 화면 전용입니다.", advanced: "상세 설정 (플레이어 닫기)", current: "현재 사용자 설정", play: "재생", pause: "일시정지", noTrack: "곡을 선택해 재생하면 여기서도 조작할 수 있습니다.", rotateTitle: "가로로 돌려 주세요", rotateHint: "게임은 넓은 화면이 가장 쾌적합니다. 가로로 돌리면 이 안내는 사라집니다." }
  };
  const words = () => labels[core.settings.language] || labels.en;
  const items = [["library", "♫"], ["effects", "◉"], ["player", "▶"], ["study", "▤"], ["game", "◆"]];
  let view = "library", mediaEffects = false, stageMarker = null;

  /* ---------- ナビゲーション ---------- */
  const nav = document.createElement("nav");
  nav.className = "trk-mobile-nav";
  const grid = document.querySelector("#selectScreen .selectGrid");

  /* ---------- エフェクト画面 ---------- */
  const effects = document.createElement("section");
  effects.className = "trk-effects";
  effects.id = "trkEffects";
  effects.setAttribute("aria-labelledby", "trkEffectsTitle");
  const heading = document.createElement("h2");
  heading.id = "trkEffectsTitle";
  heading.tabIndex = -1;
  const now = document.createElement("div");
  now.className = "trk-effects-now";
  const nowName = document.createElement("span");
  nowName.className = "trk-effects-track";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.id = "trkEffectsPlay";
  const stageHost = document.createElement("div");
  stageHost.className = "trk-effects-stage";
  now.append(nowName, playButton);

  const sound = document.createElement("section");
  sound.className = "trk-effect-card";
  const soundTitle = document.createElement("h3"), soundHint = document.createElement("p");
  const soundSelect = document.createElement("select");
  soundSelect.id = "trkSoundPreset";
  soundSelect.setAttribute("aria-labelledby", "trkSoundTitle");
  soundTitle.id = "trkSoundTitle";
  const soundActions = document.createElement("div");
  soundActions.className = "trk-effect-actions";
  const prev = document.createElement("button"), next = document.createElement("button"), off = document.createElement("button");
  for (const button of [prev, next, off]) button.type = "button";
  prev.id = "trkSoundPrev"; next.id = "trkSoundNext"; off.id = "trkSoundOff";
  soundActions.append(prev, next, off);
  sound.append(soundTitle, soundHint, soundSelect, soundActions);

  /* EQ は #fxPanel（js/fx.js が作る本物の設定）を映す。読めなければ鏡を作らない。 */
  const eqTitle = document.createElement("h3"), eqHint = document.createElement("p"), eqRows = document.createElement("div");
  eqTitle.className = "trk-eq-title";
  eqRows.className = "trk-eq-rows";
  const sourceEq = [];
  let eqRow = document.querySelector('#fxPanel [data-i18n="sfxEqLabel"]');
  for (let i = 0; i < 5 && eqRow; i++) {
    eqRow = eqRow.nextElementSibling;
    const input = eqRow && eqRow.querySelector('input[type="range"]');
    if (!input) { sourceEq.length = 0; break; }
    sourceEq.push(input);
  }
  const eqMirrors = sourceEq.map((source, i) => {
    const label = document.createElement("label"), name = document.createElement("span"), range = document.createElement("input"), value = document.createElement("output");
    label.className = "trk-eq-row";
    name.textContent = ["60 Hz", "250 Hz", "1 kHz", "4 kHz", "12 kHz"][i];
    range.type = "range";
    range.min = source.min; range.max = source.max; range.step = source.step;
    range.setAttribute("aria-label", name.textContent);
    range.addEventListener("input", () => {
      source.value = range.value;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      syncEqControls();
    });
    label.append(name, range, value);
    eqRows.append(label);
    return { source, range, value };
  });
  const eqReset = document.createElement("button");
  eqReset.type = "button";
  eqReset.id = "trkEqReset";
  eqReset.addEventListener("click", () => {
    const reset = document.querySelector('#fxPanel [data-i18n="sfxEqReset"]');
    if (reset) reset.click();
    syncEqControls();
  });
  if (eqMirrors.length === 5) sound.append(eqTitle, eqHint, eqRows, eqReset);

  function syncEqControls() {
    for (const row of eqMirrors) {
      row.range.value = row.source.value;
      row.value.textContent = `${Number(row.source.value) > 0 ? "+" : ""}${row.source.value} dB`;
    }
  }
  for (const row of eqMirrors) {
    const originalValue = row.source.parentElement && row.source.parentElement.querySelector(".mono");
    if (originalValue) new MutationObserver(syncEqControls).observe(originalValue, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 映像のエフェクト ---------- */
  const video = document.createElement("section");
  video.className = "trk-effect-card";
  const videoTitle = document.createElement("h3"), videoHint = document.createElement("p");
  videoTitle.id = "trkVideoTitle";
  const videoSelect = document.createElement("select");
  videoSelect.id = "trkVideoPreset";
  videoSelect.setAttribute("aria-labelledby", "trkVideoTitle");
  video.append(videoTitle, videoHint, videoSelect);
  const advanced = document.createElement("button");
  advanced.type = "button";
  advanced.id = "trkEffectsAdvanced";
  advanced.className = "trk-effects-advanced";
  effects.append(heading, now, stageHost, sound, video, advanced);
  if (grid) grid.append(effects);

  /* ---------- 画面の切り替え ---------- */
  function isMediaOpen() { return !!(window.TrkMediaPlayer && window.TrkMediaPlayer.isOpen()); }
  function restoreStage() {
    if (stageMarker) {
      const stage = stageHost.querySelector(".mediaStage");
      if (stage && stageMarker.parentNode) stageMarker.replaceWith(stage);
      else stageMarker.remove();
      stageMarker = null;
    }
  }
  function placeEffects(inMedia) {
    const dialog = document.querySelector("#mediaPlayerMode .mediaDialog");
    if (inMedia && dialog) {
      if (effects.parentNode !== dialog) dialog.insertBefore(effects, nav.parentNode === dialog ? nav : null);
      const stage = dialog.querySelector(".mediaBody .mediaStage");
      if (stage && !stageMarker) { stageMarker = document.createComment("media stage position"); stage.before(stageMarker); stageHost.append(stage); }
    } else {
      restoreStage();
      if (grid && effects.parentNode !== grid) grid.append(effects);
    }
  }
  function setView(nextView) {
    view = ["library", "effects", "game"].includes(nextView) ? nextView : "library";
    document.body.dataset.trkView = view;
    const card = document.querySelector("#selectScreen .card");
    if (card) card.scrollTop = 0;
  }
  function navigate(name) {
    const open = isMediaOpen();
    if (name === "effects" && open) mediaEffects = true;
    else if (name === "player") {
      mediaEffects = false;
      if (!open && window.TrkMediaPlayer) window.TrkMediaPlayer.open();
    } else {
      mediaEffects = false;
      if (open) window.TrkMediaPlayer.close();
      if (name === "study") { if (window.TrkStudyRoom) window.TrkStudyRoom.open(); }
      else setView(name);
    }
    sync();
  }
  /* 🎬 GAME から戻ってきたとき、再生画面を開き直すための窓口（js/media-player-mode.js などから使える） */
  window.TrkMobileReturnToPlayer = () => { if (isMediaOpen() && mediaEffects) navigate("player"); };

  const buttons = items.map(([name, icon]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.destination = name;
    const symbol = document.createElement("span");
    symbol.textContent = icon;
    symbol.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "trk-mobile-nav-label";
    button.append(symbol, label);
    nav.append(button);
    button.addEventListener("click", () => navigate(name));
    return button;
  });
  document.body.append(nav);

  function fillSelect(select, entries, value, fallback) {
    select.replaceChildren();
    if (fallback) { const option = document.createElement("option"); option.value = value; option.textContent = fallback; select.append(option); }
    for (const [id, name] of entries) { const option = document.createElement("option"); option.value = id; option.textContent = name; select.append(option); }
    select.value = value;
  }
  function syncEffects() {
    const text = words(), fx = window.TrkFX, tv = window.TrkTV;
    heading.textContent = text.nav[1];
    soundTitle.textContent = text.sound;
    soundHint.textContent = text.soundHint;
    eqTitle.textContent = text.eq;
    eqHint.textContent = text.eqHint;
    eqReset.textContent = text.eqReset;
    syncEqControls();
    videoTitle.textContent = text.video;
    videoHint.textContent = text.videoHint;
    advanced.textContent = text.advanced;
    prev.textContent = "‹"; prev.setAttribute("aria-label", text.previous);
    next.textContent = "›"; next.setAttribute("aria-label", text.next);
    off.textContent = text.off;
    const presets = fx ? fx.list() : [];
    const selected = core.settings.fxOn ? String(core.settings.fxPreset || "") : "";
    const missing = !!selected && !presets.some(p => p.id === selected);
    fillSelect(soundSelect, [["", text.off], ...presets.map(p => [p.id, p.name])], selected, missing ? text.current : "");
    soundSelect.disabled = !fx; prev.disabled = !fx; next.disabled = !fx; off.disabled = !fx || !core.settings.fxOn;
    /* 映像は、色調のフィルターだけを選ぶ（overlay はゲーム画面向けなので出さない） */
    const videos = tv ? tv.list().filter(p => !p.off && !p.overlay) : [];
    const videoValue = tv ? tv.current() : "";
    const unknownVideo = !!videoValue && !videos.some(p => p.id === videoValue);
    fillSelect(videoSelect, videos.map(p => [p.id, p.name]), videoValue, unknownVideo ? text.current : "");
    videoSelect.disabled = !tv || !videos.length;
    const filter = tv && typeof tv.filter === "function" ? tv.filter() : "none";
    document.body.style.setProperty("--trk-video-filter", filter || "none");
    const open = isMediaOpen();
    now.hidden = !open;
    const title = document.querySelector("#mediaPlayerMode .mediaDisplayTitle");
    nowName.textContent = core.currentSong && title ? title.textContent : text.noTrack;
    playButton.textContent = core.video && !core.video.paused ? text.pause : text.play;
    playButton.disabled = !core.videoReady || !core.currentSong;
  }
  function visibleModal() {
    return [...document.querySelectorAll('.plOverlay,[role="dialog"][aria-modal="true"]')].some(node => {
      if (node.closest("[hidden]")) return false;
      if (node.classList.contains("mediaDialog")) return false;
      return true;
    });
  }
  function sync() {
    const text = words(), open = isMediaOpen();
    if (!open) mediaEffects = false;
    document.body.classList.toggle("trk-media-effects", open && mediaEffects);
    const dialog = document.querySelector("#mediaPlayerMode .mediaDialog");
    if (dialog) dialog.setAttribute("aria-labelledby", open && mediaEffects ? "trkEffectsTitle" : "mediaTitle");
    if (open && dialog) { if (nav.parentNode !== dialog) dialog.append(nav); }
    else if (nav.parentNode !== document.body) document.body.append(nav);
    placeEffects(open && mediaEffects);
    effects.hidden = open ? !mediaEffects : view !== "effects";
    nav.setAttribute("aria-label", text.navLabel);
    const active = open ? (mediaEffects ? "effects" : "player") : view;
    buttons.forEach((button, i) => {
      button.querySelector(".trk-mobile-nav-label").textContent = text.nav[i];
      if (items[i][0] === active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const select = document.getElementById("selectScreen");
    const blockingModal = visibleModal();
    nav.hidden = core.phase !== "title" || !select || select.hidden || document.body.classList.contains("study-room-open") || blockingModal;
    /* 🛟 セーフモードの浮きボタン（緊急復旧）は、元から常に出ているボタン。
       ほかの窓が開いているときだけ引っ込める（重なって押せないのを避ける）。
       プレイ中も消さない：壊れたときの逃げ道を残す。 */
    const floatingButton = document.getElementById("floatingSafeBtn");
    if (floatingButton) floatingButton.hidden = blockingModal;
    ensureMediaGame();
    const gameButton = document.getElementById("trkMediaGame");
    if (gameButton) gameButton.textContent = text.game;
    const summary = document.getElementById("trkImportSummary");
    if (summary) summary.textContent = text.import;
    syncEffects();
  }
  soundSelect.addEventListener("change", () => { if (window.TrkFX) { if (soundSelect.value) window.TrkFX.select(soundSelect.value); else window.TrkFX.off(); } syncEffects(); });
  prev.addEventListener("click", () => { if (window.TrkFX) window.TrkFX.prev(); syncEffects(); });
  next.addEventListener("click", () => { if (window.TrkFX) window.TrkFX.next(); syncEffects(); });
  off.addEventListener("click", () => { if (window.TrkFX) window.TrkFX.off(); syncEffects(); });
  videoSelect.addEventListener("change", () => { if (window.TrkTV) window.TrkTV.select(videoSelect.value); syncEffects(); });
  playButton.addEventListener("click", () => { const button = document.querySelector("#mediaPlayerMode .mediaPlayBtn"); if (button) button.click(); });
  advanced.addEventListener("click", () => {
    if (isMediaOpen()) window.TrkMediaPlayer.close();
    mediaEffects = false; setView("effects"); sync();
    core.openSettings();
    const panel = document.getElementById("fxPanel");
    if (panel) { panel.open = true; setTimeout(() => panel.scrollIntoView({ block: "start" }), 50); }
  });

  /* ---------- 縦向きの案内（ゲーム中だけ） ---------- */
  const rotate = document.createElement("div");
  rotate.className = "rotateHint";
  rotate.hidden = true;
  const rotateCard = document.createElement("div");
  rotateCard.className = "rotateHintCard";
  const rotateTitle = document.createElement("strong");
  const rotateNote = document.createElement("span");
  rotateCard.append(rotateTitle, rotateNote);
  rotate.append(rotateCard);
  document.body.append(rotate);
  function syncRotate() {
    const text = words();
    rotateTitle.textContent = text.rotateTitle;
    rotateNote.textContent = text.rotateHint;
    let portrait = false;
    try { portrait = !!(window.matchMedia && window.matchMedia("(orientation: portrait)").matches); } catch (_) {}
    rotate.hidden = !(core.phase === "play" && portrait);
  }
  try { window.matchMedia("(orientation: portrait)").addEventListener("change", syncRotate); } catch (_) { /* 古い Safari は addListener だけ */ }

  /* ---------- 再生画面（メディアプレーヤー）の中に「ゲームモードへ」を置く ----------
     プレーヤーの窓は初めて開いたときに作られるので、出来たのを見つけてから足す。 */
  function ensureMediaGame() {
    if (document.getElementById("trkMediaGame")) return;
    const header = document.querySelector("#mediaPlayerMode .mediaHeader");
    if (!header) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "trkMediaGame";
    button.className = "trk-mobile-media-game";
    button.addEventListener("click", () => navigate("game"));
    header.append(button);
  }

  /* ---------- 再生画面の開閉を受け取る ----------
     メディアプレーヤーは core のイベントを出さないので、全画面の重ね表示の窓口
     （window.Trk.overlay.set）を包んで、開閉のたびに sync を呼ぶ。
     元の動きはそのまま返すだけ（ほかの画面の開閉にも手を出さない）。 */
  function watchOverlay() {
    const overlay = window.Trk && window.Trk.overlay;
    if (!overlay || typeof overlay.set !== "function" || overlay.__trkMobileWatched) return;
    const original = overlay.set;
    overlay.set = function (name, open) {
      const result = original.call(overlay, name, open);
      if (name === "media") sync();
      return result;
    };
    try { Object.defineProperty(overlay, "__trkMobileWatched", { value: true }); } catch (_) {}
  }

  /* ---------- 起動 ---------- */
  function init() {
    /* スマホでは「＋ コンテンツを追加」を閉じた状態から始める（曲リストを先に見せる） */
    const importDetails = document.getElementById("trkImportDetails");
    if (importDetails) importDetails.open = false;
    ensureMediaGame();
    watchOverlay();
    setView("library");
    sync();
  }
  for (const event of ["language", "screen", "phase", "studyOpen", "studyClose"]) core.on(event, sync);
  for (const event of ["fxRack", "tvChange", "songSelected", "mediaReady", "songTags", "skin", "lite"]) core.on(event, syncEffects);
  if (core.video) for (const event of ["play", "pause", "ended"]) core.video.addEventListener(event, syncEffects);
  core.on("phase", syncRotate);
  new MutationObserver(() => { if (core.phase === "title") sync(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  /* タイトル画面のモーダル（プレイリスト・ようこそ・インストール案内）が開いたらナビを引っ込める。
     プレイ中は、無関係な変化を走査しない。 */
  new MutationObserver(records => {
    if (core.phase !== "title") return;
    const modal = node => node.nodeType === 1 && (node.matches('.plOverlay,[role="dialog"][aria-modal="true"],.instOverlay,.iosInstall') || node.querySelector('.plOverlay,[role="dialog"][aria-modal="true"],.instOverlay,.iosInstall'));
    if (records.some(r => r.type === "attributes" ? modal(r.target) : [...r.addedNodes, ...r.removedNodes].some(modal))) sync();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();

  window.Trk = window.Trk || {};
  window.Trk.mobileShell = Object.freeze({ active: true, view: () => view, navigate });
})();

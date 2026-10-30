// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ 🍎 iPhone / iPad 向けの調整（iOS の Safari・ホーム画面アプリ） ============

   iOS には Android のようなインストールの自動案内（beforeinstallprompt）がありません。
   そのため、次の3つをこのファイルだけで行います（他の端末では何もしません）。

   1. インストール案内 … Safari のタブで開いているときだけ「共有 → ホーム画面に追加」を案内する。
      一度閉じたら、その端末ではもう出さない（localStorage: trk_ios_install_v1）。
      設定（⚙）の「🍎 iPhoneで使う」から、いつでも開き直せる。
   2. 音のセッション … タップを起点に navigator.audioSession.type = "playback" を設定する
      （画面ロックや他のアプリへ移ったあとも音楽を続けやすくする。Chromium には無い API）。
   3. ことばの言い換え … iOS はフォルダの恒久アクセス（showDirectoryPicker）が無いので、
      「共有」ではなく「フォルダを選ぶ」と表示する。

   保存は増やさない：案内を閉じた印だけが trk_ios_install_v1（このファイル専用）です。 */
(() => {
  "use strict";
  const ua = String(navigator.userAgent || "");
  const iPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  const iOS = /iPad|iPhone|iPod/.test(ua) || iPadOS;
  if (!iOS) return;
  const core = window.Trk && window.Trk.core;
  if (!core) return;

  const DISMISS_KEY = "trk_ios_install_v1";
  document.body.classList.add("ios");

  /* ---------- 1. 音のセッション（タップを起点に playback を宣言する） ---------- */
  function claimPlaybackSession() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback";
    } catch (_) { /* 未対応の iOS・設定できない場合はそのまま */ }
  }
  for (const type of ["pointerdown", "touchstart", "keydown"]) {
    window.addEventListener(type, claimPlaybackSession, { capture: true, passive: true });
  }
  /* 再生が始まるたびに言い直す（画面ロックの直前に別のセッションへ戻ることがあるため） */
  try { core.on("mediaReady", claimPlaybackSession); } catch (_) {}
  try { core.on("beforePlay", claimPlaybackSession); } catch (_) {}
  if (core.video) {
    for (const type of ["play", "playing"]) core.video.addEventListener(type, claimPlaybackSession);
  }

  /* ---------- 2. インストール案内 ---------- */
  const isStandalone = () => {
    try {
      return (window.matchMedia && (window.matchMedia("(display-mode:standalone)").matches ||
        window.matchMedia("(display-mode:fullscreen)").matches)) || navigator.standalone === true;
    } catch (_) { return navigator.standalone === true; }
  };
  function dismissed() {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch (_) { return false; }
  }
  function rememberDismissed() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch (_) {}
  }

  const overlay = document.createElement("div");
  overlay.className = "iosInstall";
  overlay.id = "iosInstall";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "iosInstallTitle");
  overlay.hidden = true;
  const card = document.createElement("div");
  card.className = "iosInstallCard";
  const title = document.createElement("h2");
  title.id = "iosInstallTitle";
  const lead = document.createElement("p");
  const steps = document.createElement("ol");
  steps.className = "iosInstallSteps";
  const step1 = document.createElement("li");
  const step2 = document.createElement("li");
  const step3 = document.createElement("li");
  steps.append(step1, step2, step3);
  const note = document.createElement("p");
  note.className = "iosInstallNote";
  const actions = document.createElement("div");
  actions.className = "iosInstallActions";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "primary";
  close.id = "iosInstallClose";
  const later = document.createElement("button");
  later.type = "button";
  later.id = "iosInstallLater";
  actions.append(close, later);
  card.append(title, lead, steps, note, actions);
  overlay.append(card);

  let lastFocus = null;
  function openGuide() {
    if (isStandalone()) return;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    fill();
    try { close.focus({ preventScroll: true }); } catch (_) { close.focus(); }
  }
  function hideGuide(remember) {
    overlay.hidden = true;
    if (remember) rememberDismissed();
    if (lastFocus && typeof lastFocus.focus === "function") { try { lastFocus.focus({ preventScroll: true }); } catch (_) {} }
  }
  close.addEventListener("click", () => hideGuide(true));
  later.addEventListener("click", () => hideGuide(true));
  overlay.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); hideGuide(true); }
    if (event.key !== "Tab") return;
    const focusable = [close, later];
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  });
  document.body.append(overlay);

  function fill() {
    title.textContent = tr("iosInstallTitle");
    lead.textContent = tr("iosInstallLead");
    step1.textContent = tr("iosInstallStep1");
    step2.textContent = tr("iosInstallStep2");
    step3.textContent = tr("iosInstallStep3");
    note.textContent = tr("iosInstallNote");
    close.textContent = tr("iosInstallClose");
    later.textContent = tr("iosInstallLater");
  }

  /* 設定（⚙）の「🍎 iPhoneで使う」から開き直す／更新を確かめる */
  const again = document.getElementById("iosInstallBtn");
  if (again) again.addEventListener("click", openGuide);
  const update = document.getElementById("iosUpdateBtn");
  const updateStatus = document.getElementById("iosUpdateStatus");
  if (update) {
    update.addEventListener("click", async () => {
      update.disabled = true;
      if (updateStatus) updateStatus.textContent = tr("iosUpdateChecking");
      try {
        const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (registration) await registration.update();
        if (updateStatus) updateStatus.textContent = tr("iosUpdateDone");
        /* 新しい版があれば、次の読み込みで入れ替わる。いま開き直して揃える。 */
        setTimeout(() => { try { location.reload(); } catch (_) {} }, 450);
      } catch (_) {
        if (updateStatus) updateStatus.textContent = tr("iosUpdateFailed");
        update.disabled = false;
      }
    });
  }

  /* 初回の案内：タイトル画面が出て、しばらくしてから1回だけ。
     ヘルプを隠す設定（helpText = off）の人には出さない。 */
  if (!dismissed() && !isStandalone() && core.settings.helpText !== false) {
    setTimeout(() => {
      if (dismissed() || isStandalone() || overlay.hidden === false) return;
      if (core.phase !== "title") return;
      if (document.body.classList.contains("helpTextOff")) return;
      openGuide();
    }, 2600);
  }

  /* ---------- 3. ことばの言い換え（iOS にはフォルダの恒久アクセスが無い） ---------- */
  function relabel(id, key) {
    const node = document.getElementById(id);
    if (!node) return;
    node.setAttribute("data-i18n", key);
    node.textContent = tr(key);
  }
  relabel("libShareBtn", "libPickFolderIos");
  relabel("libShareSettingsBtn", "libPickFolderIos");
  const shareHint = document.querySelector("#libSharePanel .hint[data-i18n='libShareHint']");
  if (shareHint) {
    shareHint.setAttribute("data-i18n", "libShareHintIos");
    shareHint.textContent = tr("libShareHintIos");
  }
  try { core.on("language", () => { fill(); relabel("libShareBtn", "libPickFolderIos"); relabel("libShareSettingsBtn", "libPickFolderIos"); if (shareHint) shareHint.textContent = tr("libShareHintIos"); }); } catch (_) {}

  window.Trk = window.Trk || {};
  window.Trk.ios = Object.freeze({
    ios: true,
    standalone: isStandalone,
    showInstallGuide: openGuide,
    claimPlaybackSession
  });
})();

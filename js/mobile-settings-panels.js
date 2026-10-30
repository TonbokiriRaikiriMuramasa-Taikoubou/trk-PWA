// SPDX-License-Identifier: GPL-3.0-or-later
/* 設定（⚙）で「自分で開いた欄」を覚える（スマホでは欄が縦に長いため）。

   ・開いた／閉じたのは、利用者が summary を押したときだけ記録する。
     設定の絞り込み（🔍）が一時的に開く欄や、プリセットの折りたたみは記録しない。
   ・保存先は trk_mobile_settings_panels_v1（このファイルだけの新しいキー）。
     アプリ本体の設定（shadow_taiko_preferences_v2）は増やさない。
   ・スマホ用シェル（js/mobile-shell.js）が body.trk-mobile を付けたときだけ働く。
     PC では今までどおり、開くたびに既定の状態から始まる。 */
(() => {
  "use strict";
  if (!document.body.classList.contains("trk-mobile")) return;
  const storageKey = "trk_mobile_settings_panels_v1";
  const settingsScreen = document.getElementById("settingsScreen");
  if (!settingsScreen) return;
  let saved = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed;
  } catch (_) { /* 保存が使えなくても、このセッションの中では設定は動く */ }

  const isSettingsPanel = panel => panel && panel.tagName === "DETAILS" && settingsScreen.contains(panel) && !panel.closest(".fxGrid");
  function keyOf(panel) {
    if (panel.id) return "id:" + panel.id;
    const summary = Array.from(panel.children).find(child => child.tagName === "SUMMARY");
    const key = summary && (summary.dataset.i18n || (summary.querySelector("[data-i18n]") || {}).dataset?.i18n);
    return key ? "label:" + key : "";
  }
  function initialize() {
    for (const panel of settingsScreen.querySelectorAll("details")) {
      if (!isSettingsPanel(panel)) continue;
      const key = keyOf(panel);
      panel.open = !!key && saved[key] === true;
    }
  }
  function searching() {
    const input = document.getElementById("settingsSearch");
    return !!(input && input.value.trim());
  }
  settingsScreen.addEventListener("click", event => {
    const summary = event.target.closest && event.target.closest("summary");
    const panel = summary && summary.parentElement;
    if (!isSettingsPanel(panel) || searching() || event.defaultPrevented) return;
    const key = keyOf(panel);
    if (!key) return;
    const wasOpen = panel.open;
    /* details の既定の動作は click の後に起きる。実際に変わったときだけ覚える。 */
    setTimeout(() => {
      if (searching() || panel.open === wasOpen) return;
      saved[key] = panel.open;
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) {}
    }, 0);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ 🖥 画面と再生バーの追加の設定（trk222） ============

   設定（⚙ → 🖥 画面と再生バー／❓ 謎設定）の次の4つを配線します。

     #uiScale        … 拡大率 50／75／100／125%（既定 100%）
     #fixedIconSize  … アイコンの大きさを 100% で固定する（既定オン）
     #uiModeLock     … 画面の形は、常に選んだものを使う（❓ 謎設定。既定オン）
     #fxInLibrary    … スマホ型で、エフェクトの欄をライブラリにも出す（既定オフ）

   ・保存は本体の設定（core.settings）だけ。新しい保存キーは増やしません。
   ・画面の形そのものの切り替えは js/mobile-shell.js、再生バーは js/player-bar.js が担当します。
   ・ここは「値を読む／書く／反映を頼む」だけで、見た目の計算は core.applyUiScale() に任せます。 */
(() => {
  "use strict";
  const core = window.Trk && window.Trk.core;
  if (!core) return;

  const fields = {
    fixedIconSize: "fixedIconSize",
    uiModeLock: "uiModeLock",
    fxInLibrary: "fxInLibrary",
    playerBarSeekLock: "playerBarSeekLock"      /* 🎵 trk226：バーに触れても位置を移動しない（既定オフ） */
  };
  /* 既定が「オン」の設定と「オフ」の設定が混ざっているので、どちらかを明示する */
  const DEFAULT_ON = new Set(["fixedIconSize", "uiModeLock"]);

  /* 設定の欄へ、いまの値を写す（起動時・言語やスキンの切り替え・設定を開いたとき） */
  function sync() {
    const scale = document.getElementById("uiScale");
    if (scale) {
      const value = String(core.uiScaleValue ? core.uiScaleValue() : core.settings.uiScale);
      if (scale.value !== value) scale.value = value;
    }
    for (const [id, key] of Object.entries(fields)) {
      const input = document.getElementById(id);
      if (input) {
        const on = DEFAULT_ON.has(id) ? core.settings[key] !== false : core.settings[key] === true;
        if (input.checked !== on) input.checked = on;
      }
    }
  }

  function save() {
    if (typeof core.saveUserPrefs === "function") core.saveUserPrefs();
  }

  function wire() {
    const scale = document.getElementById("uiScale");
    if (scale) {
      scale.addEventListener("change", () => {
        core.settings.uiScale = Number(scale.value);
        core.applyUiScale({ persist: true });
        sync();
      });
    }
    for (const [id, key] of Object.entries(fields)) {
      const input = document.getElementById(id);
      if (!input) continue;
      input.addEventListener("change", () => {
        core.settings[key] = input.checked;
        if (id === "fixedIconSize") core.applyUiScale({ persist: true });
        else save();
        /* 画面の形の固定と、エフェクト欄の置き場所は、それぞれの担当へ知らせる（開き直さない） */
        try {
          if (id === "uiModeLock" && window.Trk.mobileShell && window.Trk.mobileShell.applyMode) window.Trk.mobileShell.applyMode();
          if (id === "fxInLibrary" && window.Trk.mobileShell && window.Trk.mobileShell.sync) window.Trk.mobileShell.sync();
        } catch (_) {}
      });
    }
  }

  for (const name of ["language", "settings", "skin", "uiscale"]) core.on(name, sync);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { sync(); wire(); }, { once: true });
  } else { sync(); wire(); }

  window.Trk = window.Trk || {};
  window.Trk.uiPrefs = Object.freeze({ sync, fields: Object.keys(fields) });
})();

// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ ⧉ 操作パネルを、別の小窓に出す（trk226） ============

   実機の相談（2026-10-31）から。下の再生バーと同じ操作（曲名・再生位置・再生／曲送り・
   シャッフル・リピート・音量）を、**別の小窓**でもできるようにします。PC のブラウザで、
   ほかの作業をしながら曲を操作する使い方のためです。

   ・**Document PiP（documentPictureInPicture）** があればそれを使います（Chrome／Edge 116+、
     Firefox 151+。Safari とスマホは未対応）。常に手前に浮く小窓で、位置はブラウザが決めます。
   ・無ければ `window.open` の小窓に同じ中身を出します（常に手前にはなりません）。
   ・どちらも、**このページの DOM を移さず、同じ状態を見て絵を描き直す**（鏡）方式です。
     本体のバー・再生・設定はそのまま動き、窓を閉じても何も壊れません。
   ・中身はすべてこのページの中で組み立てます（通信しません。オフラインでも動きます）。
   ・PC型のときだけ出します（スマホ型ではバーが画面の下にあり、Document PiP も端末では使えないため）。

   状態は js/player-bar.js の `Trk.playerBar.snapshot()` だけを見ます（二重に持たない）。
   操作は `Trk.playerBar` の関数を呼びます（バーと同じ道を通る）。

   ⚠ 実ブラウザ（とくに Document PiP の窓）での見た目は未確認です。 */
(() => {
  "use strict";
  const core = window.Trk && window.Trk.core;
  if (!core) return;

  const WIN_W = 560, WIN_H = 216;
  const VARS = ["--ui-panel", "--ui-text", "--ui-muted", "--ui-border", "--ui-soft", "--ui-field",
    "--ui-button", "--ui-button-hover", "--ui-accent", "--ui-accent-ink", "--ui-on-accent", "--ui-bg", "--ui-glow"];

  const word = key => (typeof tr === "function" ? tr(key) : key);

  /* ---------- 使えるか（純粋関数。テストで確かめる） ---------- */
  /* Document PiP が使えるか。窓口の形まで見る（あるだけで中身が無い実装を避ける） */
  function pipUsable(win) {
    const api = win && win.documentPictureInPicture;
    return !!(api && typeof api.requestWindow === "function");
  }
  /* 小窓（window.open）で代わりに出せるか */
  function popupUsable(win) {
    return !!(win && typeof win.open === "function");
  }
  /* 別窓を出してよいか。スマホ型では出さない（端末では Document PiP が使えず、下部ナビと競合する） */
  function panelAllowed(ctx) {
    return !!(ctx && ctx.desktop && (ctx.pip || ctx.popup));
  }
  const layoutDesktop = () => !(document.body && document.body.classList.contains("trk-mobile"));
  function available() {
    return panelAllowed({ desktop: layoutDesktop(), pip: pipUsable(window), popup: popupUsable(window) });
  }

  /* ---------- 小窓の CSS（スキンの色は CSS変数を写して合わせる） ---------- */
  const PANEL_CSS = `
:root { color-scheme: dark; }
html, body { margin: 0; height: 100%; }
body {
  display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;
  padding: 10px 12px; background: var(--ui-panel, #14121f); color: var(--ui-text, #eee);
  font: 13px/1.35 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  overflow: hidden;
}
.trk-pp-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.trk-pp-art {
  flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center;
  border: 1px solid var(--ui-border, #444); border-radius: 9px; background: var(--ui-soft, #222); color: var(--ui-muted, #999);
}
.trk-pp-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.trk-pp-title { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trk-pp-artist { font-size: 12px; color: var(--ui-muted, #999); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trk-pp-seek { width: 100%; margin: 2px 0 0; accent-color: var(--ui-accent, #e8b25a); }
.trk-pp-seek:disabled { opacity: .5; }
.trk-pp-row { display: flex; align-items: center; gap: 6px; min-height: 34px; }
.trk-pp-time { color: var(--ui-muted, #999); font-variant-numeric: tabular-nums; white-space: nowrap; margin-left: auto; }
.trk-pp-row button {
  min-width: 36px; min-height: 34px; display: grid; place-items: center; cursor: pointer;
  border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--ui-text, #eee); font-size: 15px;
}
.trk-pp-row button:hover { background: var(--ui-button-hover, #2a2740); }
.trk-pp-row button[aria-pressed="true"] { border-color: var(--ui-accent, #e8b25a); color: var(--ui-accent, #e8b25a); }
.trk-pp-row button:disabled { opacity: .38; cursor: default; }
.trk-pp-play { min-width: 42px !important; min-height: 42px !important; font-size: 17px !important;
  border-color: var(--ui-border, #444) !important; background: var(--ui-soft, #222) !important; }
.trk-pp-vol { display: flex; align-items: center; gap: 6px; color: var(--ui-muted, #999); }
.trk-pp-vol input { width: 96px; accent-color: var(--ui-accent, #e8b25a); }
.trk-pp-note { margin: 0; font-size: 11px; color: var(--ui-muted, #999); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 420px) { .trk-pp-vol input { width: 64px; } .trk-pp-art { display: none; } }
`;

  /* スキンの CSS変数を写す（写せないときは PANEL_CSS の既定色で出る） */
  function skinVars(win) {
    const out = {};
    try {
      const cs = win.getComputedStyle(win.document.documentElement);
      for (const name of VARS) {
        const value = cs.getPropertyValue(name);
        if (value && value.trim()) out[name] = value.trim();
      }
    } catch (_) { /* 写せなくても既定色で出す */ }
    return out;
  }
  function varsCss(vars) {
    const body = Object.keys(vars || {}).map(name => `${name}:${vars[name]};`).join("");
    return body ? `:root{${body}}` : "";
  }

  /* ---------- 中身を組み立てる（本物の document でも、テストの偽 DOM でも同じ関数） ---------- */
  function make(doc, tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function makeButton(doc, className, text, label) {
    const button = make(doc, "button", className, text);
    button.type = "button";
    if (label) button.setAttribute("aria-label", label);
    return button;
  }
  /* actions: { play, prev, next, shuffle, repeat, seek(ratio), volume(value), close } */
  function buildPanel(doc, actions) {
    const parts = {};
    const top = make(doc, "div", "trk-pp-top");
    const art = make(doc, "div", "trk-pp-art", "♪");
    art.setAttribute("aria-hidden", "true");
    const meta = make(doc, "div", "trk-pp-meta");
    parts.title = make(doc, "strong", "trk-pp-title", "");
    parts.artist = make(doc, "span", "trk-pp-artist", "");
    meta.append(parts.title, parts.artist);
    top.append(art, meta);

    parts.seek = doc.createElement("input");
    parts.seek.type = "range"; parts.seek.className = "trk-pp-seek";
    parts.seek.min = "0"; parts.seek.max = "1000"; parts.seek.step = "1"; parts.seek.value = "0";
    parts.seek.setAttribute("aria-label", word("barSeek"));

    const row = make(doc, "div", "trk-pp-row");
    parts.prev = makeButton(doc, "trk-pp-prev", "⏮", word("barPrev"));
    parts.play = makeButton(doc, "trk-pp-play", "▶", word("barPlay"));
    parts.next = makeButton(doc, "trk-pp-next", "⏭", word("barNext"));
    parts.shuffle = makeButton(doc, "trk-pp-shuffle", "🎲", word("barShuffle"));
    parts.repeat = makeButton(doc, "trk-pp-repeat", "🔁", word("barRepeat"));
    parts.time = make(doc, "span", "trk-pp-time", "0:00 / --:--");
    row.append(parts.prev, parts.play, parts.next, parts.shuffle, parts.repeat, parts.time);

    const bottom = make(doc, "div", "trk-pp-row");
    const volWrap = make(doc, "label", "trk-pp-vol");
    const volIcon = make(doc, "span", "", "🔊");
    volIcon.setAttribute("aria-hidden", "true");
    parts.volume = doc.createElement("input");
    parts.volume.type = "range"; parts.volume.min = "0"; parts.volume.max = "1"; parts.volume.step = "0.01"; parts.volume.value = "0.7";
    parts.volume.setAttribute("aria-label", word("barVolume"));
    volWrap.append(volIcon, parts.volume);
    parts.note = make(doc, "p", "trk-pp-note", "");
    parts.close = makeButton(doc, "trk-pp-close", "✕", word("barPanelClose"));
    bottom.append(volWrap, parts.note, parts.close);

    parts.prev.addEventListener("click", () => actions.prev());
    parts.play.addEventListener("click", () => actions.play());
    parts.next.addEventListener("click", () => actions.next());
    parts.shuffle.addEventListener("click", () => actions.shuffle());
    parts.repeat.addEventListener("click", () => actions.repeat());
    parts.close.addEventListener("click", () => actions.close());
    parts.seek.addEventListener("input", () => {
      if (parts.seek.__dragging) return;
      parts.seek.__dragging = true;
    });
    parts.seek.addEventListener("change", () => {
      parts.seek.__dragging = false;
      actions.seek(Number(parts.seek.value) / 1000);
    });
    parts.volume.addEventListener("input", () => actions.volume(Number(parts.volume.value)));

    const root = make(doc, "div", "trk-pp-root");
    root.append(top, parts.seek, row, bottom);
    return { root, parts };
  }

  /* 状態を絵に写す（純粋な写し。テストで確かめる） */
  function paintParts(parts, snap) {
    if (!parts || !snap) return;
    const title = snap.title || "";
    const artist = snap.artist || "";
    parts.title.textContent = title;
    parts.title.title = title;
    parts.artist.textContent = artist;
    parts.artist.title = artist;
    parts.time.textContent = `${snap.elapsed} / ${snap.total}`;
    parts.seek.disabled = !snap.canSeek;
    parts.seek.classList.toggle("is-locked", !!snap.seekLocked);
    if (!parts.seek.__dragging) {
      const value = String(Math.round(Math.min(1, Math.max(0, snap.ratio || 0)) * 1000));
      if (parts.seek.value !== value) parts.seek.value = value;
    }
    parts.play.textContent = snap.playing ? "⏸" : "▶";
    parts.play.setAttribute("aria-pressed", String(!!snap.playing));
    parts.prev.disabled = !snap.canStep;
    parts.next.disabled = !snap.canStep;
    parts.shuffle.setAttribute("aria-pressed", String(!!snap.shuffle));
    parts.repeat.textContent = snap.repeat === "one" ? "🔂" : "🔁";
    parts.repeat.setAttribute("aria-pressed", String(snap.repeat !== "off"));
    parts.repeat.setAttribute("aria-label", `${word("barRepeat")}（${word(snap.repeat === "one" ? "barRepeatOne" : snap.repeat === "all" ? "barRepeatAll" : "barRepeatOff")}）`);
    const vol = String(Math.min(1, Math.max(0, Number(snap.volume) || 0)));
    if (parts.volume !== undefined && !parts.volume.__dragging) parts.volume.value = vol;
    parts.note.textContent = snap.hasSong ? "" : word("barNoSong");
  }

  /* ---------- 窓を開く／閉じる ---------- */
  let panelWin = null, panelDoc = null, panelParts = null, panelKind = "", paintTimer = 0, panelTitle = "";
  const barApi = () => (window.Trk && window.Trk.playerBar ? window.Trk.playerBar : null);

  function snapshotNow() {
    const bar = barApi();
    if (bar && typeof bar.snapshot === "function") return bar.snapshot();
    return null;
  }
  function panelActions() {
    const bar = barApi() || {};
    return {
      play: () => { if (bar.playPause) bar.playPause(); paint(); },
      prev: () => { if (bar.step) bar.step(-1); paint(); },
      next: () => { if (bar.step) bar.step(1); paint(); },
      shuffle: () => { if (bar.shuffle) bar.shuffle(); paint(); },
      repeat: () => { if (bar.repeat) bar.repeat(); paint(); },
      seek: ratio => { if (bar.seekToRatio) bar.seekToRatio(ratio); paint(); },
      volume: value => { if (bar.setVolume) bar.setVolume(value); },
      close: () => close()
    };
  }
  function paint() {
    const snap = snapshotNow();
    if (!snap || !panelParts) return;
    paintParts(panelParts, snap);
    const next = `${snap.title}${snap.artist ? " — " + snap.artist : ""}`;
    if (panelDoc && panelTitle !== next) {
      panelTitle = next;
      try { panelDoc.title = next; } catch (_) {}
    }
  }
  function writeStyles(doc) {
    const style = doc.createElement("style");
    style.textContent = PANEL_CSS + varsCss(skinVars(window));
    doc.head.append(style);
  }
  function cleanup() {
    clearInterval(paintTimer); paintTimer = 0;
    panelWin = null; panelDoc = null; panelParts = null; panelKind = ""; panelTitle = "";
    /* バーの ⧉ の見た目を戻す */
    try { if (window.Trk.playerBar && window.Trk.playerBar.sync) window.Trk.playerBar.sync(); } catch (_) {}
  }
  function watchClose(win) {
    try {
      win.addEventListener("pagehide", () => { cleanup(); });
    } catch (_) {}
  }

  async function open() {
    if (panelWin) return true;
    if (!available()) return false;
    let win = null;
    if (pipUsable(window)) {
      try {
        win = await window.documentPictureInPicture.requestWindow({ width: WIN_W, height: WIN_H });
        panelKind = "pip";
      } catch (_) { win = null; panelKind = ""; }
    }
    if (!win && popupUsable(window)) {
      try {
        win = window.open("", "trkPlayerPanel", `popup=yes,width=${WIN_W},height=${WIN_H}`);
      } catch (_) { win = null; }
      if (!win) return false;
      panelKind = "popup";
      /* about:blank の中身を用意する（同じオリジンなので、この文書から直接組み立てられる） */
      try {
        const doc = win.document;
        doc.open();
        doc.write(`<!doctype html><html lang="${core.settings.language || "ja"}"><head><meta charset="utf-8"></head><body></body></html>`);
        doc.close();
      } catch (_) { try { win.close(); } catch (__) {} return false; }
    }
    if (!win) return false;
    panelWin = win;
    panelDoc = win.document;
    try {
      writeStyles(panelDoc);
      const built = buildPanel(panelDoc, panelActions());
      panelParts = built.parts;
      panelDoc.body.append(built.root);
      paint();
      watchClose(win);
      paintTimer = setInterval(paint, 250);
      /* 本体を閉じたら、小窓も閉じる（Document PiP は自動で閉じるが、小窓は残るため） */
      window.addEventListener("pagehide", () => { try { win.close(); } catch (_) {} }, { once: true });
    } catch (_) {
      try { win.close(); } catch (__) {}
      cleanup();
      return false;
    }
    try { if (window.Trk.playerBar && window.Trk.playerBar.sync) window.Trk.playerBar.sync(); } catch (_) {}
    return true;
  }
  function close() {
    const win = panelWin;
    try { if (win) win.close(); } catch (_) {}
    cleanup();
  }

  /* 設定・言語・画面の形が変わったら、中身とボタンの出し分けを合わせ直す */
  if (typeof core.on === "function") {
    for (const name of ["language", "settings", "mediaOptions", "songSelected", "nowPlaying", "phase", "uiscale"]) {
      core.on(name, () => { if (panelWin) paint(); });
    }
  }
  /* 画面の形がスマホ型になったら、小窓は片付ける（PC型のための機能） */
  if (typeof core.on === "function") {
    core.on("settings", () => {
      if (!layoutDesktop() && panelWin) close();
      try { if (window.Trk.playerBar && window.Trk.playerBar.sync) window.Trk.playerBar.sync(); } catch (_) {}
    });
  }

  window.Trk = window.Trk || {};
  window.Trk.playerPanel = Object.freeze({
    available, open, close,
    isOpen: () => !!panelWin,
    kind: () => panelKind,
    /* テストで確かめる道具（窓は開かない） */
    pipUsable, popupUsable, panelAllowed, buildPanel, paintParts, skinVars, varsCss
  });
})();

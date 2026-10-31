// SPDX-License-Identifier: GPL-3.0-or-later
/* 🎵 再生バーのテスト用の偽 DOM（trk221 から切り出し。trk223 でも使う）

   本物のブラウザでは大きさを測って配るので、テストでは「ステージの設計の高さ（offsetHeight）」と
   「画面に出ている高さ（getBoundingClientRect().height）」を別々に与えられるようにしてあります。
   拡大率（CSS の zoom／ステージの transform）があると、この2つは一致しません。 */
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./browser-data.mjs";

export const barSrc = fs.readFileSync(path.join(ROOT, "js/player-bar.js"), "utf8");

export function fakeDom() {
  const created = [];
  const log = [];
  function makeNode(tagName) {
    const node = {
      tagName: String(tagName).toUpperCase(), id: "", className: "", type: "",
      textContent: "", hidden: false, disabled: false, value: "", title: "",
      parentNode: null, childNodes: [], dataset: {}, attributes: {},
      offsetHeight: 60,
      style: {
        values: {},
        setProperty(name, value) { this.values[name] = String(value); },
        removeProperty(name) { delete this.values[name]; }
      },
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); log.push(`toggle:${c}`); },
        remove(c) { this.set.delete(c); log.push(`toggle:${c}`); },
        toggle(c, on) {
          if (on === undefined ? !this.set.has(c) : on) this.set.add(c); else this.set.delete(c);
          log.push(`toggle:${c}`);
        },
        contains(c) { return this.set.has(c); }
      },
      append(...kids) { for (const kid of kids) { kid.parentNode = node; node.childNodes.push(kid); } },
      appendChild(kid) { node.append(kid); return kid; },
      remove() { if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter(k => k !== node); },
      setAttribute(name, value) { node.attributes[name] = String(value); },
      removeAttribute(name) { delete node.attributes[name]; },
      blur() {},
      /* 既定は「画面に出ている大きさ＝設計の大きさ」。テストで上書きする。
         いつ測ったか（順番）を dom.log に残す（trk225：印を付けてから測る、を確かめる） */
      getBoundingClientRect() {
        log.push(`rect:${node.id || node.className || node.tagName}`);
        return node.__rect || { width: 0, height: node.offsetHeight, top: 0, left: 0 };
      },
      __events: {},
      addEventListener(name, fn) { (node.__events[name] = node.__events[name] || []).push(fn); },
      removeEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      matches: () => false
    };
    created.push(node);
    return node;
  }
  const body = makeNode("body");
  const document = {
    body,
    documentElement: makeNode("html"),
    readyState: "complete",
    createElement: tag => makeNode(tag),
    getElementById: id => body.childNodes.find(n => n.id === id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    activeElement: null
  };
  return { document, body, created, makeNode, log };
}

export function fire(node, name) {
  for (const fn of (node && node.__events && node.__events[name]) || []) fn({ target: node, preventDefault() {} });
}

/* stage: { designH, screenH } を与えると #stage を置く（designH＝offsetHeight、screenH＝実寸）
   navHeight を与えると下部ナビ（.trk-mobile-nav）を置く（trk225：バーとの前後）
   controls を与えると、設定の欄（#playerBarMode／#playerBarPos／#playerBarLock）を置く */
export function runBar({ playerBar = "auto", phase = "title", hasSong = true, media = false, study = false, stage = null, mobile = false,
  playerBarPos, playerBarLock, navHeight = null, controls = false } = {}) {
  const dom = fakeDom();
  const events = [];
  const calls = { save: 0, seek: [], select: [], openPlayer: 0, bannerClick: 0, toast: [] };
  const banner = dom.makeNode("button");
  banner.className = "bannerPlayBtn";
  banner.textContent = "▶";
  banner.title = "T:bannerPlayResumeTip";
  banner.disabled = true;
  banner.click = () => { calls.bannerClick += 1; };

  const video = dom.makeNode("video");
  video.duration = 100;
  video.currentTime = 10;
  video.paused = false;

  const settings = { language: "ja", playerBar, musicVolume: 0.5 };
  if (playerBarPos !== undefined) settings.playerBarPos = playerBarPos;
  if (playerBarLock !== undefined) settings.playerBarLock = playerBarLock;
  const core = {
    settings,
    phase,
    currentSong: hasSong ? { key: "song-a", base: "曲A", artist: "歌手A" } : null,
    videoReady: true,
    video,
    on(name, fn) { events.push({ name, fn }); },
    saveUserPrefs() { calls.save += 1; },
    rememberMusicVolume() {}
  };
  const window = {
    Trk: {
      core,
      play: { seekTo: seconds => calls.seek.push(seconds), pauseGame() {}, resumeGame() {} },
      library: {
        prevSong: () => ({ key: "song-prev" }),
        nextSong: () => ({ key: "song-next" }),
        selectSong: async it => { calls.select.push(it.key); },
        songDisplayMeta: it => ({ title: `${it.base}（表示）`, artist: it.artist || "" }),
        loadSongArtwork: () => Promise.resolve(null),
        plToast(message) { calls.toast.push(String(message)); }
      }
    },
    TrkMediaPlayer: { open: () => { calls.openPlayer += 1; }, close() {}, isOpen: () => media },
    addEventListener() {},
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout() {}
  };
  window.window = window;
  const document = dom.document;
  /* 「再生画面の中のボタン」だけ、本物の置き場所を返す（曲名バナーの ▶ を共有するため） */
  document.querySelector = sel => {
    if (sel === "#songBanner .bannerPlayBtn") return banner;
    if (sel === ".trk-mobile-nav") return dom.nav || null;
    return null;
  };
  if (stage) {
    const node = dom.makeNode("div");
    node.id = "stage";
    node.offsetHeight = stage.designH;
    node.__rect = { width: 0, height: stage.screenH, top: 0, left: 0 };
    dom.body.append(node);
    dom.stage = node;
  }
  /* 下部ナビ（スマホのシェル）。高さは実寸（getBoundingClientRect）で返す */
  if (navHeight !== null) {
    const nav2 = dom.makeNode("nav");
    nav2.className = "trk-mobile-nav";
    nav2.offsetHeight = navHeight;
    nav2.__rect = { width: 0, height: navHeight, top: 0, left: 0 };
    dom.body.append(nav2);
    dom.nav = nav2;
  }
  /* 設定の欄（⚙ → 🖥 画面と再生バー）。値を書き換えたかをテストで見られるようにする */
  if (controls) {
    const mode = dom.makeNode("select"); mode.id = "playerBarMode"; mode.value = playerBar;
    const pos = dom.makeNode("select"); pos.id = "playerBarPos"; pos.value = playerBarPos || "bottom";
    const lock = dom.makeNode("input"); lock.id = "playerBarLock"; lock.checked = playerBarLock === true;
    for (const node of [mode, pos, lock]) dom.body.append(node);
    dom.controls = { mode, pos, lock };
  }
  if (mobile) dom.body.classList.add("trk-mobile");
  if (study) dom.body.classList.add("study-room-open");

  const context = vm.createContext({
    window, document, navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" }, console,
    setInterval: window.setInterval, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    tr: key => `T:${key}`,
    Promise
  });
  vm.runInContext(barSrc, context, { filename: "js/player-bar.js" });
  return { dom, core, events, window, calls, fire, banner };
}

export const barOf = dom => dom.body.childNodes.find(n => n.id === "trkPlayerBar");

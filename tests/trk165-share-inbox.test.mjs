// SPDX-License-Identifier: GPL-3.0-or-later
/* trk165: 📥 OS共有（share_target）／「このアプリで開く」（file_handlers）の受け口のテスト。
   実ソースから関数を切り出して vm で動かす（コピーを持たない）。
   方針の要：ファイルは必ず**既存の取り込み経路**（library／study-room／custom）へ合流し、
   新しい検証入口を作らないこと。振り分けとSWの一時保存の決定だけをここで検証する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const shareSrc = fs.readFileSync(`${ROOT}/js/share-inbox.js`, "utf8");
const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");
const librarySrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");
const htmlSrc = fs.readFileSync(`${ROOT}/index.html`, "utf8");
const studySrc = fs.readFileSync(`${ROOT}/js/study-room.js`, "utf8");
const customSrc = fs.readFileSync(`${ROOT}/js/custom.js`, "utf8");
const manifest = JSON.parse(fs.readFileSync(`${ROOT}/manifest.webmanifest`, "utf8"));
const count = (hay, needle) => hay.split(needle).length - 1;

const grab = (src, pattern, label) => {
  const m = src.match(pattern);
  assert.ok(m, `${label} can be isolated`);
  return m[0];
};
const packJsonRe = grab(shareSrc, /const PACK_JSON_RE = [^;]+;/, "PACK_JSON_RE");
const fnShareToast = grab(shareSrc, /function shareToast\(key, vars\) \{[\s\S]*?\n\}/, "shareToast()");
const fnInboxPrefix = grab(shareSrc, /function shareInboxPrefix\(\) \{[\s\S]*?\n\}/, "shareInboxPrefix()");
const fnDisplayName = grab(shareSrc, /function shareDisplayName\(name\) \{[\s\S]*?\n\}/, "shareDisplayName()");
const fnClassify = grab(shareSrc, /function classifyInboundFile\(name, type\) \{[\s\S]*?\n\}/, "classifyInboundFile()");
const fnZipProbe = grab(shareSrc, /async function zipLooksLikePack\(file\) \{[\s\S]*?\n\}/, "zipLooksLikePack()");
const fnRoute = grab(shareSrc, /async function routeInboundFiles\(files\) \{[\s\S]*?\n\}/, "routeInboundFiles()");
const fnDrain = grab(shareSrc, /async function drainShareInbox\(\) \{[\s\S]*?\n\}/, "drainShareInbox()");
const shareCacheConst = grab(shareSrc, /const SHARE_CACHE = "[^"]+";/, "SHARE_CACHE (page)");
const fnHandleShare = grab(swSrc, /async function handleShareTarget\(request\) \{[\s\S]*?\n\}/, "handleShareTarget()");
const swCacheConst = grab(swSrc, /const SHARE_CACHE = "[^"]+";/, "SHARE_CACHE (sw)");
const swPathConst = grab(swSrc, /const SHARE_PATH = [^;]+;/, "SHARE_PATH");
const swInboxConst = grab(swSrc, /const SHARE_INBOX_PREFIX = [^;]+;/, "SHARE_INBOX_PREFIX");
/* 振り分けに使う実物の表（library.js／core.js から切り出す。テスト用に書き写さない） */
const mediaExtConst = grab(librarySrc, /const MEDIA_EXT = \[[^\]]+\];/, "MEDIA_EXT");
const videoExtConst = grab(librarySrc, /const VIDEO_EXT = \[[^\]]+\];/, "VIDEO_EXT");
const extOfConst = grab(coreSrc, /const extOf = [^;]+;/, "extOf");

/* ---------- 振り分け＋ルーティング ---------- */
function routeSandbox({ zipEntriesFor = () => [], zipThrows = false, noZipIO = false } = {}) {
  const calls = { songs: [], videos: [], books: [], packs: [], toasts: [] };
  const sandbox = {
    core: {},
    window: {
      Trk: {
        library: { addSongFiles: async l => { calls.songs.push(...l); }, addVideoFiles: async l => { calls.videos.push(...l); } },
        study: { importArchives: async l => { calls.books.push(...l); } },
        custom: { installAndUse: async f => { calls.packs.push(f); } },
        play: { showToast: m => calls.toasts.push(m) },
        zipIO: noZipIO ? undefined : { zipOpen: async file => { if (zipThrows) throw new Error("zipBad"); return { entries: zipEntriesFor(file) }; } },
      },
    },
    showToast: () => {},
    tr: (key, vars) => vars ? `${key}:${JSON.stringify(vars)}` : key,
    console: { error() {}, log() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(`
${extOfConst}
${mediaExtConst}
${videoExtConst}
${packJsonRe}
${fnShareToast}
${fnClassify}
${fnZipProbe}
${fnRoute}
core.extOf = extOf;
window.Trk.library.MEDIA_EXT = MEDIA_EXT;
window.Trk.library.VIDEO_EXT = VIDEO_EXT;
window.__classify = classifyInboundFile;
window.__route = routeInboundFiles;
window.__probe = zipLooksLikePack;
`, sandbox, { filename: "js/share-inbox.js#route" });
  return { calls, api: sandbox.window };
}

test("classifyInboundFile() routes by extension first, video MIME second, and refuses unknown audio", () => {
  const { api } = routeSandbox();
  assert.equal(api.__classify("song.mp3", "audio/mpeg"), "audio");
  assert.equal(api.__classify("song.flac", ""), "audio", "MEDIA_EXT covers flac");
  assert.equal(api.__classify("song.mid", ""), "audio");
  assert.equal(api.__classify("movie.mp4", "video/mp4"), "video", "mp4 sits in both lists; video probing wins and falls back to audio inside addVideoFiles");
  assert.equal(api.__classify("movie.mkv", ""), "video");
  assert.equal(api.__classify("clip", "video/webm"), "video", "video MIME without a known extension still probes");
  assert.equal(api.__classify("book.cbz", ""), "book");
  assert.equal(api.__classify("archive.zip", "application/zip"), "zip", "zip needs the pack.json probe");
  assert.equal(api.__classify("pack.stpack", ""), "pack");
  assert.equal(api.__classify("notes.txt", "text/plain"), "unsupported");
  assert.equal(api.__classify("weird.xyz", "audio/mpeg"), "unsupported", "audio MIME alone is refused honestly instead of being dropped silently");
  assert.equal(api.__classify("book.m4b", "audio/mp4"), "audio", "m4b joined MEDIA_EXT in trk170 (roadmap #10 shipped) — audiobooks are accepted as songs");
  assert.equal(api.__classify("", ""), "unsupported");
});

test("zipLooksLikePack() only peeks at pack.json and defers to the study room on broken zips", async () => {
  const pack = routeSandbox({ zipEntriesFor: () => [{ name: "pack.json" }] });
  assert.equal(await pack.api.__probe({ name: "a.zip" }), true);
  const nested = routeSandbox({ zipEntriesFor: () => [{ name: "sub/pack.json" }] });
  assert.equal(await nested.api.__probe({ name: "a.zip" }), true, "same shape as the installer's search");
  const images = routeSandbox({ zipEntriesFor: () => [{ name: "01.png" }] });
  assert.equal(await images.api.__probe({ name: "a.zip" }), false);
  const broken = routeSandbox({ zipThrows: true });
  assert.equal(await broken.api.__probe({ name: "a.zip" }), false, "broken zip goes to the study room, which reports it");
  const noIo = routeSandbox({ noZipIO: true });
  assert.equal(await noIo.api.__probe({ name: "a.zip" }), false);
});

test("routeInboundFiles() merges into the existing import paths and reports what it cannot take", async () => {
  const { calls, api } = routeSandbox({
    zipEntriesFor: file => file.name === "renamed-pack.zip" ? [{ name: "pack.json" }] : [{ name: "page1.png" }],
  });
  const files = [
    { name: "song.mp3", type: "audio/mpeg" },
    { name: "movie.mkv", type: "video/x-matroska" },
    { name: "comic.cbz", type: "" },
    { name: "trk-pack.stpack", type: "" },
    { name: "renamed-pack.zip", type: "application/zip" },
    { name: "photos.zip", type: "application/zip" },
    { name: "notes.txt", type: "text/plain" },
    { name: "weird.xyz", type: "audio/mpeg" },
  ];
  const groups = await api.__route(files);   // ⚠ vm 越しの配列は別レルム → Array.from で此方側にしてから比較
  assert.deepEqual(Array.from(groups.audio.map(f => f.name)), ["song.mp3"]);
  assert.deepEqual(Array.from(groups.video.map(f => f.name)), ["movie.mkv"]);
  assert.deepEqual(Array.from(groups.pack.map(f => f.name)), ["trk-pack.stpack", "renamed-pack.zip"]);
  assert.deepEqual(Array.from(groups.book.map(f => f.name)), ["comic.cbz", "photos.zip"]);
  assert.deepEqual(calls.songs.map(f => f.name), ["song.mp3"], "Trk.library.addSongFiles gets the audio");
  assert.deepEqual(calls.videos.map(f => f.name), ["movie.mkv"], "Trk.library.addVideoFiles gets the video");
  assert.deepEqual(calls.books.map(f => f.name), ["comic.cbz", "photos.zip"], "study room importArchives gets CBZ and image zips");
  assert.deepEqual(calls.packs.map(f => f.name), ["trk-pack.stpack", "renamed-pack.zip"], "pack installer gets .stpack and zips holding pack.json");
  assert.equal(calls.toasts.length, 1);
  assert.match(calls.toasts[0], /shareInboundUnsupported/);
  assert.match(calls.toasts[0], /notes\.txt/);
  assert.match(calls.toasts[0], /weird\.xyz/);
});

test("the unsupported report shows at most three names, then a count (core.js Import style)", async () => {
  const { calls, api } = routeSandbox();
  await api.__route([1, 2, 3, 4, 5].map(i => ({ name: `f${i}.txt`, type: "" })));
  assert.equal(calls.toasts.length, 1);
  assert.match(calls.toasts[0], /f1\.txt, f2\.txt, f3\.txt/);
  assert.match(calls.toasts[0], /…\+2/);
  assert.equal(calls.songs.length + calls.videos.length + calls.books.length + calls.packs.length, 0);
});

/* ---------- SWの一時保存 → ページ側の引き取り ---------- */
function drainSandbox({ inbox = [], extraUrls = [], withCaches = true, confirmAnswer, withoutConfirm = false } = {}) {
  const state = { deleted: [], routed: [], opened: [] };
  const cache = {
    keys: async () => [...inbox.map(e => ({ url: e.url })), ...extraUrls.map(url => ({ url }))],
    match: async req => {
      const e = inbox.find(x => x.url === req.url);
      if (!e) return undefined;
      return {
        blob: async () => ({ type: e.type || "" }),
        headers: { get: h => h === "X-Share-Name" ? e.encodedName : h === "Content-Type" ? (e.type || "") : null },
      };
    },
    delete: async req => { state.deleted.push(req.url); return true; },
  };
  const sandbox = {
    document: { baseURI: "https://x/trk/index.html" },
    URL,
    File: class { constructor(parts, name, opts) { this.name = name; this.type = (opts && opts.type) || ""; } },
    console: { error() {} },
    window: {},
  };
  if (withCaches) sandbox.caches = { open: async name => { state.opened.push(name); return cache; } };
  if (!withoutConfirm) {
    state.asked = [];
    sandbox.tr = (key, vars) => `${key}:${vars.n}:${vars.names}`;
    sandbox.confirm = (msg) => { state.asked.push(msg); return confirmAnswer !== false; };
  }
  vm.createContext(sandbox);
  vm.runInContext(`
${shareCacheConst}
${fnInboxPrefix}
${fnDisplayName}
${fnDrain}
var routed = [];
function routeInboundFiles(files) { routed.push(files); return Promise.resolve({}); }
window.__drain = drainShareInbox;
window.__routed = () => routed;
window.__state = ${JSON.stringify({})};
`, sandbox, { filename: "js/share-inbox.js#drain" });
  sandbox.window.__state = state;
  return sandbox.window;
}

test("drainShareInbox() reads only the inbox prefix, restores names, routes once and deletes everything", async () => {
  const api = drainSandbox({
    inbox: [
      { url: "https://x/trk/share-inbox/555-0", encodedName: encodeURIComponent("song.mp3"), type: "audio/mpeg" },
      { url: "https://x/trk/share-inbox/555-1", encodedName: "%E4%BB", type: "" },   // 壊れたエンコード → 名前だけフォールバック
    ],
    extraUrls: ["https://x/trk/js/core.js", "https://x/trk/share-target/"],
  });
  const n = await api.__drain();
  assert.equal(n, 2);
  assert.equal(api.__state.opened[0], "trk-share-inbox-v1");
  const routed = api.__routed();
  assert.equal(routed.length, 1, "one batch");
  assert.equal(routed[0][0].name, "song.mp3");
  assert.equal(routed[0][0].type, "audio/mpeg");
  assert.equal(routed[0][1].name, "shared-file", "a corrupted X-Share-Name falls back instead of throwing");
  assert.deepEqual(api.__state.deleted, ["https://x/trk/share-inbox/555-0", "https://x/trk/share-inbox/555-1"], "app caches are never deleted");
});

test("drainShareInbox() is inert without CacheStorage and with an empty inbox", async () => {
  const noCaches = drainSandbox({ withCaches: false, inbox: [{ url: "https://x/trk/share-inbox/1-0", encodedName: "a.mp3" }] });
  assert.equal(await noCaches.__drain(), 0);
  assert.equal(noCaches.__routed().length, 0);
  const empty = drainSandbox({ inbox: [], extraUrls: ["https://x/trk/js/core.js"] });
  assert.equal(await empty.__drain(), 0);
  assert.equal(empty.__routed().length, 0);
  assert.equal(empty.__state.deleted.length, 0);
});

/* ---------- sw.js handleShareTarget ---------- */
function swHarness({ fields = null, formThrows = false, putFailsFor = "" } = {}) {
  const state = { puts: [], redirects: [] };
  class FakeRequest { constructor(url) { this.url = String(url); } }
  class FakeResponse {
    constructor(body, init) { this.body = body; this.init = init || {}; }
    static redirect(url, status) { state.redirects.push({ url, status }); return { redirect: url }; }
  }
  const cache = {
    put: async (req, res) => {
      if (putFailsFor && req.url.includes(putFailsFor)) throw new Error("quota");
      state.puts.push({ url: req.url, res });
    },
  };
  const sandbox = {
    SCOPE: new URL("https://x/trk/"),
    URL,
    caches: { open: async () => cache },
    Request: FakeRequest,
    Response: FakeResponse,
    Date: { now: () => 555 },
    console: { error() {} },
    window: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(`
${swCacheConst}
${swPathConst}
${swInboxConst}
${fnHandleShare}
window.__handle = handleShareTarget;
window.__paths = { SHARE_PATH, SHARE_INBOX_PREFIX, SHARE_CACHE };
`, sandbox, { filename: "sw.js#share-target" });
  const request = {
    formData: async () => {
      if (formThrows) throw new Error("bad body");
      return { getAll: key => (fields && fields[key]) || [] };
    },
  };
  return { state, request, api: sandbox.window };
}

test("handleShareTarget() stashes shared files in the inbox cache and redirects home (303)", async () => {
  const h = swHarness({
    fields: {
      media: ["just text", { name: "song.mp3", size: 10, type: "audio/mpeg" }],
      packs: [{ name: "pack.stpack", size: 20, type: "" }],
      books: [{ name: "comic.cbz", size: 30, type: "application/vnd.comicbook+zip" }],
    },
  });
  const res = await h.api.__handle(h.request);
  assert.ok(res);
  assert.equal(h.state.puts.length, 3, "plain-text share fields are ignored, files are kept");
  assert.ok(h.state.puts.every(p => p.url.startsWith("https://x/trk/share-inbox/555-")), "inbox slot URLs");
  const first = h.state.puts[0].res;
  assert.equal(first.init.headers["Content-Type"], "audio/mpeg");
  assert.equal(first.init.headers["X-Share-Name"], encodeURIComponent("song.mp3"));
  assert.equal(h.state.puts[1].res.init.headers["Content-Type"], "application/octet-stream", "missing type falls back");
  assert.deepEqual(h.state.redirects, [{ url: "https://x/trk/index.html?shared=1", status: 303 }]);
});

test("handleShareTarget() reports empty, partial and broken shares through the redirect flag", async () => {
  const empty = swHarness({ fields: { media: ["text only"] } });
  await empty.api.__handle(empty.request);
  assert.deepEqual(empty.state.redirects, [{ url: "https://x/trk/index.html?shared=empty", status: 303 }]);
  assert.equal(empty.state.puts.length, 0);

  const partial = swHarness({
    fields: { media: [{ name: "a.mp3", size: 1, type: "" }, { name: "b.mp3", size: 1, type: "" }] },
    putFailsFor: "555-1",
  });
  await partial.api.__handle(partial.request);
  assert.equal(partial.state.puts.length, 1);
  assert.deepEqual(partial.state.redirects, [{ url: "https://x/trk/index.html?shared=partial", status: 303 }]);

  const allFail = swHarness({ fields: { media: [{ name: "a.mp3", size: 1, type: "" }, { name: "b.mp3", size: 1, type: "" }] }, putFailsFor: "555-" });
  await allFail.api.__handle(allFail.request);
  assert.deepEqual(allFail.state.redirects, [{ url: "https://x/trk/index.html?shared=error", status: 303 }]);

  const broken = swHarness({ formThrows: true });
  await broken.api.__handle(broken.request);
  assert.deepEqual(broken.state.redirects, [{ url: "https://x/trk/index.html?shared=error", status: 303 }]);
});

/* ---------- manifest と配線 ---------- */
test("manifest declares share_target and file_handlers that match the worker path", () => {
  const st = manifest.share_target;
  assert.ok(st, "share_target exists");
  assert.equal(st.method, "POST");
  assert.equal(st.enctype, "multipart/form-data");
  assert.equal(st.action, "./share-target/");
  assert.ok(swSrc.includes('new URL("share-target/", SCOPE).pathname'), "sw.js derives the same path from the scope");
  const names = st.params.files.map(f => f.name);
  assert.deepEqual(names, ["media", "packs", "books"]);
  assert.ok(swSrc.includes('for (const field of ["media", "packs", "books"])'), "the worker reads exactly those fields");
  assert.ok(st.params.files[0].accept.includes("audio/*") && st.params.files[0].accept.includes("video/*"));
  assert.ok(st.params.files[1].accept.includes(".stpack"));
  assert.ok(st.params.files[2].accept.includes(".cbz") && st.params.files[2].accept.includes(".zip"));

  const fh = manifest.file_handlers;
  assert.ok(Array.isArray(fh) && fh.length === 1, "file_handlers exists");
  assert.equal(fh[0].launch_type, "single-client");
  assert.ok(fh[0].accept["audio/*"] && fh[0].accept["video/*"]);
  assert.deepEqual(fh[0].accept["application/vnd.comicbook+zip"], [".cbz"]);
  assert.deepEqual(fh[0].accept["application/octet-stream"], [".stpack"]);
});

test("wiring: script order, exported entry points, worker cleanup whitelist, four-language strings", () => {
  const shareTag = '<script src="js/share-inbox.js"></script>';
  assert.ok(htmlSrc.includes(shareTag), "share-inbox.js is loaded");
  assert.ok(htmlSrc.indexOf(shareTag) > htmlSrc.indexOf('<script src="js/backup.js"></script>'), "loaded after library/study/custom/backup so all entry points exist");
  assert.ok(librarySrc.includes("LIB_SHOW, MEDIA_EXT, VIDEO_EXT, addSongFiles"), "library exports its extension tables");
  assert.ok(studySrc.includes("importArchives:studyImportArchives"), "study room exposes the same validated archive import");
  assert.ok(customSrc.includes("updateMascotUI, installAndUse"), "custom exposes installAndUse (the pack-file input's own path)");
  assert.ok(swSrc.includes("key !== SHARE_CACHE"), "the activate cleanup spares the share inbox");
  assert.ok(swSrc.includes('if (request.method === "POST")'), "the fetch handler branches on POST before the GET-only logic");
  /* sw.js の cache 版数はリリースごとに進むので、ここでは固定しない（check-repo.mjs が確認する） */
  for (const key of ["shareInboundNone", "shareInboundError", "shareInboundUnsupported", "shareInboundAsk"]) {
    assert.equal(count(shareSrc, `${key}:`), 4, `${key} exists in ja/en/zh/ko`);
  }
  const launchStart = shareSrc.indexOf('if ("launchQueue" in window');
  const launchEnd = shareSrc.indexOf("/* 取り込みはアプリの初期化", launchStart);
  assert.ok(launchStart >= 0 && launchEnd > launchStart, "launchQueue consumer can be isolated");
  assert.doesNotMatch(shareSrc.slice(launchStart, launchEnd), /confirm\s*\(/, "explicit Open-with-this-app does not get a second confirmation");
  assert.ok(shareSrc.includes("window.TrkShareInbox = Object.freeze({ classifyInboundFile, zipLooksLikePack, routeInboundFiles, drainShareInbox, SHARE_CACHE })"), "test handles are exported");
  assert.equal(swCacheConst, shareCacheConst, "worker and page agree on the inbox cache name");
});

/* trk177（レビュー）：share_target はほかのサイトのフォームからも届くので、取り込む前に件数と名前を見せて尋ねる */
test("drainShareInbox() asks before routing, and a refusal routes nothing but still clears the inbox", async () => {
  const inbox = [{ url: "https://x/trk/share-inbox/9-0", encodedName: "a.stpack", type: "" }];
  const no = drainSandbox({ inbox, confirmAnswer: false });
  assert.equal(await no.__drain(), -1);
  assert.equal(no.__routed().length, 0, "refused files are not imported");
  assert.deepEqual(no.__state.deleted, ["https://x/trk/share-inbox/9-0"], "refused files do not linger in the inbox");
  assert.equal(no.__state.asked[0], "shareInboundAsk:1:a.stpack");
  const yes = drainSandbox({ inbox, confirmAnswer: true });
  assert.equal(await yes.__drain(), 1);
  assert.equal(yes.__routed().length, 1);

  const unavailable = drainSandbox({ inbox, withoutConfirm: true });
  assert.equal(await unavailable.__drain(), -1, "missing confirmation support fails closed");
  assert.equal(unavailable.__routed().length, 0);
  assert.deepEqual(unavailable.__state.deleted, ["https://x/trk/share-inbox/9-0"]);
});

test("share confirmation bounds and sanitizes untrusted file names", async () => {
  const name = `x\n\u202ey${"z".repeat(100)}`;
  const api = drainSandbox({ inbox:[{
    url:"https://x/trk/share-inbox/10-0", encodedName:encodeURIComponent(name), type:"application/octet-stream",
  }], confirmAnswer:false });
  assert.equal(await api.__drain(), -1);
  const shown = api.__state.asked[0].slice("shareInboundAsk:1:".length);
  assert.equal(shown.length, 80);
  assert.match(shown, /^x y/);
  assert.doesNotMatch(shown, /[\n\u202e]/);
});

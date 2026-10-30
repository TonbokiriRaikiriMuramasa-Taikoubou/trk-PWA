// SPDX-License-Identifier: GPL-3.0-or-later
/* 📂 trk208: フォルダー共有を「1本だけ」から「何本でも」へ広げる。
   ・曲リスト … ミュージックフォルダー（trk194）＋**動画フォルダー**を登録簿でまとめて覚える
   ・書斎 … 「画像フォルダーを取り込む（コピー）」に加えて、**フォルダーのまま読む本**（コピーしない）
   ここで確かめるのは、DOM も IndexedDB も要らない部分（純関数・フォルダーの歩き方・配線）。
   実機（Chrome／Edge のフォルダー選択・許可の確認）は手で確かめること。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const sharedSrc = read("js/shared-folders.js");
const libSrc = read("js/library.js");
const studySrc = read("js/study-room.js");
const utilSrc = read("js/study-room-utils.js");
const html = read("index.html");
const i18nSrc = read("js/i18n.js");
const backupSrc = read("js/backup.js");
const swSrc = read("sw.js");

/* ---------- js/shared-folders.js を実際に動かす ---------- */
const sandbox = { window:{}, Intl, Map, Set, Array, Object, Number, String, Math, JSON, Promise };
vm.createContext(sandbox);
vm.runInContext(sharedSrc, sandbox, { filename:"js/shared-folders.js" });
const F = sandbox.window.TrkSharedFolders;

const folder = (name, children) => ({ name, kind:"directory", async *values() { for (const child of children) yield child; } });
const file = (name, size = 100) => ({ name, kind:"file", async getFile() { return { name, size, type:"", slice:() => null }; } });

test("trk208: the shared folder helper is a classic script loaded before the library", () => {
  assert.ok(F, "window.TrkSharedFolders exists");
  const shared = html.indexOf('<script src="js/shared-folders.js"></script>');
  const library = html.indexOf('<script src="js/library.js"></script>');
  const utils = html.indexOf('<script src="js/study-room-utils.js"></script>');
  const study = html.indexOf('<script src="js/study-room.js"></script>');
  assert.ok(shared > 0 && shared < library, "shared-folders.js comes before library.js");
  assert.ok(utils > 0 && utils < study, "study-room-utils.js still comes before study-room.js (existing rule)");
});

/* ---------- フォルダーを歩く ---------- */
test("trk208: walking a folder collects only accepted files and skips hidden folders", async () => {
  const root = folder("Pictures", [
    file("cover.jpg"),
    file("notes.txt"),
    folder("Album", [file("01.jpg"), file("02.jpg"), folder("sub", [file("03.jpg")])]),
    folder(".trash", [file("old.jpg")]),
  ]);
  const r = await F.walk(root, { accept:name => F.extOf(name) === "jpg" });
  const paths = [...r.entries.map(entry => entry.path)].sort();
  assert.deepEqual(paths, ["Pictures/Album/01.jpg", "Pictures/Album/02.jpg", "Pictures/Album/sub/03.jpg", "Pictures/cover.jpg"]);
  assert.equal(r.skipped, 1, "notes.txt is counted as skipped");
  assert.equal(r.entries[0].size, 100, "the size comes from the file when we read it");
});

test("trk208: a name-only scan stays light and keeps the handle for later reads", async () => {
  const root = folder("Pictures", [file("01.jpg", 2048), file("02.jpg", 4096)]);
  const r = await F.walk(root, { read:false, accept:() => true });
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].file, null, "no File is read at scan time");
  assert.equal(r.entries[0].size, 0, "the size is filled in when the page is opened");
  assert.ok(r.entries[0].fileHandle, "the file handle is kept for a lazy read");
});

test("trk208: the walk stops at the file cap and at the depth cap", async () => {
  const many = folder("Big", [file("1.jpg"), file("2.jpg"), file("3.jpg")]);
  assert.equal((await F.walk(many, { maxFiles:2 })).entries.length, 2, "the cap is respected");
  const deep = folder("A", [folder("B", [folder("C", [file("x.jpg")])])]);
  assert.equal((await F.walk(deep, { maxDepth:1 })).entries.length, 0, "too deep is not read");
  assert.equal((await F.walk(deep, { maxDepth:5 })).entries.length, 1);
});

/* ---------- 読み取り専用の参照 ---------- */
test("trk208: reading a page resolves the path under the folder handle (and never writes)", async () => {
  const target = { name:"01.jpg", size:9 };
  const album = { name:"Album", async getFileHandle(name) { if (name !== "01.jpg") throw new Error("NotFound"); return { async getFile() { return target; } }; } };
  const root = { name:"Pictures", async getDirectoryHandle(name) { if (name !== "Album") throw new Error("NotFound"); return album; } };
  assert.equal(await F.readFileAt(root, "Pictures/Album/01.jpg"), target, "the leading folder name is stripped");
  assert.equal(await F.readFileAt(root, "Album/01.jpg"), target, "and a path without it still works");
  assert.equal(await F.readFileAt(root, "Pictures/Gone/01.jpg"), null, "a missing folder returns null");
  assert.equal(await F.readFileAt(root, "Pictures/Album/missing.jpg"), null, "a missing file returns null");
  assert.ok(!/create\s*:/.test(sharedSrc) && !/createWritable/.test(sharedSrc), "the helper never writes to the folder");
});

test("trk208: a path can never climb out of the folder", () => {
  assert.deepEqual([...F.pathParts("../../etc/passwd")], ["etc", "passwd"]);
  assert.deepEqual([...F.pathParts("Album/./01.jpg")], ["Album", "01.jpg"]);
  assert.deepEqual([...F.pathParts("")], []);
});

/* ---------- いつ読むか（trk194 と同じ決まり） ---------- */
test("trk208: the same read plan decides the startup for a whole registry", () => {
  assert.equal(F.plan({ hasHandle:true, permission:"granted", autoRead:true, safe:false }), "scan");
  assert.equal(F.plan({ hasHandle:true, permission:"prompt", autoRead:true, safe:false }), "ask");
  assert.equal(F.plan({ hasHandle:true, permission:"denied", autoRead:true, safe:false }), "none");
  assert.equal(F.plan({ hasHandle:true, permission:"granted", autoRead:false, safe:false }), "none");
  assert.equal(F.plan({ hasHandle:true, permission:"granted", autoRead:true, safe:true }), "none");
  assert.equal(F.plan({}), "none");
});

/* ---------- 同じ名前のフォルダーが2つ来ても混ざらない ---------- */
test("trk208: two folders with the same name get distinct labels", () => {
  assert.equal(F.uniqueLabel([], "Music"), "Music");
  assert.equal(F.uniqueLabel(["Music"], "Music"), "Music (2)");
  assert.equal(F.uniqueLabel(["Music", "Music (2)"], "Music"), "Music (3)");
  assert.equal(F.uniqueLabel([], "  "), "Folder", "an empty name still gets a usable label");
});

test("trk208: merged scans keep each folder's paths apart and add up the skips", () => {
  const a = { name:"Music", skipped:1, files:[{ file:{ name:"a.mp3" }, rel:"Music/Album/a.mp3" }, { file:{ name:"b.mp3" }, rel:"Music/b.mp3" }] };
  const b = { name:"Music", skipped:2, files:[{ file:{ name:"c.mp4" }, rel:"Music/c.mp4" }] };
  const merged = F.mergeScans([a, b]);
  assert.deepEqual([...merged.labels], ["Music", "Music (2)"]);
  assert.deepEqual([...merged.files.map(item => item.rel)], ["Music/Album/a.mp3", "Music/b.mp3", "Music (2)/c.mp4"]);
  assert.equal(merged.skipped, 3, "skipped files are summed");
});

/* ---------- 書斎：フォルダーのまま読む本の分け方 ---------- */
const utilBox = { window:{} };
vm.createContext(utilBox);
vm.runInContext(utilSrc, utilBox, { filename:"js/study-room-utils.js" });
const U = utilBox.window.TrkStudyUtils;

test("trk208: folder books keep the full path so a page can be opened later", () => {
  const entries = [
    { name:"1.png", path:"Pictures/Manga/vol1/1.png", size:10 },
    { name:"2.png", path:"Pictures/Manga/vol1/2.png", size:20 },
    { name:"1.png", path:"Pictures/Manga/vol2/1.png", size:30 },
    { name:"cover.png", path:"Pictures/Manga/cover.png", size:40 },
    { name:"notes.txt", path:"Pictures/Manga/notes.txt", size:1 },
  ];
  const split = U.folderBookGroups(entries, "split");
  assert.deepEqual(Array.from(split, group => group.sourcePath), ["Pictures/Manga", "Pictures/Manga/vol1", "Pictures/Manga/vol2"]);
  const vol1 = split.find(group => group.sourcePath === "Pictures/Manga/vol1");
  assert.equal(vol1.title, "vol1");
  assert.deepEqual(Array.from(vol1.pages, page => page.path), ["Pictures/Manga/vol1/1.png", "Pictures/Manga/vol1/2.png"], "full paths survive");
  assert.deepEqual(Array.from(vol1.pages, page => page.size), [10, 20]);
  const flat = U.folderBookGroups(entries, "flat");
  assert.equal(flat.length, 1, "flat keeps one book per chosen folder");
  assert.equal(flat[0].pages.length, 4, "a text file is not a page");
});

test("trk208: a linked book reports no size on this device", () => {
  const linked = { kind:"image", linked:true, pages:[{ size:5000 }, { size:5000 }] };
  assert.equal(U.bookSize(linked), 0, "nothing is stored for a folder book");
  assert.equal(U.bookSize({ kind:"image", pages:[{ size:5000 }] }), 5000, "copied books still count");
});

/* ---------- 曲リスト側の配線 ---------- */
test("trk208: the song list keeps a registry of folders instead of a single handle", () => {
  assert.ok(libSrc.includes('libKV.put("folders"'), "the registry is saved next to the old single handle");
  assert.ok(libSrc.includes("async function loadSharedFolders()") && libSrc.includes('libKV.get("share")'),
    "the old single handle is migrated into the registry");
  assert.ok(libSrc.includes('startIn:FOLDER_KIND_START[video ? "video" : "music"]'), "music → music, video → videos");
  assert.ok(/const FOLDER_KIND_START = \{ music:"music", video:"videos" \};/.test(libSrc), "both well-known starts are declared");
  assert.ok(libSrc.includes("async function readSharedFolders()") && libSrc.includes("TrkSharedFolders.mergeScans(scans)"),
    "every readable folder is merged into one song list");
  assert.ok(libSrc.includes("async function removeSharedFolder(id)"), "a single folder can be removed without stopping everything");
  assert.ok(libSrc.includes('libKV.del("folders")'), "🚫 stop sharing forgets the whole registry");
});

test("trk208: the share panel offers a video folder and lists what is shared", () => {
  assert.ok(html.includes('id="libShareVideoBtn"'), "🎬 share a video folder");
  assert.ok(html.includes('id="libSharedFolderList"'), "the list of remembered folders");
  const text = i18nSrc;
  for (const key of ["libShareVideo", "libShareStateMulti", "libShareFolderCount", "libShareFolderRemoveHint", "libShareAdded", "libShareAlready", "libShareFolderMax", "libShareRemoved"]) {
    const count = [...text.matchAll(new RegExp(`\\b${key}:`, "g"))].length;
    assert.equal(count, 4, `${key} is translated into four languages (found ${count})`);
  }
});

test("trk208: the first tap asks for one folder at a time, never a burst of prompts", () => {
  const kick = libSrc.match(/async function folderAutoKickShared\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(kick.includes("requestPermission"), "the confirmation happens inside the tap");
  assert.ok(kick.includes("armFolderAutoRead()"), "another folder that still needs a tap re-arms the wait");
  assert.ok(!/for \([^)]*\)[^]*?requestPermission/.test(kick), "the request is not inside a loop");
});

/* ---------- 曲リストの登録簿を実際に動かす（偽の libKV・偽のフォルダー） ---------- */
function registryWith({ stored = null, legacy = null, folders = [], permissions = [] } = {}) {
  const saved = { folders:stored, share:legacy };
  const calls = { puts:[], dels:[], ingested:null, scans:[] };
  const libKV = {
    async get(key) { return saved[key] === undefined ? undefined : saved[key]; },
    async put(key, value) { calls.puts.push(key); saved[key] = value; },
    async del(key) { calls.dels.push(key); delete saved[key]; },
  };
  const core = { settings:{ libKeepShared:false }, setStatus() {}, $:() => ({ hidden:true, textContent:"" }) };
  const context = vm.createContext({
    libKV, core, __folders:folders, __perms:permissions, calls,
    sharedLabels: [], libHandle:null, libShared:false, shareRemembered:false, lastScan:[],
    TrkSharedFolders:F,
    folderPermissionOf: async h => { const at = folders.map(entry => entry.handle).indexOf(h); return (at >= 0 && permissions[at]) || "prompt"; },
    scanHandle: async h => { calls.scans.push(h.name); return { files:[{ file:{ name:`${h.name}.mp3` }, rel:`${h.name}/${h.name}.mp3` }], skipped:0 }; },
    ingestFolder: (files, label, shared, skipped) => { calls.ingested = { files, label, shared, skipped }; },
    keepSharedSongs: async () => {},
    syncShareUI: () => {},
    showReconnect: () => {},
    renderSharedFolderList: () => {},
  });
  vm.runInContext("let sharedFolders = __folders;\nlet libShared2 = false;", context);
  const names = ["sharedFolderLabel", "sharedFolderNames", "sharedPendingNameFrom", "loadSharedFolders", "saveSharedFolders", "readSharedFolders", "foldersNeedingPermission"];
  for (const name of names) {
    const re = name.startsWith("sharedFolder") && !name.startsWith("sharedFolderNames")
      ? /function sharedFolderLabel\(f, index\) \{[\s\S]*?\n\}/
      : new RegExp(`(?:async )?function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`);
    const match = libSrc.match(re);
    assert.ok(match, `${name} is extractable`);
    vm.runInContext(match[0], context);
  }
  return { context, calls, saved, run: expr => vm.runInContext(expr, context) };
}

test("trk208: the old single shared folder is migrated into the registry on first start", async () => {
  const legacy = { name:"Music", kind:"directory" };
  const env = registryWith({ legacy });
  await env.run("loadSharedFolders()");
  assert.equal(env.run("sharedFolders.length"), 1, "the old handle is kept");
  assert.equal(env.run("sharedFolders[0].kind"), "music");
  assert.deepEqual(env.calls.puts, ["folders"], "and written to the new registry key");
  assert.ok(env.saved.share, "the old key is never deleted (a browser that cannot save must not lose the folder)");
});

test("trk208: reading merges a music folder and a video folder into one song list", async () => {
  const music = { name:"Music" }, video = { name:"Videos" };
  const env = registryWith({
    folders:[{ id:"music:Music", name:"Music", kind:"music", handle:music, addedAt:0, label:"" },
      { id:"video:Videos", name:"Videos", kind:"video", handle:video, addedAt:0, label:"" }],
    permissions:["granted", "granted"],
  });
  const result = await env.run("readSharedFolders()");
  assert.equal(result.granted, 2, "both folders are readable");
  assert.deepEqual(env.calls.scans, ["Music", "Videos"], "both folders are scanned");
  assert.deepEqual([...env.calls.ingested.files.map(item => item.rel)], ["Music/Music.mp3", "Videos/Videos.mp3"], "paths stay apart");
  assert.equal(env.calls.ingested.label, "Music・Videos", "the status line names both folders");
  assert.equal(env.calls.ingested.shared, true);
});

test("trk208: a folder whose permission was refused is skipped, not retried in a loop", async () => {
  const music = { name:"Music" }, video = { name:"Videos" };
  const env = registryWith({
    folders:[{ id:"music:Music", name:"Music", kind:"music", handle:music, addedAt:0, label:"" },
      { id:"video:Videos", name:"Videos", kind:"video", handle:video, addedAt:0, label:"" }],
    permissions:["granted", "denied"],
  });
  const result = await env.run("readSharedFolders()");
  assert.equal(result.granted, 1);
  assert.deepEqual(env.calls.scans, ["Music"], "only the readable folder is scanned");
  assert.equal(env.calls.ingested.files.length, 1);
  const need = await env.run("foldersNeedingPermission()");
  assert.deepEqual([...need.map(item => item.permission)], ["denied"], "the refused folder is reported, not asked again");
});

/* ---------- 書斎側の配線 ---------- */
test("trk208: the study room shares a folder and reads pages in place", () => {
  assert.ok(html.includes('id="studyShareFolderBtn"'), "the 📂 button exists");
  assert.ok(studySrc.includes("async function studyShareImageFolder()") && studySrc.includes('startIn:"pictures"'), "the picker opens at the pictures folder");
  assert.ok(studySrc.includes("async function studyImportSharedFolder(handle)"), "the import path exists");
  assert.ok(/linked:true, sharedFolder:name/.test(studySrc), "books record which folder they belong to");
  assert.ok(studySrc.includes("book.linked ? await studySharedPageBlob(book, page)"), "pages are read from the folder, not from IndexedDB");
  assert.ok(studySrc.includes("raw.linked === true"), "the book shape remembers the link");
  assert.ok(studySrc.includes('libKV') === false && studySrc.includes("core.idbStore(\"shadow_taiko_library\", \"kv\")"),
    "the handle is stored in the library kv (outside the study database)");
});

test("trk208: a folder book never writes page blobs into the study database", () => {
  const block = studySrc.match(/async function studyImportSharedFolder\(handle\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!block.includes('studyDBBatch("pages"'), "no page blob is stored");
  assert.ok(!block.includes('"pages", "readwrite"'), "the pages store is untouched");
  assert.ok(block.includes("studyWriteImageRecord(item.id, record, old, refs)"), "only the table of contents is saved (through the existing writer)");
  assert.ok(block.includes("studySharedFolderByName(name)") || block.includes("studySharedFolders.push(entry)"), "the folder handle is registered");
});

test("trk208: a missing folder or permission is explained instead of failing silently", () => {
  for (const key of ["studyShareFolder", "studyFolderScanning", "studyFolderAdded", "studyFolderDenied", "studyFolderUnsupported",
    "studyFolderMissing", "studyFolderPermission", "studyFolderPageMissing", "studyLinkedBadge"]) {
    const count = [...studySrc.matchAll(new RegExp(`\\b${key}:`, "g"))].length;
    assert.equal(count, 4, `${key} is translated into four languages (found ${count})`);
  }
  const ja = studySrc.slice(studySrc.indexOf("Object.assign(TEXT.ja"), studySrc.indexOf("Object.assign(TEXT.en"));
  assert.ok(ja.includes("もう一度選ぶと、同じ本として読めます"), "the user is told how to reconnect");
});

/* ---------- バックアップとの約束 ---------- */
test("trk208: folder handles stay out of the backup and linked pages are not counted as storage", () => {
  assert.ok(backupSrc.includes('skip:{ kv:["dir", "share", "folders", "studyFolders"] }'), "handles cannot be serialized, so they are skipped");
  assert.ok(backupSrc.includes('value.kind === "image" && value.linked !== true'),
    "a folder book holds no bytes here, so restore limits must not count its pages");
});

test("trk208: the service worker cache is bumped for this change", () => {
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "版数つきの名前");
  assert.ok(Number(m[2]) > 206, `trk206 より新しい番号で割る（今は ${m[2]}）`);
});

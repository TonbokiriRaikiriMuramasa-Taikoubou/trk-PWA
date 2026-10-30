// SPDX-License-Identifier: GPL-3.0-or-later
/* 🔍 trk210：1.1.0 のレビュー（2026-10-27）で見つかった共有フォルダーまわりの3点と、
   レビューが「実機で確かめてほしい」と書いた 🔓 再接続の扱いを直す。
   1. × で最後の1本を外しても、1.0.x の "share" が残っていると次の起動で戻ってくる
   2. 1本でも「確認が必要」「拒否」だと、許可が生きているフォルダーの曲も起動時に出ない
   3. 書斎の 📂：同じ名前の**別の**フォルダーを選ぶと、前のフォルダーの本としおりが消える
   4. 🔓 再接続が1クリックで requestPermission を何本も呼ぶ（2本目以降が失敗しうる）
   ここで確かめるのは、DOM も IndexedDB も要らない部分（純関数・関数の中身・配線）。
   実機（Chrome／Edge のフォルダー選択・許可の確認）は手で確かめること。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const libSrc = read("js/library.js");
const studySrc = read("js/study-room.js");
const utilSrc = read("js/study-room-utils.js");
const html = read("index.html");
const swSrc = read("sw.js");

/* 関数の中身を取り出す（次のトップレベルの } まで） */
function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `not found: ${head}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 2);   /* 閉じかっこまで含める（VM で動かすため） */
}

/* ---------- 1. 最後の1本を外したら "share" も消す ---------- */
test("trk210: removing the last shared folder also forgets the legacy \"share\" record", async () => {
  const deleted = [];
  const box = {
    sharedFolders: [{ id: "a", name: "Music", kind: "music", handle: { name: "Music", kind: "directory" } }],
    sharedLabels: ["Music"], sharedPendingName: "Music", folderSongs: [{ dir: "Music/a.mp3" }],
    libHandle: null, libShared: true, lastScan: [], shareRemembered: true,
    libKV: { async del(k) { deleted.push(k); }, async get() { return null; } },
    core: { $: () => ({ hidden: false }), setStatus() {}, settings: {} },
    async saveSharedFolders() { return true; },
    async clearSharedSongs() {},
    async readSharedFolders() {},
    sharedFolderLabel: f => f.name,
    renderLib() {}, syncShareUI() {},
    Intl, console,
  };
  vm.createContext(box);
  vm.runInContext(`${body(libSrc, "async function removeSharedFolder(id)")}\n;globalThis.run = removeSharedFolder;`, box);
  await vm.runInContext("run('a')", box);
  assert.ok(deleted.includes("share"), 'the legacy "share" must be deleted, or it comes back on the next start');
  assert.equal(box.sharedFolders.length, 0);
  assert.equal(box.libShared, false);
});

/* ---------- 2. 許可が生きているフォルダーは、残りを待たずに読む ---------- */
test("trk210: folders whose permission is alive are read at start, and 🔓 stays while any folder is pending", () => {
  const restore = body(libSrc, "async function restoreSharedFolders()");
  assert.match(restore, /plan !== "scan" && autoRead && need\.length < sharedFolders\.length/,
    "partly granted folders are read before the first tap");
  assert.match(restore, /await readSharedFolders\(\)/);
  /* trk211 でヘルパーに集約（意味は同じ＝「まだ許可が要る先頭の1本」を文面に出す） */
  assert.match(restore, /sharedPendingName = sharedPendingNameFrom\(need\)/);

  const readFn = body(libSrc, "async function readSharedFolders()");
  assert.match(readFn, /hidden = granted >= sharedFolders\.length/,
    "🔓 is shown while at least one folder still needs permission");
  assert.match(readFn, /pending\.push\(f\)/, "pending folders are remembered for the 🔓 label");

  /* 🔓 の文面は「まだ許可が要る1本」の名前を出す（複数あるときに先頭の名前で迷わせない） */
  const show = body(libSrc, "function showReconnect()");
  assert.match(show, /name:sharedPendingName \|\| libHandle\.name/);
});

/* ---------- 3. 書斎：同名の別フォルダーは「Manga (2)」 ---------- */
test("trk210: a different folder with the same name gets its own shelf name instead of replacing the first", async () => {
  const first = { name: "Manga", kind: "directory", isSameEntry: async other => other === first };
  const second = { name: "Manga", kind: "directory", isSameEntry: async other => other === second };
  const box = {
    studySharedFolders: [{ id: "study:Manga", name: "Manga", handle: first, addedAt: 1 }],
    studySharedLoaded: true,
    studySharedFolderByName: name => box.studySharedFolders.find(f => f.name === name) || null,
    Intl, console,
  };
  vm.createContext(box);
  vm.runInContext(`${body(studySrc, "async function studySharedFolderNameFor(handle)")}\n;globalThis.nameFor = studySharedFolderNameFor;`, box);
  assert.equal(await vm.runInContext("nameFor(__second)", Object.assign(box, { __second: second })), "Manga (2)",
    "a different folder with the same name becomes Manga (2)");
  assert.equal(await vm.runInContext("nameFor(__first)", Object.assign(box, { __first: first })), "Manga",
    "picking the same folder again (permission lost) keeps the same books");

  const importFn = body(studySrc, "async function studyImportSharedFolder(handle)");
  assert.match(importFn, /await studySharedFolderNameFor\(handle\)/);
  assert.match(importFn, /sharedFolder:name/, "books carry the (possibly renamed) folder");
});

test("trk210: forgetting a study folder once its last linked book is deleted", async () => {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext(utilSrc, box, { filename: "js/study-room-utils.js" });
  const U = box.window.TrkStudyUtils;
  assert.deepEqual([...U.sharedFoldersInUse([
    { id: "a", linked: true, sharedFolder: "Manga" },
    { id: "b", linked: true, sharedFolder: "Manga" },
    { id: "c", kind: "image", sharedFolder: "Copied" },   /* コピーした本は数えない */
    { id: "d", kind: "text" },
  ])], ["Manga"]);

  const prune = body(studySrc, "async function studySharedFoldersPrune()");
  assert.match(prune, /STUDY_UTIL\.sharedFoldersInUse\(studyBooks\)/);
  assert.match(prune, /await studySharedFoldersSave\(\)/);
  assert.match(body(studySrc, "async function studyDeleteBook(book)"), /studySharedFoldersPrune\(\)/,
    "the registry is tidied when a book is deleted");
});

/* ---------- 4. 🔓 再接続は1タップ＝1本 ---------- */
test("trk210: the reconnect button asks for one folder per tap (a loop of requestPermission may fail)", () => {
  const head = 'core.$("libReconnectBtn").addEventListener("click"';
  const handler = body(libSrc, head);
  assert.match(handler, /foldersNeedingPermission\(\)/);
  assert.match(handler, /target\.folder\.handle\.requestPermission/, "only the first folder that needs it is asked");
  assert.ok(!/for \(const f of sharedFolders\)[\s\S]*requestPermission/.test(handler),
    "no loop of requestPermission calls inside one click");
  assert.match(handler, /armFolderAutoRead\(\)/, "the rest wait for the next tap");
});

/* ---------- キャッシュ名（変更したので上げる） ---------- */
test("trk210: the service worker cache name moves on for this change", () => {
  /* trk211 で番号が進むので「trk210 以降」で見る（名前そのものは後の版が持つ） */
  const cache = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(cache, "版数つきの名前");
  assert.ok(Number(cache[2]) >= 210, `trk210 以降の番号で割る（今は ${cache[2]}）`);
  assert.ok(html.includes("js/shared-folders.js"), "the shared folder helper is still loaded");
});

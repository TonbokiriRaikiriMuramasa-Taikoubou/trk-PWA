// SPDX-License-Identifier: GPL-3.0-or-later
/* trk201: 🗂 フォルダーの曲の「参照（📄）」を1件ずつ保存し直さない。
   起動のたびに最大3000件を IndexedDB へ書いていて重かったうえ、フォルダーを替えると
   前のフォルダーの参照が残り、📄行として復活していた（1.0.7 レビューの推奨）。
   ・保存するのは「曲ファイルを追加したもの」だけにする（フォルダーはフォルダー自体を覚えている）
   ・以前の版が保存したフォルダー曲の参照は、一度だけ掃除する（docs/MIGRATIONS.md）
   tests で確かめること：保存の入口・掃除の動き（偽のIndexedDB）・起動とフォルダー読み取りの配線・
   印が保存されること・消すのは参照だけであること */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");
const coreSrc = fs.readFileSync(`${ROOT}/js/core.js`, "utf8");

function slice(startMarker, endMarker) {
  const a = libSrc.indexOf(startMarker);
  assert.ok(a >= 0, `${startMarker} がある`);
  const b = libSrc.indexOf(endMarker, a);
  assert.ok(b > a, `${endMarker} が後ろにある`);
  return libSrc.slice(a, b);
}

test("trk201: folder songs are no longer written to the reference store", () => {
  const remember = slice("async function rememberSongRef(it){", "async function rememberRefsForList");
  assert.ok(/if\(it\.source==="folder"\) return;/.test(remember), "フォルダー曲は保存しない");
  assert.ok(/if\(it\.source==="builtin"\|\|it\.source==="pack"\) return;/.test(remember), "同梱曲・パック曲は今までどおり");
  const ingest = slice("function ingestFolder(", "/* フォルダの中を歩く");
  assert.ok(!/rememberRefsForList\(folderSongs\)/.test(ingest), "フォルダー読み取りで全件保存しない");
  assert.ok(/void pruneFolderRefsOnce\(\);/.test(ingest), "代わりに古い参照を掃除する");
});

test("trk201: adding song/video files still keeps their reference", () => {
  /* 曲ファイルの追加・🎬 動画の追加は、これまでどおり保存する（📄行が消えない） */
  for (const marker of ["async function addSongFiles(list)", "async function addVideoFiles(list, opts)"]) {
    const body = slice(marker, "\n}\n");
    assert.ok(/rememberSongRef\(it\)/.test(body), `${marker} は参照を残す`);
  }
});

test("trk201: the clean-up removes only old folder references, once", async () => {
  const fn = libSrc.match(/async function pruneFolderRefsOnce\(force\)\{[\s\S]*?\n\}/)[0];
  const store = {
    "1|a": { key:"1|a", source:"folder", base:"a" },
    "2|b": { key:"2|b", source:"file", base:"b" },     // 追加した曲＝残す
    "3|c": { key:"3|c", base:"c" },                     // source 無し＝残す
  };
  const calls = { del: [], saved: 0 };
  const ctx = vm.createContext({
    core: { settings: {}, saveUserPrefs: () => { calls.saved++; } },
    ghostSongs: [{ key:"1|a", source:"folder" }, { key:"2|b", source:"file" }],
    songRefDB: {
      all: async () => Object.values(store),
      del: async k => { calls.del.push(k); delete store[k]; },
    },
  });
  vm.runInContext(`${fn}\nthis.__prune = pruneFolderRefsOnce; this.__ghosts = () => ghostSongs;`, ctx);

  const removed = await ctx.__prune();
  assert.equal(removed, 1, "消したのはフォルダー曲の参照1件");
  assert.deepEqual([...calls.del], ["1|a"]);
  assert.deepEqual(Object.keys(store), ["2|b", "3|c"], "追加した曲の参照は残す");
  assert.deepEqual(Array.from(ctx.__ghosts(), g => g.key), ["2|b"], "📄行からもフォルダー曲を外す");
  assert.equal(calls.saved, 1, "印を残す（次の起動では何もしない）");

  const again = await ctx.__prune();
  assert.equal(again, 0, "印があるので2回目は何もしない");
  assert.equal(calls.del.length, 1);
});

test("trk201: a broken store never breaks the start-up", async () => {
  const fn = libSrc.match(/async function pruneFolderRefsOnce\(force\)\{[\s\S]*?\n\}/)[0];
  const ctx = vm.createContext({
    core: { settings: {}, saveUserPrefs: () => {} },
    ghostSongs: [],
    songRefDB: { all: async () => { throw new Error("no db"); }, del: async () => {} },
  });
  vm.runInContext(`${fn}\nthis.__prune = pruneFolderRefsOnce;`, ctx);
  assert.equal(await ctx.__prune(), 0, "落ちずに0を返す");
});

test("trk201: the one-shot clean-up is registered and runs at start-up", () => {
  assert.ok(/await pruneFolderRefsOnce\(\);/.test(libSrc), "起動時に一度だけ");
  assert.ok(/trkFolderRefsPrune1: prefs\.trkFolderRefsPrune1 === 1 \? 1 : 0/.test(coreSrc), "印は設定に残す（毎回は走らない）");
  const registry = fs.readFileSync(`${ROOT}/docs/MIGRATIONS.md`, "utf8");
  const row = registry.split("\n").find(line => line.startsWith("| `trkFolderRefsPrune1`"));
  assert.ok(row, "docs/MIGRATIONS.md に登録");
  assert.match(row, /2027-01-27/, "削除予定日を決める");
  assert.ok(libSrc.includes("trkFolderRefsPrune1"), "コードと表の名前が一致する");
});

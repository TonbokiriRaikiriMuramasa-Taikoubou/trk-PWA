// SPDX-License-Identifier: GPL-3.0-or-later
/* trk199: 1.0.7 レビューの修正版パッチ（同梱の trk107-fix.patch）を取り込んだ分の見張り。
   ① 一覧を描くときに displayTitle を「使う前」に用意する（リロードで一覧が空になる不具合の原因）
   ② 選び直しで参照（📄）の記録を消さない／動画の参照は動画として選び直す
   ③ 📄 参照の行を押したら、曲を選ぶのではなく選び直しを開く
   ④ タッチの pointerdown は「ユーザー操作」に数えられないので、pointerup を待つ（拒否の誤表示を出さない） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const libSrc = fs.readFileSync(`${ROOT}/js/library.js`, "utf8");

function slice(startMarker, endMarker) {
  const a = libSrc.indexOf(startMarker);
  assert.ok(a >= 0, `${startMarker} がある`);
  const b = libSrc.indexOf(endMarker, a);
  assert.ok(b > a, `${endMarker} が後ろにある`);
  return libSrc.slice(a, b);
}

test("trk199: the list sets displayTitle before it is used (a reload no longer renders an empty list)", () => {
  const renderBody = slice("function renderLib()", "\nfunction renderBanner");
  const decl = renderBody.indexOf("const displayTitle = songDisplayTitle(it, m);");
  const use = renderBody.indexOf('b.setAttribute("aria-label", displayTitle');
  assert.ok(decl >= 0, "displayTitle を宣言している");
  assert.ok(use >= 0, "参照の行に aria-label を付けている");
  assert.ok(decl < use, "宣言が使用より前（宣言前参照の ReferenceError を出さない）");
  /* 実際に「参照の行」を描いても落ちないこと（同じ並びを VM で再現する） */
  const ctx = vm.createContext({ songDisplayTitle: () => "曲", tr: () => "参照のみ", out: [] });
  vm.runInContext(`
    let html = "";
    const b = { setAttribute: (k, v) => { html += k + "=" + v + ";"; } };
    const it = { key: "1|a", ghost: true }, m = {};
    const displayTitle = songDisplayTitle(it, m);
    if (it.ghost) b.setAttribute("aria-label", displayTitle + " — " + tr("srcGhost"));
    out.push(html);
  `, ctx);
  assert.equal(ctx.out[0], "aria-label=曲 — 参照のみ;");
});

test("trk199: re-linking a file keeps the reference (the row comes back as 📄 next reload)", () => {
  const all = slice("async function ghostRelinkAll()", "/* 選び直したファイルを");
  const one = slice("async function relinkGhost(ghost)", "\nfunction forgetGhost");
  for (const [name, body] of [["ghostRelinkAll", all], ["relinkGhost", one]]) {
    assert.ok(!body.includes("songRefDB.del"), `${name} は参照を消さない`);
    assert.ok(body.includes("await addRelinkFiles(files"), `${name} は共通の振り分けを通す`);
  }
});

test("trk199: a video reference is re-opened as a video, a song reference as a song", async () => {
  const fn = libSrc.match(/async function addRelinkFiles\(files, ghost = null\)\{[\s\S]*?\n\}/)[0];
  const ctx = vm.createContext({});
  vm.runInContext(`
    let ghostSongs = [{ key: "10|clip", video: true }, { key: "20|song", video: false }];
    const calls = { songs: [], vids: [] };
    const core = { baseName: n => n.replace(/\\.[^.]+$/, "") };
    async function addSongFiles(f) { calls.songs.push(...f.map(x => x.name)); }
    async function addVideoFiles(f) { calls.vids.push(...f.map(x => x.name)); }
    ${fn}
    this.__run = (files, ghost) => addRelinkFiles(files, ghost);
    this.__calls = calls;
  `, ctx);
  const files = [
    { name: "clip.mkv", size: 10 },     // 参照が動画
    { name: "song.m4a", size: 20 },     // 参照が曲
    { name: "new.mp3", size: 30 },      // 参照なし＝曲の経路
  ];
  await ctx.__run(files);
  assert.deepEqual([...ctx.__calls.vids], ["clip.mkv"], "動画の参照は動画として選び直す");
  assert.deepEqual([...ctx.__calls.songs], ["song.m4a", "new.mp3"], "曲はこれまでどおり");

  /* 1件だけの選び直しでも、渡された ghost の video を見る（ghostSongs に無くても） */
  ctx.__calls.songs.length = 0; ctx.__calls.vids.length = 0;
  await ctx.__run([{ name: "other.mkv", size: 99 }], { key: "99|other", video: true });
  assert.deepEqual([...ctx.__calls.vids], ["other.mkv"]);
  assert.deepEqual([...ctx.__calls.songs], []);
});

test("trk199: pressing a 📄 row opens the picker instead of starting a song", () => {
  const sel = slice("async function selectSong(it)", "const selection = ++songSelectToken;");
  assert.match(sel, /if \(it\.ghost\) \{ void relinkGhost\(it\); return; \}/, "参照の行は選び直しへ");
  const at = libSrc.indexOf("async function selectSong(it)");
  const ghost = libSrc.indexOf("if (it.ghost) { void relinkGhost(it); return; }");
  const token = libSrc.indexOf("const selection = ++songSelectToken;", at);
  assert.ok(ghost > at && ghost < token, "曲を選ぶ処理より前で分岐する（無い本体を探しに行かない）");
});

function kickHarness({ isActive = true, permission = "prompt", request = "granted" } = {}) {
  const calls = { request: 0, use: 0, disarmed: 0, status: [] };
  const handle = {
    name: "Music",
    async queryPermission() { return permission; },
    async requestPermission() { calls.request++; return request; },
  };
  const fn = libSrc.match(/async function folderAutoKick\(e\) \{[\s\S]*?\n\}/)[0];
  const manual = libSrc.match(/const FOLDER_MANUAL_SELECTOR = [^;]+;/)[0];
  const permFn = libSrc.match(/async function folderPermissionOf\(h\) \{[\s\S]*?\n\}/)[0];
  const ctx = vm.createContext({
    libHandle: handle, libShared: false, calls,
    navigator: { userActivation: { isActive } },
    disarmFolderAutoRead: () => { calls.disarmed++; },
    useHandle: async () => { calls.use++; },
    markFolderAccess: () => {},
    showReconnect: () => {}, syncShareUI: () => {},
    core: {
      setStatus: (id, key) => calls.status.push(key),
      $: () => ({ hidden: false }),
    },
  });
  vm.runInContext(`let folderAutoBusy = false; let folderLastPermission = "";\n${manual}\n${permFn}\n${fn};
    globalThis.kick = e => folderAutoKick(e);`, ctx);
  return { ctx, calls };
}

test("trk199: a touch pointerdown waits for pointerup instead of showing a refusal", async () => {
  const down = kickHarness({ isActive: false });
  await down.ctx.kick({ type: "pointerdown", target: { closest: () => null } });
  assert.equal(down.calls.request, 0, "押しただけでは確認を出さない");
  assert.equal(down.calls.disarmed, 0, "待ち合わせは外さない（次の pointerup を待つ）");
  assert.equal(down.calls.status.length, 0, "「拒否」と誤表示しない");

  const up = kickHarness({ isActive: true });
  await up.ctx.kick({ type: "pointerup", target: { closest: () => null } });
  assert.equal(up.calls.request, 1, "指を離したら確認を出す");
  assert.equal(up.calls.use, 1);
  assert.equal(up.calls.disarmed, 1);
});

test("trk199: pointerup is armed and disarmed together with the other waits", () => {
  const arm = slice("function armFolderAutoRead()", "function markFolderAccess");
  const disarm = slice("function disarmFolderAutoRead()", "/* 最初のタップ");
  assert.ok(arm.includes('document.addEventListener("pointerup", folderAutoKick, true)'), "pointerup を待つ");
  assert.ok(disarm.includes('document.removeEventListener("pointerup", folderAutoKick, true)'), "解除もする");
});

test("trk199: the worker cache is bumped so the fixed files are served", () => {
  const swSrc = fs.readFileSync(`${ROOT}/sw.js`, "utf8");
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "版数つきの名前を保つ");
  /* 版数は固定しない（次のリリースで割れるため）。trk198 より新しい番号であることだけ見る */
  assert.ok(Number(m[2]) > 198, `trk198 より新しい番号で割る（今は ${m[2]}）`);
});

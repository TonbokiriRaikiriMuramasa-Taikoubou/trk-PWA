// SPDX-License-Identifier: GPL-3.0-or-later
/* 🔍 trk211：1.1.1 のレビュー（2026-10-27）の軽微な指摘。
   「最初のタップでの自動確認（folderAutoKickShared）で許可を断ったとき、sharedPendingName が
     更新されないため、🔓 ボタンに少し前のフォルダー名が出ることがある」を直す。
   ここで確かめるのは、DOM も IndexedDB も要らない部分（純関数・関数の中身・配線）。
   実機（Chrome／Edge の許可ダイアログ）は手で確かめること。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

const read = rel => fs.readFileSync(`${ROOT}/${rel}`, "utf8");
const libSrc = read("js/library.js");
const swSrc = read("sw.js");

/* 関数の中身を取り出す（次のトップレベルの } まで） */
function body(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `not found: ${head}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 2);   /* 閉じかっこまで含める（VM で動かすため） */
}

/* 共有フォルダーの偽物（フォルダー名・許可の状態つき） */
function folder(name, permission, answer = permission) {
  return {
    /* answer＝実際に requestPermission が返す値（許可できる場面を作るときに使う） */
    folder: { name, handle: { name, kind: "directory", requestPermission: async () => answer } },
    permission,
  };
}

function boxFor({ needSeq, pending = "Old" }) {
  const btn = { hidden: true, textContent: "" };
  const statuses = [];
  const box = {
    sharedPendingName: pending,
    libHandle: { name: "OldHandle" },
    libShared: true,
    folderAutoArmed: false,
    readCalls: 0,
    armCalls: 0,
    syncCalls: 0,
    statuses,
    needSeq,
    needCalls: 0,
    core: {
      $: () => btn,
      setStatus(key) { statuses.push(key); },
      settings: {},
    },
    btn,
    tr: (key, vars) => `${key}:${vars && vars.name ? vars.name : ""}`,
    async foldersNeedingPermission() {
      const list = box.needSeq[Math.min(box.needCalls, box.needSeq.length - 1)];
      box.needCalls++;
      return list;
    },
    async readSharedFolders() { box.readCalls++; },
    markFolderAccess() {},
    armFolderAutoRead() { box.armCalls++; },
    disarmFolderAutoRead() {},
    syncShareUI() {
      box.syncCalls++;
      /* 本物の syncShareUI は最後に showReconnect() を呼ぶ（🔓 の文面を更新する） */
      vm.runInContext("showReconnect()", box);
    },
    console,
  };
  box.sharedFolders = [];
  vm.createContext(box);
  vm.runInContext(
    `${body(libSrc, "function sharedPendingNameFrom(list)")}\n` +
    `${body(libSrc, "function showReconnect()")}\n` +
    `${body(libSrc, "async function folderAutoKickShared()")}\n` +
    `;globalThis.run = folderAutoKickShared;`,
    box,
  );
  return box;
}

/* ---------- 1. 次に聞く1本を選ぶ純関数 ---------- */
test("trk211: the 🔓 label names the next folder to ask, not the one just refused", () => {
  const box = { console };
  vm.createContext(box);
  vm.runInContext(`${body(libSrc, "function sharedPendingNameFrom(list)")}\n;globalThis.pick = sharedPendingNameFrom;`, box);

  assert.equal(box.pick([folder("Music", "prompt"), folder("Video", "prompt")]), "Music",
    "まだ確認していない先頭の1本");
  assert.equal(box.pick([folder("Music", "denied"), folder("Video", "prompt")]), "Video",
    "拒否された1本は飛ばして、次に聞ける1本を出す");
  assert.equal(box.pick([folder("Music", "denied"), folder("Video", "denied")]), "Music",
    "全部が拒否なら空にせず先頭の1本を出す（libHandle.name に落ちない）");
  assert.equal(box.pick([]), "", "残りが無ければ空");
  assert.equal(box.pick(null), "", "引数が無くても落ちない");
  /* readSharedFolders が渡すのは「フォルダーそのもの」の配列（permission を持たない） */
  assert.equal(box.pick([{ name: "Only" }, { name: "Other" }]), "Only");
});

/* ---------- 2. 最初のタップで断られたとき ---------- */
test("trk211: refusing in the first-tap check updates the 🔓 label to the next folder", async () => {
  const box = boxFor({
    needSeq: [
      [folder("Music", "prompt"), folder("Video", "prompt")],   /* 最初のタップ */
      [folder("Music", "denied"), folder("Video", "prompt")],   /* 断った後 */
    ],
  });
  await vm.runInContext("run()", box);

  assert.equal(box.sharedPendingName, "Video", "断った Music ではなく、次に聞く Video を出す");
  assert.match(box.btn.textContent, /Video/, "🔓 の文面も一緒に変わる");
  assert.equal(box.btn.hidden, false, "🔓 は出したまま");
  assert.equal(box.armCalls, 1, "残りの1本は次のタップで聞く（自動の待ち合わせを掛け直す）");
  assert.equal(box.readCalls, 0, "断られたときは読み直さない");
});

/* ---------- 3. 全部断られたとき ---------- */
test("trk211: when every remaining folder is refused, the label still shows a folder name", async () => {
  const box = boxFor({
    needSeq: [
      [folder("Music", "prompt"), folder("Video", "prompt")],
      [folder("Music", "denied"), folder("Video", "denied")],
    ],
  });
  await vm.runInContext("run()", box);
  assert.equal(box.sharedPendingName, "Music", "空にして libHandle.name に落とさない");
  assert.doesNotMatch(box.btn.textContent, /OldHandle/);
  assert.equal(box.armCalls, 0, "聞ける1本が残っていないので待ち合わせない");
});

/* ---------- 4. 許可できたとき（残りは次のタップ） ---------- */
test("trk211: after a granted folder is read, the label follows the folder still pending", async () => {
  const box = boxFor({
    needSeq: [
      [folder("Music", "prompt", "granted")],
      [folder("Video", "prompt")],
    ],
  });
  await vm.runInContext("run()", box);
  assert.equal(box.readCalls, 1, "許可できたら読む");
  assert.equal(box.sharedPendingName, "Video", "残っている1本に合わせ直す");
  assert.equal(box.armCalls, 1);
});

/* ---------- 5. 🔓 ボタンの側も同じ決め方にそろえてある ---------- */
test("trk211: the 🔓 button recomputes the label after a refusal instead of keeping the old name", () => {
  assert.doesNotMatch(libSrc, /sharedPendingName = target\.folder\.name;/,
    "断った1本の名前をそのまま残さない");
  const btn = libSrc.slice(libSrc.indexOf('core.$("libReconnectBtn").addEventListener("click"'));
  const handler = btn.slice(0, btn.indexOf("\n});"));
  assert.match(handler, /const rest = await foldersNeedingPermission\(\);\s*\n\s*sharedPendingName = sharedPendingNameFrom\(rest\);[\s\S]*core\.setStatus\("libStatus", "libShareDenied"\)/,
    "断られたら、残りを数え直してから文面を合わせる");
  assert.match(handler, /await readSharedFolders\(\);\s*\n\s*const rest = await foldersNeedingPermission\(\);\s*\n\s*sharedPendingName = sharedPendingNameFrom\(rest\);/,
    "読み終えた後も残りの1本に合わせる");
});

/* ---------- 6. cache 名 ---------- */
test("trk211: the service worker cache name moves on for this change", () => {
  /* 後の版で番号が進むので「trk211 以降」で見る（名前そのものは後の版が持つ） */
  const m = swSrc.match(/^const CACHE = "trk-v([\d.]+)-trk(\d+)";$/m);
  assert.ok(m, "版数つきの名前");
  assert.ok(Number(m[2]) >= 211, `trk211 以降の番号で割る（今は ${m[2]}）`);
});

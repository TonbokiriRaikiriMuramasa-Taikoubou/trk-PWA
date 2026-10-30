// SPDX-License-Identifier: GPL-3.0-or-later
/* trk160–163: ZIP/backup hard limits, pack restore ordering, study store write ordering, and user-visible restore reporting. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

function loadZipIO() {
  const sandbox = { window:{}, console, TextEncoder, TextDecoder, Blob, File, Response, Uint8Array, DataView, ArrayBuffer,
    BigInt, CompressionStream, DecompressionStream, Map, Math, Number, String, Array, Error, Promise, Uint32Array };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${ROOT}/js/zip-io.js`, "utf8"), sandbox);
  return sandbox.window.Trk.zipIO;
}
const Z = loadZipIO();
const freshMeta = () => ({ format:"trk-backup", version:1, app:"trk", createdAt:"2026-10-14T00:00:00.000Z",
  areas:{ core:false, study:false, packs:true, media:false }, counts:{ ls:0, library:0, study:{ books:0, pages:0 }, packs:0, media:0 } });
async function packBlob(id) {
  return Z.zipWrite([{ name:"pack.json", blob:new Blob([JSON.stringify({ id, format:"shadow-taiko-pack", name:id, author:"test" })]), deflate:true }]);
}
async function backupFile(entries = [], { packs = true } = {}) {
  const meta = freshMeta(); meta.areas.packs = packs;
  return Z.zipWrite([
    { name:"backup.json", blob:new Blob([JSON.stringify(meta)]), deflate:true },
    ...entries.map((blob, i) => ({ name:`packs/${String(i + 1).padStart(4, "0")}.stpack`, blob })),
  ]);
}
async function backupWithLocalItems(items) {
  const meta = freshMeta(); meta.areas = { core:true, study:false, packs:false, media:false };
  return Z.zipWrite([
    { name:"backup.json", blob:new Blob([JSON.stringify(meta)]), deflate:true },
    { name:"local.json", blob:new Blob([JSON.stringify({ items })]), deflate:true },
  ]);
}
test("backup restore reports ZIP entry-count safety caps as non-bypassable", async () => {
  const restore = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, limitsIgnored:true });
  const valid = await Z.zipWrite([
    { name:"backup.json", blob:new Blob([JSON.stringify(freshMeta())]), deflate:true },
  ], { forceZip64:true });
  const bytes = new Uint8Array(await valid.arrayBuffer());
  let record = -1;
  for (let i = 0; i + 4 <= bytes.length; i++) if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x06 && bytes[i + 3] === 0x06) { record = i; break; }
  assert.ok(record >= 0, "forced ZIP64 end record is present");
  const view = new DataView(bytes.buffer);
  view.setBigUint64(record + 24, BigInt(Z.limits.entries + 1), true);
  view.setBigUint64(record + 32, BigInt(Z.limits.entries + 1), true);
  await assert.rejects(restore.readBackupMeta(new Blob([bytes])), e => e.key === "backupHardLimit");
});

async function studyBackup({ pageBytes = 101, declaredPageSize = 1 } = {}) {
  const meta = freshMeta(); meta.areas = { core:false, study:true, packs:false, media:false };
  const book = [{ k:{ s:"book-1" }, v:{ id:"book-1", kind:"image", pages:[{ key:"page-1", size:declaredPageSize }] } }];
  const pages = [{ k:{ s:"page-1" }, v:{ $blob:"blobs/0000001", type:"image/png", file:false, name:"", mtime:0 } }];
  return Z.zipWrite([
    { name:"backup.json", blob:new Blob([JSON.stringify(meta)]), deflate:true },
    { name:"db/trk_study_room_v1/books.json", blob:new Blob([JSON.stringify(book)]), deflate:true },
    { name:"db/trk_study_room_v1/pages.json", blob:new Blob([JSON.stringify(pages)]), deflate:true },
    { name:"blobs/0000001", blob:new Blob([new Uint8Array(pageBytes)]) },
  ]);
}
function mockIDB(packStore, events, extraStores = new Map()) {
  const stores = new Map([["packs", packStore], ...extraStores]);
  const db = {
    objectStoreNames:{ contains:name => stores.has(name) },
    createObjectStore(name) { const store = new Map(); stores.set(name, store); return { createIndex() {} }; },
    close() {},
    transaction(name) {
      const map = stores.get(name);
      /* リクエスト（getAllKeys）が無いトランザクション（clear+put だけ）でも oncomplete へ進む。
         リクエストがあるときは、そのコールバックが終わってから完了する（delete→complete の順を保つ） */
      let pending = 0, finished = false;
      const complete = () => { if (!pending && !finished) { finished = true; setTimeout(() => tx.oncomplete?.(), 0); } };
      const tx = { error:null, oncomplete:null, onerror:null, onabort:null, abort() { this.onabort?.(); } };
      const os = {
        getAllKeys() {
          pending++;
          const req = { result:null, onsuccess:null, onerror:null };
          setTimeout(() => {
            req.result = [...map.keys()];
            req.onsuccess?.();
            pending--; complete();
          }, 0);
          return req;
        },
        put(value, key) { events.push(`put:${name}:${String(key)}`); map.set(key, value); },
        clear() { events.push(`clear:${name}`); map.clear(); },
        delete(key) { events.push(`delete:${key}`); map.delete(key); },
      };
      tx.objectStore = () => os;
      setTimeout(complete, 0);
      return tx;
    },
  };
  return {
    databases:async () => [{ name:"shadow_taiko_packs" }],
    open() {
      const req = { result:null, onsuccess:null, onerror:null, onblocked:null, onupgradeneeded:null };
      setTimeout(() => { req.result = db; req.onsuccess?.(); }, 0);
      return req;
    },
  };
}
function loadBackup({ idb, custom, tr = (key, vars = {}) => `${key}:${JSON.stringify(vars)}`, elements = {},
  confirmFn = () => true, alertFn = () => {}, reloadFn = () => {}, limitsIgnored = true, localStore = new Map(),
  studyLimits = { shelf:500, pages:3000, imageBytes:600 * 1048576, imageFileBytes:100 * 1048576, textBytes:12 * 1048576 } }) {
  const window = { tr, alert:alertFn, Trk:{ core:{ storageLimitsIgnored:() => limitsIgnored, $:() => null, setStatus() {} }, custom, zipIO:Z, studyLimits } };
  const sandbox = {
    window, document:{ readyState:"complete", getElementById:id => elements[id] || null, addEventListener() {} },
    confirm:confirmFn, location:{ reload:reloadFn },
    indexedDB:idb, localStorage:{ getItem:key => localStore.has(key) ? localStore.get(key) : null,
      setItem:(key, value) => localStore.set(key, String(value)), removeItem:key => localStore.delete(key) },
    console, Blob, File, Date, Number, String, Array, Object, JSON, Math, Error, Promise, ArrayBuffer, Uint8Array, DataView, Map, Set,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${ROOT}/js/backup.js`, "utf8"), sandbox);
  return window.Trk.backup;
}

function customFor(store, events, failIds = []) {
  return {
    packIdentityFromManifest(raw) { return raw && typeof raw.id === "string" ? { id:raw.id } : null; },
    async installPackFile(file) {
      const id = file.name.includes("0001") ? "target-good" : "target-fail";
      events.push(`install:${id}`);
      if (failIds.includes(id)) return null;
      store.set(id, { id, value:"restored" });
      return { id };
    },
  };
}

test("failed replacement preserves its old pack; successful installs precede pruning absent IDs", async () => {
  const events = [];
  const oldFailed = { id:"target-fail", value:"pre-existing version" };
  const store = new Map([
    ["target-fail", oldFailed],
    ["target-good", { id:"target-good", value:"old version" }],
    ["stale", { id:"stale", value:"not in backup" }],
  ]);
  const custom = customFor(store, events, ["target-fail"]);
  const restore = loadBackup({ idb:mockIDB(store, events), custom });
  const file = await backupFile([await packBlob("target-good"), await packBlob("target-fail")]);
  const result = await restore.restoreBackup(file);

  assert.equal(result.packsOk, 1);
  assert.equal(result.packsFailed, 1);
  assert.equal(result.packsRemoved, 1);
  assert.equal(result.packCleanupSkipped, false);
  assert.deepEqual(events, ["install:target-good", "install:target-fail", "delete:stale"]);
  assert.equal(store.get("target-good").value, "restored");
  assert.equal(store.get("target-fail"), oldFailed, "failed replacement leaves the previous same-ID pack untouched");
  assert.equal(store.has("stale"), false, "only an ID absent from the backup is pruned");
});

test("an unidentifiable backup pack disables pruning rather than risking unrelated data", async () => {
  const events = [];
  const store = new Map([["keep-me", { id:"keep-me", value:"safe" }], ["stale", { id:"stale" }]]);
  const custom = {
    packIdentityFromManifest() { return null; },
    async installPackFile() { events.push("install:failed"); return null; },
  };
  const restore = loadBackup({ idb:mockIDB(store, events), custom });
  const malformedInner = await Z.zipWrite([{ name:"other.json", blob:new Blob(["not a pack"]) }]);
  const result = await restore.restoreBackup(await backupFile([malformedInner]));
  assert.equal(result.packsFailed, 1);
  assert.equal(result.packsRemoved, 0);
  assert.equal(result.packCleanupSkipped, true, "the report can distinguish preserved data from a clean inventory");
  assert.deepEqual(events, ["install:failed"]);
  assert.equal(store.has("keep-me"), true);
  assert.equal(store.has("stale"), true);
});

test("an intentionally empty pack area removes all installed pack IDs", async () => {
  const events = [];
  const store = new Map([["old-a", { id:"old-a" }], ["old-b", { id:"old-b" }]]);
  const custom = {
    packIdentityFromManifest(raw) { return raw && typeof raw.id === "string" ? { id:raw.id } : null; },
    async installPackFile() { throw new Error("there are no pack entries"); },
  };
  const restore = loadBackup({ idb:mockIDB(store, events), custom });
  const result = await restore.restoreBackup(await backupFile());
  assert.equal(result.packsOk, 0);
  assert.equal(result.packsFailed, 0);
  assert.equal(result.packsRemoved, 2);
  assert.equal(result.packCleanupSkipped, false);
  assert.equal(store.size, 0);
  assert.deepEqual(events, ["delete:old-a", "delete:old-b"]);
});

test("packs omitted from a backup are reported as unchanged and are not pruned", async () => {
  const events = [], store = new Map([["keep", { id:"keep" }]]);
  const custom = {
    packIdentityFromManifest() { return null; },
    async installPackFile() { throw new Error("packs must not be installed"); },
  };
  const restore = loadBackup({ idb:mockIDB(store, events), custom });
  const result = await restore.restoreBackup(await backupFile([], { packs:false }));
  assert.equal(result.packsOk, 0);
  assert.equal(result.packsRemoved, 0);
  assert.equal(result.packCleanupSkipped, false, "not including the pack area is not a failed cleanup");
  assert.equal(store.has("keep"), true);
  assert.deepEqual(events, []);
});

test("backup restore enforces shelf, page, file and per-album byte caps, using actual blob sizes", () => {
  const limits = { shelf:2, pages:10, imageBytes:600, imageFileBytes:100, textBytes:12 };
  const check = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, limitsIgnored:false, studyLimits:limits }).checkStudyLimits;
  const imageBook = sizes => ({ v:{ kind:"image", pages:sizes.map((size, index) => ({ key:`page-${index}`, size })) } });
  const invalid = book => assert.throws(() => check([book]), e => e.key === "backupRestoreLimit");

  assert.doesNotThrow(() => check([imageBook([100, 100, 100, 100, 100, 100])]));
  invalid(imageBook(Array(11).fill(0)));
  invalid(imageBook([101]));
  invalid(imageBook([86, 86, 86, 86, 86, 86, 86]));
  invalid({ v:{ kind:"text", content:"1234567890123", pages:[] } });
  assert.throws(() => check(Array.from({ length:3 }, () => ({ v:{ kind:"text", pages:[] } }))), e => e.key === "backupRestoreLimit");

  const actualSizeCheck = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, limitsIgnored:false, studyLimits:limits }).checkStudyLimits;
  assert.throws(() => actualSizeCheck([imageBook([1])], new Map([["page-0", 101]])), e => e.key === "backupRestoreLimit",
    "a forged small page.size does not hide the actual Blob size");
  const ignored = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, limitsIgnored:true, studyLimits:limits }).checkStudyLimits;
  assert.doesNotThrow(() => ignored([imageBook([1000, 1000, 1000, 1000]), { v:{ kind:"text", content:"long", pages:[] } }]));
});

test("restore checks the actual page Blob size instead of trusting book metadata", async () => {
  const restore = loadBackup({
    idb:mockIDB(new Map(), []), custom:{}, limitsIgnored:false,
    studyLimits:{ shelf:500, pages:3000, imageBytes:600 * 1048576, imageFileBytes:100, textBytes:12 * 1048576 },
  });
  await assert.rejects(restore.restoreBackup(await studyBackup({ pageBytes:101, declaredPageSize:1 })),
    e => e.key === "backupRestoreLimit");
});

test("the completion details report counts, failed-version protection and skipped pruning", () => {
  const tr = (key, vars = {}) => key === "backupRestorePackCounts"
    ? `counts:${vars.ok}/${vars.failed}/${vars.removed}` : key;
  const restore = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, tr });
  assert.equal(restore.formatRestoreDetails({ meta:{ areas:{ packs:true } }, packsOk:2, packsFailed:1, packsRemoved:3, packCleanupSkipped:true }),
    "counts:2/1/3\nbackupRestorePackFailedKept\nbackupRestorePackCleanupSkipped");
  assert.equal(restore.formatRestoreDetails({ meta:{ areas:{ packs:false } }, packsOk:0, packsFailed:0, packsRemoved:0 }),
    "backupRestorePacksNotIncluded");
});

test("manual lyrics and subtitle storage (including delay) are in the backup allowlist and restore", async () => {
  const lyrics = JSON.stringify({ "song-key":{ text:"[00:01.00]hello" } });
  const subtitles = JSON.stringify({ "song-key":{ text:"00:00:01.000 --> 00:00:02.000\\nline", offsetMs:250 } });
  const localStore = new Map();
  const restore = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, localStore });
  assert.ok(restore.LS_KEYS.includes("trk_lyrics_v1"));
  assert.ok(restore.LS_KEYS.includes("trk_subs_v1"));
  const file = await backupWithLocalItems({
    trk_lyrics_v1:lyrics, trk_subs_v1:subtitles, trk_not_allowed_v1:"must not be restored",
  });
  await restore.restoreBackup(file);
  assert.equal(localStore.get("trk_lyrics_v1"), lyrics);
  assert.equal(localStore.get("trk_subs_v1"), subtitles, "the subtitle offset lives in the same v1 value");
  assert.equal(localStore.has("trk_not_allowed_v1"), false, "unlisted localStorage keys stay excluded");
});

test("restored add-ons are previewed by name and count, sanitized for the prompt, and forced off", async () => {
  const addons = {
    "addon-a":{ id:"addon-a", name:"Alpha\n\u0085\u202eInjected", enabled:true, code:"register-a", consentAt:100, consentSha:"sha256:keep" },
    "addon-b":{ id:"addon-b", name:"Beta", enabled:false, code:"register-b" },
    "addon-c":{ id:"addon-c", name:"Gamma", enabled:true, code:"register-c" },
    "addon-d":{ id:"addon-d", name:"Delta", enabled:true, code:"register-d" },
  };
  const localStore = new Map([["trk_addons_v1", "current-addons"]]);
  const restore = loadBackup({ idb:mockIDB(new Map(), []), custom:{}, localStore });
  const file = await backupWithLocalItems({ trk_addons_v1:JSON.stringify(addons) });
  const info = await restore.readBackupMeta(file);
  assert.equal(info.addons.known, true);
  assert.equal(info.addons.count, 4);
  assert.deepEqual(Array.from(info.addons.names), ["Alpha Injected", "Beta", "Gamma"]);
  assert.equal(info.addons.omitted, 1);

  await restore.restoreBackup(file, { info });
  const stored = JSON.parse(localStore.get("trk_addons_v1"));
  assert.equal(stored["addon-a"].enabled, false);
  assert.equal(stored["addon-b"].enabled, false);
  assert.equal(stored["addon-c"].enabled, false);
  assert.equal(stored["addon-d"].enabled, false);
  assert.equal(stored["addon-a"].code, "register-a", "the installed code remains available for explicit later enablement");
  assert.equal(stored["addon-a"].consentSha, "sha256:keep", "the original consent fingerprint is retained but cannot auto-run while disabled");
});

test("restore confirmation includes add-on count, names, and the disabled-by-default rule", async () => {
  const element = () => ({ checked:false, disabled:false, files:[], value:"", handlers:{},
    addEventListener(type, handler) { this.handlers[type] = handler; } });
  const input = element(), prompts = [];
  input.files = [await backupWithLocalItems({ trk_addons_v1:JSON.stringify({
    "addon-one":{ id:"addon-one", name:"Echo", enabled:true, code:"code" },
    "addon-two":{ id:"addon-two", name:"Foxtrot", enabled:true, code:"code" },
  }) })];
  const restore = loadBackup({
    idb:mockIDB(new Map(), []), custom:{},
    elements:{ backupMakeBtn:element(), backupRestoreFile:input, ignoreLimitsChk:element() },
    tr:(key, vars = {}) => key === "backupRestoreAsk"
      ? `ask:${vars.addonCount}:${vars.addonNames}` : key,
    confirmFn:text => { prompts.push(text); return false; },
  });
  await input.handlers.change();
  assert.deepEqual(prompts, ["ask:2:Echo, Foxtrot"], "the native confirmation receives the count and add-on name list (comma-separated in every locale)");

  const i18nSource = fs.readFileSync(`${ROOT}/js/i18n.js`, "utf8");
  assert.equal((i18nSource.match(/backupRestoreAsk:/g) || []).length, 4, "confirmation text exists in all four locales");
  for (const phrase of [
    "復元したアドオンはすべてオフになります。",
    "Restored add-ons will all be disabled.",
    "恢复的插件都会处于关闭状态。",
    "복원된 애드온은 모두 꺼진 상태입니다.",
  ]) assert.ok(i18nSource.includes(phrase), `disabled-by-default explanation exists: ${phrase}`);
});

test("the restore completion report is acknowledged before the page reloads", async () => {
  const element = () => ({ checked:false, disabled:false, files:[], value:"", handlers:{},
    addEventListener(type, handler) { this.handlers[type] = handler; } });
  const input = element(), events = [];
  input.files = [await backupFile([], { packs:false })];
  const restore = loadBackup({
    idb:mockIDB(new Map(), []), custom:{},
    elements:{ backupMakeBtn:element(), backupRestoreFile:input, ignoreLimitsChk:element() },
    tr:(key, vars = {}) => key === "backupRestoreDone" ? `done:${vars.details}` : key,
    alertFn:text => events.push(["alert", text]),
    reloadFn:() => events.push(["reload"]),
  });
  assert.equal(typeof restore.restoreBackup, "function");
  await input.handlers.change();
  assert.deepEqual(events, [
    ["alert", "done:backupRestorePacksNotIncluded"],
    ["reload"],
  ]);
});

/* trk163（レビュー【低】③）：書斎のストアは参照される側から置き換える（pages→covers→books→settings）。
   一番大きな書き込み（pages）が先なので、容量不足などで途中失敗したときに本側は無傷＝残るのは「参照されないページ」。
   「本は新しいのにページは古い」（存在しないページを指す本）にはならない。 */
async function studyOrderBackup() {
  const meta = freshMeta(); meta.areas = { core:false, study:true, packs:false, media:false };
  const json = (name, rows) => ({ name:`db/trk_study_room_v1/${name}.json`, blob:new Blob([JSON.stringify(rows)]), deflate:true });
  return Z.zipWrite([
    { name:"backup.json", blob:new Blob([JSON.stringify(meta)]), deflate:true },
    /* ZIP のエントリー順は書き出し時と同じ（books が先・DB_STUDY.stores 順）。復元側で書き順を組み替える */
    json("books", [{ k:{ s:"book-1" }, v:{ id:"book-1", kind:"image", pages:[{ key:"page-1", size:3 }] } }]),
    json("pages", [{ k:{ s:"page-1" }, v:{ $blob:"blobs/0000001", type:"image/png", file:false, name:"", mtime:0 } }]),
    json("covers", [{ k:{ s:"song-1" }, v:{ bookId:"book-1", pageKey:"page-1", pageIndex:0 } }]),
    json("settings", [{ k:{ s:"ui" }, v:{ zoom:1 } }]),
    { name:"blobs/0000001", blob:new Blob([new Uint8Array(3)]) },
  ]);
}

test("study stores are replaced referenced-side first (pages→covers→books→settings)", async () => {
  const events = [];
  const study = new Map([
    ["books", new Map([["book-old", { id:"book-old" }]])],
    ["pages", new Map([["page-old", {}]])],
    ["covers", new Map()],
    ["settings", new Map()],
  ]);
  const restore = loadBackup({ idb:mockIDB(new Map(), events, study), custom:{} });
  await restore.restoreBackup(await studyOrderBackup());
  assert.deepEqual(events, [
    "clear:pages", "put:pages:page-1",
    "clear:covers", "put:covers:song-1",
    "clear:books", "put:books:book-1",
    "clear:settings", "put:settings:ui",
  ], "the ZIP carries books.json first, but referenced stores are written before the books that point at them");
  assert.deepEqual([...study.get("books").keys()], ["book-1"]);
  assert.deepEqual([...study.get("pages").keys()], ["page-1"]);
});

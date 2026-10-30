// SPDX-License-Identifier: GPL-3.0-or-later
/* IndexedDB まわりを node --test で検査する（依存パッケージ不要）。
 *
 *   node --test tests/        または   npm test
 *
 * 対象：
 *   ・js/core.js の idbStore（パック DB の v1→v2 移行・size index・合計・putIf・onblocked）
 *   ・js/media.js の解析結果キャッシュ（保存と読み出し・壊れた記録・件数の上限・セーフモード）
 * 本物のブラウザの代わりに tests/helpers/fake-idb.mjs を使う（その冒頭に真似る範囲を書いてある）。
 * 実ブラウザでの確認は smoke や probe（docs/HANDOFF.md §6・§7）で別に行う。 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";
import { createFakeIndexedDB, realmOf } from "./helpers/fake-idb.mjs";

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
/* 区切りの見出しの間だけを取り出す（ファイル全体を文脈に入れると、無関係な宣言まで巻き込むため） */
function between(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  const b = a < 0 ? -1 : src.indexOf(endMarker, a + 1);
  if (a < 0 || b < 0) throw new Error(`区切りが見つからない: ${startMarker.slice(0, 30)}`);
  return src.slice(a, b);
}
const until = async (cond, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("時間切れ");
    await new Promise(r => setTimeout(r, 5));
  }
};

/* 文脈（vm）と、その文脈の型に合わせた fake IndexedDB を作る */
function setup({ safe = false } = {}) {
  const ctx = vm.createContext({});
  const fake = createFakeIndexedDB(realmOf(ctx));
  ctx.indexedDB = fake.indexedDB;
  ctx.crypto = globalThis.crypto;
  ctx.window = { indexedDB: fake.indexedDB, crypto: globalThis.crypto, TrkSafeMode: () => safe };
  return { ctx, fake };
}

/* 素の IndexedDB 操作（テストの下準備に使う） */
function rawOpen(fake, name, version, onupgrade) {
  return new Promise((res, rej) => {
    const r = fake.indexedDB.open(name, version);
    r.onupgradeneeded = () => onupgrade(r.result, r.transaction);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("blocked"));
  });
}
function rawWrite(db, store, fn) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, "readwrite");
    fn(tx.objectStore(store));
    tx.oncomplete = () => res();
    tx.onerror = tx.onabort = () => rej(tx.error);
  });
}

/* ---------- idbStore（js/core.js） ---------- */
function loadIdbStore() {
  const { ctx, fake } = setup();
  const src = between(read("js/core.js"), "const IDB_VERSION = 2;", "/* ---------- ステータス表示");
  vm.runInContext(src + "\n;this.__idbStore = idbStore;", ctx, { filename: "js/core.js (idbStore)" });
  return { idbStore: ctx.__idbStore, fake, ctx };
}

describe("idbStore（パック DB）", () => {
  test("v1 → v2：size を持たない古い記録に size を書き戻し、index に載せる", async () => {
    const { idbStore, fake } = loadIdbStore();
    /* 旧版（v1）の状態を作る：store は作ったが size index は無く、size のない記録が入っている */
    const v1 = await rawOpen(fake, "shadow_taiko_packs", 1, db => db.createObjectStore("packs"));
    await rawWrite(v1, "packs", os => { os.put({ bytes: 100 }, "a"); os.put({ size: 50, bytes: 50 }, "b"); });
    v1.close();

    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    const usage = await db.usage();
    assert.deepEqual([usage.stored, usage.count, usage.fast], [150, 2, true], "index から数えた合計が、移行後の全件と一致する");
    assert.equal((await db.get("a")).size, 100, "移行で size が書き戻される");
  });

  test("主キーが数値でも、合計は size の合計（主キーを足さない）・高速経路を使う", async () => {
    const { idbStore } = loadIdbStore();
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    await db.put(1000, { size: 10, bytes: 10 });
    await db.put(2000, { size: 20, bytes: 20 });
    const usage = await db.usage();
    assert.equal(usage.stored, 30, "主キー（1000 + 2000）を size と取り違えない");
    assert.equal(usage.fast, true, "索引の値で数えられる");
  });

  test("文字列の主キー（パックの \"p…\"）でも高速経路を使う", async () => {
    const { idbStore } = loadIdbStore();
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    await db.put("pabc", { size: 5, bytes: 5 });
    const usage = await db.usage();
    assert.deepEqual([usage.stored, usage.fast], [5, true]);
  });

  test("index で数えられない記録があると、全件を数え直して合計を過小にしない", async () => {
    const { idbStore } = loadIdbStore();
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    await db.put("x", { size: 10, bytes: 10 });
    await db.put("y", { bytes: 7 });                  // size が無い（index に載らない）
    const usage = await db.usage();
    assert.equal(usage.fast, false, "件数が食い違うので index を使わない");
    assert.equal(usage.stored, 17, "全件の合計（10 + 7）で数える。過小（10）にはしない");
  });

  test("putIf は、判定と書き込みを同じトランザクションで行い、上限を超えたら書かない", async () => {
    const { idbStore } = loadIdbStore();
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    await db.put("x", { size: 10, bytes: 10 });
    const okA = await db.putIf("z", { id: "z", size: 60, bytes: 60 }, s => s.stored + 60 <= 100);
    const okB = await db.putIf("w", { id: "w", size: 200, bytes: 200 }, s => s.stored + 200 <= 100);
    assert.equal(okA, true);
    assert.equal(okB, false);
    assert.equal(await db.get("w"), undefined, "上限を超えた記録は入らない");
    assert.equal((await db.usage()).stored, 70);
  });

  test("閉じていない古い接続があると onblocked で止まり、保存が固まらない", async () => {
    const { idbStore, fake } = loadIdbStore();
    const old = await rawOpen(fake, "shadow_taiko_packs", 1, db => db.createObjectStore("packs"));
    // old は閉じない（onversionchange も無い）
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    await assert.rejects(() => db.get("k"), /idb-blocked/);
    old.close();
  });

  test("古いタブが onversionchange で閉じてくれれば、そのまま版数が上がる", async () => {
    const { idbStore, fake } = loadIdbStore();
    const old = await rawOpen(fake, "shadow_taiko_packs", 1, db => db.createObjectStore("packs"));
    old.onversionchange = () => old.close();
    const db = idbStore("shadow_taiko_packs", "packs", { sizeKey: "size", sizeOf: r => r.bytes });
    assert.equal(await db.get("k"), undefined);
    assert.equal(fake.dbs.get("shadow_taiko_packs").version, 2);
  });
});

/* ---------- 解析結果のキャッシュ（js/media.js） ---------- */
const ANALYSIS_DB = "trk_analysis_cache_v1";
function loadCache({ safe = false } = {}) {
  const env = setup({ safe });
  const { ctx } = env;
  env.calls = 0;
  env.analysis = null;
  ctx.analyzeAudio = async () => { env.calls++; return env.analysis; };
  const src = between(read("js/media.js"), "/* ---------- 解析結果のキャッシュ", "/* ---------- 音声解析（音量");
  vm.runInContext(src + `
;this.__cache = { analysisCacheKey, analysisCacheGet, analysisCachePut, analysisCacheValid, analyzeAudioCached,
  ANALYSIS_CACHE_VERSION, ANALYSIS_CACHE_MAX };`, ctx, { filename: "js/media.js (cache)" });
  return { ...env, C: ctx.__cache };
}
function makeAnalysis(n, seed = 1) {
  const f = (k) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * k + seed) * 0.5 + 0.5);
  return { rms: f(0.1), onset: f(0.2), ratio: f(0.3), frames: n, frameMs: 10, maxRms: 0.9, scale: 0.25, loudness: -12.5, peak: 0.8 };   /* 🔊 trk168: 平準化の材料も数値で入る */
}
/* 同じ大きさの2つの「ファイル」。中身の先頭・末尾が違うと鍵も違う */
const fileOf = (bytes) => new Blob([bytes]);
const bytesOf = (fill, size = 200000) => new Uint8Array(size).fill(fill);

describe("解析結果のキャッシュ（js/media.js）", () => {
  test("保存と読み出し：同じ値が戻り、保存されるのは配列と数値だけ（PCM なし）", async () => {
    const { C, fake, ctx } = loadCache();
    const a = makeAnalysis(50);
    const key = await C.analysisCacheKey(fileOf(bytesOf(1)), "200000:300");
    await C.analysisCachePut(key, a);
    const got = await C.analysisCacheGet(key);
    assert.deepEqual(Array.from(got.rms), Array.from(a.rms));
    assert.deepEqual([got.frames, got.frameMs, got.maxRms, got.scale, got.loudness, got.peak], [50, 10, 0.9, 0.25, -12.5, 0.8]);
    const rec = fake.dbs.get(ANALYSIS_DB).stores.get("analysis").records.get(key);
    assert.deepEqual(Object.keys(rec).sort(), ["frameMs", "frames", "key", "loudness", "maxRms", "onset", "peak", "ratio", "rms", "savedAt", "scale", "version"]);
    assert.ok(rec.rms instanceof vm.runInContext("Float32Array", ctx), "配列は Float32Array として戻る");
  });

  test("鍵：同じ内容なら同じ鍵、末尾が違えば別の鍵、fingerprint が違えば別の鍵", async () => {
    const { C } = loadCache();
    const k1 = await C.analysisCacheKey(fileOf(bytesOf(1)), "200000:300");
    const k2 = await C.analysisCacheKey(fileOf(bytesOf(1)), "200000:300");
    const kTail = await C.analysisCacheKey(fileOf(Uint8Array.from([...bytesOf(1).subarray(0, 199999), 9])), "200000:300");
    const kFp = await C.analysisCacheKey(fileOf(bytesOf(1)), "200000:301");
    assert.equal(k1, k2);
    assert.notEqual(k1, kTail, "末尾の違いは別の曲として扱う");
    assert.notEqual(k1, kFp, "fingerprint の違いは別の曲として扱う");
    assert.ok(k1.startsWith(`v${C.ANALYSIS_CACHE_VERSION}|200000:300|`));
  });

  test("壊れた記録（配列が Float32Array でない）は無いものとして扱う", async () => {
    const { C, fake } = loadCache();
    const key = "v1|bad|0";
    const db = await rawOpen(fake, ANALYSIS_DB, 1, d => d.createObjectStore("analysis", { keyPath: "key" }).createIndex("savedAt", "savedAt"));
    await rawWrite(db, "analysis", os => os.put({ key, version: 1, savedAt: 1, frames: 3, frameMs: 10, maxRms: 1, scale: 1, rms: [1, 2, 3], onset: [0, 0, 0], ratio: [0, 0, 0] }));
    assert.equal(await C.analysisCacheGet(key), null);
  });

  test("件数の上限：31件目を入れると古い順に消え、30件に保つ", async () => {
    const { C, fake } = loadCache();
    const db = await rawOpen(fake, ANALYSIS_DB, 1, d => d.createObjectStore("analysis", { keyPath: "key" }).createIndex("savedAt", "savedAt"));
    const old = makeAnalysis(4);
    await rawWrite(db, "analysis", os => {
      for (let s = 1; s <= 30; s++) os.put({ key: `k${s}`, version: 1, savedAt: s, frames: 4, frameMs: 10, maxRms: 1, scale: 1, rms: old.rms, onset: old.onset, ratio: old.ratio }, undefined);
    });
    db.close();
    await C.analysisCachePut("newest", makeAnalysis(4));
    const recs = fake.dbs.get(ANALYSIS_DB).stores.get("analysis").records;
    assert.equal(recs.size, 30);
    assert.equal(recs.has("k1"), false, "最も古いものが消える");
    assert.equal(recs.has("k2"), true);
    assert.equal(recs.has("newest"), true);
  });

  test("LRU：読み出したものは savedAt が今に更新され、次の上限超過で先に消えない", async () => {
    const { C, fake } = loadCache();
    const db = await rawOpen(fake, ANALYSIS_DB, 1, d => d.createObjectStore("analysis", { keyPath: "key" }).createIndex("savedAt", "savedAt"));
    const old = makeAnalysis(4);
    await rawWrite(db, "analysis", os => {
      for (let s = 1; s <= 30; s++) os.put({ key: `k${s}`, version: 1, savedAt: s, frames: 4, frameMs: 10, maxRms: 1, scale: 1, rms: old.rms, onset: old.onset, ratio: old.ratio }, undefined);
    });
    db.close();
    const hit = await C.analysisCacheGet("k1");          // 最も古いものを読む（FIFO なら次に消える）
    assert.equal(hit.frames, 4, "読み出し自体は従来どおり");
    const recs = fake.dbs.get(ANALYSIS_DB).stores.get("analysis").records;
    assert.ok(recs.get("k1").savedAt > 30, "読んだ記録の savedAt は今の時刻に更新される");
    await C.analysisCachePut("newest", makeAnalysis(4));
    assert.equal(recs.size, 30);
    assert.equal(recs.has("k1"), true, "読まれた曲は残る（LRU）");
    assert.equal(recs.has("k2"), false, "読まれなかった最古の曲が消える");
  });

  test("LRU：不正な記録は読んでも savedAt を書き換えない（解析し直して置き換える）", async () => {
    const { C, fake } = loadCache();
    const db = await rawOpen(fake, ANALYSIS_DB, 1, d => d.createObjectStore("analysis", { keyPath: "key" }).createIndex("savedAt", "savedAt"));
    await rawWrite(db, "analysis", os => os.put({ key: "bad", version: 1, savedAt: 5, frames: 3, frameMs: 10, maxRms: 1, scale: 1, rms: [1, 2, 3], onset: [0, 0, 0], ratio: [0, 0, 0] }));
    assert.equal(await C.analysisCacheGet("bad"), null);
    const recs = fake.dbs.get(ANALYSIS_DB).stores.get("analysis").records;
    assert.equal(recs.get("bad").savedAt, 5);
  });

  test("セーフモードでは読まず・書かず、解析は普通に行う", async () => {
    const { C, fake, ctx } = loadCache({ safe: true });
    let n = 0;
    ctx.analyzeAudio = async () => { n++; return makeAnalysis(20); };
    const got = await C.analyzeAudioCached(fileOf(bytesOf(2)), "200000:300");
    assert.equal(got.frames, 20);
    assert.equal(n, 1, "解析は普通に行う");
    assert.equal(fake.dbs.has(ANALYSIS_DB), false, "セーフモードではキャッシュの DB を開かない");
  });

  test("2回目はキャッシュから返り、解析を呼ばない。壊れた記録は解析し直して直す", async () => {
    const { C, fake, ctx } = loadCache();
    let n = 0;
    const analysis = makeAnalysis(30);
    ctx.analyzeAudio = async () => { n++; return analysis; };
    const file = fileOf(bytesOf(3));
    const first = await C.analyzeAudioCached(file, "200000:300");
    assert.equal(n, 1);
    await until(() => fake.dbs.has(ANALYSIS_DB) && fake.dbs.get(ANALYSIS_DB).stores.get("analysis").records.size === 1);
    const second = await C.analyzeAudioCached(file, "200000:300");
    assert.equal(n, 1, "2回目は解析を呼ばない");
    assert.deepEqual(Array.from(second.onset), Array.from(first.onset));
    assert.equal(second.scale, first.scale);

    // 壊れた記録を入れてから読むと、解析し直して正しい記録に置き換わる
    const key = await C.analysisCacheKey(file, "200000:300");
    const db = fake.dbs.get(ANALYSIS_DB).stores.get("analysis");
    db.records.set(key, { key, version: 1, savedAt: 1, frames: 30, frameMs: 10, maxRms: 1, scale: 1, rms: [1], onset: [1], ratio: [1] });
    await C.analyzeAudioCached(file, "200000:300");
    assert.equal(n, 2, "壊れた記録は使わず、解析し直す");
    /* 保存は待たずに行う（解析の結果を先に返すため）ので、置き換わるのを待つ */
    const F32 = vm.runInContext("Float32Array", ctx);
    await until(() => db.records.get(key) && db.records.get(key).rms instanceof F32);
    assert.equal(db.records.get(key).frames, 30, "記録は正しいかたちに置き換わる");
  });
});

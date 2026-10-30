// SPDX-License-Identifier: GPL-3.0-or-later
/* 📦 trk137／160／162: ZIP 入出力。BlobのCRC確認・書き出しはストリームで行い、ZIP64・改ざん・名前・資源上限の境界を検査する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

function loadZipIO() {
  const sandbox = {
    window: {}, console, TextEncoder, TextDecoder, Blob, File, Response, Uint8Array, DataView, ArrayBuffer, BigInt,
    CompressionStream, DecompressionStream, Map, Math, Number, String, Array, Error, Promise, Uint32Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${ROOT}/js/zip-io.js`, "utf8"), sandbox);
  return sandbox.window.Trk.zipIO;
}
const Z = loadZipIO();
const text = async (b) => new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()));
async function roundTrip(entries, opts) {
  const blob = await Z.zipWrite(entries, opts);
  return { blob, zip: await Z.zipOpen(blob) };
}
function findSignature(bytes, signature) {
  for (let i = 0; i + 4 <= bytes.length; i++) if (bytes[i] === (signature & 255) && bytes[i + 1] === ((signature >>> 8) & 255) &&
    bytes[i + 2] === ((signature >>> 16) & 255) && bytes[i + 3] === ((signature >>> 24) & 255)) return i;
  return -1;
}

test("store and deflate entries read back byte for byte", async () => {
  const entries = [
    { name: "backup.json", blob: new Blob(['{"a":1}']) },
    { name: "local.json", blob: new Blob(["x".repeat(5000)]), deflate: true },
    { name: "blobs/000001", blob: new Blob([new Uint8Array([0, 1, 2, 255])]) },
    { name: "日本語/ファイル.txt", blob: new Blob(["漫画の本文"]), deflate: true },
    { name: "empty.txt", blob: new Blob([]), deflate: true },
  ];
  const { zip } = await roundTrip(entries);
  assert.deepEqual([...zip.entries.map(e => e.name)], entries.map(e => e.name));   /* vm の別realm の配列を正規化 */
  for (const e of entries) {
    const got = zip.byName.get(e.name);
    const blob = await Z.zipEntryBlob(zip, got, 1e9);
    assert.equal(await text(blob), await text(e.blob), e.name);
    await Z.zipVerifyEntry(zip, got, 1e9);
  }
  assert.equal(zip.byName.get("local.json").method, 8, "text is deflated");
  assert.equal(zip.byName.get("blobs/000001").method, 0, "binary is stored");
});

test("ZIP64 structures (forced, including the ZIP64 end record) read back", async () => {
  const { zip } = await roundTrip([{ name: "a.bin", blob: new Blob(["hello"]) }, { name: "b.txt", blob: new Blob(["world"]), deflate: true }], { forceZip64: true });
  assert.equal(await text(await Z.zipEntryBlob(zip, zip.byName.get("a.bin"))), "hello");
  assert.equal(await text(await Z.zipEntryBlob(zip, zip.byName.get("b.txt"))), "world");
});

test("ZIP structure limits are hard caps for reader and writer, independent of settings", async () => {
  assert.deepEqual({ ...Z.limits }, { entries:250000, centralBytes:64 * 1048576 });
  assert.equal(Object.isFrozen(Z.limits), true);
  await assert.rejects(Z.zipWrite(new Array(Z.limits.entries + 1)), e => e.key === "zipLimit");

  const { blob } = await roundTrip([{ name:"a.bin", blob:new Blob(["x"]) }], { forceZip64:true });
  const source = new Uint8Array(await blob.arrayBuffer()), record = findSignature(source, 0x06064b50);
  assert.ok(record >= 0);
  const countOver = source.slice();
  const countView = new DataView(countOver.buffer);
  countView.setBigUint64(record + 24, BigInt(Z.limits.entries + 1), true);
  countView.setBigUint64(record + 32, BigInt(Z.limits.entries + 1), true);
  await assert.rejects(Z.zipOpen(new Blob([countOver])), e => e.key === "zipLimit");
  const centralOver = source.slice();
  new DataView(centralOver.buffer).setBigUint64(record + 40, BigInt(Z.limits.centralBytes + 1), true);
  await assert.rejects(Z.zipOpen(new Blob([centralOver])), e => e.key === "zipLimit");
});

test("ZIP64 end-record offsets and sizes must be safe integers", async () => {
  const { blob } = await roundTrip([{ name:"a.bin", blob:new Blob(["hello"]) }], { forceZip64:true });
  const source = new Uint8Array(await blob.arrayBuffer());
  const locator = findSignature(source, 0x07064b50), record = findSignature(source, 0x06064b50);
  assert.ok(locator >= 0 && record >= 0);
  const tooLarge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
  const mutate = (write) => { const bytes = source.slice(); write(new DataView(bytes.buffer), locator, record); return new Blob([bytes]); };
  const cases = [
    mutate((view, at) => view.setBigUint64(at + 8, tooLarge, true)),
    mutate((view, _at, at) => { view.setBigUint64(at + 24, tooLarge, true); view.setBigUint64(at + 32, tooLarge, true); }),
    mutate((view, _at, at) => view.setBigUint64(at + 40, tooLarge, true)),
    mutate((view, _at, at) => view.setBigUint64(at + 48, tooLarge, true)),
  ];
  for (const candidate of cases) await assert.rejects(Z.zipOpen(candidate), e => e.key === "zipBad" && e.name !== "RangeError");
});

test("a ZIP comment may contain an EOCD-shaped byte sequence without replacing the real record", async () => {
  const { blob } = await roundTrip([{ name:"commented.txt", blob:new Blob(["payload"]) }]);
  const original = new Uint8Array(await blob.arrayBuffer()), bytes = original.slice();
  const real = bytes.length - 22, view = new DataView(bytes.buffer);
  view.setUint16(real + 20, 22, true);
  const comment = new Uint8Array(22), fake = new DataView(comment.buffer);
  fake.setUint32(0, 0x06054b50, true); fake.setUint16(20, 0, true);
  const zip = await Z.zipOpen(new Blob([bytes, comment]));
  assert.equal(await text(await Z.zipEntryBlob(zip, zip.byName.get("commented.txt"))), "payload");
});

test("more than 65535 entries (ZIP64 end record) read back", async () => {
  const n = 65540;
  const entries = [];
  for (let i = 0; i < n; i++) entries.push({ name: `e/${i}`, blob: new Blob([String(i % 10)]) });
  const { zip } = await roundTrip(entries);
  assert.equal(zip.entries.length, n);
  assert.equal(await text(await Z.zipEntryBlob(zip, zip.byName.get(`e/${n - 1}`))), String((n - 1) % 10));
});

test("a changed byte in the data is detected by the CRC check", async () => {
  const { blob } = await roundTrip([{ name: "x.txt", blob: new Blob(["abcdef"]) }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  bytes[30 + 5 + 2] ^= 0x20;   /* 本文（ローカルヘッダ30＋名前5の次）の中を1byteだけ変える。中央ディレクトリは触らない */
  const zip = await Z.zipOpen(new Blob([bytes]));
  await assert.rejects(Z.zipVerifyEntry(zip, zip.byName.get("x.txt")), e => e.key === "zipCorrupt");
});

test("encrypted entries, path escapes and garbage are refused", async () => {
  const { blob } = await roundTrip([{ name: "x.txt", blob: new Blob(["abc"]) }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const find = (sig) => { for (let i = bytes.length - 4; i >= 0; i--) if (bytes[i] === sig[0] && bytes[i + 1] === sig[1] && bytes[i + 2] === sig[2] && bytes[i + 3] === sig[3]) return i; return -1; };
  const cd = find([0x50, 0x4b, 0x01, 0x02]);
  const enc = bytes.slice(); enc[cd + 8] |= 1;
  await assert.rejects(Z.zipOpen(new Blob([enc])), e => e.key === "zipEncrypted");
  const esc = new TextEncoder().encode("../x.txt");
  const pathBytes = bytes.slice(); const nameAt = cd + 46;
  pathBytes.set(esc.subarray(0, 3), nameAt);
  await assert.rejects(Z.zipOpen(new Blob([pathBytes])), e => e.key === "zipBad");
  await assert.rejects(Z.zipOpen(new Blob([new Uint8Array(10)])), e => e.key === "zipBad");
  await assert.rejects(Z.zipOpen(new Blob([])), e => e.key === "zipBad");
});

test("a declared size over the limit stops reading", async () => {
  const { zip } = await roundTrip([{ name: "big.txt", blob: new Blob(["y".repeat(100)]), deflate: true }]);
  await assert.rejects(Z.zipEntryBlob(zip, zip.byName.get("big.txt"), 10), e => e.key === "zipTooBig");
});

/* trk160：同じバイト数のASCII名に置き換え、ローカルヘッダーと中央ディレクトリの両方を変更する。 */
async function withName(name) {
  const { blob } = await roundTrip([{ name: "a".repeat(name.length), blob: new Blob(["abc"]) }]);
  const bytes = new Uint8Array(await blob.arrayBuffer()), nameBytes = new TextEncoder().encode(name);
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && (bytes[i + 2] === 0x01 || bytes[i + 2] === 0x03)) {
      bytes.set(nameBytes, i + (bytes[i + 2] === 0x01 ? 46 : 30));
    }
  }
  return new Blob([bytes]);
}

test("ellipses and Windows separators are accepted; only unsafe path segments are refused", async () => {
  const ellipsis = await Z.zipOpen(await withName("Wait.../001.jpg"));
  assert.equal(ellipsis.entries[0].name, "Wait.../001.jpg");
  const windows = await Z.zipOpen(await withName("ch01\\002.jpg"));
  assert.equal(windows.entries[0].name, "ch01/002.jpg");
  for (const name of ["a/../b.jpg", "C:/x/y.jpg", "/rooted/x.jpg", "\\rooted\\x.jpg"]) {
    await assert.rejects(Z.zipOpen(await withName(name)), e => e.key === "zipBad", name);
  }
});

test("a short ZIP64 extra field is reported as ZipIOError, not RangeError", async () => {
  const { blob } = await roundTrip([{ name:"a.bin", blob:new Blob(["hello"]) }], { forceZip64:true });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let cd = -1;
  for (let i = 0; i + 4 <= bytes.length; i++) if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02) { cd = i; break; }
  assert.ok(cd >= 0);
  const nameLength = bytes[cd + 28] | (bytes[cd + 29] << 8);
  const extraLength = bytes[cd + 30] | (bytes[cd + 31] << 8);
  assert.ok(extraLength >= 28);
  const extra = cd + 46 + nameLength;
  bytes[extra + 2] = 7; bytes[extra + 3] = 0;   /* usize/csize/offset には24バイト必要 */
  await assert.rejects(Z.zipOpen(new Blob([bytes])), e => e.key === "zipBad" && e.name !== "RangeError");
});

test("streamed CRC matches the byte-array CRC and stops at the declared size", async () => {
  const source = new Blob(["hello, ", "streamed world"]);
  const result = await Z.crc32Stream(source.stream());
  assert.equal(result.size, source.size);
  assert.equal(result.crc, Z.crc32(new Uint8Array(await source.arrayBuffer())));

  let pulls = 0, cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(16)); },
    cancel() { cancelled = true; },
  }, { highWaterMark:0 });
  await assert.rejects(Z.crc32Stream(stream, 8, "zipCorrupt"), e => e.key === "zipCorrupt");
  assert.equal(pulls, 1, "the stream is stopped as soon as the first chunk exceeds the cap");
  assert.equal(cancelled, true);
});

test("write and verify never call arrayBuffer for an entry's full contents", async () => {
  const raw = new Blob(["manga audio and video data".repeat(1000)]);
  raw.arrayBuffer = async () => { throw new Error("entry arrayBuffer must not be used"); };
  const blob = await Z.zipWrite([{ name:"media.bin", blob:raw }]);
  const zip = await Z.zipOpen(blob), entry = zip.byName.get("media.bin");
  const dataStart = await Z.zipDataStart(zip, entry), source = zip.file;
  zip.file = {
    size:source.size,
    slice(start, end) {
      const part = source.slice(start, end);
      if (start >= dataStart) part.arrayBuffer = async () => { throw new Error("entry arrayBuffer must not be used"); };
      return part;
    },
  };
  assert.equal(await Z.zipVerifyEntry(zip, entry), true);
  assert.equal(await Z.zipEntryBlob(zip, entry, Infinity, true).then(b => b.size), raw.size);
});

test("verification stops a stored or deflated stream once it exceeds its declared size", async () => {
  const { zip } = await roundTrip([
    { name:"stored.bin", blob:new Blob(["s".repeat(100)]) },
    { name:"deflated.bin", blob:new Blob(["d".repeat(5000)]), deflate:true },
  ]);
  const stored = zip.byName.get("stored.bin"), deflated = zip.byName.get("deflated.bin");
  await assert.rejects(Z.zipVerifyEntry(zip, { ...stored, usize:99 }), e => e.key === "zipCorrupt");
  await assert.rejects(Z.zipVerifyEntry(zip, { ...deflated, usize:100 }), e => e.key === "zipCorrupt");
});

test("ZIP writer rejects paths and entry counts that its reader would not accept", async () => {
  for (const name of ["../escape.txt", "/absolute.txt", "C:/drive.txt", "back\\slash.txt", "a".repeat(65536)]) {
    await assert.rejects(Z.zipWrite([{ name, blob:new Blob(["x"]) }]), e => e.key === "zipBad", name.slice(0, 40));
  }
  await assert.rejects(Z.zipWrite(new Array(Z.limits.entries + 1)), e => e.key === "zipLimit");
});

test("deterministic ZIP-header fuzzing never leaks RangeError or unchecked offsets", async () => {
  const { blob } = await roundTrip([
    { name:"alpha.txt", blob:new Blob(["alpha payload"]) },
    { name:"beta.txt", blob:new Blob(["beta payload"]), deflate:true },
  ], { forceZip64:true });
  const source = new Uint8Array(await blob.arrayBuffer());
  let seed = 0x6d2b79f5;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let i = 0; i < 256; i++) {
    const bytes = source.slice(), at = random() % bytes.length, bit = 1 << (random() % 8);
    bytes[at] ^= bit;
    try {
      const zip = await Z.zipOpen(new Blob([bytes]));
      for (const entry of zip.entries) {
        for (const value of [entry.off, entry.csize, entry.usize]) assert.ok(Number.isSafeInteger(value) && value >= 0);
        const start = await Z.zipDataStart(zip, entry);
        assert.ok(Number.isSafeInteger(start) && start >= 0 && start <= zip.centralOffset - entry.csize);
      }
    } catch (error) {
      assert.ok(error && typeof error.key === "string" && error.key.startsWith("zip"), `mutation ${i} leaked ${error && error.name}: ${error && error.message}`);
    }
  }
});

/* trk163（レビュー）：Info-ZIP が標準入力からメンバーを読むZIP（`printf abc | zip - - > x.zip`）は、大きさが事前に
   分からないためローカルヘッダを ZIP64 拡張にし、32bit で足りていても ZIP64 の終端レコードとロケーターを置く。
   ロケーターが正しく指していて終端レコードの中身も EOCD と一致していれば読む（パイプで作った CBZ・パックが読めるように）。
   fixture は実 Info-ZIP 3.0 の出力（`printf abc | zip - -` と時刻欄を除きバイト一致・199バイト）。 */
const INFOZIP_STDIN_B64 = "UEsDBC0AAAAAAFGATl3CQSQ1//////////8BABQALQEAEAADAAAAAAAAAAMAAAAAAAAAYWJjUEsBAh4DLQAAAAAAUYBOXcJBJDUDAAAAAwAAAAEAAAAAAAAAAQAAAIARAAAAAC1QSwYGLAAAAAAAAAAeAy0AAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAALwAAAAAAAAA2AAAAAAAAAFBLBgcAAAAAZQAAAAAAAAABAAAAUEsFBgAAAAABAAEALwAAADYAAAAAAA==";
/* 同じ入力の deflate 版（`printf abcabc… | zip -9 - -`・203バイト）。flags bit1（最大圧縮）がローカルと中央目録で一致する例 */
const INFOZIP_STDIN_DEFLATE_B64 = "UEsDBC0AAgAIACKGTl03DyAB//////////8BABQALQEAEAAYAAAAAAAAAAcAAAAAAAAAS0xKTsSGAFBLAQIeAy0AAgAIACKGTl03DyABBwAAABgAAAABAAAAAAAAAAEAAACAEQAAAAAtUEsGBiwAAAAAAAAAHgMtAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAC8AAAAAAAAAOgAAAAAAAABQSwYHAAAAAGkAAAAAAAAAAQAAAFBLBQYAAAAAAQABAC8AAAA6AAAAAAA=";
const infoZipBytes = (b64) => Uint8Array.from(Buffer.from(b64, "base64"));

test("an optional ZIP64 end record written by Info-ZIP from stdin is accepted", async () => {
  const zip = await Z.zipOpen(new Blob([infoZipBytes(INFOZIP_STDIN_B64)]));
  assert.equal(zip.entries.length, 1);
  assert.equal(zip.entries[0].name, "-");
  assert.equal(await text(await Z.zipEntryBlob(zip, zip.entries[0], 100, true)), "abc");
  const deflated = await Z.zipOpen(new Blob([infoZipBytes(INFOZIP_STDIN_DEFLATE_B64)]));
  assert.equal(await text(await Z.zipEntryBlob(deflated, deflated.entries[0], 100, true)), "abc".repeat(8));
  /* ロケーターが嘘の位置を指すときは、従来どおり拒否する */
  const bad = infoZipBytes(INFOZIP_STDIN_B64); const eocd = bad.length - 22, loc = eocd - 20;
  new DataView(bad.buffer).setUint32(loc + 8, 1, true);
  await assert.rejects(Z.zipOpen(new Blob([bad])), e => e.key === "zipBad");
});

test("an optional ZIP64 end record that disagrees with the EOCD is refused (no dual interpretation)", async () => {
  const bytes = infoZipBytes(INFOZIP_STDIN_B64);
  const record = findSignature(bytes, 0x06064b50);
  assert.ok(record >= 0, "the Info-ZIP fixture carries an optional ZIP64 end record");
  /* 終端レコードの中身（件数・中央目録の大きさ／位置・ディスク番号）の1つでも EOCD と食い違えば zipBad。
     読む値は常に EOCD 側なので、食い違うファイルは「別の読み手には別の中央目録が見える」二重解釈になり得る＝受け取らない */
  for (const [at, value] of [[record + 32, 2n], [record + 40, 48n], [record + 48, 55n], [record + 16, 1n], [record + 24, 2n]]) {
    const bad = bytes.slice();
    new DataView(bad.buffer).setBigUint64(at, value, true);
    await assert.rejects(Z.zipOpen(new Blob([bad])), e => e.key === "zipBad", `mutation at +${at}`);
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
/* trk160: .stpack 読み書きで本文全体をArrayBufferにせず、CRCと上限を確認する。 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { ROOT } from "./helpers/browser-data.mjs";

function loadZipIO() {
  const sandbox = { window:{}, console, TextEncoder, TextDecoder, Blob, Response, Uint8Array, DataView, ArrayBuffer,
    BigInt, CompressionStream, DecompressionStream, Map, Math, Number, String, Array, Error, Promise, Uint32Array };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(`${ROOT}/js/zip-io.js`, "utf8"), sandbox);
  return sandbox.window.Trk.zipIO;
}
const Z = loadZipIO();
const customSource = fs.readFileSync(`${ROOT}/js/custom.js`, "utf8");
const start = customSource.indexOf("class PackError extends Error");
const end = customSource.indexOf("/* ============ pack.json の検証", start);
assert.ok(start >= 0 && end > start, "the .stpack ZIP helpers can be isolated");
const helperSource = customSource.slice(start, end);
function loadPackZip() {
  const sandbox = { window:{ Trk:{ zipIO:Z } }, Blob, Response, CompressionStream, DecompressionStream,
    TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer, Error, Promise, Object, Number };
  vm.createContext(sandbox);
  vm.runInContext(`${helperSource}\nglobalThis.__packZip = { readZip, inflateEntry, writeZip };`, sandbox);
  return sandbox.__packZip;
}
const P = loadPackZip();
const text = blob => blob.text();

test(".stpack readZip keeps payloads as Blob slices and streams CRC/decompression", async () => {
  const archive = await Z.zipWrite([
    { name:"pack.json", blob:new Blob([JSON.stringify({ format:"shadow-taiko-pack", name:"Sample" })]), deflate:true },
    { name:"__proto__", blob:new Blob(["ordinary data"]) },
    { name:"songs/s1/audio.mp3", blob:new Blob(["audio payload ".repeat(64)]), deflate:true },
  ]);
  archive.arrayBuffer = async () => { throw new Error("reading the complete .stpack as an ArrayBuffer is forbidden"); };

  const entries = await P.readZip(archive);
  assert.equal(Object.getPrototypeOf(entries), null, "archive names cannot mutate the file map prototype");
  assert.deepEqual(Object.keys(entries), ["pack.json", "__proto__", "songs/s1/audio.mp3"]);
  assert.equal(await text(await P.inflateEntry(entries["pack.json"], 1024, "pack.json")),
    JSON.stringify({ format:"shadow-taiko-pack", name:"Sample" }));
  assert.equal(await text(await P.inflateEntry(entries["__proto__"], 1024, "__proto__")), "ordinary data");
  assert.equal(await text(await P.inflateEntry(entries["songs/s1/audio.mp3"], 1024, "audio.mp3")), "audio payload ".repeat(64));
  await assert.rejects(P.inflateEntry(entries["songs/s1/audio.mp3"], 8, "audio.mp3"), e => e.key === "packFileTooBig");
});

test(".stpack writer does not materialize a source entry with arrayBuffer", async () => {
  const source = new Blob(["large song payload ".repeat(2048)]);
  source.arrayBuffer = async () => { throw new Error("source entry arrayBuffer must not be used"); };
  const archive = await P.writeZip([{ name:"songs/s1/audio.mp3", blob:source }]);
  const zip = await Z.zipOpen(archive);
  const entry = zip.byName.get("songs/s1/audio.mp3");
  assert.equal(entry.usize, source.size);
  assert.equal(await Z.zipVerifyEntry(zip, entry), true);
});

test(".stpack importer rejects payload CRC corruption", async () => {
  const archive = await Z.zipWrite([{ name:"assets/icon.png", blob:new Blob(["image bytes"]) }]);
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const entry = (await Z.zipOpen(archive)).byName.get("assets/icon.png");
  const start = await Z.zipDataStart(await Z.zipOpen(archive), entry);
  bytes[start + 2] ^= 0x20;
  const corrupted = await Z.zipOpen(new Blob([bytes]));
  const wrapped = { size:corrupted.size, entries:corrupted.entries, byName:corrupted.byName, file:corrupted.file };
  const files = Object.create(null);
  for (const e of wrapped.entries) files[e.name] = { method:e.method, usize:e.usize, zip:wrapped, entry:e };
  await assert.rejects(P.inflateEntry(files["assets/icon.png"], 1024, "assets/icon.png"), e => e.key === "packBadZip");
});

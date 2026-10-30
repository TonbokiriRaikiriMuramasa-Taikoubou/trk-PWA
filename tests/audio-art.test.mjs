// SPDX-License-Identifier: GPL-3.0-or-later
/* 埋め込みジャケット画像のローカル解析を合成タグで検査する（実音源・通信なし）。 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "js/audio-art.js"), "utf8");
const window = { Trk:{ media:{} } };
const context = vm.createContext({ window, Blob, TextDecoder, Uint8Array, atob, document:undefined });
vm.runInContext(source, context, { filename:"js/audio-art.js" });
const audioArt = window.Trk.media.audioArt;

function concat(...parts) {
  const arrays = parts.map(x => x instanceof Uint8Array ? x : Uint8Array.from(x));
  const out = new Uint8Array(arrays.reduce((n, x) => n + x.length, 0)); let p = 0;
  for (const item of arrays) { out.set(item, p); p += item.length; }
  return out;
}
function be24(n) { return Uint8Array.of((n >>> 16) & 255, (n >>> 8) & 255, n & 255); }
function be32(n) { return Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255); }
function le32(n) { return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }
function text(s) { return new TextEncoder().encode(s); }
function synchsafe(n) { return Uint8Array.of((n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127); }
function png(width = 1, height = 1) {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  out.set(be32(13), 8); out.set(text("IHDR"), 12); out.set(be32(width), 16); out.set(be32(height), 20);
  return out;
}
function atom(type, payload) { return concat(be32(payload.length + 8), text(type), payload); }
function flacPicture(image, mime = "image/png") {
  const description = text("cover");
  return concat(be32(3), be32(text(mime).length), text(mime), be32(description.length), description,
    be32(1), be32(1), be32(24), be32(0), be32(image.length), image);
}
function id3File(image, { version = 3, mime = "image/png" } = {}) {
  const description = text("front");
  const picture = concat(Uint8Array.of(3), text(mime), Uint8Array.of(0, 3), description, Uint8Array.of(0), image);
  const frame = concat(text("APIC"), be32(picture.length), Uint8Array.of(0, 0), picture);
  return new File([concat(text("ID3"), Uint8Array.of(version, 0, 0), synchsafe(frame.length), frame)], "cover.mp3");
}
function makeCommentPacket(image, signature = "vorbis") {
  const isVorbis = signature === "vorbis";
  const comment = `METADATA_BLOCK_PICTURE=${Buffer.from(flacPicture(image)).toString("base64")}`;
  const body = concat(le32(3), text("trk"), le32(1), le32(text(comment).length), text(comment));
  return isVorbis ? concat(Uint8Array.of(3), text("vorbis"), body) : concat(text("OpusTags"), body);
}
function oggFile(packet, name = "cover.ogg") {
  const laces = [];
  let remaining = packet.length;
  while (remaining >= 255) { laces.push(255); remaining -= 255; }
  laces.push(remaining);
  const header = new Uint8Array(27);
  header.set(text("OggS"), 0); header[4] = 0; header[5] = 2;
  header.set(le32(1234), 14); header.set(le32(0), 18); header[26] = laces.length;
  return new File([concat(header, Uint8Array.from(laces), packet)], name);
}

test("MP3: ID3v2 APICから前面ジャケットを読み取る", async () => {
  const blob = await audioArt.extract(id3File(png()));
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, "image/png");
  assert.equal(blob.size, 24);
  const thumb = await audioArt.thumbnail(blob); // Nodeではデコーダーがないので、制限確認後に画像Blobを返す
  assert.equal(thumb.type, "image/png");
});

test("MP4/M4A: moov/udta/meta/ilst/covr/dataを読み取る", async () => {
  const image = png();
  const data = atom("data", concat(be32(14), be32(0), image));
  const covr = atom("covr", data);
  const ilst = atom("ilst", covr);
  const meta = atom("meta", concat(Uint8Array.of(0, 0, 0, 0), ilst));
  const moov = atom("moov", atom("udta", meta));
  for (const name of ["cover.m4a", "cover.mp4"]) {
    const blob = await audioArt.extract(new File([moov], name));
    assert.ok(blob instanceof Blob, `${name} artwork should be extracted`);
    assert.equal(blob.type, "image/png");
  }
});

test("FLAC: PICTUREメタデータブロックを読み取る", async () => {
  const picture = flacPicture(png());
  const block = concat(Uint8Array.of(0x86), be24(picture.length), picture); // 最終ブロック・PICTURE
  const blob = await audioArt.extract(new File([concat(text("fLaC"), block)], "cover.flac"));
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, "image/png");
});

test("Ogg VorbisとOpus: METADATA_BLOCK_PICTUREコメントを読み取る", async () => {
  for (const [signature, name] of [["vorbis", "cover.ogg"], ["opus", "cover.opus"]]) {
    const packet = makeCommentPacket(png(), signature);
    const blob = await audioArt.extract(oggFile(packet, name));
    assert.ok(blob instanceof Blob, `${name} artwork should be extracted`);
    assert.equal(blob.type, "image/png");
  }
});

test("未対応形式・SVG・壊れたタグは画像として返さない", async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal(await audioArt.extract(id3File(svg, { mime:"image/svg+xml" })), null);
  assert.equal(await audioArt.extract(new File([png()], "cover.wav")), null);
  assert.equal(await audioArt.extract(new File([text("not audio")], "cover.mp3")), null);
});

test("大きすぎる画像と異常寸法の画像はサムネイルにしない", async () => {
  const huge = new Blob([new Uint8Array(6 * 1024 * 1024 + 1)], { type:"image/png" });
  assert.equal(await audioArt.thumbnail(huge), null);
  assert.equal(await audioArt.thumbnail(new Blob([png(9000, 1)], { type:"image/png" })), null);
  assert.equal(await audioArt.thumbnail(new Blob([png(4000, 4000)], { type:"image/png" })), null);
});

test("画像抽出はローカル読み取りだけで、通信・IndexedDB・書き込みを追加しない", () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bindexedDB\b|createWritable|\.remove\s*\(/);
  assert.match(source, /file\.slice\(start, end\)/);
});

// SPDX-License-Identifier: GPL-3.0-or-later
/* ローカル音源に埋め込まれたジャケット画像・歌詞・テキストタグ・チャプターを読む（通信・保存なし）。
   画像: ID3 APIC/PIC、MP4/M4A covr、FLAC picture、Ogg Vorbis/Opus picture comments。
   歌詞（trk166・読み取りだけ）: ID3 USLT/ULT・SYLT/SLT、MP4 ©lyr、FLAC/Ogg の LYRICS/UNSYNCEDLYRICS。
   タグ（trk167・読み取りだけ）: ID3 TIT2/TPE1/TALB/TPE2/TRCK/TCON、MP4 ©nam/©ART/©alb/aART/trkn/©gen、
     FLAC/Ogg の TITLE/ARTIST/ALBUM/ALBUMARTIST/TRACKNUMBER/TRACKTOTAL/GENRE。編集（書き戻し）はしない。
   チャプター（trk170・読み取りだけ）: MP4 系の chpl（Nero 形式＝M4B の定番）。iTunes 方式のチャプタートラックは対象外。
   読み出すメタデータと画像サイズを制限し、サムネイルだけをメモリ上で作る。 */
(() => {
"use strict";
const MAX_TAG_BYTES = 16 * 1024 * 1024;
const MAX_ART_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_EDGE = 8192;
const MAX_IMAGE_PIXELS = 12_000_000;
const THUMB_EDGE = 256;
const MAX_LYRICS_BYTES = 256 * 1024;   /* 🎤 埋め込み歌詞の上限（表示用のテキストとしては十分すぎる大きさ） */
const MAX_SYLT_LINES = 5000;           /* 🎤 SYLT の時刻付き行の上限 */
const MAX_TAG_TEXT = 200;              /* 🏷 テキストタグ1項目の上限（表示用。trk167） */
/* 🏷 埋め込みテキストタグ（trk167・表示だけ。編集はしない＝読み取り専用方針）の対応表 */
const ID3_TAG_FRAMES = { TIT2:"title", TT2:"title", TPE1:"artist", TP1:"artist", TALB:"album", TAL:"album",
  TPE2:"albumArtist", TP2:"albumArtist", TRCK:"track", TRK:"track", TCON:"genre", TCO:"genre" };
const MP4_TAG_BOXES = { "\xA9nam":"title", "\xA9ART":"artist", "\xA9alb":"album", "aART":"albumArtist", "trkn":"track", "\xA9gen":"genre" };
const VORBIS_TAG_KEYS = { TITLE:"title", ARTIST:"artist", ALBUM:"album", ALBUMARTIST:"albumArtist",
  TRACKNUMBER:"track", TRACKTOTAL:"trackTotal", GENRE:"genre" };
const textDecoder = typeof TextDecoder === "function" ? new TextDecoder("utf-8") : null;

function ascii(bytes, start, length) {
  let out = "";
  for (let i = 0; i < length && start + i < bytes.length; i++) out += String.fromCharCode(bytes[start + i]);
  return out;
}
function u24be(b, p) { return ((b[p] << 16) | (b[p + 1] << 8) | b[p + 2]) >>> 0; }
function u32be(b, p) { return ((b[p] * 0x1000000) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]) >>> 0; }
function u32le(b, p) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; }
function u64be(b, p) {
  const hi = u32be(b, p), lo = u32be(b, p + 4);
  const value = hi * 0x100000000 + lo;
  return Number.isSafeInteger(value) ? value : Infinity;
}
function syncsafe(b, p) {
  if (b[p] & 0x80 || b[p + 1] & 0x80 || b[p + 2] & 0x80 || b[p + 3] & 0x80) return -1;
  return (b[p] << 21) | (b[p + 1] << 14) | (b[p + 2] << 7) | b[p + 3];
}
async function readRange(file, start, end, cap = MAX_TAG_BYTES) {
  if (!file || typeof file.slice !== "function" || !Number.isFinite(file.size)) return null;
  start = Math.max(0, Math.floor(start)); end = Math.min(file.size, Math.floor(end));
  if (end <= start || end - start > cap) return null;
  try {
    const part = file.slice(start, end);
    if (!part || part.size > cap) return null;
    const data = new Uint8Array(await part.arrayBuffer());
    return data.length <= cap ? data : null;
  } catch (_) { return null; }
}
function imageMime(data) {
  if (!data || data.length < 12) return "";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 24 && data[0] === 0x89 && ascii(data, 1, 3) === "PNG" && ascii(data, 12, 4) === "IHDR") return "image/png";
  if (ascii(data, 0, 4) === "RIFF" && ascii(data, 8, 4) === "WEBP") return "image/webp";
  return "";
}
function candidate(data) {
  if (!(data instanceof Uint8Array) || data.length < 12 || data.length > MAX_ART_BYTES) return null;
  const type = imageMime(data);
  if (!type) return null;                    // reject SVG, HTML and unknown payloads regardless of tag MIME
  try { return new Blob([data.slice()], { type }); } catch (_) { return null; }
}
function findTextEnd(data, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < data.length; i += 2) if (data[i] === 0 && data[i + 1] === 0) return i + 2;
    return -1;
  }
  for (let i = start; i < data.length; i++) if (data[i] === 0) return i + 1;
  return -1;
}
function parsePictureFrame(data, version) {
  if (!data.length) return null;
  const encoding = data[0];
  let p = 1, mime = "";
  if (version === 2) {
    if (p + 4 > data.length) return null;
    const format = ascii(data, p, 3).toUpperCase(); p += 3;
    mime = format === "JPG" || format === "JPEG" ? "image/jpeg" : format === "PNG" ? "image/png" : "";
  } else {
    let end = p;
    while (end < data.length && data[end] !== 0) end++;
    if (end >= data.length || end + 1 >= data.length) return null;
    mime = ascii(data, p, end - p).toLowerCase(); p = end + 1;
  }
  const pictureType = data[p++];
  const imageStart = findTextEnd(data, p, encoding);
  if (imageStart < 0 || imageStart >= data.length) return null;
  return { blob:candidate(data.subarray(imageStart)), pictureType };
}
function removeUnsynchronisation(data) {
  const out = new Uint8Array(data.length); let n = 0;
  for (let i = 0; i < data.length; i++) {
    out[n++] = data[i];
    if (data[i] === 0xff && data[i + 1] === 0 && (i + 2 >= data.length || data[i + 2] === 0 || data[i + 2] >= 0xe0)) i++;
  }
  return out.subarray(0, n);
}
/* 🎤 歌詞（trk166）：ID3 のテキスト符号化（0=Latin-1、1=UTF-16+BOM、2=UTF-16BE、3=UTF-8）で復号する。
   歌詞は表示専用のテキストなので、復号に失敗したら空文字（= 歌詞なし）として扱う。 */
function decodeID3Text(bytes, encoding) {
  if (!bytes || !bytes.length || typeof TextDecoder !== "function") return "";
  let label = "utf-8", data = bytes;
  try {
    if (encoding === 0) label = "iso-8859-1";
    else if (encoding === 1 || encoding === 2) {
      let be = encoding === 2;
      if (data.length >= 2) {
        if (data[0] === 0xff && data[1] === 0xfe) { be = false; data = data.subarray(2); }
        else if (data[0] === 0xfe && data[1] === 0xff) { be = true; data = data.subarray(2); }
      }
      label = be ? "utf-16be" : "utf-16le";
    }
    return new TextDecoder(label).decode(data).replace(/\0+$/g, "");
  } catch (_) { return ""; }
}
function parseLyricsTextFrame(data) {   /* USLT / ULT：encoding(1)+言語(3)+説明(ヌル終端)+歌詞本文 */
  if (!data || data.length < 6) return null;
  const encoding = data[0];
  const descEnd = findTextEnd(data, 4, encoding);
  if (descEnd < 0 || descEnd >= data.length) return null;   /* 説明の終端がない／本文が空 → 歌詞なし */
  const text = decodeID3Text(data.subarray(descEnd, data.length), encoding);
  return text && text.trim() ? text.slice(0, MAX_LYRICS_BYTES) : null;
}
function parseSyltFrame(data) {         /* SYLT / SLT：説明のあと「テキスト(ヌル終端)+時刻(4バイト)」の繰り返し */
  if (!data || data.length < 8) return null;
  const encoding = data[0], format = data[4];
  if (format !== 2) return null;        /* 時刻はミリ秒（形式2）だけ。MIDIフレーム形式はテンポ情報がないと秒に直せない */
  let p = findTextEnd(data, 6, encoding);   /* 内容タイプ(1)+説明を飛ばす */
  if (p < 0) return null;
  const termLen = encoding === 1 || encoding === 2 ? 2 : 1;
  const lines = [];
  while (p + 4 <= data.length && lines.length < MAX_SYLT_LINES) {
    const textEnd = findTextEnd(data, p, encoding);
    if (textEnd < termLen || textEnd + 4 > data.length) break;
    const text = decodeID3Text(data.subarray(p, textEnd - termLen), encoding);
    lines.push({ t: u32be(data, textEnd) / 1000, text });
    p = textEnd + 4;
  }
  if (!lines.length) return null;
  lines.sort((a, b) => a.t - b.t);            /* SYLT の時刻は並び順が保証されないので整列する */
  return { lines };
}
/* 🔊 ReplayGain の値（"-6.53 dB" 等）→ dB の数。±24dB を超えたら壊れた値として無視（trk168） */
function parseRgDb(v) {
  const m = /^\s*([+-]?\d{1,3}(?:[.,]\d{1,3})?)\s*(?:dB\s*)?$/i.exec(String(v == null ? "" : v));
  if (!m) return null;
  const db = Number(m[1].replace(",", "."));
  return Number.isFinite(db) && db >= -24 && db <= 24 ? db : null;
}
/* 🏷 生タグ → 表示用の形にそろえる（trk167）。空白だけ・空の項目は落とし、トラック番号は "3/12" を分解する。
   全部空なら null（＝タグなし＝表示はファイル名のまま）。🔊 rgTrackGain（trk168）は数だけ通す。 */
function normalizeTags(t) {
  if (!t) return null;
  const out = {};
  for (const k of ["title", "artist", "album", "albumArtist", "genre"]) {
    const v = String(t[k] == null ? "" : t[k]).trim();
    if (v) out[k] = v.slice(0, MAX_TAG_TEXT);
  }
  const trk = String(t.track == null ? "" : t.track).trim();
  const m = /^(\d{1,4})(?:\s*\/\s*(\d{1,4}))?$/.exec(trk);
  const total = m && m[2] ? Number(m[2]) : Number(String(t.trackTotal == null ? "" : t.trackTotal).trim());
  if (m) out.track = Number(m[1]);
  if (Number.isFinite(total) && total > 0 && total <= 9999) out.trackTotal = total;
  if (Number.isFinite(t.rgTrackGain)) out.rgTrackGain = Math.min(24, Math.max(-24, t.rgTrackGain));
  return Object.keys(out).length ? out : null;
}
/* mode: "art"（ジャケット・従来どおり）／ "lyrics"（🎤 USLT/ULT・SYLT/SLT。trk166） */
async function extractID3(file, mode = "art") {
  const header = await readRange(file, 0, 10, 10);
  if (!header || ascii(header, 0, 3) !== "ID3") return null;
  const version = header[3], flags = header[5];
  if (version < 2 || version > 4 || (version === 2 && (flags & 0x40))) return null; // compressed v2.2 tag
  const tagSize = syncsafe(header, 6);
  if (tagSize < 0 || tagSize > MAX_TAG_BYTES || tagSize + 10 > file.size) return null;
  let tag = await readRange(file, 10, 10 + tagSize, MAX_TAG_BYTES);
  if (!tag) return null;
  if (flags & 0x80) tag = removeUnsynchronisation(tag);
  let p = 0;
  if (flags & 0x40) {                     // extended header
    if (tag.length < 4) return null;
    const extSize = version === 4 ? syncsafe(tag, 0) : u32be(tag, 0);
    if (extSize < 4 || extSize > tag.length) return null;
    p = version === 4 ? extSize : 4 + extSize;
  }
  let first = null, uslt = null, sylt = null;
  const tags = {};                      /* 🏷 テキストタグ（trk167） */
  const frameHeader = version === 2 ? 6 : 10;
  while (p + frameHeader <= tag.length) {
    const idLength = version === 2 ? 3 : 4;
    const id = ascii(tag, p, idLength);
    if (!id || /^\x00+$/.test(id)) break;
    const size = version === 2 ? u24be(tag, p + 3)
      : version === 4 ? syncsafe(tag, p + 4) : u32be(tag, p + 4);
    if (!Number.isFinite(size) || size <= 0 || size > tag.length - p - frameHeader) break;
    let flags2 = 0;
    if (version !== 2) flags2 = tag[p + 9];
    const bodyStart = p + frameHeader, bodyEnd = bodyStart + size;
    const unsupportedFlags = version === 3 ? (flags2 & 0xe0) : version === 4 ? (flags2 & 0x4f) : 0;
    if (mode === "lyrics") {
      if ((id === "SYLT" || id === "SLT") && !unsupportedFlags && !sylt) sylt = parseSyltFrame(tag.subarray(bodyStart, bodyEnd));
      else if ((id === "USLT" || id === "ULT") && !unsupportedFlags && !uslt) uslt = parseLyricsTextFrame(tag.subarray(bodyStart, bodyEnd));
    } else if (mode === "tags") {
      if ((id === "TXXX" || id === "TXX") && !unsupportedFlags && !Number.isFinite(tags.rgTrackGain)) {
        /* 🔊 ReplayGain タグ（trk168）：TXXX の説明が REPLAYGAIN_TRACK_GAIN のものだけ読む（読み取り専用） */
        const body = tag.subarray(bodyStart, bodyEnd);
        const enc = body[0], descEnd = findTextEnd(body, 1, enc);
        if (descEnd > 0) {
          const desc = decodeID3Text(body.subarray(1, descEnd), enc).replace(/\0+$/g, "").trim().toUpperCase();
          if (desc === "REPLAYGAIN_TRACK_GAIN") {
            const g = parseRgDb(decodeID3Text(body.subarray(descEnd), enc));
            if (g != null) tags.rgTrackGain = g;
          }
        }
      } else {
        const field = ID3_TAG_FRAMES[id];   /* 🏷 TIT2/TPE1/TALB/TPE2/TRCK/TCON（v2.2 の TT2 等も） */
        if (field && !tags[field] && !unsupportedFlags) {
          const body = tag.subarray(bodyStart, bodyEnd);
          if (body.length >= 2) {           /* encoding(1) + テキスト */
            const text = decodeID3Text(body.subarray(1), body[0]).trim();
            if (text) tags[field] = text.slice(0, MAX_TAG_TEXT);
          }
        }
      }
    } else if ((id === "APIC" || id === "PIC") && !unsupportedFlags) {
      const found = parsePictureFrame(tag.subarray(bodyStart, bodyEnd), version);
      if (found && found.blob) {
        if (found.pictureType === 3) return found.blob; // front cover wins
        if (!first) first = found.blob;
      }
    }
    p = bodyEnd;
  }
  if (mode === "lyrics") return sylt || (uslt ? { text: uslt } : null);   /* 🎤 同期歌詞（SYLT）があれば優先 */
  if (mode === "tags") return normalizeTags(tags);                        /* 🏷 全部空なら null */
  return first;
}
function parseFlacPicture(data, start = 0, end = data.length) {
  let p = start;
  if (end - p < 32) return null;
  p += 4; // picture type
  const mimeLen = u32be(data, p); p += 4;
  if (mimeLen > 1024 || p + mimeLen + 4 > end) return null;
  p += mimeLen;
  const descLen = u32be(data, p); p += 4;
  if (descLen > 65536 || p + descLen + 20 > end) return null;
  p += descLen + 16;                   // width, height, depth, colors
  const imageLen = u32be(data, p); p += 4;
  if (!imageLen || imageLen > MAX_ART_BYTES || p + imageLen > end) return null;
  return candidate(data.subarray(p, p + imageLen));
}
async function extractFlac(file, mode = "art") {
  const signature = await readRange(file, 0, 4, 4);
  if (!signature || ascii(signature, 0, 4) !== "fLaC") return null;
  let p = 4;
  for (let n = 0; n < 4096 && p + 4 <= file.size && p < MAX_TAG_BYTES; n++) {
    const header = await readRange(file, p, p + 4, 4);
    if (!header) return null;
    const h = header[0], type = h & 0x7f, size = u24be(header, 1), start = p + 4, end = start + size;
    if (end > file.size || end > MAX_TAG_BYTES) return null;
    if (type === 6 && mode !== "lyrics") {
      const block = await readRange(file, start, end, MAX_ART_BYTES + 128 * 1024);
      if (!block) return null;
      const blob = parseFlacPicture(block); if (blob) return blob;
    } else if (type === 4 && (mode === "lyrics" || mode === "tags")) {   /* 🎤🏷 VORBIS_COMMENT ブロック（歌詞とテキストタグ） */
      const block = await readRange(file, start, end, MAX_TAG_BYTES);
      if (!block) return null;
      const found = mode === "lyrics" ? parseVorbisLyrics(block, 0) : parseVorbisTags(block, 0);
      if (found) return found;
    }
    p = end;
    if (h & 0x80) break;
  }
  return null;
}
function decodeBase64(value) {
  const clean = String(value || "").replace(/[\t\n\r ]/g, "");
  if (!clean || clean.length > Math.ceil(MAX_ART_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return null;
  try {
    const raw = atob(clean), out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out.length <= MAX_ART_BYTES ? out : null;
  } catch (_) { return null; }
}
function parseVorbisComments(packet, start) {
  let p = start;
  if (!textDecoder || p + 8 > packet.length) return null;
  const vendorLength = u32le(packet, p); p += 4;
  if (vendorLength > packet.length - p - 4) return null;
  p += vendorLength;
  const count = u32le(packet, p); p += 4;
  if (count > 100_000) return null;
  let picture = null, coverArt = null, coverMime = "";
  for (let i = 0; i < count && p + 4 <= packet.length; i++) {
    const length = u32le(packet, p); p += 4;
    if (!length || length > packet.length - p) return null;
    const text = textDecoder.decode(packet.subarray(p, p + length)); p += length;
    const equal = text.indexOf("="); if (equal <= 0) continue;
    const key = text.slice(0, equal).toUpperCase(), value = text.slice(equal + 1);
    if (key === "METADATA_BLOCK_PICTURE" && !picture) {
      const raw = decodeBase64(value); if (raw) picture = parseFlacPicture(raw);
    } else if (key === "COVERART" && !coverArt) coverArt = decodeBase64(value);
    else if (key === "COVERARTMIME") coverMime = value.slice(0, 100);
  }
  return picture || (coverArt && candidate(coverArt)) || null;
}
function parseCommentPacket(packet) {
  if (packet.length >= 7 && packet[0] === 3 && ascii(packet, 1, 6) === "vorbis") return parseVorbisComments(packet, 7);
  if (packet.length >= 8 && ascii(packet, 0, 8) === "OpusTags") return parseVorbisComments(packet, 8);
  return null;
}
/* 🎤 Vorbis コメントから LYRICS / UNSYNCEDLYRICS を探す（trk166）。FLAC のブロックにも同じ形が使われる */
function parseVorbisLyrics(packet, start) {
  let p = start;
  if (!textDecoder || p + 8 > packet.length) return null;
  const vendorLength = u32le(packet, p); p += 4;
  if (vendorLength > packet.length - p - 4) return null;
  p += vendorLength;
  const count = u32le(packet, p); p += 4;
  if (count > 100_000) return null;
  for (let i = 0; i < count && p + 4 <= packet.length; i++) {
    const length = u32le(packet, p); p += 4;
    if (!length || length > packet.length - p) return null;
    if (length <= MAX_LYRICS_BYTES) {
      const text = textDecoder.decode(packet.subarray(p, p + length));
      const equal = text.indexOf("=");
      if (equal > 0) {
        const key = text.slice(0, equal).toUpperCase(), value = text.slice(equal + 1);
        if ((key === "LYRICS" || key === "UNSYNCEDLYRICS") && value && value.trim()) return { text: value };
      }
    }
    p += length;
  }
  return null;
}
function parseCommentLyricsPacket(packet) {
  if (packet.length >= 7 && packet[0] === 3 && ascii(packet, 1, 6) === "vorbis") return parseVorbisLyrics(packet, 7);
  if (packet.length >= 8 && ascii(packet, 0, 8) === "OpusTags") return parseVorbisLyrics(packet, 8);
  return null;
}
/* 🏷 Vorbis コメントからテキストタグを拾う（trk167）。FLAC の VORBIS_COMMENT ブロックも同じ形 */
function parseVorbisTags(packet, start) {
  let p = start;
  if (!textDecoder || p + 8 > packet.length) return null;
  const vendorLength = u32le(packet, p); p += 4;
  if (vendorLength > packet.length - p - 4) return null;
  p += vendorLength;
  const count = u32le(packet, p); p += 4;
  if (count > 100_000) return null;
  const out = {};
  for (let i = 0; i < count && p + 4 <= packet.length; i++) {
    const length = u32le(packet, p); p += 4;
    if (!length || length > packet.length - p) return null;
    if (length <= MAX_TAG_BYTES) {
      const text = textDecoder.decode(packet.subarray(p, p + length));
      const equal = text.indexOf("=");
      if (equal > 0) {
        const key = text.slice(0, equal).toUpperCase();
        const field = VORBIS_TAG_KEYS[key];
        if (field && !out[field]) {
          const value = text.slice(equal + 1).trim();
          if (value) out[field] = value.slice(0, MAX_TAG_TEXT);
        } else if (key === "REPLAYGAIN_TRACK_GAIN" && !Number.isFinite(out.rgTrackGain)) {   /* 🔊 trk168（読み取りだけ） */
          const g = parseRgDb(text.slice(equal + 1));
          if (g != null) out.rgTrackGain = g;
        }
      }
    }
    p += length;
  }
  return normalizeTags(out);
}
function parseCommentTagsPacket(packet) {
  if (packet.length >= 7 && packet[0] === 3 && ascii(packet, 1, 6) === "vorbis") return parseVorbisTags(packet, 7);
  if (packet.length >= 8 && ascii(packet, 0, 8) === "OpusTags") return parseVorbisTags(packet, 8);
  return null;
}
function joinChunks(chunks, length) {
  const out = new Uint8Array(length); let p = 0;
  for (const chunk of chunks) { out.set(chunk, p); p += chunk.length; }
  return out;
}
/* parse = コメントパケットから欲しいものを取り出す関数（既定はジャケット。🎤 歌詞は parseCommentLyricsPacket を渡す） */
async function extractOgg(file, parse = parseCommentPacket) {
  let p = 0, serial = null, packetChunks = [], packetLength = 0, packetTooLarge = false;
  for (let pages = 0; pages < 4096 && p + 27 <= file.size && p < MAX_TAG_BYTES; pages++) {
    const header = await readRange(file, p, p + 27, 27);
    if (!header || ascii(header, 0, 4) !== "OggS" || header[4] !== 0) break;
    const pageSerial = u32le(header, 14), segments = header[26];
    if (serial === null) serial = pageSerial;
    const laceStart = p + 27, laces = segments ? await readRange(file, laceStart, laceStart + segments, 255) : new Uint8Array(0);
    if (!laces || laces.length !== segments) break;
    let bodyStart = laceStart + segments, bodySize = 0;
    for (let i = 0; i < segments; i++) bodySize += laces[i];
    const pageEnd = bodyStart + bodySize;
    if (pageEnd > file.size || pageEnd > MAX_TAG_BYTES) break;
    if (pageSerial === serial) {
      const body = bodySize ? await readRange(file, bodyStart, pageEnd, MAX_TAG_BYTES) : new Uint8Array(0);
      if (!body) break;
      let bodyOffset = 0;
      for (let i = 0; i < segments; i++) {
        const length = laces[i], end = bodyOffset + length;
        if (!packetTooLarge) {
          if (packetLength + length <= MAX_TAG_BYTES) { packetChunks.push(body.subarray(bodyOffset, end)); packetLength += length; }
          else { packetTooLarge = true; packetChunks = []; packetLength = 0; }
        }
        bodyOffset = end;
        if (length < 255) {
          if (!packetTooLarge && packetLength) {
            const found = parse(joinChunks(packetChunks, packetLength));
            if (found) return found;
          }
          packetChunks = []; packetLength = 0; packetTooLarge = false;
        }
      }
    }
    p = pageEnd;
  }
  return null;
}
const MP4_CONTAINERS = new Set(["moov", "udta", "meta", "ilst", "trak", "mdia", "minf", "stbl", "edts", "dinf", "mvex"]);
function findMp4Cover(data, start = 0, end = data.length, depth = 0, inCovr = false) {
  if (depth > 10) return null;
  let p = start, count = 0;
  while (p + 8 <= end && count++ < 8192) {
    const size32 = u32be(data, p), type = ascii(data, p + 4, 4);
    let size = size32, header = 8;
    if (size32 === 1) { if (p + 16 > end) break; size = u64be(data, p + 8); header = 16; }
    else if (size32 === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) break;
    const payload = p + header, atomEnd = p + size;
    if (type === "data" && inCovr && atomEnd - payload >= 8) {
      const kind = u32be(data, payload);
      if (kind === 13 || kind === 14 || kind === 0) {
        const blob = candidate(data.subarray(payload + 8, atomEnd));
        if (blob) return blob;
      }
    } else if (type === "covr") {
      const blob = findMp4Cover(data, payload, atomEnd, depth + 1, true); if (blob) return blob;
    } else if (MP4_CONTAINERS.has(type)) {
      const childStart = type === "meta" ? payload + 4 : payload; // full-box version/flags
      if (childStart <= atomEnd) { const blob = findMp4Cover(data, childStart, atomEnd, depth + 1, inCovr); if (blob) return blob; }
    }
    p = atomEnd;
    if (size32 === 0) break;
  }
  return null;
}
/* 🎤 MP4/M4A の ©lyr ボックス（UTF-8 テキスト）を探す（trk166）。covr と同じ入れ子（moov→udta→meta→ilst）を歩く */
function findMp4Lyrics(data, start = 0, end = data.length, depth = 0, inLyrics = false) {
  if (depth > 10 || !textDecoder) return null;
  let p = start, count = 0;
  while (p + 8 <= end && count++ < 8192) {
    const size32 = u32be(data, p), type = ascii(data, p + 4, 4);
    let size = size32, header = 8;
    if (size32 === 1) { if (p + 16 > end) break; size = u64be(data, p + 8); header = 16; }
    else if (size32 === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) break;
    const payload = p + header, atomEnd = p + size;
    if (type === "data" && inLyrics && atomEnd - payload >= 8) {
      const kind = u32be(data, payload);
      if (kind === 1 || kind === 0) {           /* 1 = UTF-8 テキスト。0（暗黙）も UTF-8 として読む */
        const text = textDecoder.decode(data.subarray(payload + 8, atomEnd)).replace(/\0+$/g, "");
        if (text.trim()) return { text: text.slice(0, MAX_LYRICS_BYTES) };
      }
    } else if (type === "\xA9lyr") {
      const found = findMp4Lyrics(data, payload, atomEnd, depth + 1, true); if (found) return found;
    } else if (MP4_CONTAINERS.has(type)) {
      const childStart = type === "meta" ? payload + 4 : payload; // full-box version/flags
      if (childStart <= atomEnd) { const found = findMp4Lyrics(data, childStart, atomEnd, depth + 1, inLyrics); if (found) return found; }
    }
    p = atomEnd;
    if (size32 === 0) break;
  }
  return null;
}
/* 🔊 MP4 freeform ボックス（"----" の中に mean/name/data）から REPLAYGAIN_TRACK_GAIN を読む（trk168・読み取りだけ）。
   mean（ふつう com.apple.iTunes）と name を確かめてから、data のテキストを dB の数にする */
function parseMp4FreeformRg(data, start, end) {
  if (!textDecoder) return null;
  let mean = "", name = "", value = null, p = start, count = 0;
  while (p + 8 <= end && count++ < 16) {
    const size = u32be(data, p), type = ascii(data, p + 4, 4);
    if (!Number.isSafeInteger(size) || size < 8 || p + size > end) break;
    const payload = p + 8, atomEnd = p + size;
    if ((type === "mean" || type === "name") && atomEnd - payload >= 4) {
      const s = textDecoder.decode(data.subarray(payload + 4, atomEnd)).replace(/\0+$/g, "").trim().toUpperCase();
      if (type === "mean") mean = s; else name = s;
    } else if (type === "data" && atomEnd - payload >= 8) {
      value = textDecoder.decode(data.subarray(payload + 8, atomEnd)).replace(/\0+$/g, "").trim();
    }
    p = atomEnd;
  }
  if (value == null || name !== "REPLAYGAIN_TRACK_GAIN") return null;
  if (mean && mean !== "COM.APPLE.ITUNES") return null;
  return parseRgDb(value);
}
/* 🏷 MP4/M4A のテキストタグ（©nam/©ART/©alb/aART/trkn/©gen）を ilst から拾う（trk167）。
   trkn だけはバイナリ（8バイト：予約2・トラック2・総数2・予約2）なので、そこで "3/12" 形に直す */
function findMp4Tags(data, start = 0, end = data.length, depth = 0, field = "") {
  if (depth > 10) return null;
  const out = {};
  let p = start, count = 0;
  while (p + 8 <= end && count++ < 8192) {
    const size32 = u32be(data, p), type = ascii(data, p + 4, 4);
    let size = size32, header = 8;
    if (size32 === 1) { if (p + 16 > end) break; size = u64be(data, p + 8); header = 16; }
    else if (size32 === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) break;
    const payload = p + header, atomEnd = p + size;
    if (type === "data" && field && atomEnd - payload >= 8) {
      const kind = u32be(data, payload);
      if (field === "track") {
        if (kind === 0 && atomEnd - payload >= 14) {
          const n = (data[payload + 10] << 8) | data[payload + 11], total = (data[payload + 12] << 8) | data[payload + 13];
          if (n > 0) out.track = total > 0 ? `${n}/${total}` : `${n}`;
        }
      } else if ((kind === 1 || kind === 0) && textDecoder) {
        const text = textDecoder.decode(data.subarray(payload + 8, atomEnd)).replace(/\0+$/g, "").trim();
        if (text) out[field] = text.slice(0, MAX_TAG_TEXT);
      }
    } else if (type === "----") {
      /* 🔊 freeform ボックス（----:com.apple.iTunes:REPLAYGAIN_TRACK_GAIN）→ 音量の平準化に使う（trk168） */
      if (!Number.isFinite(out.rgTrackGain)) {
        const g = parseMp4FreeformRg(data, payload, atomEnd);
        if (g != null) out.rgTrackGain = g;
      }
    } else if (MP4_TAG_BOXES[type]) {
      const found = findMp4Tags(data, payload, atomEnd, depth + 1, MP4_TAG_BOXES[type]);
      if (found) Object.assign(out, found);
    } else if (MP4_CONTAINERS.has(type)) {
      const childStart = type === "meta" ? payload + 4 : payload; // full-box version/flags
      if (childStart <= atomEnd) { const found = findMp4Tags(data, childStart, atomEnd, depth + 1, field); if (found) Object.assign(out, found); }
    }
    p = atomEnd;
    if (size32 === 0) break;
  }
  return out;
}
/* 🔖 M4B チャプター（trk170）：Nero 形式の chpl ボックス（ふつう moov→udta→chpl）。
   形は FFmpeg の mov_read_chpl に合わせた：version(1)+flags(3)、version が 0 以外なら予約の 4 バイト、
   個数(1)、項目＝[時刻(8バイト big-endian・100ナノ秒単位) + 名前の長さ(1バイト) + UTF-8 の名前]。
   読み取りだけ。iTunes 方式のチャプタートラック（サンプルテーブルの解析が要る）は対象外。 */
const MAX_CHAPTERS = 255;              /* 個数が 1 バイトなので、構造的な上限も 255 */
function parseChplBox(data, payload, end) {
  if (!textDecoder || end - payload < 6) return null;
  let p = payload;
  const version = data[p]; p += 4;                 /* version(1) + flags(3) */
  if (version) p += 4;                             /* version!=0 のときの追加 4 バイト（FFmpeg で予約扱い） */
  if (p >= end) return null;
  const count = data[p]; p += 1;
  if (!count || p >= end) return null;
  const out = [];
  for (let i = 0; i < count && i < MAX_CHAPTERS && p + 9 <= end; i++) {
    const ts = u64be(data, p); p += 8;
    const len = data[p]; p += 1;
    if (p + len > end) break;
    const text = len ? textDecoder.decode(data.subarray(p, p + len)).trim() : "";   /* 空の名前は項目ごと飛ばす（後続は生かす） */
    p += len;
    const t = ts / 10000000;                       /* 100ナノ秒 → 秒 */
    if (text && Number.isFinite(t) && t >= 0 && t < 86400) out.push({ t, text: text.slice(0, MAX_TAG_TEXT) });
  }
  if (!out.length) return null;
  out.sort((a, b) => a.t - b.t);
  return out;
}
function findChpl(data, start = 0, end = data.length, depth = 0) {
  if (depth > 10) return null;
  let p = start, count = 0;
  while (p + 8 <= end && count++ < 8192) {
    const size32 = u32be(data, p), type = ascii(data, p + 4, 4);
    let size = size32, header = 8;
    if (size32 === 1) { if (p + 16 > end) break; size = u64be(data, p + 8); header = 16; }
    else if (size32 === 0) size = end - p;
    if (!Number.isSafeInteger(size) || size < header || p + size > end) break;
    const payload = p + header, atomEnd = p + size;
    if (type === "chpl") {
      const found = parseChplBox(data, payload, atomEnd);
      if (found) return found;
    } else if (MP4_CONTAINERS.has(type)) {
      const childStart = type === "meta" ? payload + 4 : payload; // full-box version/flags
      if (childStart <= atomEnd) { const found = findChpl(data, childStart, atomEnd, depth + 1); if (found) return found; }
    }
    p = atomEnd;
    if (size32 === 0) break;
  }
  return null;
}
async function extractMp4(file, mode = "art") {
  let offset = 0;
  for (let boxes = 0; boxes < 512 && offset + 8 <= file.size; boxes++) {
    const header = await readRange(file, offset, Math.min(file.size, offset + 16), 16);
    if (!header || header.length < 8) return null;
    const size32 = u32be(header, 0), type = ascii(header, 4, 4);
    let size = size32, headerSize = 8;
    if (size32 === 1) { if (header.length < 16) return null; size = u64be(header, 8); headerSize = 16; }
    else if (size32 === 0) size = file.size - offset;
    if (!Number.isSafeInteger(size) || size < headerSize || offset + size > file.size) return null;
    if (type === "moov") {
      if (size - headerSize > MAX_TAG_BYTES) return null;
      const moov = await readRange(file, offset + headerSize, offset + size, MAX_TAG_BYTES);
      if (!moov) return null;
      if (mode === "lyrics") return findMp4Lyrics(moov);
      if (mode === "tags") return normalizeTags(findMp4Tags(moov));
      if (mode === "chapters") return findChpl(moov);   /* 🔖 trk170 */
      return findMp4Cover(moov);
    }
    if (size32 === 0) return null;
    offset += size;
  }
  return null;
}
async function extract(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 12) return null;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  try {
    if (["mp3", "aac", "wav"].includes(ext)) return await extractID3(file);
    if (["m4a", "m4b", "mp4"].includes(ext)) return await extractMp4(file);
    if (ext === "flac") return await extractFlac(file);
    if (["ogg", "oga", "opus"].includes(ext)) return await extractOgg(file);
  } catch (_) { return null; }
  return null;
}
/* 🎤 埋め込み歌詞を読む（trk166）。戻り値: { text }（非同期テキスト。LRC形式のこともあるので
   呼び出し側で parseLrc にかける）／ { lines:[{t,text}] }（SYLT の同期歌詞・秒）／ null。
   ⚠ 歌詞は表示のために読むだけで、ファイルには書き戻さない（読み取り専用方針）。 */
async function extractLyrics(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 12) return null;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  try {
    if (["mp3", "aac", "wav"].includes(ext)) return await extractID3(file, "lyrics");
    if (["m4a", "m4b", "mp4"].includes(ext)) return await extractMp4(file, "lyrics");
    if (ext === "flac") return await extractFlac(file, "lyrics");
    if (["ogg", "oga", "opus"].includes(ext)) return await extractOgg(file, parseCommentLyricsPacket);
  } catch (_) { return null; }
  return null;
}
/* 🏷 埋め込みテキストタグを読む（trk167）。戻り値: { title, artist, album, albumArtist, genre, track, trackTotal } の一部か null。
   🔊 rgTrackGain（trk168）: REPLAYGAIN_TRACK_GAIN タグがあれば dB の数（音量の平準化が優先して使う）。
   ⚠ 表示のために読むだけで、ファイルには書き戻さない（タグ編集はしない＝読み取り専用方針）。 */
async function extractTags(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 12) return null;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  try {
    if (["mp3", "aac", "wav"].includes(ext)) return await extractID3(file, "tags");
    if (["m4a", "m4b", "mp4"].includes(ext)) return await extractMp4(file, "tags");
    if (ext === "flac") return await extractFlac(file, "tags");
    if (["ogg", "oga", "opus"].includes(ext)) return await extractOgg(file, parseCommentTagsPacket);
  } catch (_) { return null; }
  return null;
}
/* 🔖 チャプターを読む（trk170）。戻り値: [{ t:秒, text }]（時刻の昇順）か null。
   対応は MP4 系の chpl（Nero 形式）だけ＝M4B オーディオブックの定番。読み取り専用。 */
async function extractChapters(file) {
  if (!file || !Number.isFinite(file.size) || file.size < 12) return null;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  try {
    if (["m4b", "m4a", "mp4", "mov"].includes(ext)) return await extractMp4(file, "chapters");
  } catch (_) { return null; }
  return null;
}
function imageDimensions(data, mime) {
  if (mime === "image/png" && data.length >= 24) return { width:u32be(data, 16), height:u32be(data, 20) };
  if (mime === "image/jpeg") {
    let p = 2;
    while (p + 4 <= data.length) {
      if (data[p] !== 0xff) { p++; continue; }
      while (data[p] === 0xff) p++;
      const marker = data[p++];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
      if (p + 2 > data.length) break;
      const size = (data[p] << 8) | data[p + 1];
      if (size < 2 || p + size > data.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && size >= 7)
        return { height:(data[p + 3] << 8) | data[p + 4], width:(data[p + 5] << 8) | data[p + 6] };
      p += size;
    }
    return null;
  }
  if (mime === "image/webp" && data.length >= 30) {
    const kind = ascii(data, 12, 4);
    if (kind === "VP8X" && data.length >= 30) {
      const w = data[24] | (data[25] << 8) | (data[26] << 16), h = data[27] | (data[28] << 8) | (data[29] << 16);
      return { width:w + 1, height:h + 1 };
    }
    if (kind === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
      const b1 = data[21], b2 = data[22], b3 = data[23], b4 = data[24];
      return { width:1 + b1 + ((b2 & 0x3f) << 8), height:1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10) };
    }
    if (kind === "VP8 " && data.length >= 30 && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a)
      return { width:((data[26] | (data[27] << 8)) & 0x3fff), height:((data[28] | (data[29] << 8)) & 0x3fff) };
  }
  return null;
}
async function thumbnail(blob) {
  if (!blob || typeof blob.arrayBuffer !== "function" || blob.size > MAX_ART_BYTES) return null;
  let bytes, mime;
  try { bytes = new Uint8Array(await blob.arrayBuffer()); mime = imageMime(bytes); } catch (_) { return null; }
  if (!mime) return null;
  const dimensions = imageDimensions(bytes, mime);
  if (!dimensions || !dimensions.width || !dimensions.height || dimensions.width > MAX_IMAGE_EDGE || dimensions.height > MAX_IMAGE_EDGE || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) return null;
  if (typeof window.createImageBitmap !== "function" || typeof document === "undefined") return blob;
  let bitmap = null;
  try {
    bitmap = await window.createImageBitmap(blob);
    if (!bitmap.width || !bitmap.height || bitmap.width > MAX_IMAGE_EDGE || bitmap.height > MAX_IMAGE_EDGE || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) return null;
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    return out && out.size && out.size <= MAX_ART_BYTES ? out : null;
  } catch (_) { return null; }
  finally { if (bitmap && typeof bitmap.close === "function") bitmap.close(); }
}
window.Trk = window.Trk || {};
window.Trk.media = window.Trk.media || {};
window.Trk.media.audioArt = Object.freeze({ extract, extractLyrics, extractTags, extractChapters, thumbnail, limits:Object.freeze({ metadataBytes:MAX_TAG_BYTES, artBytes:MAX_ART_BYTES, edge:THUMB_EDGE, lyricsBytes:MAX_LYRICS_BYTES, tagText:MAX_TAG_TEXT, chapters:MAX_CHAPTERS }) });
})();

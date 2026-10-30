// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ ZIP の入出力（バックアップ／パック共用・Blob のまま扱う） ============
   ・書き出し：中身を Blob の参照のまま並べる（全体を1つの ArrayBuffer に載せない）。CRC は1ファイルずつ読んで計算する。
   ・読み出し：末尾と中央ディレクトリだけを読み、中身は必要になったときに slice で取り出す。
   ・ZIP64 に対応（4GiB超・65535件超）。暗号化されたZIPは受け付けない。
   ・バックアップと .stpack の読み書きで共有し、大きな本文は必要になるまで読み込まない。
   公開先：window.Trk.zipIO */
(function () {
  "use strict";
  window.Trk = window.Trk || {};

  const U32 = 0xffffffff, U16 = 0xffff;
  /* Safety ceilings are deliberately independent from the user's storage-limit switch.
     250k entries cover large backups/archives while keeping the entry objects + name map bounded; 64 MiB caps the one-shot central-directory parse. */
  const ZIP_LIMITS = Object.freeze({ entries:250000, centralBytes:64 * 1048576 });
  const MAX_ENTRIES = ZIP_LIMITS.entries, MAX_CENTRAL = ZIP_LIMITS.centralBytes;
  const enc = new TextEncoder(), dec = new TextDecoder();

  class ZipIOError extends Error {
    constructor(key) { super(key); this.key = key; }
  }

  /* Convert a Unix millisecond timestamp to ZIP's local-time DOS fields (2-second precision).
     If no mtime is supplied, callers retain the deterministic 1980-01-01 default. */
  function zipDosDateTime(timestamp) {
    if (!Number.isFinite(timestamp)) throw new ZipIOError("zipBad");
    const d = new Date(timestamp);
    if (!Number.isFinite(d.getTime())) throw new ZipIOError("zipBad");
    const year = Math.min(2107, Math.max(1980, d.getFullYear()));
    const month = d.getMonth() + 1, day = d.getDate();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((year - 1980) << 9) | (month << 5) | day;
    return { time, date };
  }

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32Update(c, u8) {
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return c;
  }
  function crc32(u8) { return (crc32Update(0xffffffff, u8) ^ 0xffffffff) >>> 0; }
  /* Blob / 展開ストリームを蓄積せずに CRC と実バイト数を数える。maxBytes を超えたら即時に読み取りを止める。 */
  async function crc32Stream(stream, maxBytes = Infinity, overflowKey = "zipTooBig") {
    const max = Number.isFinite(maxBytes) ? Math.max(0, maxBytes) : Infinity;
    const reader = stream.getReader();
    let c = 0xffffffff, size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const length = value && value.byteLength;
        if (!Number.isSafeInteger(length) || length < 0 || size > Number.MAX_SAFE_INTEGER - length) {
          try { await reader.cancel(); } catch (_) {}
          throw new ZipIOError("zipBad");
        }
        if (size + length > max) {
          try { await reader.cancel(); } catch (_) {}
          throw new ZipIOError(overflowKey);
        }
        c = crc32Update(c, value);
        size += length;
      }
    } finally {
      try { reader.releaseLock(); } catch (_) {}
    }
    return { crc:(c ^ 0xffffffff) >>> 0, size };
  }

  async function deflateBlob(blob) {
    return new Response(blob.stream().pipeThrough(new CompressionStream("deflate-raw"))).blob();
  }

  /* entries：[{ name, blob, deflate? }]。戻り値は ZIP の Blob。
     opts.forceZip64 はテスト用。opts.mtime は全エントリ共通の Unix 時刻(ms)（配布ZIPのビルド時刻用）。 */
  async function zipWrite(entries, opts = {}) {
    if (!Array.isArray(entries)) throw new ZipIOError("zipBad");
    if (entries.length > MAX_ENTRIES) throw new ZipIOError("zipLimit");
    const parts = [], central = [];
    let off = 0, cdSize = 0;
    const { time:DOS_TIME, date:DOS_DATE } = opts.mtime === undefined
      ? { time:0, date:0x21 }   /* 1980-01-01 固定（通常のbackup/.stpackは決定的な出力） */
      : zipDosDateTime(opts.mtime);
    for (const e of entries) {
      if (!e || typeof e.name !== "string" || !e.name || e.name.includes("\\") || e.name.startsWith("/") ||
          /^[A-Za-z]:/.test(e.name) || e.name.split("/").includes("..") || !e.blob || typeof e.blob.stream !== "function") throw new ZipIOError("zipBad");
      const raw = e.blob;
      if (!Number.isSafeInteger(raw.size) || raw.size < 0) throw new ZipIOError("zipBad");
      const { crc, size:usize } = await crc32Stream(raw.stream());
      if (usize !== raw.size) throw new ZipIOError("zipBad");
      let body = raw, method = 0, csize = usize;
      if (e.deflate && usize > 0 && typeof CompressionStream !== "undefined") {
        body = await deflateBlob(raw); method = 8; csize = body.size;
      }
      if (!Number.isSafeInteger(csize) || csize < 0) throw new ZipIOError("zipBad");
      const name = enc.encode(e.name);
      if (name.length > U16) throw new ZipIOError("zipBad");
      const big = !!opts.forceZip64 || csize >= U32 || usize >= U32 || off >= U32;
      const lhLen = 30 + name.length + (big ? 20 : 0);
      const lh = new DataView(new ArrayBuffer(lhLen)), lu = new Uint8Array(lh.buffer);
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, big ? 45 : 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, DOS_TIME, true); lh.setUint16(12, DOS_DATE, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, big ? U32 : csize, true); lh.setUint32(22, big ? U32 : usize, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, big ? 20 : 0, true);
      lu.set(name, 30);
      if (big) {
        const x = 30 + name.length;
        lh.setUint16(x, 0x0001, true); lh.setUint16(x + 2, 16, true);
        lh.setBigUint64(x + 4, BigInt(usize), true); lh.setBigUint64(x + 12, BigInt(csize), true);
      }
      parts.push(lh, body);

      const cdLen = 46 + name.length + (big ? 28 : 0);
      const ch = new DataView(new ArrayBuffer(cdLen)), cu = new Uint8Array(ch.buffer);
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, big ? 45 : 20, true); ch.setUint16(6, big ? 45 : 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, DOS_TIME, true); ch.setUint16(14, DOS_DATE, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, big ? U32 : csize, true); ch.setUint32(24, big ? U32 : usize, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, big ? 28 : 0, true);
      ch.setUint32(42, big ? U32 : off, true);
      cu.set(name, 46);
      if (big) {
        const x = 46 + name.length;
        ch.setUint16(x, 0x0001, true); ch.setUint16(x + 2, 24, true);
        ch.setBigUint64(x + 4, BigInt(usize), true); ch.setBigUint64(x + 12, BigInt(csize), true); ch.setBigUint64(x + 20, BigInt(off), true);
      }
      if (cdSize > MAX_CENTRAL - ch.byteLength) throw new ZipIOError("zipLimit");
      cdSize += ch.byteLength;
      central.push(ch);
      const localSize = lhLen + csize;
      if (!Number.isSafeInteger(localSize) || off > Number.MAX_SAFE_INTEGER - localSize) throw new ZipIOError("zipBad");
      off += localSize;
    }
    const cdOff = off;
    const count = entries.length;
    const cdEnd = cdOff + cdSize;
    const needZip64 = !!opts.forceZip64 || count >= U16 || cdOff >= U32 || cdSize >= U32;
    if (!Number.isSafeInteger(cdEnd) || cdEnd > Number.MAX_SAFE_INTEGER - (needZip64 ? 98 : 22)) throw new ZipIOError("zipBad");
    const tail = [];
    if (needZip64) {
      const z = new DataView(new ArrayBuffer(56));
      z.setUint32(0, 0x06064b50, true); z.setBigUint64(4, 44n, true);
      z.setUint16(12, 45, true); z.setUint16(14, 45, true);
      z.setBigUint64(24, BigInt(count), true); z.setBigUint64(32, BigInt(count), true);
      z.setBigUint64(40, BigInt(cdSize), true); z.setBigUint64(48, BigInt(cdOff), true);
      const loc = new DataView(new ArrayBuffer(20));
      loc.setUint32(0, 0x07064b50, true); loc.setUint32(4, 0, true);
      loc.setBigUint64(8, BigInt(cdEnd), true); loc.setUint32(16, 1, true);
      tail.push(z, loc);
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, opts.forceZip64 ? U16 : Math.min(count, U16), true);
    end.setUint16(10, opts.forceZip64 ? U16 : Math.min(count, U16), true);
    end.setUint32(12, opts.forceZip64 ? U32 : Math.min(cdSize, U32), true);
    end.setUint32(16, opts.forceZip64 ? U32 : Math.min(cdOff, U32), true);
    tail.push(end);
    return new Blob([...parts, ...central, ...tail], { type: "application/zip" });
  }

  async function readZipEndRecord(file, tail, tailOff, eocd) {
    const size = file.size, eocdAbs = tailOff + eocd;
    const disk = tail.getUint16(eocd + 4, true), cdDisk = tail.getUint16(eocd + 6, true);
    const diskCount16 = tail.getUint16(eocd + 8, true);
    let count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
    if (disk !== 0 || cdDisk !== 0 || diskCount16 !== U16 && count !== U16 && diskCount16 !== count) throw new ZipIOError("zipBad");
    const needs64 = diskCount16 === U16 || count === U16 || cdSize === U32 || cdOff === U32;
    let zip64Off = null;
    if (needs64) {
      const locator = eocd - 20;
      if (locator < 0 || tail.getUint32(locator, true) !== 0x07064b50 ||
          tail.getUint32(locator + 4, true) !== 0 || tail.getUint32(locator + 16, true) !== 1) throw new ZipIOError("zipBad");
      const zip64Big = tail.getBigUint64(locator + 8, true), locatorAbs = tailOff + locator;
      if (zip64Big > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipIOError("zipBad");
      zip64Off = Number(zip64Big);
      if (zip64Off > size - 56 || zip64Off + 56 > locatorAbs) throw new ZipIOError("zipBad");
      const z = new DataView(await file.slice(zip64Off, zip64Off + 56).arrayBuffer());
      if (z.byteLength !== 56 || z.getUint32(0, true) !== 0x06064b50) throw new ZipIOError("zipBad");
      const recordSize = z.getBigUint64(4, true);
      if (recordSize < 44n || BigInt(zip64Off) + 12n + recordSize !== BigInt(locatorAbs)) throw new ZipIOError("zipBad");
      const zDisk = z.getUint32(16, true), zCdDisk = z.getUint32(20, true);
      const diskCount64 = z.getBigUint64(24, true), count64 = z.getBigUint64(32, true);
      const cdSize64 = z.getBigUint64(40, true), cdOff64 = z.getBigUint64(48, true);
      const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
      if (zDisk !== 0 || zCdDisk !== 0 || diskCount64 !== count64 ||
          diskCount64 > maxSafe || cdSize64 > maxSafe || cdOff64 > maxSafe) throw new ZipIOError("zipBad");
      count = Number(count64); cdSize = Number(cdSize64); cdOff = Number(cdOff64);
      if (diskCount16 !== U16 && diskCount16 !== count ||
          tail.getUint16(eocd + 10, true) !== U16 && tail.getUint16(eocd + 10, true) !== count) throw new ZipIOError("zipBad");
    }
    /* 32bit で足りていても、ZIP64 の終端レコード＋ロケーターを置く作り手がある（Info-ZIP が標準入力からメンバーを
       読むとき＝ `printf abc | zip - - > x.cbz` など。大きさが事前に分からないためローカルヘッダを ZIP64 拡張にし、
       その結果として終端レコードも必ず書く）。その場合、中央目録の直後は ZIP64 の終端レコードで、trk162 の厳密な
       「中央目録の終わり＝EOCD の位置」検査はこれを zipBad にしていた（旧 readZip は読めたのでパック・CBZ では回帰）。
       ロケーターが正しく指していて、終端レコードの中身（ディスク番号・件数・中央目録の大きさ／位置）も EOCD と
       一致するときだけ、その位置を中央目録の終わりとして認める（trk163・レビュー）。一致しなければ zip64Off は
       null のままで下の cdEnd 検査が zipBad にする＝「EOCD と ZIP64 の中身を食い違わせる二重解釈」は許さない
       （実 Info-ZIP 出力は両者が一致する。この経路でも読む値は EOCD 側だけで、終端レコードの中身は使わない） */
    if (zip64Off === null && eocd >= 20 && tail.getUint32(eocd - 20, true) === 0x07064b50 &&
        tail.getUint32(eocd - 16, true) === 0 && tail.getUint32(eocd - 4, true) === 1) {
      const optional = tail.getBigUint64(eocd - 12, true), locatorAbs = tailOff + eocd - 20;
      if (optional <= BigInt(Number.MAX_SAFE_INTEGER) && Number(optional) + 56 <= locatorAbs) {
        const z = new DataView(await file.slice(Number(optional), Number(optional) + 56).arrayBuffer());
        if (z.byteLength === 56 && z.getUint32(0, true) === 0x06064b50 &&
            BigInt(optional) + 12n + z.getBigUint64(4, true) === BigInt(locatorAbs) &&
            z.getUint32(16, true) === 0 && z.getUint32(20, true) === 0 &&
            z.getBigUint64(24, true) === z.getBigUint64(32, true) && z.getBigUint64(32, true) === BigInt(count) &&
            z.getBigUint64(40, true) === BigInt(cdSize) && z.getBigUint64(48, true) === BigInt(cdOff)) zip64Off = Number(optional);
      }
    }
    const cdEnd = cdOff + cdSize, expectedCdEnd = zip64Off === null ? eocdAbs : zip64Off;
    if (!Number.isSafeInteger(count) || count < 0 ||
        !Number.isSafeInteger(cdSize) || cdSize < 0 ||
        !Number.isSafeInteger(cdOff) || cdOff < 0) throw new ZipIOError("zipBad");
    if (count > MAX_ENTRIES || cdSize > MAX_CENTRAL) throw new ZipIOError("zipLimit");
    if (cdOff > size - cdSize || cdEnd !== expectedCdEnd) throw new ZipIOError("zipBad");
    return { eocdAbs, count, cdSize, cdOff, cdEnd, zip64Off };
  }

  /* 中央ディレクトリを読む。中身（ローカルヘッダ）は触らない。 */
  async function zipOpen(file) {
    const size = file && file.size;
    if (!Number.isSafeInteger(size) || size < 22 || !file || typeof file.slice !== "function") throw new ZipIOError("zipBad");
    const tailLen = Math.min(size, 65557), tailOff = size - tailLen;
    const tail = new DataView(await file.slice(tailOff, size).arrayBuffer());
    let end = null, lastError = null;
    /* コメント中にも同じsignatureがありえる。コメント長と範囲を通る候補だけを採用する。 */
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) !== 0x06054b50 || i + 22 + tail.getUint16(i + 20, true) !== tailLen) continue;
      try { end = await readZipEndRecord(file, tail, tailOff, i); break; }
      catch (error) { if (!(error instanceof ZipIOError)) throw error; lastError = error; }
    }
    if (!end) throw lastError || new ZipIOError("zipBad");
    const { count, cdSize, cdOff, cdEnd, zip64Off } = end;
    const cd = new DataView(await file.slice(cdOff, cdEnd).arrayBuffer());
    if (cd.byteLength !== cdSize) throw new ZipIOError("zipBad");
    const list = [], names = new Set();
    let p = 0;
    for (let n = 0; n < count; n++) {
      if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== 0x02014b50) throw new ZipIOError("zipBad");
      const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true), crc = cd.getUint32(p + 16, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true), loff = cd.getUint32(p + 42, true);
      const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
      const diskStart = cd.getUint16(p + 34, true);
      if (diskStart !== 0) throw new ZipIOError("zipBad");   /* 分割ZIPは扱わない */
      if (flags & 1) throw new ZipIOError("zipEncrypted");
      if (method !== 0 && method !== 8) throw new ZipIOError("zipMethod");
      const recordEnd = p + 46 + nlen + xlen + clen;
      if (recordEnd > cd.byteLength) throw new ZipIOError("zipBad");
      const nameBytes = new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nlen);
      const rawName = dec.decode(nameBytes);
      /* ZIP64 の拡張：32bit が 0xffffffff のときだけ、順番どおり 8byte の値が入っている */
      let x = p + 46 + nlen;
      const xEnd = x + xlen;
      let zip64Found = false;
      while (x < xEnd) {
        if (x + 4 > xEnd) throw new ZipIOError("zipBad");
        const id = cd.getUint16(x, true), len = cd.getUint16(x + 2, true);
        if (x + 4 + len > xEnd) throw new ZipIOError("zipBad");
        if (id === 0x0001) {
          if (zip64Found) throw new ZipIOError("zipBad");
          zip64Found = true;
          let q = x + 4;
          const need = (usize === U32 ? 8 : 0) + (csize === U32 ? 8 : 0) + (loff === U32 ? 8 : 0);
          if (need > len) throw new ZipIOError("zipBad");
          const read64 = () => {
            const value = Number(cd.getBigUint64(q, true)); q += 8;
            if (!Number.isSafeInteger(value) || value < 0) throw new ZipIOError("zipBad");
            return value;
          };
          if (usize === U32) usize = read64();
          if (csize === U32) csize = read64();
          if (loff === U32) loff = read64();
        }
        x += 4 + len;
      }
      if ((usize === U32 || csize === U32 || loff === U32) && !zip64Found) throw new ZipIOError("zipBad");
      p = recordEnd;
      /* ZIP名はファイルシステムへ書かない。Windows の「\\」区切りは「/」として読み、危険な区切りだけ拒む。 */
      const name = rawName.replace(/\\/g, "/");
      if (!name || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.split("/").includes("..")) throw new ZipIOError("zipBad");
      if (names.has(name)) throw new ZipIOError("zipBad");
      names.add(name);
      if (!Number.isSafeInteger(loff) || loff < 0 || loff > cdOff - 30) throw new ZipIOError("zipBad");
      if (name.endsWith("/")) continue;
      list.push({ name, rawName, flags, method, csize, usize, crc, off:loff });
    }
    if (p !== cd.byteLength) throw new ZipIOError("zipBad");
    const byName = new Map();
    for (const e of list) byName.set(e.name, e);
    return { size, file, entries:list, byName, centralOffset:cdOff, centralSize:cdSize };
  }

  async function zipDataStart(zip, e) {
    if (!e || !Number.isSafeInteger(e.off) || e.off < 0 || !Number.isSafeInteger(e.csize) || e.csize < 0 ||
        e.off > zip.size - 30) throw new ZipIOError("zipBad");
    const h = new DataView(await zip.file.slice(e.off, e.off + 30).arrayBuffer());
    if (h.byteLength !== 30 || h.getUint32(0, true) !== 0x04034b50 ||
        h.getUint16(6, true) !== e.flags || h.getUint16(8, true) !== e.method) throw new ZipIOError("zipBad");
    const nameLength = h.getUint16(26, true), extraLength = h.getUint16(28, true);
    const nameStart = e.off + 30, start = nameStart + nameLength + extraLength;
    if (!Number.isSafeInteger(start) || start > zip.centralOffset || e.csize > zip.centralOffset - start) throw new ZipIOError("zipBad");
    const localName = dec.decode(await zip.file.slice(nameStart, nameStart + nameLength).arrayBuffer());
    if (localName !== e.rawName) throw new ZipIOError("zipBad");
    return start;
  }

  /* 中身を Blob で返す。limit を超える展開後の大きさは即停止。verifyCrc=true なら同じストリームでCRCも確かめる。 */
  async function zipEntryBlob(zip, e, limit = Infinity, verifyCrc = false) {
    if (e.usize > limit) throw new ZipIOError("zipTooBig");
    const start = await zipDataStart(zip, e);
    const raw = zip.file.slice(start, start + e.csize);
    if (e.method === 0) {
      if (verifyCrc) {
        const check = await crc32Stream(raw.stream(), e.usize, "zipCorrupt");
        if (check.size !== e.usize || check.crc !== e.crc) throw new ZipIOError("zipCorrupt");
      }
      return raw;
    }
    const stream = raw.stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader(), chunks = [];
    let size = 0, c = 0xffffffff;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > Math.min(limit, e.usize)) throw new ZipIOError("zipTooBig");   /* 宣言／利用側上限を超えたら即停止 */
        if (verifyCrc) c = crc32Update(c, value);
        chunks.push(value);
      }
    } catch (err) {
      try { await reader.cancel(); } catch (_) {}
      throw err instanceof ZipIOError ? err : new ZipIOError("zipBad");
    }
    if (verifyCrc && (size !== e.usize || ((c ^ 0xffffffff) >>> 0) !== e.crc)) throw new ZipIOError("zipCorrupt");
    return new Blob(chunks);
  }

  /* CRC と実サイズを流しながら確かめる。確認対象を Blob / ArrayBuffer に溜めない。 */
  async function zipVerifyEntry(zip, e, limit = Infinity) {
    if (e.usize > limit) throw new ZipIOError("zipTooBig");
    const start = await zipDataStart(zip, e);
    const raw = zip.file.slice(start, start + e.csize);
    let result;
    try {
      let stream = raw.stream();
      if (e.method === 8) stream = stream.pipeThrough(new DecompressionStream("deflate-raw"));
      result = await crc32Stream(stream, e.usize, "zipCorrupt");
    } catch (err) {
      if (err instanceof ZipIOError) throw err;
      throw new ZipIOError(e.method === 8 ? "zipBad" : "zipCorrupt");
    }
    if (result.size !== e.usize || result.crc !== e.crc) throw new ZipIOError("zipCorrupt");
    return true;
  }

  window.Trk.zipIO = Object.assign(window.Trk.zipIO || {}, {
    ZipIOError, limits:ZIP_LIMITS, crc32, crc32Stream, zipWrite, zipOpen, zipDataStart, zipEntryBlob, zipVerifyEntry,
  });
})();

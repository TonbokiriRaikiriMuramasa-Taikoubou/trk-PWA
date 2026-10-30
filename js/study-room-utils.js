// SPDX-License-Identifier: GPL-3.0-or-later
/* 📚 書斎の純粋データ処理。外部ライブラリ・通信・HTML解釈は使いません。
   ここは「決まった入力 → 決まった出力」だけを置き、UI・IndexedDB・イベントは study-room.js 側に置きます。 */
"use strict";

window.TrkStudyUtils = (() => {
  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp"]);
  const TEXT_EXTS = new Set(["txt", "md", "markdown", "json", "csv", "log", "html", "htm", "xml", "yaml", "yml", "ini", "css", "js", "ts"]);
  const collator = new Intl.Collator(undefined, { numeric:true, sensitivity:"base" });
  const ROOT_ALBUM = "画像";
  const MAX_MATCHES = 4000;

  function extension(name) {
    const leaf = String(name || "").split(/[\\/]/).pop() || "";
    const dot = leaf.lastIndexOf(".");
    return dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
  }
  function baseName(name) {
    const leaf = String(name || "").split(/[\\/]/).pop() || "";
    const dot = leaf.lastIndexOf(".");
    return (dot > 0 ? leaf.slice(0, dot) : leaf).trim() || leaf || "Untitled";
  }
  function relativePath(file) {
    return String(file && (file.webkitRelativePath || file.name) || "").replace(/\\/g, "/").split("/").filter(Boolean).join("/");
  }
  function isImageFile(file) {
    const ext = extension(file && file.name);
    return IMAGE_EXTS.has(ext) || (!ext && /^image\/(?:jpeg|png|webp|gif|avif|bmp)$/i.test(file && file.type || ""));
  }
  function isTextFile(file) { return TEXT_EXTS.has(extension(file && file.name)); }
  function comparePath(a, b) { return collator.compare(String(a || ""), String(b || "")); }

  /* ---------- 取り込みの整理 ----------
     nesting:"split"（既定）は「1フォルダ＝1冊」を基本にしつつ、中のサブフォルダは別の本に分けます。
     nesting:"flat" は従来どおり、選んだフォルダ全体を1冊にまとめます。 */
  function groupImageFiles(files, nesting) {
    const split = nesting !== "flat";
    const grouped = new Map();
    for (const file of Array.from(files || [])) {
      if (!isImageFile(file)) continue;
      const rel = relativePath(file), parts = rel.split("/").filter(Boolean);
      const hasFolder = parts.length > 1;
      const parentPath = hasFolder ? parts.slice(0, -1).join("/") : "";
      const key = hasFolder ? (split ? parentPath : parts[0]) : ROOT_ALBUM;
      const pagePath = parentPath ? parts[parts.length - 1] : (file.name || rel);
      if (!grouped.has(key)) grouped.set(key, { title:key.split("/").pop() || key, sourcePath:key, files:[] });
      grouped.get(key).files.push({ file, path:pagePath });
    }
    return [...grouped.values()].map(group => ({
      ...group,
      files:group.files.sort((a, b) => comparePath(a.path, b.path))
    })).sort((a, b) => comparePath(a.sourcePath, b.sourcePath));
  }

  /* 📂 trk210：本棚のリンク本がまだ使っている共有フォルダーの名前（登録の後始末に使う）。 */
  function sharedFoldersInUse(books) {
    const out = new Set();
    for (const book of Array.isArray(books) ? books : []) {
      if (book && book.linked === true && typeof book.sharedFolder === "string" && book.sharedFolder) out.add(book.sharedFolder);
    }
    return [...out];
  }
  /* 📂 trk208：共有フォルダー（フォルダのまま読む本）の本分け。
     entries = [{ path:"Pictures/Book/01.jpg", name:"01.jpg", size:123 }]（フォルダーから見た相対パス）。
     nesting:"split"（既定）は「1フォルダ＝1冊」でサブフォルダは別の本、"flat" は選んだフォルダ全体を1冊。
     groupImageFiles と違うのは、**ページにフォルダー内のフルパスを残す**こと（読むときに開き直すため）。
     戻り値 [{ title, sourcePath, pages:[{ name, path, size }] }]（ページは自然順）。 */
  function folderBookGroups(entries, nesting) {
    const split = nesting !== "flat", grouped = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const name = String(entry && entry.name || ""), path = String(entry && entry.path || name).replace(/\\/g, "/");
      if (!IMAGE_EXTS.has(extension(name))) continue;
      const parts = path.split("/").filter(Boolean);
      if (!parts.length) continue;
      const hasFolder = parts.length > 1;
      const parentPath = hasFolder ? parts.slice(0, -1).join("/") : "";
      const key = hasFolder ? (split ? parentPath : parts[0]) : ROOT_ALBUM;
      if (!grouped.has(key)) grouped.set(key, { title:key.split("/").pop() || key, sourcePath:key, pages:[] });
      grouped.get(key).pages.push({ name, path:parts.join("/"), size:Math.max(0, Number(entry && entry.size) || 0) });
    }
    return [...grouped.values()].map(group => ({ ...group, pages:group.pages.sort((a, b) => comparePath(a.path, b.path)) }))
      .sort((a, b) => comparePath(a.sourcePath, b.sourcePath));
  }
  function listTextFiles(files) {
    return Array.from(files || []).filter(isTextFile).map(file => ({
      file,
      path:relativePath(file) || file.name || "Untitled.txt",
      title:baseName(file.name)
    })).sort((a, b) => comparePath(a.path, b.path));
  }

  /* ---------- 文字コード ---------- */
  function decodeTextBuffer(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let start = 0, encoding = "utf-8";
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
    else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) { start = 2; encoding = "utf-16le"; }
    else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) { start = 2; encoding = "utf-16be"; }
    const payload = bytes.subarray(start);
    if (encoding !== "utf-8") return new TextDecoder(encoding).decode(payload);
    try { return new TextDecoder("utf-8", { fatal:true }).decode(payload); }
    catch (_) {
      try { return new TextDecoder("shift_jis", { fatal:true }).decode(payload); }
      catch (_) { return new TextDecoder("utf-8").decode(payload); }
    }
  }

  /* 本文の改行・改ページを1つの形にそろえる（表示と検索で同じ文字列を使うため）。 */
  function normalizeText(input) {
    return String(input || "").replace(/\r\n?/g, "\n").replace(/\f/g, "\n\n");
  }

  /* 🛡 青空文庫ルビの切り分け。
     ここは「後戻りしない1回の前向き走査（線形）」で書いてあります。
     以前は正規表現（/｜([^《\n]+)《…/u）でしたが、細工した本文で後戻りが爆発し、
     タブが固まることが実測で分かったためです（例：漢字だけが延々と続く本文、閉じない《 が大量にある本文）。
     位置（次の改行・次の《・次の》と、その《に対する》）は前から後ろへ一度だけ探すので、合計は本文の長さに比例します。
     ルビとして扱う条件は以前と同じ：
       ・｜親文字《ルビ》 … 明示のルビ（親文字・ルビとも1文字以上・改行をまたがない）
       ・親文字《ルビ》   … 漢字（+ 々〆ヵヶ）の並びの直後の《》だけをルビとみなす
       ・閉じない《、空のルビ、改行をまたぐルビは、ルビにせずそのまま文字として残す */
  const KANJI_LIKE = /[\u3400-\u9fff々〆ヵヶ]/;
  function aozoraSegments(input) {
    const source = normalizeText(input).replace(/［＃改ページ］/g, "\n\n");
    const out = [];
    const len = source.length;
    let cursor = 0, i = 0, runStart = -1;
    let nl = source.indexOf("\n"), open = source.indexOf("《"), close = source.indexOf("》");
    let openPos = -1, closeForOpen = -1;
    const advance = () => {   /* それぞれの位置は前にしか進まない（合計 O(n)） */
      if (nl >= 0 && nl < i) nl = source.indexOf("\n", i);
      if (open >= 0 && open < i) open = source.indexOf("《", i);
      if (close >= 0 && close < i) close = source.indexOf("》", i);
    };
    const sameLine = p => p >= 0 && (nl < 0 || p < nl);
    /* 《 ごとに、そのあとの最初の 》 を一度だけ探して覚える（同じ《を何度も調べ直さない） */
    const closeAfter = at => {
      if (at !== openPos) { openPos = at; closeForOpen = source.indexOf("》", at + 1); }
      return closeForOpen;
    };
    while (i < len) {
      advance();
      const c = source[i];
      if (c === "\n") { runStart = -1; i++; continue; }
      if (c === "｜") {
        const at = open;   /* 同じ行で、いちばん近い《 */
        if (sameLine(at) && at > i + 1) {
          const end = closeAfter(at);
          if (sameLine(end) && end > at + 1) {
            if (i > cursor) out.push({ text:source.slice(cursor, i) });
            out.push({ ruby:source.slice(i + 1, at), reading:source.slice(at + 1, end) });
            cursor = i = end + 1; runStart = -1; continue;
          }
        }
        runStart = -1; i++; continue;
      }
      if (c === "《" && runStart >= 0) {
        const end = closeAfter(i);
        if (sameLine(end) && end > i + 1) {
          if (runStart > cursor) out.push({ text:source.slice(cursor, runStart) });
          out.push({ ruby:source.slice(runStart, i), reading:source.slice(i + 1, end) });
          cursor = i = end + 1; runStart = -1; continue;
        }
      }
      runStart = KANJI_LIKE.test(c) ? (runStart < 0 ? i : runStart) : -1;
      i++;
    }
    if (cursor < len) out.push({ text:source.slice(cursor) });
    return out;
  }

  /* ---------- 検索 ---------- */
  /* 返すのは「正規化した本文の文字位置」。UI側がDOMのテキストノードへ対応づけて着色します。 */
  function findMatches(text, query, limit) {
    const haystack = String(text || "").toLocaleLowerCase(), needle = String(query || "").toLocaleLowerCase();
    const cap = Math.max(1, Math.min(MAX_MATCHES, Number(limit) || MAX_MATCHES));
    const out = [];
    if (!needle) return out;
    let index = haystack.indexOf(needle);
    while (index >= 0 && out.length < cap) {
      out.push(index);
      index = haystack.indexOf(needle, index + Math.max(1, needle.length));
    }
    return out;
  }

  /* 本棚カードや栞一覧に出す、1行の抜粋。ratio は 0〜1（栞の位置の目安）。 */
  function snippetAt(text, ratio, length) {
    const source = normalizeText(text).replace(/\s+/g, " ").trim();
    const span = Math.max(24, Math.min(200, Number(length) || 72));
    if (source.length <= span) return source;
    const start = Math.max(0, Math.min(source.length - span, Math.round((Number(ratio) || 0) * source.length) - Math.floor(span / 2)));
    return (start > 0 ? "…" : "") + source.slice(start, start + span).trim() + (start + span < source.length ? "…" : "");
  }

  function textStats(text) {
    const source = normalizeText(text);
    return { chars:source.replace(/\n/g, "").length, lines:source ? source.split("\n").length : 0 };
  }

  /* ---------- 本棚・本の情報 ---------- */
  /* この端末に保存している大きさ。📂 フォルダーのまま読む本（linked）は実体を持たないので 0（trk208）。 */
  function bookSize(book) {
    if (!book || typeof book !== "object" || book.linked === true) return 0;
    if (book.kind === "text") return typeof book.content === "string" ? book.content.length : 0;
    return (Array.isArray(book.pages) ? book.pages : []).reduce((sum, page) => sum + Math.max(0, Number(page && page.size) || 0), 0);
  }
  function sortBooks(books, mode) {
    const rows = Array.from(books || []);
    const byUpdated = (a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0) || comparePath(a.title, b.title);
    switch (mode) {
      case "added": return rows.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0) || comparePath(a.title, b.title));
      case "title": return rows.sort((a, b) => comparePath(a.title, b.title));
      case "type": return rows.sort((a, b) => (a.kind === b.kind ? comparePath(a.title, b.title) : a.kind === "image" ? -1 : 1));
      case "size": return rows.sort((a, b) => bookSize(b) - bookSize(a) || comparePath(a.title, b.title));
      default: return rows.sort(byUpdated);
    }
  }
  function sortShelfItems(items, options) {
    const rows = Array.from(items || []), config = options && typeof options === "object" ? options : {};
    const mode = ["updated", "added", "title", "type", "size"].includes(config.mode) ? config.mode : "updated";
    const orderKeys = Array.isArray(config.orderKeys) ? config.orderKeys : [];
    if (config.manual === true) {
      const order = new Map(orderKeys.map((key, index) => [String(key), index]));
      rows.sort((a, b) => (order.get(String(a && a.key)) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(String(b && b.key)) ?? Number.MAX_SAFE_INTEGER) || comparePath(a && a.title, b && b.title));
    } else {
      const typeRank = item => item && item.itemType === "folder" ? 2 : item && item.kind === "image" ? 0 : 1;
      rows.sort((a, b) => {
        let result = 0;
        if (mode === "title") result = comparePath(a && a.title, b && b.title);
        else if (mode === "added") result = (Number(a && a.createdAt) || 0) - (Number(b && b.createdAt) || 0);
        else if (mode === "type") result = typeRank(a) - typeRank(b);
        else if (mode === "size") result = (Number(b && b.size) || 0) - (Number(a && a.size) || 0);
        else result = (Number(b && b.updatedAt) || 0) - (Number(a && a.updatedAt) || 0);
        return result || comparePath(a && a.title, b && b.title);
      });
    }
    if (config.foldersFirst === true) {
      return rows.filter(item => item && item.itemType === "folder").concat(rows.filter(item => !item || item.itemType !== "folder"));
    }
    return rows;
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${Math.round(value)} B`;
    const units = ["KB", "MB", "GB", "TB"], base = 1024;
    let size = value, unit = "B";
    for (const next of units) {
      if (size < base) break;
      size /= base; unit = next;
    }
    return `${size >= 100 ? Math.round(size) : Math.round(size * 10) / 10} ${unit}`;
  }

  /* ---------- しおり ---------- */
  function bookmarkedBooks(books) {
    return Array.from(books || []).filter(book => book && book.bookmark)
      .sort((a, b) => (Number(b.bookmark.savedAt) || 0) - (Number(a.bookmark.savedAt) || 0));
  }

  /* ---------- 画像の並び ---------- */
  function orderPages(pages, order) {
    const rows = Array.from(pages || []);
    return order === "reverse" ? rows.reverse() : rows;
  }

  function stableId(kind, sourcePath) {
    const input = `${kind}\u0000${String(sourcePath || "").normalize("NFC")}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `${kind}-${(hash >>> 0).toString(36)}`;
  }

  /* CBZ／ZIP の中から、ページになる画像だけを選んで自然順に並べる（trk138）。
     入力は zip-io の中央ディレクトリの項目（name・usize…）。Mac が付ける __MACOSX/ と「.」で始まる名前は除く。 */
  const ARCHIVE_MIME = Object.freeze({ jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif", avif:"image/avif", bmp:"image/bmp" });
  function archivePages(entries) {
    return (Array.isArray(entries) ? entries : []).filter(entry => {
      const name = String(entry && entry.name || "");
      const parts = name.split("/").filter(Boolean);
      if (!parts.length || parts.some(part => part === "__MACOSX" || part.startsWith("."))) return false;
      return IMAGE_EXTS.has(extension(name));
    }).sort((a, b) => comparePath(a.name, b.name));
  }
  function mimeOf(name) { return ARCHIVE_MIME[extension(name)] || "application/octet-stream"; }
  /* 1冊（アルバム）の上限を確かめる（trk139）。画像フォルダと CBZ/ZIP で共用。
     entries は { name, size }（size は1ページの大きさ）、limits は { count, bytes, file }（Infinity で無制限）。
     問題が無ければ null。1枚が file を超えれば { kind:"file", name, max }、枚数か合計が超えれば { kind:"album" }。 */
  function albumProblem(entries, limits) {
    const list = Array.isArray(entries) ? entries : [], L = limits || {};
    let bytes = 0;
    for (const entry of list) {
      const size = Math.max(0, Number(entry && entry.size) || 0);
      if (size > L.file) return { kind:"file", name:String(entry.name || ""), max:L.file };
      bytes += size;
    }
    if (list.length > L.count || bytes > L.bytes) return { kind:"album" };
    return null;
  }

  return Object.freeze({ IMAGE_EXTS, TEXT_EXTS, ROOT_ALBUM, MAX_MATCHES, extension, baseName, relativePath, isImageFile, isTextFile,
    comparePath, groupImageFiles, folderBookGroups, sharedFoldersInUse, listTextFiles, decodeTextBuffer, normalizeText, aozoraSegments, findMatches, snippetAt, textStats,
    bookSize, sortBooks, sortShelfItems, formatBytes, bookmarkedBooks, orderPages, stableId, archivePages, mimeOf, albumProblem });
})();

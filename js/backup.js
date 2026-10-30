// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ 📦 まるごとバックアップ（trk137） ============
   1つのZIPに、この端末の trk! の保存内容をまとめます。
     ・core（常に）：設定・記録・プレイリスト・スキン・音量など（localStorage の許可リスト）＋ライブラリ（IndexedDB shadow_taiko_library）＋軽量参照（shadow_taiko_song_refs）
     ・study（既定ON）：📚 書斎（本・画像・栞・メモ・設定）
     ・packs（既定ON）：📦 カスタムパック。本体を .stpack に組み直し、復元は既存のインストーラで**検証を通す**
     ・media（既定OFF）：🎵 保存棚の曲・動画・共有曲・VRM・MMD のファイル（大きい）
   含めないもの：解析の結果（再生成できる）、一度きりの印、フォルダの権限（ブラウザごとの許可なので書き出せない）。
   復元は選んだ領域を置き換え、選んでいない領域には触らない。パックは先に導入を試し、成功後にバックアップに無いIDを削除する。
   バックアップに含まれるパックの導入に失敗した場合、同じIDの既存パックがあれば残す。
   「容量の上限を無視」（設定）は、書斎・パックの保存量上限だけを外す。ブラウザの空き容量は外せない。
   バックアップのZIP構造・JSON展開量・レコード数には別の固定安全上限を設け、設定で解除できない（250,000エントリー／中央ディレクトリ64 MiB、JSON 64 MiB／ストア、250,000レコード／ストア）。
   公開先：window.Trk.backup（テスト用の純粋関数も含む） */
(function () {
  "use strict";
  const core = window.Trk.core;
  const Z = window.Trk.zipIO;
  const FORMAT = "trk-backup", VERSION = 1, APP = "trk";
  const BLOB_PREFIX = "blobs/", PACK_PREFIX = "packs/", DB_PREFIX = "db/";
  /* Hard parsing limits do not follow "ignore storage limits": bounded ZIP metadata and JSON are needed before any app-level quota can be checked. */
  const MAX_META = 1 << 20, MAX_RECORDS = 250000, MAX_LS_VALUE = 20 * 1048576, MAX_DB_JSON = 64 * 1048576;
  /* Count UTF-8 bytes without allocating a second full-sized buffer for a large JSON row. */
  function utf8LengthWithin(text, limit) {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 0x80) bytes++;
      else if (c < 0x800) bytes += 2;
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
        bytes += 4; i++;
      } else bytes += 3;
      if (bytes > limit) return bytes;
    }
    return bytes;
  }

  /* localStorage の許可リスト。ここに無いキーは書き出さない・復元もしない。 */
  const LS_KEYS = [
    "shadow_taiko_preferences_v2", "shadow_taiko_preferences_v1", "shadow_taiko_best_v1", "shadow_taiko_custom_skins_v1",
    "shadow_taiko_records_v1", "shadow_taiko_song_prefs_v1", "shadow_taiko_songmeta_v1", "shadow_taiko_played_v1",
    "trk_media_positions_v1", "trk_media_loop_presets_v1", "trk_fx_presets_v1", "trk_addons_v1",
    "trk_synth_mode_v1", "trk_synth_patches_v1", "trk_tv_skins_v1",
    "trk_lyrics_v1", "trk_subs_v1",   /* 手で選んだ歌詞・字幕と遅延（trk166・169）。trk177 のレビューで追加 */
  ];
  const ADDONS_KEY = "trk_addons_v1";
  const ADDON_PREVIEW_NAMES = 3, ADDON_PREVIEW_NAME_MAX = 80;
  function safeAddonName(value) {
    const clean = String(value || "")
      .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ").trim();
    return Array.from(clean).slice(0, ADDON_PREVIEW_NAME_MAX).join("") || "(unnamed)";
  }
  function summarizeAddonStore(raw) {
    if (raw == null) return { known:true, count:0, names:[], omitted:0 };
    if (typeof raw !== "string") return { known:false, count:0, names:[], omitted:0 };
    let store;
    try { store = JSON.parse(raw); } catch (_) { return { known:false, count:0, names:[], omitted:0 }; }
    if (!store || typeof store !== "object" || Array.isArray(store)) return { known:false, count:0, names:[], omitted:0 };
    let count = 0;
    const names = [];
    for (const id of Object.keys(store)) {
      const entry = store[id];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      count++;
      if (names.length < ADDON_PREVIEW_NAMES) names.push(safeAddonName(entry.name || entry.id || id));
    }
    return { known:true, count, names, omitted:Math.max(0, count - names.length) };
  }
  /* バックアップから戻したコードは、元の同意指紋が有効でも初期状態では実行しない。 */
  function disableRestoredAddons(raw) {
    if (typeof raw !== "string") return raw;
    let store;
    try { store = JSON.parse(raw); } catch (_) { return "{}"; }
    if (!store || typeof store !== "object" || Array.isArray(store)) return "{}";
    const out = Object.create(null);
    for (const [id, entry] of Object.entries(store)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const disabled = Object.create(null);
      for (const key of Object.keys(entry)) Object.defineProperty(disabled, key, {
        value:entry[key], enumerable:true, writable:true, configurable:true,
      });
      disabled.enabled = false;
      Object.defineProperty(out, id, { value:disabled, enumerable:true, writable:true, configurable:true });
    }
    return JSON.stringify(out);
  }
  /* IndexedDB の対象。skip はそのストアで書き出さないキー（FileSystemHandle などを持つ） */
  /* 📂 trk208：フォルダーのハンドル（dir／share／folders／studyFolders）は端末ごとの値なので、バックアップには入れない */
  const DB_LIBRARY = { db:"shadow_taiko_library", version:2, stores:["kv"], skip:{ kv:["dir", "share", "folders", "studyFolders"] } };
  const DB_STUDY = { db:"trk_study_room_v1", version:1, stores:["books", "pages", "covers", "settings"] };
  /* 復元で書斎のストアを書く順（trk163・レビュー【低】③）：参照される側を先に（pages→covers→books→settings）。
     一番大きな書き込み（pages）が先なので、容量不足などで途中失敗したときに本・カバー側は無傷のまま＝残る不整合は
     「参照されないページ」（書斎の整理で消せる）になり、「存在しないページを指す本」にはならない。 */
  const STUDY_WRITE_ORDER = ["pages", "covers", "books", "settings"];
  /* 書斎のストアだけを、plan.dbs の中の書斎の位置同士で並べ替える（ほかのDBの相対順は保つ） */
  function orderStudyStores(dbs) {
    const slots = [];
    dbs.forEach((p, i) => { if (p.spec === DB_STUDY) slots.push(i); });
    if (slots.length < 2) return;
    const rank = (p) => { const at = STUDY_WRITE_ORDER.indexOf(p.store); return at === -1 ? STUDY_WRITE_ORDER.length : at; };
    const ordered = slots.map(i => dbs[i]).sort((a, b) => rank(a) - rank(b));
    slots.forEach((slot, n) => { dbs[slot] = ordered[n]; });
  }
  const DB_PACKS = { db:"shadow_taiko_packs", version:2, stores:["packs"], index:{ packs:"size" } };
  const DB_MEDIA = [
    { db:"shadow_taiko_songs", version:2, stores:["files"] },
    { db:"shadow_taiko_shared", version:2, stores:["files"] },
    { db:"shadow_taiko_vrm", version:2, stores:["files"] },
    { db:"shadow_taiko_mmd", version:2, stores:["files"] },
  ];
  const DB_REFS = { db:"shadow_taiko_song_refs", version:2, stores:["refs"] };
  const ALL_DBS = [DB_LIBRARY, DB_STUDY, DB_PACKS, ...DB_MEDIA, DB_REFS];

  class BackupError extends Error { constructor(key, vars) { super(key); this.key = key; this.vars = vars; } }
  class SkipValue extends Error { constructor() { super("skip"); this.name = "SkipValue"; } }   /* この行だけ書き出さない */

  /* ---------- 値の変換（純粋関数。テストで直接使う） ---------- */
  function encKey(k) {
    if (typeof k === "string") return { s:k };
    if (typeof k === "number" && isFinite(k)) return { n:k };
    throw new SkipValue();
  }
  function decKey(o) {
    if (o && typeof o.s === "string") return o.s;
    if (o && typeof o.n === "number" && isFinite(o.n)) return o.n;
    throw new BackupError("backupCorrupt");
  }
  /* 利用者のオブジェクトの「$」で始まる名前は、マーカー（$blob など）と混ざらないように1つ足す */
  const encName = k => (k.startsWith("$") ? "$" + k : k);
  const decName = k => (k.startsWith("$$") ? k.slice(1) : k);

  /* IndexedDB の値を JSON にする。Blob／File は add() に渡して zip の中の名前だけを書く。 */
  function encodeValue(v, add, depth = 0) {
    if (depth > 60) throw new SkipValue();
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number") return isFinite(v) ? v : { "$num":String(v) };
    if (v instanceof Blob) {
      const isFile = typeof File !== "undefined" && v instanceof File;
      return { "$blob":add(v), type:String(v.type || "").slice(0, 200), file:isFile,
        name:isFile ? String(v.name || "").slice(0, 260) : "", mtime:isFile ? Number(v.lastModified) || 0 : 0 };
    }
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return { "$blob":add(new Blob([v])), type:"", file:false, name:"", mtime:0 };
    if (v instanceof Date) return { "$date":v.getTime() };
    if (Array.isArray(v)) return v.map(x => (x === undefined ? null : encodeValue(x, add, depth + 1)));
    if (typeof FileSystemHandle !== "undefined" && v instanceof FileSystemHandle) throw new SkipValue();
    if (typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) {
        if (v[k] !== undefined) Object.defineProperty(o, encName(k), {
          value:encodeValue(v[k], add, depth + 1), enumerable:true, writable:true, configurable:true,
        });
      }
      return o;
    }
    throw new SkipValue();   /* function・symbol・bigint など */
  }
  /* 書いた JSON を値に戻す。resolve(name) は zip の中の Blob を返す（同期）。 */
  function decodeValue(j, resolve, depth = 0) {
    if (depth > 60) throw new BackupError("backupCorrupt");
    if (j === null || typeof j !== "object") return j;
    if (Array.isArray(j)) return j.map(x => decodeValue(x, resolve, depth + 1));
    if (typeof j.$num === "string") return Number(j.$num);
    if (typeof j.$date === "number") return new Date(j.$date);
    if (typeof j.$blob === "string") {
      const b = resolve(j.$blob);
      const type = typeof j.type === "string" ? j.type.slice(0, 200) : "";
      if (j.file) return new File([b], typeof j.name === "string" && j.name ? j.name.slice(0, 260) : "file", { type, lastModified:Number(j.mtime) || 0 });
      return new Blob([b], { type });
    }
    const o = {};
    /* 「__proto__」という名前は代入するとプロトタイプが替わる。JSON.parse の自前キーもデータとして安全に置く。 */
    for (const k of Object.keys(j)) Object.defineProperty(o, decName(k), {
      value:decodeValue(j[k], resolve, depth + 1), enumerable:true, writable:true, configurable:true,
    });
    return o;
  }

  /* ---------- IndexedDB（作らない読み出し・置き換え） ---------- */
  async function dbExists(name) {
    if (typeof indexedDB.databases !== "function") return true;   /* 判定できないときは開いてみる */
    try { return (await indexedDB.databases()).some(d => d.name === name); } catch (_) { return true; }
  }
  function openDb(spec, create) {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(spec.db, spec.version);
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of spec.stores) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
          const os = r.transaction.objectStore(s), idx = spec.index && spec.index[s];
          if (idx && !os.indexNames.contains(idx)) os.createIndex(idx, idx);
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("open failed"));
      r.onblocked = () => reject(new Error("idb-blocked"));
    });
  }
  /* 1ストアを、JSON（[{k,v}]の配列の文字列）にする。読むだけ。値の中の Blob は add() で zip へ。 */
  function readStoreJson(db, store, skip, add) {
    return new Promise((resolve, reject) => {
      const parts = ["["];
      let first = true, count = 0, skipped = 0, jsonBytes = 2;
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        if (!(skip && skip.includes(cur.key))) {
          if (count >= MAX_RECORDS) {
            reject(new BackupError("backupHardLimit"));
            try { tx.abort(); } catch (_) {}
            return;
          }
          try {
            const rec = JSON.stringify({ k:encKey(cur.key), v:encodeValue(cur.value, add) });
            const separatorBytes = first ? 0 : 1, remaining = MAX_DB_JSON - jsonBytes - separatorBytes;
            const recordBytes = utf8LengthWithin(rec, remaining);
            if (recordBytes > remaining) {
              reject(new BackupError("backupHardLimit"));
              try { tx.abort(); } catch (_) {}
              return;
            }
            parts.push(first ? rec : "," + rec); first = false; count++; jsonBytes += recordBytes + separatorBytes;
          } catch (e) {
            if (e instanceof SkipValue) skipped++;
            else {
              reject(e instanceof BackupError ? e : new BackupError("backupFail"));
              try { tx.abort(); } catch (_) {}
              return;
            }
          }
        }
        cur.continue();
      };
      tx.oncomplete = () => { parts.push("]"); resolve({ text:parts.join(""), count, skipped }); };
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("read failed"));
    });
  }
  /* 1ストアを置き換える（同じ読み書きの1トランザクション）。skip のキーは残す。 */
  function replaceStore(db, store, pairs, skip) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"), os = tx.objectStore(store);
      const writeAll = () => { for (const [k, v] of pairs) os.put(v, k); };
      if (skip && skip.length) {
        /* 残すキー（skip）以外を消してから入れる。消す対象は先に一覧で決める（カーソルで消しながら入れると、入れたものを消しうる） */
        const keysReq = os.getAllKeys();
        keysReq.onsuccess = () => { for (const k of keysReq.result) if (!skip.includes(k)) os.delete(k); writeAll(); };
      } else { os.clear(); writeAll(); }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("write failed"));
    });
  }
  /* パックの復元では成功したものを入れた後、バックアップに無いIDだけを取り除く。 */
  function deleteStoreExcept(db, store, keep) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite"), os = tx.objectStore(store);
      let removed = 0;
      const keysReq = os.getAllKeys();
      keysReq.onsuccess = () => {
        try {
          for (const key of keysReq.result) if (!keep.has(key)) { os.delete(key); removed++; }
        } catch (error) {
          reject(error);
          try { tx.abort(); } catch (_) {}
        }
      };
      keysReq.onerror = () => reject(keysReq.error || tx.error || new Error("read keys failed"));
      tx.oncomplete = () => resolve(removed);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("delete failed"));
    });
  }
  function readAllValues(db, store) {
    return new Promise((resolve, reject) => {
      const out = [];
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (out.length >= MAX_RECORDS) {
          reject(new BackupError("backupHardLimit"));
          try { tx.abort(); } catch (_) {}
          return;
        }
        out.push(c.value); c.continue();
      };
      tx.oncomplete = () => resolve(out);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("read failed"));
    });
  }

  /* ---------- 書き出し ---------- */
  async function buildBackup(opts = {}) {
    const want = { study:opts.study !== false, packs:opts.packs !== false, media:opts.media === true };
    const entries = [], counts = { ls:0, library:0, study:{ books:0, pages:0 }, packs:0, media:0 };
    let skipped = 0, blobN = 0;
    const pushOutput = (entry) => {
      if (entries.length >= Z.limits.entries - 1) throw new BackupError("backupHardLimit");
      entries.push(entry);
    };
    const add = (blob) => { const name = BLOB_PREFIX + String(++blobN).padStart(7, "0"); pushOutput({ name, blob }); return name; };
    const note = () => {};   /* 進み具合の表示は作成中の一文だけ（段階名は出さない） */

    /* core：localStorage の許可リストと、ライブラリ */
    const items = {};
    for (const key of LS_KEYS) { const v = localStorage.getItem(key); if (v !== null) items[key] = v; }
    counts.ls = Object.keys(items).length;
    const localJson = JSON.stringify({ items }), localBlob = new Blob([localJson]);
    if (localBlob.size > MAX_LS_VALUE) throw new BackupError("backupHardLimit");
    pushOutput({ name:"local.json", blob:localBlob, deflate:true });
    note("core");
    async function dumpStore(spec, store, into) {
      if (!(await dbExists(spec.db))) return null;
      const db = await openDb(spec, false);
      try {
        const r = await readStoreJson(db, store, (spec.skip && spec.skip[store]) || null, add);
        skipped += r.skipped;
        const jsonBlob = new Blob([r.text]);
        if (jsonBlob.size > MAX_DB_JSON) throw new BackupError("backupHardLimit");
        pushOutput({ name:`${DB_PREFIX}${spec.db}/${store}.json`, blob:jsonBlob, deflate:true });
        return r.count;
      } finally { db.close(); }
    }
    counts.library = (await dumpStore(DB_LIBRARY, "kv")) || 0;
    counts.refs = (await dumpStore(DB_REFS, "refs")) || 0;

    if (want.study) {
      note("study");
      for (const s of DB_STUDY.stores) {
        const n = await dumpStore(DB_STUDY, s);
        if (s === "books") counts.study.books = n || 0;
        if (s === "pages") counts.study.pages = n || 0;
      }
    }
    if (want.media) {
      note("media");
      for (const spec of DB_MEDIA) for (const s of spec.stores) counts.media += (await dumpStore(spec, s)) || 0;
    }
    if (want.packs) {
      note("packs");
      if (await dbExists(DB_PACKS.db)) {
        const db = await openDb(DB_PACKS, false);
        let recs = [];
        try { recs = await readAllValues(db, "packs"); } finally { db.close(); }
        let i = 0;
        for (const rec of recs) {
          if (!rec || !rec.manifest || !rec.files) { skipped++; continue; }
          const inner = [{ name:"pack.json", blob:new Blob([JSON.stringify(rec.manifest)]), deflate:true }];
          for (const [path, blob] of Object.entries(rec.files)) if (blob instanceof Blob) inner.push({ name:path, blob });
          const zipped = await Z.zipWrite(inner);
          pushOutput({ name:`${PACK_PREFIX}${String(++i).padStart(4, "0")}.stpack`, blob:zipped });
        }
        counts.packs = i;
      }
    }
    const meta = {
      format:FORMAT, version:VERSION, app:APP, createdAt:new Date().toISOString(),
      areas:{ core:true, study:want.study, packs:want.packs, media:want.media },
      counts, skipped, limitsIgnored:core.storageLimitsIgnored(),
    };
    note("zip");
    const blob = await Z.zipWrite([{ name:"backup.json", blob:new Blob([JSON.stringify(meta, null, 1)]), deflate:true }, ...entries]);
    return { blob, meta };
  }

  /* ---------- 復元 ---------- */
  /* 確認画面に出すアドオン一覧（バックアップのコードは実行せず、名前だけを読む）。 */
  async function readBackupAddonSummary(zip, meta) {
    if (!meta || !meta.areas || !meta.areas.core) return { known:true, count:0, names:[], omitted:0 };
    const entry = zip.byName.get("local.json");
    if (!entry || !Number.isSafeInteger(entry.usize) || entry.usize > MAX_LS_VALUE) return { known:false, count:0, names:[], omitted:0 };
    try {
      const local = JSON.parse(await (await Z.zipEntryBlob(zip, entry, MAX_LS_VALUE)).text());
      const items = local && local.items;
      if (!items || typeof items !== "object" || Array.isArray(items)) return { known:false, count:0, names:[], omitted:0 };
      if (!Object.prototype.hasOwnProperty.call(items, ADDONS_KEY)) return { known:true, count:0, names:[], omitted:0 };
      return summarizeAddonStore(items[ADDONS_KEY]);
    } catch (_) { return { known:false, count:0, names:[], omitted:0 }; }
  }
  /* backup.json と、確認に必要なアドオン名だけを読む。コードは実行しない。 */
  async function readBackupMeta(file) {
    let zip;
    try { zip = await Z.zipOpen(file); }
    catch (error) {
      if (error && (error.key === "zipLimit" || error.key === "zipTooBig")) throw new BackupError("backupHardLimit");
      throw error;
    }
    const e = zip.byName.get("backup.json");
    if (!e) throw new BackupError("backupRestoreBad");
    let raw;
    try { raw = await Z.zipEntryBlob(zip, e, MAX_META); }
    catch (error) {
      if (error && error.key === "zipTooBig") throw new BackupError("backupHardLimit");
      throw new BackupError("backupRestoreBad");
    }
    let meta;
    try { meta = JSON.parse(await raw.text()); }
    catch (_) { throw new BackupError("backupRestoreBad"); }
    if (!meta || meta.format !== FORMAT || meta.version !== VERSION || meta.app !== APP) throw new BackupError("backupRestoreBad");
    const addons = await readBackupAddonSummary(zip, meta);
    return { zip, meta, addons };
  }
  /* 上限の確認（上限を無視しないとき）。通常の画像取り込みと同じく、冊数・枚数・1冊の合計・1画像・文章を見る。 */
  function checkStudyLimits(books, pageBlobSizes = new Map()) {
    if (core.storageLimitsIgnored()) return;
    const L = window.Trk.studyLimits;
    if (!L || !Number.isSafeInteger(L.shelf) || !Number.isSafeInteger(L.pages) ||
        !Number.isSafeInteger(L.imageBytes) || !Number.isSafeInteger(L.imageFileBytes) || !Number.isSafeInteger(L.textBytes)) {
      throw new BackupError("backupRestoreFail");   /* 書斎の上限が読めないときは、確かめられないので止める */
    }
    if (books.length > L.shelf) throw new BackupError("backupRestoreLimit");
    for (const b of books) {
      const value = b && b.v;
      const pages = value && Array.isArray(value.pages) ? value.pages : [];
      if (pages.length > L.pages) throw new BackupError("backupRestoreLimit");
      /* 📂 trk208：フォルダーのまま読む本は、画像の実体をこの端末に持っていない（pages ストアに入れない）。
         数えると「入っていない容量」で上限に引っかかってしまうので、ここは数えない。 */
      if (value && value.kind === "image" && value.linked !== true) {
        let bytes = 0;
        for (const page of pages) {
          const actual = page && pageBlobSizes.has(page.key) ? pageBlobSizes.get(page.key) : page && page.size;
          const size = actual === undefined ? 0 : actual;
          if (!Number.isSafeInteger(size) || size < 0 || size > L.imageFileBytes || bytes > L.imageBytes - size) {
            throw new BackupError("backupRestoreLimit");
          }
          bytes += size;
        }
      }
      const text = value && typeof value.content === "string" ? value.content : "";
      if (text && new Blob([text]).size > L.textBytes) throw new BackupError("backupRestoreLimit");
    }
  }
  /* 🎵 曲・動画の保存棚上限（restore は明示操作だが、通常の保存と同じ合計上限を確認する）。
     old data is never pruned here; an over-cap backup is rejected before any store is replaced. */
  function checkMediaShelfLimit(pairs) {
    const pref = core.settings && core.settings.mediaKeepLimit;
    const cap = pref === "unlimited" ? Infinity : pref === "5g" ? 5 * 1024 ** 3 : 1024 ** 3;
    let total = 0;
    for (const [, rec] of pairs) {
      const size = rec && rec.file && Number(rec.file.size);
      if (!Number.isFinite(size) || size < 0) continue;
      if (total > cap - size) throw new BackupError("backupMediaLimit");
      total += size;
    }
  }
  /* 1件の stpack から安全にIDを得る。バックアップ生成物は外側ZIPで無圧縮のため、巨大パック本体はBlob参照のまま。
     IDの計算は custom.js の検証・正規化と同じ関数を使う。分からないときは後続の削除をしない。 */
  async function backupPackId(zip, entry) {
    const custom = window.Trk.custom;
    if (!custom || typeof custom.packIdentityFromManifest !== "function" || entry.method !== 0 || typeof entry.start !== "number") return null;
    try {
      const packBlob = zip.file.slice(entry.start, entry.start + entry.csize);
      const inner = await Z.zipOpen(packBlob);
      const manifests = inner.entries.filter(e => !e.name.startsWith("__MACOSX/") && /(^|\/)pack\.json$/.test(e.name))
        .sort((a, b) => a.name.length - b.name.length);
      const manifestEntry = manifests[0];
      if (!manifestEntry) return null;
      await Z.zipVerifyEntry(inner, manifestEntry, MAX_META);
      const raw = JSON.parse(await (await Z.zipEntryBlob(inner, manifestEntry, MAX_META)).text());
      const identity = custom.packIdentityFromManifest(raw);
      return identity && typeof identity.id === "string" ? identity.id : null;
    } catch (_) { return null; }
  }
  async function restoreBackup(file, opts = {}) {
    const prepared = opts.info && opts.info.zip && opts.info.meta ? opts.info : await readBackupMeta(file);
    const { zip, meta } = prepared;
    /* 1) 全件の中身を確かめる（CRC・大きさ）。書く前に終えて、壊れた中身で途中まで書き換えないため。
       圧縮エントリはJSON等だけのはずなので、展開処理量にも固定上限を置く。 */
    for (const e of zip.entries) {
      const limit = e.name === "backup.json" ? MAX_META : e.name === "local.json" ? MAX_LS_VALUE :
        e.name.startsWith(DB_PREFIX) && e.name.endsWith(".json") || e.method === 8 ? MAX_DB_JSON : Infinity;
      if (e.usize > limit) throw new BackupError("backupHardLimit");
      try { await Z.zipVerifyEntry(zip, e, limit); }
      catch (_) { throw new BackupError("backupCorrupt"); }
    }
    /* 2) 読んで、書くものを用意する（まだ書かない）。blob の参照は同期で取れるよう先に位置を覚える。 */
    for (const e of zip.entries) if (e.method === 0 && (e.name.startsWith(BLOB_PREFIX) || e.name.startsWith(PACK_PREFIX))) {
      e.start = await Z.zipDataStart(zip, e);
    }
    const resolve = (name) => {
      const e = zip.byName.get(name);
      if (!e || !name.startsWith(BLOB_PREFIX) || e.method !== 0 || typeof e.start !== "number") throw new BackupError("backupCorrupt");
      return zip.file.slice(e.start, e.start + e.csize);
    };
    const plan = { ls:null, dbs:[] };
    if (meta.areas && meta.areas.core) {
      const le = zip.byName.get("local.json");
      if (le) {
        const j = JSON.parse(await (await Z.zipEntryBlob(zip, le, MAX_LS_VALUE)).text());
        const out = [];
        for (const [k, v] of Object.entries(j && j.items || {})) {
          if (LS_KEYS.includes(k) && typeof v === "string" && v.length <= MAX_LS_VALUE) out.push([k, v]);
        }
        const addonRow = out.find(row => row[0] === ADDONS_KEY);
        if (addonRow) addonRow[1] = disableRestoredAddons(addonRow[1]);
        plan.ls = out;
      }
    }
    const wanted = new Set();
    for (const spec of ALL_DBS) for (const s of spec.stores) wanted.add(`${spec.db}/${s}`);
    for (const e of zip.entries) {
      if (!e.name.startsWith(DB_PREFIX) || !e.name.endsWith(".json")) continue;
      const key = e.name.slice(DB_PREFIX.length, -".json".length);
      if (!wanted.has(key)) continue;   /* 知らない名前は読まない */
      const arr = JSON.parse(await (await Z.zipEntryBlob(zip, e, MAX_DB_JSON)).text());
      if (!Array.isArray(arr)) throw new BackupError("backupCorrupt");
      if (arr.length > MAX_RECORDS) throw new BackupError("backupHardLimit");
      const spec = ALL_DBS.find(d => key.startsWith(d.db + "/"));
      const store = key.slice(spec.db.length + 1);
      plan.dbs.push({ spec, store, arr, key });
    }
    const studyBooks = plan.dbs.filter(p => p.key === `${DB_STUDY.db}/books`).flatMap(p => p.arr);
    const studyPageBlobSizes = new Map();
    for (const p of plan.dbs) if (p.key === `${DB_STUDY.db}/pages`) for (const row of p.arr) {
      const key = decKey(row.k), ref = row.v && row.v.$blob;
      if (typeof ref !== "string") continue;
      const entry = zip.byName.get(ref);
      if (!ref.startsWith(BLOB_PREFIX) || !entry || entry.method !== 0 || !Number.isSafeInteger(entry.usize)) throw new BackupError("backupCorrupt");
      studyPageBlobSizes.set(key, entry.usize);
    }
    checkStudyLimits(studyBooks, studyPageBlobSizes);
    const wantsPacks = !!(meta.areas && meta.areas.packs);
    const packEntries = wantsPacks ? zip.entries.filter(e => e.name.startsWith(PACK_PREFIX) && e.name.endsWith(".stpack")) : [];
    const install = wantsPacks && window.Trk.custom && window.Trk.custom.installPackFile;
    const backupPackIds = new Set();
    let packInventoryKnown = !!(install && window.Trk.custom && typeof window.Trk.custom.packIdentityFromManifest === "function");
    if (packInventoryKnown) {
      for (const e of packEntries) {
        const id = await backupPackId(zip, e);
        if (!id) { packInventoryKnown = false; break; }
        backupPackIds.add(id);
      }
    }
    /* 曲・動画の合計上限も、どのDBにも書き込む前に確認する（途中まで復元してから拒否しない）。 */
    const songMediaPlan = plan.dbs.find(p => p.spec.db === "shadow_taiko_songs" && p.store === "files");
    if (songMediaPlan) checkMediaShelfLimit(songMediaPlan.arr.map(r => [decKey(r.k), decodeValue(r.v, resolve)]));
    /* 3) 書く。書斎は参照される側から（pages→covers→books、trk163・レビュー【低】③） */
    orderStudyStores(plan.dbs);
    for (const p of plan.dbs) {
      const pairs = p.arr.map(r => [decKey(r.k), decodeValue(r.v, resolve)]);
      const db = await openDb(p.spec, true);
      try { await replaceStore(db, p.store, pairs, (p.spec.skip && p.spec.skip[p.store]) || null); }
      finally { db.close(); }
    }
    if (plan.ls) {
      for (const k of LS_KEYS) { try { localStorage.removeItem(k); } catch (_) {} }
      for (const [k, v] of plan.ls) { try { localStorage.setItem(k, v); } catch (_) { throw new BackupError("backupRestoreFail"); } }
    }
    let packsOk = 0, packsFailed = 0, packsRemoved = 0;
    if (wantsPacks) {
      for (const e of packEntries) {
        const blob = e.method === 0 && typeof e.start === "number"
          ? zip.file.slice(e.start, e.start + e.csize) : await Z.zipEntryBlob(zip, e, MAX_DB_JSON);
        const r = install ? await install(new File([blob], e.name.split("/").pop(), { type:"application/zip" })) : null;
        if (r) {
          packsOk++;
          if (typeof r.id === "string") backupPackIds.add(r.id);
        } else packsFailed++;
      }
      /* 失敗したパックの既存IDは、バックアップに含まれる限り残す。全IDを確かめられた場合だけ、最後に不在IDを消す。 */
      if (packInventoryKnown) {
        const db = await openDb(DB_PACKS, true);
        try { packsRemoved = await deleteStoreExcept(db, "packs", backupPackIds); }
        finally { db.close(); }
      }
    }
    return { meta, packsOk, packsFailed, packsRemoved, packCleanupSkipped:wantsPacks && !packInventoryKnown };
  }
  function formatRestoreDetails(result) {
    const areas = result && result.meta && result.meta.areas;
    if (!areas || !areas.packs) return window.tr("backupRestorePacksNotIncluded");
    const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    const parts = [window.tr("backupRestorePackCounts", {
      ok:count(result.packsOk), failed:count(result.packsFailed), removed:count(result.packsRemoved),
    })];
    if (result.packsFailed > 0) parts.push(window.tr("backupRestorePackFailedKept"));
    if (result.packCleanupSkipped) parts.push(window.tr("backupRestorePackCleanupSkipped"));
    return parts.join("\n");
  }

  /* ---------- 画面 ---------- */
  const $ = (id) => document.getElementById(id);
  const stamp = (d) => { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  function say(key, vars) { try { core.setStatus("backupStatus", key, vars); } catch (_) {} }
  function sizeText(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : n >= 1048576 ? Math.round(n / 1048576) + " MB" : Math.round(n / 1024) + " KB"; }

  function setup() {
    const make = $("backupMakeBtn"), file = $("backupRestoreFile"), ignore = $("ignoreLimitsChk");
    if (!make || !file || !ignore) return;
    ignore.checked = core.storageLimitsIgnored();
    ignore.addEventListener("change", () => { core.settings.ignoreStorageLimits = ignore.checked; core.saveUserPrefs(); });
    make.addEventListener("click", async () => {
      make.disabled = true;
      try {
        say("backupMaking");
        const { blob, meta } = await buildBackup({
          study: $("backupAreaStudy").checked, packs: $("backupAreaPacks").checked, media: $("backupAreaMedia").checked,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `trk-backup-${stamp(new Date())}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        say("backupDone", { size: sizeText(blob.size), books: meta.counts.study.books, packs: meta.counts.packs });
      } catch (e) {
        console.error(e);
        say(e instanceof BackupError ? e.key : e && e.key === "zipLimit" ? "backupHardLimit" : "backupFail");
      } finally { make.disabled = false; }
    });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      let info;
      try { info = await readBackupMeta(f); }
      catch (error) { say(keyOfError(error)); return; }
      const m = info.meta;
      const date = (() => { const d = new Date(m.createdAt); return isNaN(d) ? "?" : d.toLocaleString(); })();
      const addons = info.addons || { known:false, count:0, names:[], omitted:0 };
      const addonCount = addons.known ? addons.count : window.tr("backupRestoreAddonCountUnknown");
      const addonNames = !addons.known ? window.tr("backupRestoreAddonListUnknown") : addons.count
        ? addons.names.join(", ") + (addons.omitted ? " " + window.tr("backupRestoreAddonMore", { n:addons.omitted }) : "")
        : window.tr("backupRestoreNoAddons");
      const ask = window.tr("backupRestoreAsk", {
        date, books:m.counts && m.counts.study ? m.counts.study.books : 0,
        packs:m.counts ? m.counts.packs || 0 : 0, media:m.counts ? m.counts.media || 0 : 0,
        addonCount, addonNames,
      });
      if (!confirm(ask)) return;
      say("backupRestoreWorking");
      try {
        const r = await restoreBackup(f, { info }), vars = { details:formatRestoreDetails(r) };
        say("backupRestoreDone", vars);
        /* 結果には導入失敗時の保護・prune見送りも含める。確認してから画面を反映する。 */
        window.alert(window.tr("backupRestoreDone", vars));
        location.reload();
      } catch (e) {
        console.error(e);
        say(keyOfError(e));
      }
    });
  }
  /* 画面に出すキー。ZIP の層の失敗は「壊れている・バックアップではない」にまとめる */
  function keyOfError(e) {
    if (e instanceof BackupError) return e.key;
    if (e && (e.key === "zipLimit" || e.key === "zipTooBig")) return "backupHardLimit";
    if (e && typeof e.key === "string" && e.key.startsWith("zip")) return "backupCorrupt";
    return "backupRestoreFail";
  }

  window.Trk.backup = Object.assign(window.Trk.backup || {}, {
    buildBackup, restoreBackup, readBackupMeta, readBackupAddonSummary, formatRestoreDetails, checkStudyLimits,
    summarizeAddonStore, disableRestoredAddons, encodeValue, decodeValue, encKey, decKey, encName, decName, LS_KEYS, BackupError,
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();

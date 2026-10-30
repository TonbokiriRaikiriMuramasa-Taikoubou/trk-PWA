// SPDX-License-Identifier: GPL-3.0-or-later
/* テスト用の IndexedDB（依存パッケージなし）。js/core.js の idbStore と js/media.js の解析キャッシュが使う範囲だけを実装する。
 *
 * 本物のブラウザの代わりではない。次の点だけを真似している：
 *   ・要求は1件ずつ、別のタスクで順番に実行される。要求の合間に promise の続きが走り、そこから次の要求を出せる
 *   ・要求がなくなったトランザクションは自動で完了する。abort すると、その中の書き込みを取り消す
 *   ・版数を上げるとき、閉じていない接続があれば onblocked。onversionchange で閉じれば先へ進む
 *   ・index には、その値が有効なキー（有限の数か文字列）の記録だけが載る（size を持たない記録は載らない）
 *   ・保存と読み出しは複製。typed array は指定した realm（vm の文脈）の型に作り直す（instanceof を合わせるため）
 *
 * 使うときは createFakeIndexedDB(realmOf(ctx)) の形で作る。 */
import vm from "node:vm";

const TYPED = ["Float32Array", "Float64Array", "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array"];

/* vm の文脈の typed array コンストラクタを集める（複製をその文脈の型にするため） */
export function realmOf(ctx) {
  return Object.fromEntries(TYPED.map(n => [n, vm.runInContext(n, ctx)]));
}

export function cloneInRealm(v, realm) {
  if (v === null || typeof v !== "object") return v;
  if (ArrayBuffer.isView(v)) { const C = realm && realm[v.constructor.name]; return C ? new C(v) : v.slice(); }
  if (Array.isArray(v)) return v.map(x => cloneInRealm(x, realm));
  const out = {};
  for (const k of Object.keys(v)) out[k] = cloneInRealm(v[k], realm);
  return out;
}

const validKey = k => (typeof k === "number" && Number.isFinite(k)) || typeof k === "string";
const cmpKey = (a, b) => {
  const ra = typeof a === "number" ? 0 : 1, rb = typeof b === "number" ? 0 : 1;
  if (ra !== rb) return ra - rb;
  return a < b ? -1 : a > b ? 1 : 0;
};
const later = fn => setTimeout(fn, 0);

export function createFakeIndexedDB(realm = null) {
  const dbs = new Map();   // 名前 → { name, version, stores: Map(名前 → store), conns: Set }
  const clone = v => cloneInRealm(v, realm);

  class Req {
    constructor() { this.result = undefined; this.error = null; this.onsuccess = null; this.onerror = null; }
  }

  function newStore(keyPath) { return { keyPath, records: new Map(), indexes: new Map() }; }
  const sortedKeys = store => [...store.records.keys()].sort(cmpKey);
  function indexEntries(store, idx) {
    const out = [];
    for (const [pk, v] of store.records) {
      const ik = v && typeof v === "object" ? v[idx.keyPath] : undefined;
      if (validKey(ik)) out.push({ ik, pk });
    }
    return out.sort((a, b) => cmpKey(a.ik, b.ik) || cmpKey(a.pk, b.pk));
  }

  class Tx {
    constructor(conn, mode) {
      this.conn = conn; this.mode = mode;
      this.queue = []; this.undo = [];
      this.done = false; this.scheduled = false; this.error = null; this.versionChange = false;
      this.oncomplete = null; this.onerror = null; this.onabort = null;
    }
    _kick() {
      if (this.scheduled || this.done) return;
      this.scheduled = true;
      later(() => this._step());
    }
    _step() {
      this.scheduled = false;
      if (this.done) return;
      const op = this.queue.shift();
      if (op) { this._exec(op); this._kick(); return; }
      this._finish();
    }
    _exec(fn) {
      try { fn(); } catch (e) { this._fail(e); }
    }
    _fail(e) {
      if (this.done) return;
      this.error = e;
      if (this.onerror) this.onerror({ target: this });
      this.abort();
    }
    _finish() {
      this.done = true;
      if (this.oncomplete) this.oncomplete({ target: this });
    }
    abort() {
      if (this.done) throw new Error("InvalidStateError: transaction finished");
      this.done = true;
      this.error = this.error || new Error("AbortError: transaction aborted");
      for (let i = this.undo.length - 1; i >= 0; i--) this.undo[i]();
      this.queue = [];
      later(() => { if (this.onabort) this.onabort({ target: this }); });
    }
    _req(fn) {
      const req = new Req();
      this.queue.push(() => {
        const r = fn();
        req.result = r;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      this._kick();
      return req;
    }
    _store(name) {
      const store = this.conn._rec.stores.get(name);
      if (!store) throw new Error("NotFoundError: object store " + name);
      return store;
    }
    objectStore(name) {
      const store = this._store(name), tx = this;
      const writable = () => { if (tx.mode === "readonly") throw new Error("ReadOnlyError"); };
      const keyFor = (value, key) => {
        if (store.keyPath) {
          if (key !== undefined) throw new Error("DataError: key given with keyPath");
          const k = value && value[store.keyPath];
          if (!validKey(k)) throw new Error("DataError: no valid key at keyPath");
          return k;
        }
        if (!validKey(key)) throw new Error("DataError: invalid key");
        return key;
      };
      const write = (pk, value) => {
        writable();
        const had = store.records.has(pk), prev = had ? store.records.get(pk) : undefined;
        tx.undo.push(() => { if (had) store.records.set(pk, prev); else store.records.delete(pk); });
        store.records.set(pk, clone(value));
        return pk;
      };
      const remove = pk => {
        writable();
        if (!store.records.has(pk)) return undefined;
        const prev = store.records.get(pk);
        tx.undo.push(() => store.records.set(pk, prev));
        store.records.delete(pk);
        return undefined;
      };
      const cursor = keysOf => {
        const req = new Req();
        let keys = [], i = 0;
        const emit = () => {
          if (i >= keys.length) { req.result = null; if (req.onsuccess) req.onsuccess({ target: req }); return; }
          const pk = keys[i];
          req.result = {
            primaryKey: pk, key: pk,
            get value() { return clone(store.records.get(pk)); },
            update: v => tx._req(() => write(pk, v)),
            delete: () => tx._req(() => remove(pk)),
            continue: () => { i++; tx.queue.push(() => tx._exec(emit)); tx._kick(); },
          };
          if (req.onsuccess) req.onsuccess({ target: req });
        };
        tx.queue.push(() => { keys = keysOf(); emit(); });
        tx._kick();
        return req;
      };
      const indexHandle = idxName => {
        const idx = store.indexes.get(idxName);
        if (!idx) throw new Error("NotFoundError: index " + idxName);
        return {
          /* 仕様どおり：getAllKeys は主キーを返す */
          getAllKeys: () => tx._req(() => indexEntries(store, idx).map(e => e.pk)),
          /* 仕様どおり：openKeyCursor の cursor.key は索引の値、cursor.primaryKey は主キー */
          openKeyCursor: () => {
            const req = new Req();
            let entries = [], i = 0;
            const emit = () => {
              if (i >= entries.length) { req.result = null; if (req.onsuccess) req.onsuccess({ target: req }); return; }
              const e = entries[i];
              req.result = { key: e.ik, primaryKey: e.pk, continue: () => { i++; tx.queue.push(() => tx._exec(emit)); tx._kick(); } };
              if (req.onsuccess) req.onsuccess({ target: req });
            };
            tx.queue.push(() => { entries = indexEntries(store, idx); emit(); });
            tx._kick();
            return req;
          },
        };
      };
      return {
        name,
        keyPath: store.keyPath,
        get: k => tx._req(() => { const v = store.records.get(k); return v === undefined ? undefined : clone(v); }),
        put: (value, key) => { const pk = keyFor(value, key); return tx._req(() => write(pk, value)); },
        delete: k => tx._req(() => remove(k)),
        getAll: () => tx._req(() => sortedKeys(store).map(k => clone(store.records.get(k)))),
        getAllKeys: () => tx._req(() => sortedKeys(store)),
        count: () => tx._req(() => store.records.size),
        openCursor: () => cursor(() => sortedKeys(store)),
        index: idxName => indexHandle(idxName),
        indexNames: { contains: n => store.indexes.has(n) },
        createIndex: (idxName, keyPath) => { store.indexes.set(idxName, { keyPath }); return indexHandle(idxName); },
      };
    }
  }

  function makeConn(rec) {
    const conn = {
      name: rec.name, closed: false, onversionchange: null, _rec: rec,
      objectStoreNames: { contains: n => rec.stores.has(n) },
      transaction(names, mode = "readonly") {
        if (conn.closed) throw new Error("InvalidStateError: connection closed");
        const list = Array.isArray(names) ? names : [names];
        for (const n of list) if (!rec.stores.has(n)) throw new Error("NotFoundError: " + n);
        return new Tx(conn, mode);
      },
      createObjectStore(name, opts = {}) {
        const store = newStore(opts.keyPath);
        rec.stores.set(name, store);
        return { name, createIndex: (idxName, keyPath) => { store.indexes.set(idxName, { keyPath }); } };
      },
      close() { conn.closed = true; rec.conns.delete(conn); },
    };
    return conn;
  }

  const indexedDB = {
    open(name, version = 1) {
      const req = new Req();
      later(() => {
        const existing = dbs.get(name);
        const rec = existing || { name, version: 0, stores: new Map(), conns: new Set() };
        if (version < rec.version) {
          req.error = new Error("VersionError");
          if (req.onerror) req.onerror({ target: req });
          return;
        }
        if (version > rec.version) {
          for (const c of [...rec.conns]) {
            if (c.onversionchange) c.onversionchange({ target: c, newVersion: version });
          }
          if ([...rec.conns].some(c => !c.closed)) {
            if (req.onblocked) req.onblocked({ target: req });
            return;
          }
          const oldVersion = rec.version;
          rec.version = version;
          dbs.set(name, rec);
          const conn = makeConn(rec);
          rec.conns.add(conn);
          const utx = new Tx(conn, "versionchange");
          utx.versionChange = true;
          req.result = conn;
          req.transaction = utx;
          utx.oncomplete = () => { if (req.onsuccess) req.onsuccess({ target: req }); };
          if (req.onupgradeneeded) req.onupgradeneeded({ target: req, oldVersion, newVersion: version });
          utx._kick();
          return;
        }
        const conn = makeConn(rec);
        rec.conns.add(conn);
        dbs.set(name, rec);
        req.result = conn;
        if (req.onsuccess) req.onsuccess({ target: req });
      });
      return req;
    },
  };

  return { indexedDB, dbs };
}

// SPDX-License-Identifier: GPL-3.0-or-later
/* 📂 共有フォルダーの共通部品（trk208）
   「📤 ミュージックフォルダの共有」（trk194）で確かめたやり方を、動画フォルダと書斎の画像フォルダにも広げるための部分。
   ・許可（queryPermission / requestPermission）は**クリックの中でしか確認を出せない**（ブラウザーの決まり・trk194）
   ・フォルダーのハンドルは IndexedDB に構造化複製で保存できる（複数持てる）
   ・ここは DOM も IndexedDB も触らない。純関数（plan / uniqueLabel / mergeScans）と、フォルダーを歩く walk だけ。
   ⚠ 曲も画像も端末の外へ送りません（読むだけ。書き込みはしません）。 */
"use strict";

window.TrkSharedFolders = (() => {
  const MAX_DEPTH = 8;          /* 深すぎるフォルダーで止まる（共有は「一気に全部」が売りなので広め） */
  const MAX_FILES = 3000;       /* 1つのフォルダーから拾う上限（曲リストの LIB_MAX とそろえる） */
  const MAX_IMAGES = 5000;      /* 書斎の画像は1冊あたりの上限と別に、フォルダー全体の歯止め */

  /* 拡張子（小文字・ドットなし）。名前が空なら "" */
  function extOf(name) {
    const leaf = String(name || "").split(/[\\/]/).pop() || "";
    const dot = leaf.lastIndexOf(".");
    return dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
  }

  /* 🔓 覚えているフォルダーを起動時にどう扱うか（trk194 と同じ意味。folders は「1本」ではなく「一覧」ぶん見る）
     "scan" … 許可が生きている＝そのまま読み取る（クリック不要）
     "ask"  … 確認が必要＝最初のタップ（クリック）の中で1回だけ requestPermission する
     "none" … 何もしない（設定オフ・セーフモード・許可が拒否済み・覚えたフォルダーが無い） */
  function plan(st) {
    if (!st || !st.hasHandle) return "none";
    if (st.safe || st.autoRead === false) return "none";
    if (st.permission === "denied") return "none";
    if (st.permission === "granted") return "scan";
    return "ask";
  }

  /* 同じ名前のフォルダーを2つ共有しても、取り込み先（曲の dir・本の名前）が混ざらないようにする。
     taken は今まで使った名前の配列。空いた名前を返す（"Music" → "Music (2)" → "Music (3)"）。 */
  function uniqueLabel(taken, name) {
    const base = String(name || "").trim() || "Folder", used = new Set(taken || []);
    if (!used.has(base)) return base;
    for (let n = 2; n < 1000; n++) { const candidate = `${base} (${n})`; if (!used.has(candidate)) return candidate; }
    return `${base} (${used.size + 1})`;
  }

  /* 複数フォルダーの走査結果を、1本の取り込みリストにまとめる。
     scans = [{ name, files:[{ file, rel }], skipped }]（rel はフォルダー名から始まる相対パス）
     ・同じ名前のフォルダーがあっても、先頭のフォルダー名だけ差し替えて衝突を避ける
     ・skipped は合計する（「対象外が何件あったか」を出すため） */
  function mergeScans(scans) {
    const files = [], labels = [];
    let skipped = 0;
    for (const scan of Array.isArray(scans) ? scans : []) {
      if (!scan) continue;
      const root = String(scan.name || "").replace(/^\/+|\/+$/g, "") || "Folder";
      const label = uniqueLabel(labels, root);
      labels.push(label);
      skipped += Math.max(0, Number(scan.skipped) || 0);
      for (const item of Array.isArray(scan.files) ? scan.files : []) {
        if (!item || !item.file) continue;
        const rel = String(item.rel || item.file.name || "");
        const tail = rel === root ? String(item.file.name || "") : rel.slice(root.length);
        files.push({ file:item.file, rel: label + (tail.startsWith("/") ? tail : `/${tail.replace(/^\/+/, "")}`) });
      }
    }
    return { files, skipped, labels, label:labels.join("・") };
  }

  /* フォルダーの中を歩いて、accept(name) が true のファイルを集める。
     ・read:true（既定）… File を読む（曲・動画はサイズや中身が要る）
     ・read:false      … 名前とパスだけ（書斎の画像は開くときに読むので、起動時の走査を軽くする）
     ・onProgress(n)   … 見つけた件数（大きなフォルダーでも待てるように）
     戻り値 { entries:[{ name, path, size, file?, fileHandle? }], skipped } */
  async function walk(handle, opts = {}) {
    const accept = typeof opts.accept === "function" ? opts.accept : () => true;
    const read = opts.read !== false, maxFiles = Math.max(1, Number(opts.maxFiles) || MAX_FILES);
    const maxDepth = Number.isFinite(opts.maxDepth) ? Number(opts.maxDepth) : MAX_DEPTH;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    const entries = [];
    let skipped = 0;
    async function visit(dir, path, depth) {
      if (depth > maxDepth || entries.length >= maxFiles) return;
      for await (const entry of dir.values()) {
        if (entries.length >= maxFiles) return;
        if (entry.kind === "file") {
          if (!accept(entry.name)) { skipped++; continue; }
          try {
            const file = read ? await entry.getFile() : null;
            entries.push({ name:entry.name, path:`${path}/${entry.name}`.replace(/^\/+/, ""),
              size:file ? Number(file.size) || 0 : 0, file, fileHandle:read ? null : entry });
          } catch (_) { skipped++; continue; }
          if (onProgress && !(entries.length % 25)) onProgress(entries.length);
        } else if (entry.kind === "directory" && !entry.name.startsWith(".")) {
          await visit(entry, `${path}/${entry.name}`.replace(/^\/+/, ""), depth + 1);
        }
      }
    }
    await visit(handle, String(handle.name || ""), 0);
    return { entries, skipped, truncated:entries.length >= maxFiles };
  }

  /* "a/b/c.jpg" → ["a","b","c.jpg"]（.. や空の要素は捨てる＝フォルダーの外へは出ない） */
  function pathParts(path) {
    return String(path || "").replace(/\\/g, "/").split("/").map(part => part.trim()).filter(part => part && part !== "." && part !== "..");
  }

  /* パスのファイルをフォルダーのハンドルから読む（書斎の「フォルダーのまま読む本」用）。
     途中のフォルダーが消えていたら null（本棚側で「読み込めません」を出す）。 */
  async function readFileAt(handle, path) {
    const parts = pathParts(path);
    const name = parts.pop();
    if (!handle || !name) return null;
    /* 走査のパスは「フォルダー名から始まる」（walk も library.js の scanHandle も同じ）。
       そのままフォルダーに辿ると1階層ずれるので、先頭がフォルダー名なら外す。 */
    if (parts.length && parts[0] === String(handle.name || "")) parts.shift();
    let dir = handle;
    try {
      for (const part of parts) dir = await dir.getDirectoryHandle(part);
      const fileHandle = await dir.getFileHandle(name);
      return await fileHandle.getFile();
    } catch (_) { return null; }
  }

  return Object.freeze({ MAX_DEPTH, MAX_FILES, MAX_IMAGES, extOf, plan, uniqueLabel, mergeScans, walk, pathParts, readFileAt });
})();

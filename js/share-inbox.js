// SPDX-License-Identifier: GPL-3.0-or-later
/* ============================================================================
   trk! share-inbox.js — 📥 OSの共有／「このアプリで開く」の受け口（trk165）
   ・share_target（Android Chrome等）：Service Worker（sw.js の handleShareTarget）が
     POSTで受け取ったファイルを CacheStorage「trk-share-inbox-v1」に一時保存する。
     ここは起動時にそれを読んで、**既存の取り込み経路**へ渡すだけ：
       曲 → Trk.library.addSongFiles ／ 動画 → Trk.library.addVideoFiles
       CBZ・ZIP → Trk.study.importArchives（pack.json が入った ZIP はパック扱い）
       .stpack → Trk.custom.installAndUse
     検証・上限はすべて既存経路が持つ＝新しい入口を作らない（PLAYER-ROADMAP #5 の方針）。
   ・file_handlers（デスクトップ）：launchQueue で File を直接受け取り、同じ振り分けへ。
   ・ファイルは端末から出さない（外部通信ゼロ。title/text/url の共有フィールドは無視）。
   ============================================================================ */
"use strict";
(() => {
  const core = window.Trk.core;

Object.assign(TEXT.ja, {
  shareInboundNone:"📥 共有されたファイルを受け取れませんでした",
  shareInboundError:"📥 共有されたファイルを受け取れませんでした（もう一度お試しください）",
  shareInboundUnsupported:"📥 受け取れないファイル：{names}",
  shareInboundAsk:"📥 共有で届いたファイルを trk! に取り込みますか？（{n}件：{names}）\n\n共有の受け口は、ほかのサイトからも送り込めます。自分で共有した覚えがなければ「キャンセル」を押してください。"
});
Object.assign(TEXT.en, {
  shareInboundNone:"📥 No shared files could be received",
  shareInboundError:"📥 Shared files could not be received. Please try again",
  shareInboundUnsupported:"📥 Not accepted: {names}",
  shareInboundAsk:"📥 Add the shared files to trk!? ({n}: {names})\n\nOther websites can also send files to this share target. If you did not share them yourself, choose Cancel."
});
Object.assign(TEXT.zh, {
  shareInboundNone:"📥 未能接收到分享的文件",
  shareInboundError:"📥 未能接收到分享的文件（请重试）",
  shareInboundUnsupported:"📥 无法接收的文件：{names}",
  shareInboundAsk:"📥 要将分享来的文件导入 trk! 吗？（{n} 个：{names}）\n\n其他网站也可以向这个分享入口发送文件。如果不是你自己分享的，请选择“取消”。"
});
Object.assign(TEXT.ko, {
  shareInboundNone:"📥 공유된 파일을 받지 못했습니다",
  shareInboundError:"📥 공유된 파일을 받지 못했습니다(다시 시도해 주세요)",
  shareInboundUnsupported:"📥 받을 수 없는 파일: {names}",
  shareInboundAsk:"📥 공유된 파일을 trk!에 가져올까요? ({n}개: {names})\n\n다른 웹사이트도 이 공유 입구로 파일을 보낼 수 있습니다. 직접 공유한 기억이 없다면 '취소'를 누르세요."
});

const SHARE_CACHE = "trk-share-inbox-v1";
const PACK_JSON_RE = /(^|\/)pack\.json$/;   /* custom.js の installPackFileSerial と同じ探し方 */

function shareToast(key, vars) {
  if (typeof showToast === "function") window.Trk.play.showToast(tr(key, vars));
}
function shareInboxPrefix() {
  try { return new URL("share-inbox/", document.baseURI).pathname; } catch (_) { return ""; }
}
/* Confirmation text is a UI surface: keep untrusted file names short and remove controls/bidi overrides. */
function shareDisplayName(name) {
  const clean = String(name || "").replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return Array.from(clean).slice(0, 80).join("") || "shared-file";
}
/* 振り分け（純関数）。拡張子を正とし、動画だけ MIME でも拾う（addVideoFiles の受理条件と同じ）。
   音声系は MIME だけ（拡張子が対応表に無い）だと addSongFiles が黙って落とすため、
   こちらで「受け取れない」と正直に返す。 */
function classifyInboundFile(name, type) {
  const ext = core.extOf(String(name || ""));
  const mime = String(type || "").toLowerCase();
  const lib = window.Trk.library || {};
  const media = Array.isArray(lib.MEDIA_EXT) ? lib.MEDIA_EXT : [];
  const video = Array.isArray(lib.VIDEO_EXT) ? lib.VIDEO_EXT : [];
  if (ext === "stpack") return "pack";
  if (ext === "cbz") return "book";
  if (ext === "zip") return "zip";   /* パックか書斎か：pack.json の有無で決める（routeInboundFiles 内で判定） */
  if (video.includes(ext) || mime.startsWith("video/")) return "video";
  if (media.includes(ext)) return "audio";
  return "unsupported";
}
/* ZIP の中に pack.json があるかだけを見る（振り分け専用ののぞき見。検証は既存のインストーラが行う）。
   壊れた ZIP は false → 書斎側へ回し、既存のエラー案内（studyArchiveBad 等）を出させる。 */
async function zipLooksLikePack(file) {
  try {
    const zipIO = window.Trk.zipIO;
    if (!zipIO || typeof zipIO.zipOpen !== "function") return false;
    const zip = await zipIO.zipOpen(file);
    return (zip.entries || []).some(entry => PACK_JSON_RE.test(entry.name));
  } catch (_) { return false; }
}
async function routeInboundFiles(files) {
  const groups = { audio:[], video:[], book:[], pack:[], unsupported:[] };
  for (const file of files || []) {
    if (!file) continue;
    let kind = classifyInboundFile(file.name, file.type);
    if (kind === "zip") kind = await zipLooksLikePack(file) ? "pack" : "book";
    groups[kind].push(file);
  }
  if (groups.unsupported.length) {
    /* 先頭3件まで名前を出し、残りは件数だけ（core.js の Import 報告と同じ作法） */
    const names = groups.unsupported.map(f => f.name).slice(0, 3).join(", ") +
      (groups.unsupported.length > 3 ? ` …+${groups.unsupported.length - 3}` : "");
    shareToast("shareInboundUnsupported", { names });
  }
  /* 重い検証の順に：パック → 書斎 → 曲 → 動画（動画は全画面ビューアが開くことがあるので最後に） */
  const custom = window.Trk.custom || {};
  for (const file of groups.pack) {
    if (typeof custom.installAndUse !== "function") { groups.unsupported.push(file); continue; }
    try { await custom.installAndUse(file); } catch (err) { console.error("[share] pack:", err); }
  }
  if (groups.book.length && window.Trk.study && typeof window.Trk.study.importArchives === "function") {
    try { await window.Trk.study.importArchives(groups.book); } catch (err) { console.error("[share] books:", err); }
  }
  if (groups.audio.length) {
    try { await window.Trk.library.addSongFiles(groups.audio); } catch (err) { console.error("[share] songs:", err); }
  }
  if (groups.video.length) {
    try { await window.Trk.library.addVideoFiles(groups.video); } catch (err) { console.error("[share] videos:", err); }
  }
  return groups;
}
/* Service Worker の一時置き場（CacheStorage）を読んで File に戻す → 振り分け → 消す。
   読み出しに失敗したファイルも消す（無限の再処理ループにしないため）。
   失敗の案内は既存経路のものに任せる＝ここでは新しい検証をしない。 */
async function drainShareInbox() {
  if (typeof caches === "undefined") return 0;
  const prefix = shareInboxPrefix();
  if (!prefix) return 0;
  let cache;
  try { cache = await caches.open(SHARE_CACHE); } catch (_) { return 0; }
  let keys;
  try { keys = await cache.keys(); } catch (_) { return 0; }
  const inbox = keys.filter(req => { try { return new URL(req.url).pathname.startsWith(prefix); } catch (_) { return false; } });
  if (!inbox.length) return 0;
  const files = [];
  for (const req of inbox) {
    try {
      const res = await cache.match(req);
      if (!res) continue;
      const blob = await res.blob();
      let name = "";
      try { name = decodeURIComponent(res.headers.get("X-Share-Name") || ""); } catch (_) {}
      files.push(new File([blob], name || "shared-file", { type: blob.type || res.headers.get("Content-Type") || "" }));
    } catch (err) { console.error("[share] inbox read:", err); }
  }
  try { for (const req of inbox) await cache.delete(req); } catch (_) {}
  if (!files.length) return 0;
  /* share_target はただの POST の受け口なので、ほかのサイトのフォームからも届く（ブラウザは送り元を区別しない）。
     取り込む自由はそのままに、取り込む前に「何が・何件」を見せて利用者が決める（trk177・レビュー：信頼境界の明示）。
     launchQueue（OSの「このアプリで開く」）は利用者の操作そのものなので尋ねない。 */
  const names = files.map(f => shareDisplayName(f.name)).slice(0, 3).join(", ") + (files.length > 3 ? ` …+${files.length - 3}` : "");
  let ok = false;
  try { ok = typeof confirm === "function" && confirm(tr("shareInboundAsk", { n: files.length, names })); } catch (_) { ok = false; }
  if (!ok) return -1;   /* 断った：中身は上で消してある。「受け取れなかった」の案内も出さない */
  try { await routeInboundFiles(files); } catch (err) { console.error("[share] route:", err); }
  return files.length;
}
function shareStartup() {
  const params = new URLSearchParams(location.search);
  const shared = params.get("shared");
  /* ?shared=… は合図だけなので、処理の前に URL を掃除しておく（リロードで何度も案内しない） */
  if (shared && typeof history !== "undefined" && history.replaceState) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) {}
  }
  drainShareInbox().then(count => {
    if (count) return;   /* 取り込んだ（>0）／断った（-1） */
    if (shared === "empty" || shared === "partial") shareToast("shareInboundNone");
    else if (shared === "error") shareToast("shareInboundError");
  }).catch(err => {
    console.error("[share] inbox:", err);
    if (shared) shareToast("shareInboundError");
  });
}
/* 🖥 file_handlers（デスクトップの「このアプリで開く」）：launchQueue が File ハンドルを届ける。
   consumer の登録はすぐに済ませる（登録前の起動イベントはキューされる） */
if ("launchQueue" in window && window.launchQueue && typeof window.launchQueue.setConsumer === "function") {
  window.launchQueue.setConsumer(async launchParams => {
    const files = [];
    for (const handle of (launchParams && launchParams.files) || []) {
      try { if (handle && typeof handle.getFile === "function") files.push(await handle.getFile()); } catch (err) { console.error("[share] launch file:", err); }
    }
    if (files.length) { try { await routeInboundFiles(files); } catch (err) { console.error("[share] launch route:", err); } }
  });
}
/* 取り込みはアプリの初期化（ライブラリ・書斎・パックのDB）が終わってから＝load のあとで */
if (document.readyState === "complete") setTimeout(shareStartup, 0);
else addEventListener("load", () => setTimeout(shareStartup, 0), { once: true });

window.TrkShareInbox = Object.freeze({ classifyInboundFile, zipLooksLikePack, routeInboundFiles, drainShareInbox, SHARE_CACHE });
})();
/* ✅ share-inbox.js 完了 */

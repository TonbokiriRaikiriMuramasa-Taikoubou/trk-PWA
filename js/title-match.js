// SPDX-License-Identifier: GPL-3.0-or-later
/* ============ trk! 曲名の照合（純関数）============
   js/library.js から切り出した。曲名・メモの表記ゆれ（区切り・番号・別表記）を照合キーに直す部分だけで、
   ブラウザのグローバル（settings・metaOf など）には触らない。node --test（tests/title-match.test.mjs）から同じ関数を検査する。
   読み込み順：library.js より前（index.html）。plWishMatch（曲の当たりを付ける部分）は library.js に残す。
   ⚠ 関数名は classic script の共有スコープに載る。library.js と重ならないよう pl 接頭辞を保つこと。 */
/* 曲名の正規化（大文字小文字・前後と連続する空白）。照合キーの土台 */
const plNormTitle = t => String(t || "").trim().toLowerCase().replace(/\s+/g, " ");
/* 作品番号や形式名がある見出しは、曲全体で照合する。作品名だけ／楽章名だけへの
   分割は別作品・別楽章を拾うので禁止（通常の「キャラ名 - 曲名」は従来どおり）。 */
function plIsClassicalTitle(t) {
  t = String(t || "").replace(/_/g, " ");
  return /(?:^|\W)(?:symphony|sonata|concerto|quartet|quintet|nocturne|étude|etude|rhapsody)\b|\b(?:op|bwv|kv|rv)\.?\s*\d/i.test(t) ||
    /(?:^|\s[-–—]\s*)[ivxlcdm]+\.\s+\S/i.test(t);
}
/* クラシックの表記だけを揃える。調・作品番号・楽章・副題は削らない。
   対応の根拠が必要な「短い紹介名 ↔ 配布名」は matchAliases に置く。 */
function plClassicalTitleKey(t) {
  return plNormTitle(t).replace(/_/g, " ")
    .replace(/\.(?:mp3|wav|ogg|oga|opus|flac|fla|m4a|aac|aif|aiff|mid|midi)$/i, "")
    .replace(/\b(no|op|bwv|kv|rv|k|s)\.?\s*(?=\d)/g, "$1 ")
    .replace(/[.,_:;\-–—\u30FB\uFF65\uFF0F/]+/g, " ")
    .replace(/\s+/g, " ").trim()
    .replace(/\bin ([a-g])m\b/g, "in $1 minor")
    .replace(/^(?:vol\s*)?\d{1,3}\s+/, "");
}
/* 曲名の照合キー。ファイル名は「08_sometimes.fla」、カタログは「08 sometimes」のように
   区切りが違うことが多いので、厳しい順に候補を作って照合する（先頭＝そのまま）。 */
function plTitleKeys(t) {
  const out = [];
  const base = plNormTitle(t);
  if (!base) return out;
  out.push(base);
  /* .67 は拡張子ではなく Op.67 の番号かもしれないので、数字だけの末尾は残す。 */
  const noExt = base.replace(/\.[a-z][a-z0-9]{0,4}$/, "");
  const sep = noExt.replace(/[._\-\u30FB\uFF65\uFF0F\/]+/g, " ").replace(/\s+/g, " ").trim();
  if (sep && !out.includes(sep)) out.push(sep);
  /* 「24/7」↔「247」（Daily Routine 24/7 ↔ Daily Routine 247）の表記ゆれを吸収する。 */
  if (/\b24\s*[/\uFF0F]\s*7\b/.test(noExt)) {
    const compact = noExt.replace(/\b24\s*[/\uFF0F]\s*7\b/g, "247").replace(/[._\-\u30FB\uFF65\uFF0F\/]+/g, " ").replace(/\s+/g, " ").trim();
    if (compact && !out.includes(compact)) out.push(compact);
  }
  const noNum = sep.replace(/^(?:vol\.?\s*)?\d{1,3}\s+/, "");   /* 「08 sometimes」→「sometimes」 */
  if (noNum && !out.includes(noNum)) out.push(noNum);
  if (plIsClassicalTitle(base)) {
    const classical = plClassicalTitleKey(base);
    if (classical && !out.includes(classical)) out.push(classical);
  }
  return out;
}
/* 装飾を外した一致は通常の曲名と区別する。共有プレイリストの照合には使わず、
   plWishMatch の最後で候補が一意な場合だけ採用する（表示名・元ファイルはそのまま）。 */
const PL_DECORATED_PREFIX = "\u0001decorated:";
function plDecoratedTitleKeys(title) {
  const bare = String(title || "").trim().replace(/\.(?:mp3|wav|ogg|oga|opus|flac|fla|m4a|aac|aif|aiff|mid|midi)$/i, "");
  const clean = bare
    .replace(/^(?:(?:【\s*高音質\s*】|\[\s*(?:hq|high quality)\s*\]|🎧\uFE0F?)\s*)+/i, "")
    .replace(/^theme\s+\d{1,4}\s*[-–—:]\s*(?=\S)/i, "").trim();
  if (!clean || clean === bare) return [];
  // by以下・版・編曲名・未知の括弧は一切削らない。
  return plTitleKeys(clean).map(key => PL_DECORATED_PREFIX + key);
}
function plWishDecoratedKeys(wish) {
  const title = typeof wish === "string" ? wish : (wish && wish.t) || "";
  const aliases = wish && Array.isArray(wish.matchAliases) ? wish.matchAliases.slice(0, 8) : [];
  const artist = wish && typeof wish.ar === "string" ? wish.ar.trim() : "";
  const out = new Set();
  for (const t of [title, ...aliases]) {
    if (!plNormTitle(t)) continue;
    // 信頼するカタログ側から完全なクレジットを作る。ローカル名のbyを推測で切らない。
    for (const text of artist ? [t, `${t} by ${artist}`] : [t]) {
      for (const key of plTitleKeys(text)) out.add(PL_DECORATED_PREFIX + key);
    }
  }
  return [...out];
}
/* 「曲名 - JP Ver.」等は左右に分けると、版違いや「JP Ver.」だけのファイルを拾う。
   版らしい語を含む見出しでは部分一致を止める。版の情報そのものは正規化で削らない。 */
function plHasVersionTag(title) {
  return /\b(?:jp|cn|en|kr|ver(?:sion)?|short|instrumental|off[\s-]*vocal|karaoke|remix|cover|live|arrange(?:ment)?)\b/i.test(title);
}
/* 媒体を指定したカタログ項目だけ、音源とPVを取り違えないようにする。
   動画取込で確認したflag、実FileのMIME、実ファイル名の順。曲の表示名からは推測しない。
   ファイル内容を検証するものではない（未知の媒体は自動照合しない）。 */
function plWishMediaMatches(wish, item) {
  const want = wish && wish.matchMedia;
  if (want !== "audio" && want !== "video") return true;
  const file = item && item.file;
  const mime = String(file && file.type || "").toLowerCase();
  const name = String(file && file.name || "").toLowerCase();
  const kind = item && item.video === true ? "video"
    : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio"
      : /\.(?:mp4|m4v|mov|webm|mkv|avi|ogv|3gp|mpg|mpeg|mpe|m2v|m2ts)$/.test(name) ? "video"
        : /\.(?:mp3|m4a|aac|ogg|oga|opus|wav|flac|fla|aif|aiff|mid|midi)$/.test(name) ? "audio" : "";
  return kind === want;
}
/* 曲プロフィールの照合メモは表示タイトルに混ぜず、メモ単独と「メモ - 曲名」の候補を足す。
   例：タイトル BELIEVE ＋ メモ Suguri → カタログの Suguri - BELIEVE に一致 */
function plSongMatchKeys(title, matchHint) {
  const out = plTitleKeys(title);
  for (const key of plDecoratedTitleKeys(title)) if (!out.includes(key)) out.push(key);
  const hint = String(matchHint || "").trim().slice(0, 80);
  if (!hint) return out;
  /* メモ単独／「メモ - 曲名」の両方を候補にする。カタログ照合は片方だけでも拾える。 */
  for (const key of plTitleKeys(hint)) if (!out.includes(key)) out.push(key);
  for (const key of plTitleKeys(`${hint} - ${title}`)) if (!out.includes(key)) out.push(key);
  return out;
}
function plWishTitleKeys(wish) {
  const title = typeof wish === "string" ? wish : (wish && wish.t) || "";
  const out = plTitleKeys(title);
  /* 「キャラ名 - 曲名」のカタログ見出しは、左右どちらかだけの一致も許す。 */
  const parts = String(title || "").split(/\s+[-–—]\s+/).filter(Boolean);
  if (parts.length > 1 && !plIsClassicalTitle(title) && !plHasVersionTag(title)) for (const part of parts) {
    for (const key of plTitleKeys(part)) if (!out.includes(key)) out.push(key);
  }
  /* 公式名と配布ファイル名が異なる場合だけ、データ側の別表記も照合候補に加える。 */
  if (wish && typeof wish === "object" && Array.isArray(wish.matchAliases)) {
    for (const alias of wish.matchAliases.slice(0, 8)) {
      for (const key of plTitleKeys(alias)) if (!out.includes(key)) out.push(key);
    }
  }
  return out;
}

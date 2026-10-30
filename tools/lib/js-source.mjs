// SPDX-License-Identifier: GPL-3.0-or-later
/* 静的検査が js/ の本文を読むときの共通の処理。
 *
 * 各 IIFE は `const core = window.Trk.core;` という別名を先頭に置き、本文では `core.X` と書く
 * （名前空間の読みやすさのため。HANDOFF §2.3）。検査は「window.Trk.core.X という綴りがあるか」で
 * 配線を見ているので、読むときに別名を元の綴りへ戻す。戻すのは同じファイルの別名だけで、
 * 文字列の "core.js" や window.Trk.core.X（別名なし）には触れない。 */

const ALIAS_LINE = /^[ \t]*const core = window\.Trk\.core;[ \t]*\n/m;

export function restoreCoreAlias(text) {
  if (!ALIAS_LINE.test(text)) return text;
  return text.replace(ALIAS_LINE, "").replace(/(?<=^|[^\w$.]|\.\.\.)core\.(?!js\b)(?=[A-Za-z_$])/gm, "window.Trk.core.");
}

/* rel が js/ のファイルなら別名を戻す。それ以外はそのまま */
export function sourceOf(rel, text) {
  return rel.startsWith("js/") ? restoreCoreAlias(text) : text;
}

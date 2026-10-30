// SPDX-License-Identifier: GPL-3.0-or-later
/* 🧪 テスト用の、ちいさな CSS の読み取り（trk223）

   目的は「規則として確かめる」こと。文字列 `includes` ではなく、
   css ファイルから規則を取り出し、要素（親の並び）に当てて、カスケードで勝つ値を出します。
   対応しているもの：タグ・#id・.class・[attr]・[attr="値"]・:not()・子孫（空白）・子（>）。
   `@media` の中の規則は、`allowMedia` を渡したときだけ当てます（既定は当てない）。

   ブラウザの実装ではありません。テストで使う規則の形だけを読むための道具です。 */
import fs from "node:fs";

export function stripComments(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, "");
}

function findClosing(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return i; }
  }
  return text.length;
}

function parseDecls(body) {
  const decls = {};
  for (const part of body.split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    if (!prop) continue;
    let value = part.slice(at + 1).trim();
    const important = /!important\s*$/i.test(value);
    if (important) value = value.replace(/!important\s*$/i, "").trim();
    decls[prop] = { value, important };
  }
  return decls;
}

/** セレクタの並びを、深さ0のカンマで分ける（:not(a, b) の中は分けない） */
export function splitSelectors(prelude) {
  const out = [];
  let buf = "", depth = 0;
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(buf.trim()); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** css を規則の配列にする（@media は入れ子のまま条件を持たせる） */
export function parseRules(css, { file = "" } = {}) {
  const text = stripComments(css);
  const rules = [];
  let order = 0;
  const scan = (chunk, media) => {
    let start = 0, pos = 0;
    while (pos < chunk.length) {
      const ch = chunk[pos];
      if (ch === "{") {
        const prelude = chunk.slice(start, pos).trim();
        const close = findClosing(chunk, pos);
        if (prelude.startsWith("@")) {
          const inner = chunk.slice(pos + 1, close);
          const isMedia = /^@media\b/i.test(prelude);
          scan(inner, isMedia ? media.concat([prelude.replace(/^@media\s*/i, "")]) : media);
        } else {
          const body = chunk.slice(pos + 1, close);
          rules.push({ file, order: order++, selectors: splitSelectors(prelude), decls: parseDecls(body), media, prelude });
        }
        pos = close + 1;
        start = pos;
        continue;
      }
      pos++;
    }
  };
  scan(text, []);
  return rules;
}

export function readRules(rel, root) {
  return parseRules(fs.readFileSync(`${root}/${rel}`, "utf8"), { file: rel });
}

function tokenizeSelector(selector) {
  const out = [];
  let buf = "", depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === "(" || ch === "[") { depth++; buf += ch; continue; }
    if (ch === ")" || ch === "]") { depth--; buf += ch; continue; }
    if (depth === 0 && (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch))) {
      if (buf.trim()) out.push({ type: "compound", value: buf.trim() });
      buf = "";
      if (ch === ">" || ch === "+" || ch === "~") out.push({ type: "comb", value: ch });
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push({ type: "compound", value: buf.trim() });
  return out;
}

function matchCompound(compound, el) {
  if (!el) return false;
  let rest = compound.trim();
  /* 先頭のタグ名 */
  const tagMatch = rest.match(/^(\*|[a-zA-Z][\w-]*)/);
  if (tagMatch) {
    if (tagMatch[1] !== "*" && String(el.tag || "").toLowerCase() !== tagMatch[1].toLowerCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }
  while (rest.length) {
    let m;
    if ((m = rest.match(/^#([\w-]+)/))) {
      if (String(el.id || "") !== m[1]) return false;
    } else if ((m = rest.match(/^\.([\w-]+)/))) {
      if (!(el.classes || []).includes(m[1])) return false;
    } else if ((m = rest.match(/^\[\s*([\w-]+)\s*(?:=\s*"([^"]*)"|=\s*'([^']*)'|)\s*\]/))) {
      const name = m[1], want = m[2] !== undefined ? m[2] : m[3];
      const have = (el.attrs || {})[name];
      if (have === undefined) return false;
      if (want !== undefined && String(have) !== want) return false;
    } else if ((m = rest.match(/^:not\(/))) {
      const start = m[0].length;
      let depth = 1, i = start;
      for (; i < rest.length; i++) {
        if (rest[i] === "(") depth++;
        else if (rest[i] === ")") { depth--; if (depth === 0) break; }
      }
      const inside = rest.slice(start, i);
      if (splitSelectors(inside).some(sel => matchSelector(sel, el, []))) return false;
      rest = rest.slice(i + 1);
      continue;
    } else if ((m = rest.match(/^:([\w-]+)/))) {
      /* 状態の疑似クラス（:hover など）は「当たらない」扱い。テストでは使わない */
      return false;
    } else {
      return false;
    }
    rest = rest.slice(m[0].length);
  }
  return true;
}

/** セレクタが要素に当たるか。ancestors は外側から内側の順（html, body, …） */
export function matchSelector(selector, el, ancestors = []) {
  const toks = tokenizeSelector(selector);
  if (!toks.length) return false;
  let idx = toks.length - 1;
  if (toks[idx].type !== "compound") return false;
  if (!matchCompound(toks[idx].value, el)) return false;
  let ai = ancestors.length - 1;
  while (idx > 0) {
    let comb = " ", target;
    if (toks[idx - 1].type === "comb") { comb = toks[idx - 1].value; target = toks[idx - 2]; idx -= 2; }
    else { target = toks[idx - 1]; idx -= 1; }
    if (!target || target.type !== "compound") return false;
    if (comb === ">") {
      if (ai < 0 || !matchCompound(target.value, ancestors[ai])) return false;
      ai -= 1;
    } else if (comb === " ") {
      let found = -1;
      for (let j = ai; j >= 0; j--) if (matchCompound(target.value, ancestors[j])) { found = j; break; }
      if (found < 0) return false;
      ai = found - 1;
    } else {
      return false;  /* + と ~ は使っていない */
    }
  }
  return true;
}

export function specificity(selector) {
  const toks = tokenizeSelector(selector).filter(t => t.type === "compound");
  let ids = 0, classes = 0, elements = 0;
  for (const tok of toks) {
    const c = tok.value;
    ids += (c.match(/#[\w-]+/g) || []).length;
    classes += (c.match(/\.[\w-]+/g) || []).length;
    classes += (c.match(/\[[^\]]+\]/g) || []).length;
    classes += (c.match(/:(?!:)[\w-]+/g) || []).length;
    const tag = c.match(/^[a-zA-Z][\w-]*/);
    if (tag) elements += 1;
  }
  return [ids, classes, elements];
}

function cmpSpec(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** カスケードで勝つ宣言を返す（{value, important, selector, file} か null） */
export function computed(rules, prop, el, ancestors = [], { allowMedia = () => false } = {}) {
  let best = null;
  for (const rule of rules) {
    if (rule.media.length && !allowMedia(rule.media)) continue;
    const decl = rule.decls[prop];
    if (!decl) continue;
    for (const sel of rule.selectors) {
      if (!matchSelector(sel, el, ancestors)) continue;
      const spec = specificity(sel);
      const candidate = { value: decl.value, important: decl.important, selector: sel, spec, order: rule.order, file: rule.file };
      if (!best) { best = candidate; continue; }
      if (candidate.important !== best.important) { if (candidate.important) best = candidate; continue; }
      const bySpec = cmpSpec(candidate.spec, best.spec);
      if (bySpec > 0 || (bySpec === 0 && candidate.order > best.order)) best = candidate;
    }
  }
  return best;
}

/** 要素の並びを作る小さな道具 */
export function el(tag, { id = "", classes = [], attrs = {} } = {}) {
  return { tag, id, classes: [...classes], attrs: { ...attrs } };
}

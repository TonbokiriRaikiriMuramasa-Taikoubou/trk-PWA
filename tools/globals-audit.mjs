#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/* 名前空間の棚卸し（レビュー項目4の準備）。依存パッケージ不要。
 *
 *   node tools/globals-audit.mjs            … 一覧を表示
 *   node tools/globals-audit.mjs --json     … 機械可読の結果を標準出力へ
 *   node tools/globals-audit.mjs --write    … tests/fixtures/globals-baseline.json を更新（意図した変更の後だけ）
 *
 * 考え方：index.html の classic script は1つの大域スコープを共有する。
 *   ・ファイルのトップレベル宣言（function／const／let／var／class）を集める。
 *   ・他のファイル（と index.html のインラインscript）から、その名前が識別子として出てくるかを数える。
 *   ・他から使われない名前（private）は、そのファイルを即時関数で包んでも動きが変わらない候補。
 *   ・使われる名前（public）は、移行の段階で window.Trk.* へ寄せるか、そのまま残すかを決める対象。
 * 字句解析は簡易版（コメント・文字列・テンプレート・正規表現リテラルを概ね除く）。
 * 誤検出は「他から使われている」側へ倒すので、private と判定されたものは安全側の判定になる。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restoreCoreAlias } from "./lib/js-source.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));

/* index.html の classic script の読み込み順（type=module・importmap・外部URLは除く） */
export function classicScriptOrder(rawHtml) {
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, ""); // HTML コメント内の例は読み込まない
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>|<script\b([^>]*)\/>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? m[3] ?? "", body = m[2] ?? "";
    if (/type\s*=\s*["']?(module|importmap)/i.test(attrs)) continue;
    const src = /src\s*=\s*"([^"]+)"/.exec(attrs);
    if (src && !/^(https?:)?\/\//.test(src[1])) out.push({ kind: "file", name: src[1] });
    else if (!src && body.trim()) out.push({ kind: "inline", name: "index.html(inline)", body });
  }
  return out;
}

/* 簡易の字句処理：コメント・文字列を空白に置き換え、テンプレートの ${ } の中は残す。
   正規表現リテラルは直前の字で判定する（完全ではない）。 */
const REGEX_PREFIX_WORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
export function stripCode(src) {
  let out = "";
  const n = src.length;
  let i = 0;
  const stack = [];           // テンプレートの ${ } の入れ子：各要素は「{ の深さ」
  let braceDepth = 0;
  let lastSig = "";           // 直前の意味のある字（識別子は単語全体）
  const pushCode = c => { out += c; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") {
      const end = src.indexOf("*/", i + 2); const stop = end < 0 ? n : end + 2;
      for (let k = i; k < stop; k++) out += src[k] === "\n" ? "\n" : " ";
      i = stop; continue;
    }
    if (c === "'" || c === '"') {
      i++;
      while (i < n && src[i] !== c) { if (src[i] === "\\") i++; if (src[i] === "\n") break; i++; }
      i++; out += " "; lastSig = "str"; continue;
    }
    if (c === "`") {
      i++;
      // テンプレート本体は空白に。${ が出たら式を通常の字句処理へ戻す
      let closed = false;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "`") { i++; closed = true; break; }
        if (src[i] === "$" && src[i + 1] === "{") { stack.push(braceDepth); braceDepth++; i += 2; out += " "; lastSig = "("; break; }
        out += src[i] === "\n" ? "\n" : " "; i++;
      }
      if (closed) lastSig = "str";
      continue;
    }
    if (c === "/" && (lastSig === "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig) || REGEX_PREFIX_WORDS.has(lastSig))) {
      // 正規表現リテラル：閉じの / まで読み飛ばす（文字クラス内の / は無視）
      i++; let inClass = false;
      while (i < n && src[i] !== "\n") {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") inClass = true; else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) break;
        i++;
      }
      i++; while (i < n && /[a-z]/i.test(src[i])) i++;
      out += " "; lastSig = "re"; continue;
    }
    if (c === "{") { braceDepth++; pushCode(c); lastSig = "{"; i++; continue; }
    if (c === "}") {
      braceDepth--;
      if (stack.length && braceDepth === stack[stack.length - 1]) {
        // テンプレートの ${ } が閉じた：テンプレート本体へ戻る
        stack.pop(); out += " "; i++;
        // 本体を読み直す
        let closed = false;
        while (i < n) {
          if (src[i] === "\\") { i += 2; continue; }
          if (src[i] === "`") { i++; closed = true; break; }
          if (src[i] === "$" && src[i + 1] === "{") { stack.push(braceDepth); braceDepth++; i += 2; out += " "; break; }
          out += src[i] === "\n" ? "\n" : " "; i++;
        }
        lastSig = closed ? "str" : "(";
        continue;
      }
      pushCode(c); lastSig = "}"; i++; continue;
    }
    if (/\s/.test(c)) { out += c; i++; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out += word; lastSig = word; i = j; continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (j < n && /[\w.]/.test(src[j])) j++; out += src.slice(i, j); lastSig = "num"; i = j; continue; }
    out += c; lastSig = c; i++;
  }
  return out;
}

/* トップレベル（波括弧・丸括弧・角括弧の深さ0）で始まる宣言だけを集める。
   インデントの無い即時関数の中の宣言は深さ1以上なので数えない。 */
export function topLevelNames(stripped) {
  const names = new Set();
  const n = stripped.length;
  const depth = new Int32Array(n + 1);
  let d = 0;
  for (let i = 0; i < n; i++) {
    depth[i] = d;
    const c = stripped[i];
    if (c === "{" || c === "(" || c === "[") d++;
    else if (c === "}" || c === ")" || c === "]") d--;
  }
  // 即時関数で包んだファイル（先頭が `(() => {`）は、包みの本体を「トップレベル」として数える。
  // 本体の深さは 2 なので、本体の中だけ 2 を引いて 0 に読み替える（本体の閉じ括弧は深さ 2 で閉じる）。
  if (/^\s*\(\s*\(\s*\)\s*=>\s*\{/.test(stripped)) {
    const open = stripped.indexOf("{");
    let close = n;
    for (let i = open + 1; i < n; i++) if (stripped[i] === "}" && depth[i] === 2) { close = i; break; }
    for (let i = open + 1; i < close; i++) depth[i] -= 2;
  }
  const KW = /(?<![\w$.])(const|let|var|class|function\*?|async\s+function\*?)(?![\w$])/g;
  let m;
  while ((m = KW.exec(stripped))) {
    const at = m.index;
    if (depth[at] !== 0) continue;
    // 文の先頭か：直前の空白以外の字が無い／;／} ／ 改行を挟んでいる
    let k = at - 1, sawNewline = false;
    while (k >= 0 && /\s/.test(stripped[k])) { if (stripped[k] === "\n") sawNewline = true; k--; }
    if (k >= 0 && !(stripped[k] === ";" || stripped[k] === "}" || sawNewline)) continue;
    const kw = m[1].replace(/\s+/g, " ");
    const rest = stripped.slice(at + m[0].length);
    if (/^(function|class|async function)/.test(kw)) {
      const nm = /^\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(rest);
      if (nm) names.add(nm[1]);
      continue;
    }
    // const / let / var：文の終わり（深さ0の ; または、深さ0の改行で次の行が字下げなし）まで読み、カンマで分ける
    const stmtEnd = findStatementEnd(stripped, depth, at + m[0].length);
    for (const part of splitTop(stripped.slice(at + m[0].length, stmtEnd))) {
      const t = part.trimStart();
      const id = /^([A-Za-z_$][\w$]*)\s*(?:=|$|;)/.exec(t);
      if (id) { names.add(id[1]); continue; }
      if (t.startsWith("{") || t.startsWith("[")) {
        for (const w of t.match(/[A-Za-z_$][\w$]*/g) || []) if (!/^(?:default|as)$/.test(w)) names.add(w);
      }
    }
  }
  return [...names].sort();
}
function findStatementEnd(src, depth, from) {
  for (let i = from; i < src.length; i++) {
    if (depth[i] !== 0) continue;
    if (src[i] === ";") return i;
    if (src[i] === "\n") {
      // 深さ0の改行で、次の行が字下げなし（＝次の文）なら終わり
      let j = i + 1;
      while (j < src.length && (src[j] === " " || src[j] === "\t")) j++;
      if (j < src.length && src[j] !== "\n" && src[j] !== "." && src[j] !== "?" && src[j] !== ":" && src[j] !== "|" && src[j] !== "&" && src[j] !== "+" && src[j] !== "-" && src[j] !== "*" && j === i + 1 && !/^\s*[)\]},]/.test(src.slice(i + 1, i + 40))) return i;
    }
  }
  return src.length;
}
function splitTop(text) {
  const parts = [];
  let cur = "", d = 0;
  for (const c of text) {
    if (c === "{" || c === "(" || c === "[") d++;
    if (c === "}" || c === ")" || c === "]") d--;
    if (c === "," && d === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/* window.NAME の読み書き（字句処理のあとの文字列で見る） */
export function windowProps(stripped) {
  const winReads = new Set(), winWrites = new Set();
  const re = /(?<![.\w$])(?:window|globalThis|self)\s*\.\s*([A-Za-z_$][\w$]*)(\s*=(?!=))?/g;
  let m;
  while ((m = re.exec(stripped))) {
    winReads.add(m[1]);
    if (m[2]) winWrites.add(m[1]);
  }
  return { winReads, winWrites };
}

export function identifiers(stripped) {
  const set = new Set();
  const re = /(?<![.\w$])[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = re.exec(stripped))) set.add(m[0]);
  return set;
}

export function audit(root = ROOT) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const order = classicScriptOrder(html);
  const units = order.map(s => {
    /* 別名（const core = window.Trk.core;）は IIFE の中の局所。棚卸しは元の綴りで見る（tools/lib/js-source.mjs） */
    const text = s.kind === "file" ? restoreCoreAlias(fs.readFileSync(path.join(root, s.name), "utf8")) : s.body;
    const stripped = stripCode(text);
    // 包んだファイル（先頭が「(() => {」）：中身のうち window に出す名前だけが大域に残る
    const wrapped = /^\s*\(\s*\(\s*\)\s*=>\s*\{/.test(stripped);
    // Object.defineProperty(window, "NAME", …) も window に出す（文字列は stripCode で消えるので元の本文から読む）
    const defined = new Set([...text.matchAll(/defineProperty\(\s*(?:window|globalThis|self)\s*,\s*"([A-Za-z_$][\w$]*)"/g)].map(m => m[1]));
    return { name: s.name, wrapped, defined, decls: topLevelNames(stripped), ids: identifiers(stripped), ...windowProps(stripped) };
  });
  const result = units.map(u => {
    const publicNames = [];
    for (const name of u.decls) {
      // window.NAME 経由の参照も「使われている」に数える（window の名前は裸の識別子と同じ大域）
      const usedBy = units.filter(o => o !== u && (o.ids.has(name) || o.winReads.has(name))).map(o => o.name);
      if (usedBy.length) publicNames.push({ name, usedBy });
    }
    // 大域に残る名前：包みの外の宣言、または包みの中で window に出す名前
    const globalNames = u.wrapped ? u.decls.filter(n => u.winWrites.has(n) || u.defined.has(n)) : u.decls;
    return {
      file: u.name, decls: u.decls.length, private: u.decls.length - publicNames.length,
      public: publicNames, names: u.decls, wrapped: u.wrapped, globalNames,
    };
  });
  /* 同じ名前を2つのファイルが宣言していると、後から読んだ方が前を上書きする（大域の衝突） */
  const owners = new Map();
  for (const u of units) for (const name of u.decls) {
    if (!owners.has(name)) owners.set(name, []);
    owners.get(name).push(u.name);
  }
  const duplicates = [...owners].filter(([, files]) => files.length > 1).map(([name, files]) => ({ name, files }));
  /* window のプロパティを介した連携：書いているファイルと、読んでいるファイル */
  const windowCoupling = [];
  const winNames = new Set(units.flatMap(u => [...u.winWrites]));
  for (const name of [...winNames].sort()) {
    const writers = units.filter(u => u.winWrites.has(name)).map(u => u.name);
    const readers = units.filter(u => u.winReads.has(name)).map(u => u.name);
    windowCoupling.push({ name, writers, readers: readers.filter(r => !writers.includes(r)) });
  }
  const totals = {
    scripts: result.length,
    windowProps: windowCoupling.length,
    duplicates: duplicates.length,
    declarations: result.reduce((a, r) => a + r.decls, 0),
    private: result.reduce((a, r) => a + r.private, 0),
    public: result.reduce((a, r) => a + r.public.length, 0),
    globalNames: result.reduce((a, r) => a + r.globalNames.length, 0),
  };
  return { totals, files: result, duplicates, windowCoupling };
}

function printReport(res) {
  console.log(`classic scripts: ${res.totals.scripts} · top-level declarations: ${res.totals.declarations}`);
  console.log(`  private（他から使われない・包んでも安全な候補）: ${res.totals.private}`);
  console.log(`  public （他のファイルから使われる）            : ${res.totals.public}`);
  console.log(`  同名の重複宣言（別ファイル）                   : ${res.totals.duplicates}`);
  console.log(`  大域に残る名前（包みの外の宣言＋包みの中で window に出す名前）: ${res.totals.globalNames}`);
  for (const d of res.duplicates) console.log(`    ! ${d.name}  ← ${d.files.join(", ")}`);
  console.log(`  window 経由の連携（window.X を書いて別ファイルが読む）: ${res.windowCoupling.filter(w => w.readers.length).length} 件`);
  for (const w of res.windowCoupling.filter(x => x.readers.length)) console.log(`    · window.${w.name}  書く:${w.writers.join(",")}  読む:${w.readers.join(",")}`);
  console.log("");
  for (const f of res.files) {
    console.log(`${String(f.decls).padStart(4)} decl  ${String(f.private).padStart(4)} private  ${String(f.public.length).padStart(4)} public  ${f.file}`);
  }
}

/* 直接実行されたときだけ動く（import されたときは関数だけ使えるように） */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = audit();
  if (args.has("--json")) {
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  } else if (args.has("--write")) {
    const out = path.join(ROOT, "tests/fixtures/globals-baseline.json");
    // 基準は名前だけ（usedBy は変わりやすいので含めない）
    const base = {
      totals: res.totals,
      files: res.files.map(f => ({ file: f.file, decls: f.decls, private: f.private, public: f.public.map(p => p.name) })),
      windowCoupling: res.windowCoupling.map(w => ({ name: w.name, writers: w.writers, readers: w.readers })),
    };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(base, null, 1) + "\n");
    printReport(res);
    console.log(`\nwrote ${path.relative(ROOT, out)}`);
  } else {
    printReport(res);
  }
}

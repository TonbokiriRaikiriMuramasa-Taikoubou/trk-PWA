#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * 📚 書斎（Study reader）の依存なし静的検査。
 *
 * ・js/study-room-utils.js は Node 上で実際に走らせて、文字コード・並べ替え・検索・しおりの純関数を確かめます。
 * ・js/study-room.js / index.html / css は、UIのID・4言語の網羅・保存の約束・安全側の作りを静的に確かめます。
 * これは実ブラウザ・実機の代わりではありません（フォルダ取り込み・IndexedDB・タッチ操作は実機で確認してください）。
 */
import assert from "node:assert/strict";
import { restoreCoreAlias, sourceOf } from "./lib/js-source.mjs";
import fs from "node:fs";
import vm from "node:vm";

// 名前空間 D：js/ の本文では領域の接頭辞 window.Trk.<領域>. を取り除いて照合する（window.Trk.overlay は残す）
const read = rel => {
  const text = sourceOf(rel, fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
  return rel.startsWith("js/") ? text.replace(/window\.Trk\.(?!overlay\b)[A-Za-z]\w*\./g, "") : text;
};
const utilitySource = read("js/study-room-utils.js");
const windowStub = {};
vm.runInNewContext(utilitySource, { window:windowStub, TextDecoder, Uint8Array, Intl, Math, Set, Map, String, Number, Object, Array, RegExp });
const U = windowStub.TrkStudyUtils;
assert.ok(U, "Study utility module exports its public API");

/* ---------- 取り込むファイルの分類 ---------- */
assert.equal(U.extension("folder/Novel.MD"), "md");
assert.equal(U.baseName("folder/Novel.MD"), "Novel");
assert.equal(U.isImageFile({ name:"page.webp", type:"image/webp" }), true);
assert.equal(U.isImageFile({ name:"script.svg", type:"image/svg+xml" }), false, "SVG stays outside the image allowlist");
assert.equal(U.isTextFile({ name:"book.json" }), true);
assert.equal(U.isTextFile({ name:"notes.md" }), true);
assert.equal(U.isTextFile({ name:"snippet.js" }), true);
assert.equal(U.isTextFile({ name:"photo.png" }), false);

const imageFile = (name, rel, size = 10) => {
  const file = { name, type:"image/png", size, webkitRelativePath:rel };
  return file;
};
/* サブフォルダは別の本（split）／まとめて1冊（flat） */
const nested = [imageFile("1.png", "Manga/vol1/1.png"), imageFile("2.png", "Manga/vol1/2.png"), imageFile("1.png", "Manga/vol2/1.png"), imageFile("cover.png", "Manga/cover.png")];
const split = U.groupImageFiles(nested, "split");
assert.deepEqual(Array.from(split, group => group.sourcePath), ["Manga", "Manga/vol1", "Manga/vol2"]);
assert.deepEqual(Array.from(split.find(group => group.sourcePath === "Manga/vol1").files, entry => entry.path), ["1.png", "2.png"]);
assert.equal(split.find(group => group.sourcePath === "Manga/vol2").title, "vol2");
const flat = U.groupImageFiles(nested, "flat");
assert.deepEqual(Array.from(flat, group => group.sourcePath), ["Manga"]);
assert.equal(flat[0].files.length, 4);
const plain = U.groupImageFiles([imageFile("10.png", "Album/10.png"), imageFile("2.png", "Album/2.png"), imageFile("1.png", "Album/1.png")]);
assert.deepEqual(Array.from(plain[0].files, entry => entry.path), ["1.png", "2.png", "10.png"], "numeric order");
assert.equal(U.groupImageFiles([imageFile("loose.png", "loose.png")])[0].title, U.ROOT_ALBUM);
const texts = U.listTextFiles([
  { name:"b.md", webkitRelativePath:"Books/b.md" },
  { name:"a.txt", webkitRelativePath:"Books/a.txt" },
  { name:"skip.exe", webkitRelativePath:"Books/skip.exe" }
]);
assert.deepEqual(Array.from(texts, entry => entry.path), ["Books/a.txt", "Books/b.md"]);

/* ---------- 文字コードと本文の組み立て ---------- */
assert.equal(U.decodeTextBuffer(Uint8Array.from([0xef, 0xbb, 0xbf, 0x41, 0x42])), "AB");
assert.equal(U.decodeTextBuffer(Uint8Array.from([0xff, 0xfe, 0x42, 0x30])), "あ", "UTF-16LE is decoded");
assert.equal(U.decodeTextBuffer(Uint8Array.from([0xfe, 0xff, 0x30, 0x42])), "あ", "UTF-16BE is decoded");
assert.equal(U.decodeTextBuffer(Uint8Array.from([0x82, 0xa0])), "あ", "Shift_JIS fallback is decoded");
assert.equal(U.normalizeText("a\r\nb\fc"), "a\nb\n\nc");
const ruby = U.aozoraSegments("｜漢字《かんじ》と山《やま》\n");
assert.deepEqual(Array.from(ruby, part => part.ruby ? [part.ruby, part.reading] : part.text), [["漢字", "かんじ"], "と", ["山", "やま"], "\n"]);
assert.equal(U.aozoraSegments("［＃改ページ］").map(part => part.text).join(""), "\n\n");
/* ルビの細かい約束（ルビにしないものを、そのまま文字として残す） */
const plainRuby = s => U.aozoraSegments(s).map(p => p.ruby ? `[${p.ruby}:${p.reading}]` : p.text).join("");
assert.equal(plainRuby("｜《》"), "｜《》", "an empty base/reading stays text");
assert.equal(plainRuby("漢《》"), "漢《》", "an empty reading stays text");
assert.equal(plainRuby("漢《かん"), "漢《かん", "an unclosed opening bracket stays text");
assert.equal(plainRuby("漢《かん》じ"), "[漢:かん]じ", "an implicit ruby still works");
assert.equal(plainRuby("｜あい《ai》"), "[あい:ai]", "the explicit form takes everything up to 《");
assert.equal(plainRuby("｜漢《かん》と山《やま》"), "[漢:かん]と[山:やま]", "two rubies in one line");
assert.equal(plainRuby("｜漢《かん\nじ》"), "｜漢《かん\nじ》", "ruby never crosses a line break");
assert.equal(plainRuby("漢《a》b《c》"), "[漢:a]b《c》", "a reading without a kanji run stays text");
/* 🛡 細工した本文で固まらない（以前は正規表現の後戻りで、1MBの漢字だけで数分かかっていた） */
const worst = [
  ["kanji only, no 《", "漢".repeat(300000)],
  ["many ｜ without 《", ("｜" + "あ".repeat(80)).repeat(2000)],
  ["many unclosed 《", "《".repeat(150000)],
  ["｜ then a long run then 《", "｜" + "あ".repeat(300000) + "《"]
];
for (const [name, text] of worst) {
  const started = Date.now();
  const parts = U.aozoraSegments(text);
  const ms = Date.now() - started;
  assert.ok(parts.length >= 1, `aozoraSegments survives ${name}`);
  assert.ok(ms < 1500, `aozoraSegments stays linear on ${name} (${ms}ms)`);
}

/* ---------- 検索・抜粋・文字数 ---------- */
assert.deepEqual(Array.from(U.findMatches("abcABCabc", "ABC")), [0, 3, 6], "case-insensitive matches keep their offsets");
assert.deepEqual(Array.from(U.findMatches("aaa", "aa")), [0], "matches do not overlap");
assert.equal(U.findMatches("abc", "").length, 0);
assert.ok(U.findMatches("x".repeat(5000), "x", 10).length === 10, "match list is capped");
assert.equal(U.textStats("a\nb\nc").lines, 3);
assert.equal(U.textStats("a\nb\nc").chars, 3);
assert.ok(U.snippetAt("0123456789".repeat(20), .5, 30).includes("…"));

/* ---------- 本棚の並べ替え・使用量・しおり ---------- */
const book = (id, title, kind, updatedAt, createdAt, pages, content) => ({ id, title, kind, updatedAt, createdAt, pages:pages || [], content:content || "" });
const shelf = [book("a", "Beta", "text", 300, 100, [], "x".repeat(50)), book("b", "Alpha", "image", 200, 400, [{ size:1024 }, { size:1024 }])];
assert.deepEqual(Array.from(U.sortBooks(shelf, "updated"), b => b.id), ["a", "b"]);
assert.deepEqual(Array.from(U.sortBooks(shelf, "added"), b => b.id), ["a", "b"]);
assert.deepEqual(Array.from(U.sortBooks(shelf, "title"), b => b.id), ["b", "a"]);
assert.deepEqual(Array.from(U.sortBooks(shelf, "type"), b => b.id), ["b", "a"]);
assert.deepEqual(Array.from(U.sortBooks(shelf, "size"), b => b.id), ["b", "a"]);
const shelfEntries = [
  { key:"book:a", itemType:"book", kind:"text", title:"Alpha", updatedAt:30, createdAt:10, size:40 },
  { key:"folder:x", itemType:"folder", kind:"folder", title:"Zeta", updatedAt:10, createdAt:5, size:0 },
  { key:"book:b", itemType:"book", kind:"image", title:"Beta", updatedAt:20, createdAt:20, size:200 }
];
assert.deepEqual(Array.from(U.sortShelfItems(shelfEntries, { mode:"title" }), item => item.key), ["book:a", "book:b", "folder:x"]);
assert.deepEqual(Array.from(U.sortShelfItems(shelfEntries, { manual:true, orderKeys:["book:b", "folder:x", "book:a"] }), item => item.key), ["book:b", "folder:x", "book:a"]);
assert.deepEqual(Array.from(U.sortShelfItems(shelfEntries, { manual:true, foldersFirst:true, orderKeys:["book:b", "folder:x", "book:a"] }), item => item.key), ["folder:x", "book:b", "book:a"]);
assert.deepEqual(Array.from(U.sortShelfItems(shelfEntries, { mode:"updated", foldersFirst:true }), item => item.key), ["folder:x", "book:a", "book:b"]);
assert.equal(U.sortBooks(undefined, "updated").length, 0, "an empty shelf stays safe");
assert.equal(U.bookSize(shelf[1]), 2048);
assert.equal(U.formatBytes(0), "0 B");
assert.equal(U.formatBytes(2048), "2 KB");
assert.ok(/MB$/.test(U.formatBytes(3 * 1024 * 1024)));
const marked = { ...shelf[0], bookmark:{ index:3, top:0, left:0, ratio:.5, savedAt:5 } };
assert.deepEqual(Array.from(U.bookmarkedBooks([shelf[0], marked, shelf[1]]), b => b.id), ["a"]);
assert.deepEqual(Array.from(U.orderPages([1, 2, 3], "reverse")), [3, 2, 1]);
assert.deepEqual(Array.from(U.orderPages([1, 2, 3], "natural")), [1, 2, 3]);
assert.equal(U.stableId("text", "Books/a.txt"), U.stableId("text", "Books/a.txt"));
assert.notEqual(U.stableId("text", "Books/a.txt"), U.stableId("text", "Books/b.txt"));
assert.notEqual(U.stableId("text", "Books/a.txt"), U.stableId("image", "Books/a.txt"));

/* ---------- 本体（js/study-room.js） ---------- */
const reader = read("js/study-room.js");
const html = read("index.html");
assert.ok(html.includes("css/study-room.css") && html.includes("js/study-room-utils.js") && html.includes("js/study-room.js"));
assert.ok(html.indexOf("js/study-room-utils.js") < html.indexOf("js/study-room.js"), "utils load before the room");
assert.ok(reader.includes('const STUDY_DB_NAME = "trk_study_room_v1"'));
assert.ok(reader.includes("studyDBOpen") && reader.includes("studyGetSongCoverBlob"));
assert.ok(reader.includes("STUDY_IMAGE_MAX_COUNT = 3000") && reader.includes("STUDY_IMAGE_MAX_BYTES = 600 * 1024 * 1024") &&
  reader.includes("STUDY_IMAGE_FILE_MAX = 100 * 1024 * 1024") && reader.includes("STUDY_TEXT_FILE_MAX = 12 * 1024 * 1024") &&
  reader.includes("STUDY_TEXT_BATCH_MAX = 200") && reader.includes("STUDY_SHELF_MAX = 500"), "documented limits stay in the code");
assert.ok(reader.includes("studySafeMode()") && reader.includes("window.TrkSafeMode"), "safe mode is respected");
assert.ok(reader.includes("studyCancelImport") && reader.includes("studyImportState.cancelled"), "imports can be cancelled");
assert.ok(reader.includes("studyImportAsk") && reader.includes("studyQuotaError"), "bulk replace + quota errors are handled");
assert.ok(reader.includes("imageBytes:STUDY_IMAGE_MAX_BYTES") && reader.includes("imageFileBytes:STUDY_IMAGE_FILE_MAX"),
  "backup restore can apply the same album byte caps as normal image import");
assert.ok(reader.includes("studySweepOrphans") && reader.includes("studyDBDeleteMany"), "orphaned pages are swept");
assert.ok(reader.includes("studyGetSongCoverInfo") && reader.includes("studyClearSongCover"), "covers can be inspected and removed");
assert.ok(reader.includes("STUDY_ZOOM_MIN") && reader.includes("STUDY_ZOOM_MAX") && reader.includes("studyApplyZoomValue") && reader.includes("studyPinchStart"),
  "image zoom (buttons / wheel / pinch) exists between 50% and 400%");
assert.ok(reader.includes("studyScrollZoomedImage") &&
  reader.includes('studyScrollZoomedImage(event.code === "ArrowDown" ? 1 : -1, event.repeat)'),
  "a zoomed image can also be scrolled with the up/down keys, like the wheel");
assert.ok(reader.includes("studyJumpZoomEdge") && reader.includes("!studyPrefs.pageKeysTurnPages &&") &&
  reader.includes('studyJumpZoomEdge(event.code === "PageDown" ? 1 : -1, event.repeat)') &&
  reader.includes("if (repeat) return true;"),
  "PageDown / PageUp can jump to the bottom / top of a zoomed image, behind their own setting");
assert.ok(reader.includes("studyApplyZoomLand") && reader.includes("await studyImageReady(img)") &&
  reader.includes("studyApplyZoom(false); studyApplyZoomLand();"),
  "the page turn waits for the image height and then opens at the continued edge");
assert.ok(reader.includes("function studyCloseToShelf") && reader.includes("studyCloseToShelf();") &&
  reader.includes("studyBackToShelf();"),
  "at the ends of the book the keys close instead of wrapping");
assert.ok(reader.includes("function studyMouseClickPage") && reader.includes("studyMouseClickPage(0)") && reader.includes("studyMouseClickPage(2)") &&
  reader.includes('if (event.pointerType) studyLastPointerType = event.pointerType;') && reader.includes('pointerType !== "mouse"') &&
  reader.includes("studyPrefs.mouseClickPages") && reader.includes("studyPrefs.mouseClickFlip") && reader.includes("if (event.button) return;"),
  "the left / right click turns pages behind its own setting (with a swap), for mouse pointers only, without disturbing the tap zones");
assert.ok(reader.includes("function studyMiddleClick") && reader.includes("studyMiddleClick(event, true)") &&
  reader.includes('addEventListener("mousedown", event => { studyMiddleClick(event, false); })') &&
  reader.includes('addEventListener("auxclick"') && reader.includes('const STUDY_MIDDLE_CLICK_ACTIONS = ["none", "next", "close"]') &&
  reader.includes('studyPrefs.middleClickAction === "close"') && reader.includes("studyCloseToShelf();"),
  "middle click is a select (nothing / next page / close to the shelf), without disturbing the tap zones");
assert.ok(reader.includes("studyRunSearch") && reader.includes("studyHighlightMatchesInNode") && reader.includes("STUDY_SEARCH_MARK_MAX"), "in-book search exists and is capped");
assert.ok(reader.includes("STUDY_UTIL.bookmarkedBooks") && reader.includes("studyBookmarkOpenAt") && reader.includes("studyToggleBookmarkPanel"), "the bookmark list exists");
assert.ok(reader.includes("STUDY_TV_LOOKS") && reader.includes("STUDY_TV_RATIO") && reader.includes("studyCycleTV"), "TV looks / aspect / cycling exist");
assert.ok(reader.includes("studyIsBlob(") && reader.includes('typeof URL.createObjectURL !== "function"'), "stored blobs and object URLs are handled defensively");
assert.ok(reader.includes("studyTypingTarget") && reader.includes("studyActivateTarget"), "typing vs. activation targets are separated");
assert.ok(reader.includes("function studyBindHoldPress(node, action)") && reader.includes("const STUDY_HOLD_MS = 650, STUDY_HOLD_MOVE_MAX = 14") &&
  reader.includes("const studyLaunchPress = studyLaunchTitle ? studyBindHoldPress(studyLaunchTitle, studyOpenRoom) : null") &&
  reader.includes("const studyShelfHold = studyBindHoldPress(studyShelfTitle, studyCreateFolder)") &&
  reader.includes("studyShelfHold.cancel()") && reader.includes('event.pointerType === "mouse"'),
  "the two long presses (opening Study / making a folder) share one helper that survives a browser-side pointercancel");
assert.ok(reader.includes('$("studyOpenBtn")') === false && reader.includes('getElementById("studyOpenBtn")'),
  "the Study button at the right of the song list is wired");
assert.ok(reader.includes("studySyncWelcome") && reader.includes("STUDY_SHELF_PAGE = 60"), "the shelf hides the welcome panel when it has books and pages the list");
assert.ok(reader.includes("studyNormalizeShelfMeta") && reader.includes('store.put(value, "shelf")'), "folder assignments and manual order persist separately without a DB version migration");
assert.ok(reader.includes("function studyCreateFolder") && reader.includes("studyBindHoldPress(studyShelfTitle, studyCreateFolder)"), "the bookshelf title supports long-press folder creation");
assert.ok(reader.includes("studyShelfDragOver") && reader.includes("studyShelfMoveItem") && reader.includes("studyBindShelfDropTarget"), "shelf items can be dragged to folders and manually reordered");
assert.ok(reader.includes('handle.addEventListener("pointerdown"') && reader.includes("studyHighlightShelfTarget"), "shelf dragging also supports touch and pen pointers");
assert.ok(reader.includes("studyPrefs.manualShelfOrder") && reader.includes("studyPrefs.foldersFirst") && reader.includes("studyPrefs.skipDeleteConfirm"), "the three advanced shelf checkboxes are wired");
assert.ok(reader.includes("!studyPrefs.skipDeleteConfirm && !confirm"), "book deletion can skip confirmation only when explicitly enabled");
assert.ok(reader.includes('STUDY_DEFAULT_NEXT_KEY = "ArrowRight"') && reader.includes('STUDY_DEFAULT_PREVIOUS_KEY = "ArrowLeft"'),
  "Study's default keyboard navigation advances with right and goes back with left");
assert.ok(reader.includes("studyHandleKeyCapture") && reader.includes("studyPrefs.studyNextKey") && reader.includes("studyPrefs.studyPreviousKey") &&
  reader.includes("studyPrefs.verticalImageKeys"), "navigation keys can be assigned, with optional up/down image navigation");
assert.ok(reader.includes("studyApplyShelfVisibility") && reader.includes("studySetShelfVisible(true)"),
  "the shelf is visible by default and can be restored from the header after hiding");
assert.ok(reader.includes("studyEditorHandleTab") && reader.includes('event.code === "KeyS"') &&
  reader.includes("if (editor.value !== content)") && reader.includes("studyEditorUnsaved"),
  "the text editor supports indentation, immediate save, and visible auto-save state");
assert.ok(reader.includes("studyEditorSafety") && reader.includes("studySaveBook(book)") && reader.includes("studyExportText"),
  "text editing stays in the local Study copy and offers explicit copy export");
assert.ok(reader.includes("studyApplyEditedTextFolder") && reader.includes("studyPrefs.editedTextFolderId") &&
  reader.includes("studyTextFiledInFolder"), "edited text can be filed into a chosen bookshelf folder after saving");
const prefsWriter = reader.match(/function studySavePrefs\(\) \{[\s\S]*?\n\}/);
assert.ok(prefsWriter && prefsWriter[0].includes('store.put({ ...studyPrefs }, "ui")') && !prefsWriter[0].includes("studyExportDirectory"),
  "the selected device folder handle is transient and is not stored in Study preferences");
assert.ok(reader.includes("studyWriteExportCopy") && reader.includes('mode:"readwrite"') &&
  reader.includes('getFileHandle(filename, { create:true })') && reader.includes('writable.write(blob)') &&
  reader.includes('$("studyMemoExportBtn").hidden = isImage'),
  "text export is available while reading and writes a new copy to the user-selected destination");
assert.ok(reader.includes('$("studyMemoBtn").textContent = tr($("studyMemoEditor").hidden ? "studyMemoEdit" : "studyMemoDone")'),
  "the edit button keeps its localized label when the app language changes mid-edit");
assert.ok(!reader.includes("studyPrefs.memoEnabled") && !html.includes('id="studyMemoEnabled"'),
  "editing text books is immediately available rather than hidden behind an opt-in preference");
assert.ok(!/\beval\s*\(/.test(reader) && !/\bnew\s+Function\s*\(/.test(reader) && !reader.includes(".innerHTML"),
  "text and source-code books remain inert; the reader does not execute or parse their contents as markup");
const editorTabFn = reader.match(/function studyEditorHandleTab\(event\) \{[\s\S]*?\n\}/);
assert.ok(editorTabFn, "the editor indentation handler is defined");
const editorTestContext = vm.createContext({ Event: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
vm.runInContext(`${editorTabFn[0]}\nglobalThis.handleTab = studyEditorHandleTab;`, editorTestContext);
function applyEditorTab(value, start, end, shiftKey = false) {
  const editor = {
    id:"studyMemoEditor", value, selectionStart:start, selectionEnd:end,
    setRangeText(replacement, from, to, mode) {
      this.value = this.value.slice(0, from) + replacement + this.value.slice(to);
      if (mode === "end") this.selectionStart = this.selectionEnd = from + replacement.length;
    },
    setSelectionRange(from, to) { this.selectionStart = from; this.selectionEnd = to; },
    dispatchEvent(event) { this.inputEvent = event.type; },
  };
  const event = { code:"Tab", target:editor, shiftKey, preventDefault(){ this.prevented = true; }, stopImmediatePropagation(){ this.stopped = true; } };
  editorTestContext.handleTab(event);
  return { editor, event };
}
let editorTabResult = applyEditorTab("ab", 1, 1);
assert.equal(editorTabResult.editor.value, "a\tb");
assert.equal(editorTabResult.editor.selectionStart, 2);
editorTabResult = applyEditorTab("one\ntwo\nthree", 1, 8);
assert.equal(editorTabResult.editor.value, "\tone\n\ttwo\nthree");
assert.deepEqual([editorTabResult.editor.selectionStart, editorTabResult.editor.selectionEnd], [2, 10]);
editorTabResult = applyEditorTab("\tone\n\ttwo\nthree", 2, 10, true);
assert.equal(editorTabResult.editor.value, "one\ntwo\nthree");
assert.deepEqual([editorTabResult.editor.selectionStart, editorTabResult.editor.selectionEnd], [1, 8]);
assert.ok(editorTabResult.event.prevented && editorTabResult.event.stopped && editorTabResult.editor.inputEvent === "input");
const exportWriterFn = reader.match(/async function studyWriteExportCopy\(directory, blob, title, extension\) \{[\s\S]*?^\}/m);
assert.ok(exportWriterFn, "the explicit export writer is defined separately from file import");
const exportWriterContext = vm.createContext({ crypto:{ randomUUID:() => "test-export-id" }, Date:{ now:() => 123456789 } });
vm.runInContext(`${exportWriterFn[0]}\nglobalThis.writeExportCopy = studyWriteExportCopy;`, exportWriterContext);
const existingExports = new Set(); let exportChecks = 0, exportedBlob = null, exportClosed = false;
const fakeExportDirectory = { getFileHandle:async (name, options) => {
  if (options && options.create) {
    assert.ok(!existingExports.has(name), "export never opens an existing file for writing"); existingExports.add(name);
    return { createWritable:async () => ({ write:async value => { exportedBlob = value; }, close:async () => { exportClosed = true; } }) };
  }
  exportChecks++;
  if (exportChecks <= 2) { existingExports.add(name); return {}; }
  const missing = new Error("not found"); missing.name = "NotFoundError"; throw missing;
} };
const testExportBlob = { text:"edited copy" };
const testExportName = await exportWriterContext.writeExportCopy(fakeExportDirectory, testExportBlob, "draft", "txt");
assert.match(testExportName, /draft - edited-.* \(3\)\.txt$/);
assert.equal(exportedBlob, testExportBlob); assert.equal(exportClosed, true);
const reservedKeys = reader.match(/const STUDY_RESERVED_KEYS = new Set\([\s\S]*?\);/);
const keyAllowed = reader.match(/function studyKeyCodeAllowed\(code\) \{[\s\S]*?\n\}/);
const keyLabel = reader.match(/function studyKeyCodeLabel\(code\) \{[\s\S]*?\n\}/);
assert.ok(reservedKeys && keyAllowed && keyLabel, "navigation key validation and labels are defined");
const keyTestContext = vm.createContext({});
vm.runInContext(`${reservedKeys[0]}\n${keyAllowed[0]}\n${keyLabel[0]}\nglobalThis.allowed = studyKeyCodeAllowed; globalThis.label = studyKeyCodeLabel;`, keyTestContext);
for (const code of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyZ", "Digit3", "Numpad4", "PageUp", "PageDown", "Home", "End"])
  assert.equal(keyTestContext.allowed(code), true, `${code} is a supported navigation key`);
/* KeyA は trk175 から自動スクロールのトグル＝割り当て不可の予約キー */
for (const code of ["Escape", "Tab", "Space", "Enter", "KeyA", "KeyB", "KeyM", "KeyT", "KeyF", "Digit0", "Unknown"])
  assert.equal(keyTestContext.allowed(code), false, `${code} is reserved or unsupported`);
assert.equal(keyTestContext.label("ArrowRight"), "→");
assert.equal(keyTestContext.label("KeyA"), "A");
assert.equal(keyTestContext.label("Numpad4"), "Num 4");
assert.ok(reader.includes('typeof node.scrollBy === "function"') && reader.includes('typeof node.scrollTo === "function"'), "scrollBy/scrollTo have fallbacks for older webviews");

/* ---------- 拡大した画像のキー送り（↑ / ↓） ---------- */
/* 取り出すときだけ、別名（core.）を残した本文を使います（この2つは core.$ を読むため）。 */
const readerWithCore = sourceOf("js/study-room.js", fs.readFileSync(new URL("../js/study-room.js", import.meta.url), "utf8"));
const zoomNodesFn = readerWithCore.match(/function studyZoomScrollNodes\(includeUnzoomed = false\) \{[\s\S]*?\n\}/);
const zoomScrollFn = readerWithCore.match(/function studyScrollZoomedImage\(direction, held\) \{[\s\S]*?\n\}/);
assert.ok(zoomNodesFn && zoomScrollFn, "the arrow-key scrolling of a zoomed image is defined");
const scrollContext = vm.createContext({});
vm.runInContext(`${zoomNodesFn[0]}\n${zoomScrollFn[0]}\nglobalThis.scrollZoomedImage = studyScrollZoomedImage;`, scrollContext);
const scrollNode = (scrollHeight, clientHeight, scrollTop = 0) => ({ scrollHeight, clientHeight, scrollTop });
const singleWrap = scrollNode(2400, 600), spreadPages = [scrollNode(2400, 600), scrollNode(2400, 600)];
scrollContext.window = { Trk: { core: { $: id => id === "studySingleWrap" ? singleWrap : { querySelectorAll: () => spreadPages } } } };
scrollContext.studyCurrentBook = { kind:"image" };
scrollContext.studyPrefs = { imageMode:"single", zoom:2 };
assert.equal(scrollContext.scrollZoomedImage(1, false), true, "the down key moves a zoomed image");
assert.equal(singleWrap.scrollTop, 504, "one press moves 84% of the visible height");
assert.equal(scrollContext.scrollZoomedImage(-1, false), true, "the up key goes back");
assert.equal(singleWrap.scrollTop, 0, "the up key comes back to the top");
assert.equal(scrollContext.scrollZoomedImage(-1, false), false, "at the top the key is handed back to the page keys");
singleWrap.scrollTop = 1800;
assert.equal(scrollContext.scrollZoomedImage(1, false), false, "at the bottom the key is handed back to the page keys");
assert.equal(singleWrap.scrollTop, 1800, "a press at the bottom does not move the image");
singleWrap.scrollTop = 0;
assert.equal(scrollContext.scrollZoomedImage(1, true), true, "holding the key keeps moving");
assert.equal(singleWrap.scrollTop, 36, "a held key moves in small steps (6% of the visible height)");
scrollContext.studyPrefs.imageMode = "spread";
singleWrap.scrollTop = 0;
assert.equal(scrollContext.scrollZoomedImage(1, false), true, "a spread moves too");
assert.deepEqual(Array.from(spreadPages, node => node.scrollTop), [504, 504], "both spread pages move together");
scrollContext.studyPrefs.imageMode = "vertical";
assert.equal(scrollContext.scrollZoomedImage(1, false), false, "vertical comic mode keeps the stage's own scrolling");
scrollContext.studyPrefs.imageMode = "single";
scrollContext.studyPrefs.zoom = 1;
assert.equal(scrollContext.scrollZoomedImage(1, false), false, "without zoom there is nothing to scroll");
scrollContext.studyPrefs.zoom = 2;
scrollContext.studyCurrentBook = { kind:"text" };
assert.equal(scrollContext.scrollZoomedImage(1, false), false, "text books keep their own key handling");

/* ---------- 拡大の送り幅（％・1/2/5/10/25・初期値5） ---------- */
const zoomConstants = reader.match(/const STUDY_ZOOM_MIN = [\s\S]*?function studyZoomPercentStep\(value\) \{[\s\S]*?\n\}/);
const zoomStepPercentFn = reader.match(/function studyZoomStepPercent\(\) \{[^\n]*\}/);
const snapZoomFn = readerWithCore.match(/function studySnapZoom\(value\) \{[\s\S]*?\n\}/);
const stepZoomFn = readerWithCore.match(/function studyStepZoom\(direction\) \{[\s\S]*?\n\}/);
assert.ok(zoomConstants && zoomStepPercentFn && snapZoomFn && stepZoomFn, "the percent zoom-step helpers are defined");
assert.ok(reader.includes("STUDY_ZOOM_PERCENT_STEPS = [1, 2, 5, 10, 25]") && reader.includes("STUDY_ZOOM_PERCENT_DEFAULT = 5"),
  "the wheel / button / pinch zoom step offers 1, 2, 5, 10 and 25 percent, five by default");
const zoomStepSelect = html.match(/<select id="studyZoomPercentStep"[^>]*>([\s\S]*?)<\/select>/);
assert.ok(zoomStepSelect, "the advanced settings offer a zoom-step select");
assert.deepEqual([...zoomStepSelect[1].matchAll(/<option value="(\d+)"/g)].map(match => Number(match[1])), [1, 2, 5, 10, 25],
  "the select lists the same percentages as the code, smallest first");
assert.ok(/aria-labelledby="studyZoomStepLabel"/.test(zoomStepSelect[0]) && /aria-describedby="studyZoomStepHint"/.test(zoomStepSelect[0]),
  "the zoom-step select has an accessible label and hint");
const zoomStepContext = vm.createContext({});
vm.runInContext(`${zoomConstants[0]}
${zoomStepPercentFn[0]}
${snapZoomFn[0]}
${stepZoomFn[0]}
globalThis.studyPrefs = { zoom:1, zoomPercentStep:5 };
globalThis.zoomCalls = [];
globalThis.studySetZoom = (value, save) => { studyPrefs.zoom = value; zoomCalls.push(value); return value; };
`, zoomStepContext);
const zoomSnap = value => vm.runInContext(`studySnapZoom(${JSON.stringify(value)})`, zoomStepContext);
const zoomStep = direction => vm.runInContext(`studyStepZoom(${JSON.stringify(direction)})`, zoomStepContext);
assert.equal(zoomStepContext.studyPrefs.zoomPercentStep, 5, "the default in-memory preference is the 5 percent step");
assert.equal(vm.runInContext("studyZoomPercentStep(undefined)", zoomStepContext), 5, "an unset zoom step falls back to 5 percent");
assert.equal(vm.runInContext('studyZoomPercentStep("25")', zoomStepContext), 25, "a stored zoom step is read as a number");
assert.equal(vm.runInContext("studyZoomPercentStep(7)", zoomStepContext), 5, "an unsupported zoom step falls back to 5 percent");
for (const step of [1, 2, 5, 10, 25]) assert.equal(vm.runInContext(`studyZoomPercentStep(${step})`, zoomStepContext), step, `${step} percent is supported`);
assert.equal(zoomSnap(1.14), 1.15, "a pinched zoom snaps to the chosen step (up)");
assert.equal(zoomSnap(1.12), 1.1, "a pinched zoom snaps to the chosen step (down)");
assert.equal(zoomSnap(0.2), 0.5, "the zoom never snaps below 50 percent");
assert.equal(zoomSnap(9), 4, "the zoom never snaps above 400 percent");
zoomStepContext.studyPrefs.zoomPercentStep = 25;
assert.equal(zoomSnap(2.2), 2.25, "the 25 percent step snaps to quarter steps");
zoomStepContext.studyPrefs.zoomPercentStep = 1;
assert.equal(zoomSnap(1.37), 1.37, "the 1 percent step keeps a fine value");
zoomStepContext.studyPrefs.zoomPercentStep = 5; zoomStepContext.studyPrefs.zoom = 1;
zoomStep(1); assert.equal(zoomStepContext.studyPrefs.zoom, 1.05, "one press moves by the chosen 5 percent");
zoomStep(1); assert.equal(zoomStepContext.studyPrefs.zoom, 1.1, "pressing again keeps the 5 percent grid");
zoomStep(-1); assert.equal(zoomStepContext.studyPrefs.zoom, 1.05, "zoom out uses the same step");
assert.deepEqual([...zoomStepContext.zoomCalls], [1.05, 1.1, 1.05], "each press applies and saves the new zoom");
zoomStepContext.studyPrefs.zoomPercentStep = 10; zoomStepContext.studyPrefs.zoom = 1.37;
zoomStep(1); assert.equal(zoomStepContext.studyPrefs.zoom, 1.4, "an off-grid zoom steps to the next grid point");
zoomStep(-1); assert.equal(zoomStepContext.studyPrefs.zoom, 1.3, "an off-grid zoom steps back to the previous grid point");
zoomStepContext.studyPrefs.zoomPercentStep = 25; zoomStepContext.studyPrefs.zoom = 1;
for (let i = 0; i < 20; i++) zoomStep(1);
assert.equal(zoomStepContext.studyPrefs.zoom, 4, "the 25 percent step stops at 400 percent");
for (let i = 0; i < 30; i++) zoomStep(-1);
assert.equal(zoomStepContext.studyPrefs.zoom, 0.5, "the 25 percent step stops at 50 percent");
/* ---------- 拡大中の PageDown / PageUp（端へ→端でさらに押すとページ送り） ---------- */
const jumpEdgeFn = readerWithCore.match(/function studyJumpZoomEdge\(direction, repeat = false\) \{[\s\S]*?\n\}/);
const normalizeFn = readerWithCore.match(/function studyNormalizePage\(page\) \{[\s\S]*?\n\}/);
const applyLandFn = readerWithCore.match(/function studyApplyZoomLand\(\) \{[\s\S]*?\n\}/);
assert.ok(jumpEdgeFn && normalizeFn && applyLandFn, "the PageDown / PageUp edge jump and its landing are defined");
const edgeContext = vm.createContext({});
vm.runInContext(`${zoomNodesFn[0]}
${normalizeFn[0]}
${jumpEdgeFn[0]}
${applyLandFn[0]}
globalThis.studyZoomLand = "";
globalThis.studyPrefs = { imageMode:"single", zoom:2, closeOnLastPageDown:true };
globalThis.studyCurrentBook = { kind:"image", pages:[{ key:"a" }, { key:"b" }, { key:"c" }] };
globalThis.studyCurrentPage = 0;
globalThis.pageJumps = [];
globalThis.studyJumpToPage = page => { studyCurrentPage = studyNormalizePage(page); pageJumps.push(studyCurrentPage); };
globalThis.single = { scrollHeight:2400, clientHeight:600, scrollTop:0 };
globalThis.spread = [{ scrollHeight:2400, clientHeight:600, scrollTop:0 }, { scrollHeight:2400, clientHeight:600, scrollTop:0 }];
globalThis.flat = { scrollHeight:600, clientHeight:600, scrollTop:0 };
globalThis.elems = { studySingleWrap: () => single, studySpreadWrap: () => ({ querySelectorAll: () => spread }) };
globalThis.window = { Trk: { core: { $: id => elems[id]() } } };
globalThis.closeCalls = 0;
globalThis.studyCloseToShelf = () => { closeCalls++; };
globalThis.jumpEdge = studyJumpZoomEdge;
globalThis.applyLand = studyApplyZoomLand;
`, edgeContext);
const edge = (fn, ...args) => vm.runInContext(`${fn}(${args.join(",")})`, edgeContext);
const edgeState = () => vm.runInContext("({ page:studyCurrentPage, jumps:pageJumps.slice(), land:studyZoomLand, top:single.scrollTop, spread:spread.map(n => n.scrollTop) })", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "PageDown moves a zoomed image");
assert.equal(edgeState().top, 1800, "PageDown jumps to the bottom of the image");
assert.deepEqual(Array.from(edgeState().jumps), [], "the first press stays inside the image");
assert.equal(edge("jumpEdge", 1), true, "PageDown at the bottom still moves");
assert.deepEqual(Array.from(edgeState().jumps), [1], "PageDown at the bottom turns to the next page");
assert.equal(edgeState().land, "top", "the next page opens at its top");
assert.equal(edgeState().top, 1800, "the page turn leaves the old scroll position to the landing step");
edge("applyLand");
assert.equal(edgeState().land, "", "the landing is applied once");
assert.equal(edgeState().top, 0, "the landing opens the new page at the top");
assert.equal(edge("jumpEdge", 1), true, "PageDown on the new page moves again");
assert.equal(edgeState().top, 1800, "PageDown goes to the bottom again");
assert.equal(edge("jumpEdge", -1), true, "PageUp at the bottom moves");
assert.equal(edgeState().top, 0, "PageUp jumps to the top");
assert.equal(edge("jumpEdge", -1), true, "PageUp at the top still moves");
assert.deepEqual(Array.from(edgeState().jumps), [1, 0], "PageUp at the top turns to the previous page");
assert.equal(edgeState().land, "bottom", "the previous page opens at its bottom");
edge("applyLand");
assert.equal(edgeState().top, 1800, "the landing opens the previous page at the bottom");
vm.runInContext("studyCurrentPage = 2; single.scrollTop = 1800; pageJumps.length = 0; closeCalls = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "at the end of the book PageDown is still handled");
assert.deepEqual(Array.from(edgeState().jumps), [], "the last page does not turn");
assert.equal(edgeState().top, 1800, "at the end of the book the image no longer wraps to the top");
assert.equal(edgeState().land, "", "no landing is left over at the end of the book");
assert.equal(vm.runInContext("closeCalls", edgeContext), 1, "PageDown at the end of the book closes instead");
vm.runInContext("studyCurrentPage = 0; single.scrollTop = 0; closeCalls = 0;", edgeContext);
assert.equal(edge("jumpEdge", -1), true, "at the first page PageUp is still handled");
assert.equal(edgeState().top, 0, "at the first page the image no longer wraps to the bottom");
assert.equal(vm.runInContext("closeCalls", edgeContext), 1, "PageUp at the first page closes instead");
/* 最後で閉じる設定は単ページ／見開きの両方に効き、PageUpや途中のページ送りを変えない。 */
for (const mode of ["single", "spread"]) {
  vm.runInContext(`studyPrefs.imageMode = "${mode}"; studyPrefs.closeOnLastPageDown = false;
    studyCurrentPage = 2; single.scrollTop = 1800; spread.forEach(n => n.scrollTop = 1800);
    closeCalls = 0; pageJumps.length = 0;`, edgeContext);
  assert.equal(edge("jumpEdge", 1), true, `${mode}: last-page PageDown is consumed when closing is off`);
  assert.equal(vm.runInContext("closeCalls", edgeContext), 0);
  assert.equal(edgeState().page, 2);
  assert.deepEqual(Array.from(edgeState().jumps), []);
  assert.equal(edgeState().top, 1800);
  assert.equal(edge("jumpEdge", 1, true), true);
  assert.equal(vm.runInContext("closeCalls", edgeContext), 0);
  vm.runInContext("studyCurrentPage = 0; single.scrollTop = 0; spread.forEach(n => n.scrollTop = 0);", edgeContext);
  assert.equal(edge("jumpEdge", -1), true);
  assert.equal(vm.runInContext("closeCalls", edgeContext), 1, "PageUp at the start remains unchanged");
  vm.runInContext("closeCalls = 0; single.scrollTop = 1800; spread.forEach(n => n.scrollTop = 1800);", edgeContext);
  edge("jumpEdge", 1);
  assert.equal(edgeState().page, mode === "spread" ? 2 : 1, "normal page turns still work");
  vm.runInContext('studyZoomLand = ""; studyCurrentPage = 2; studyPrefs.closeOnLastPageDown = true;', edgeContext);
  edge("jumpEdge", 1, true);
  assert.equal(vm.runInContext("closeCalls", edgeContext), 0, "even when on, holding never closes");
  edge("jumpEdge", 1);
  assert.equal(vm.runInContext("closeCalls", edgeContext), 1, "re-enabling closes on a fresh press");
}
vm.runInContext('studyPrefs.imageMode = "single";', edgeContext);
/* 押しっぱなし（キーリピート）では端で止まる：ページ送りも閉じる動作もしない（押し直したときだけ） */
vm.runInContext("studyCurrentPage = 2; single.scrollTop = 1800; pageJumps.length = 0; closeCalls = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1, true), true, "a held PageDown at the end of the book is swallowed");
assert.equal(vm.runInContext("closeCalls", edgeContext), 0, "a held PageDown never closes the book");
vm.runInContext("studyCurrentPage = 1; single.scrollTop = 1800;", edgeContext);
assert.equal(edge("jumpEdge", 1, true), true, "a held PageDown at the bottom is swallowed");
assert.deepEqual(Array.from(edgeState().jumps), [], "a held PageDown does not turn the page");
vm.runInContext("single.scrollTop = 0;", edgeContext);
edge("jumpEdge", 1, true);
assert.equal(edgeState().top, 1800, "a held PageDown still reaches the bottom of the image");
/* 次のページを描画中（scrollHeightがまだ0）：押しっぱなしはページを飛ばさず、押し直しだけページ送り */
vm.runInContext("studyCurrentPage = 0; single.scrollTop = 0; single.scrollHeight = 0; pageJumps.length = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1, true), true, "a held PageDown while the next page is still rendering is swallowed");
assert.deepEqual(Array.from(edgeState().jumps), [], "a held PageDown while rendering does not turn the page");
assert.equal(edge("jumpEdge", 1, false), false, "a fresh PageDown while rendering falls back to the page turn");
/* trk136：画面に収まる画像（はみ出し無し・高さは0でない）では、押しっぱなしもページ送りへゆずる（長押しで連続して進む） */
vm.runInContext('single.scrollHeight = 900; single.clientHeight = 900; studyZoomLand = "";', edgeContext);
assert.equal(edge("jumpEdge", 1, true), false, "a held PageDown on an image that fits falls through to the page turn");
vm.runInContext('studyZoomLand = "top";', edgeContext);
assert.equal(edge("jumpEdge", 1, true), true, "but not while a landing from an edge jump is still pending");
vm.runInContext('studyZoomLand = ""; single.clientHeight = 600;', edgeContext);
vm.runInContext("single.scrollHeight = 2400; single.scrollTop = 0;", edgeContext);
vm.runInContext("studyCurrentPage = 0; single.scrollTop = 0; closeCalls = 0; pageJumps.length = 0;", edgeContext);
vm.runInContext("single.scrollTop = 300; closeCalls = 0;", edgeContext);
assert.equal(edge("jumpEdge", -1), true, "PageUp away from the top keeps working");
assert.equal(edgeState().top, 0, "PageUp away from the top goes to the top");
assert.equal(vm.runInContext("closeCalls", edgeContext), 0, "closing only happens at the ends of the book");
vm.runInContext("studyCurrentPage = 0; single.scrollTop = 0; studyPrefs.imageMode = \"spread\"; pageJumps.length = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "a spread moves too");
assert.deepEqual(Array.from(edgeState().spread), [1800, 1800], "both spread pages jump to the bottom");
assert.equal(edge("jumpEdge", 1), true, "a spread turns by one opening");
assert.deepEqual(Array.from(edgeState().jumps), [2], "a spread turns two pages at a time");
vm.runInContext("spread.forEach(node => { node.scrollTop = 0; }); studyCurrentPage = 0; pageJumps.length = 0; studyPrefs.imageMode = \"spread\";", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "a spread with only one page scrolled moves the images");
assert.deepEqual(Array.from(edgeState().jumps), [], "a half-scrolled spread jumps to the edge instead of turning");
vm.runInContext("spread[0].scrollTop = 1800; spread[1].scrollTop = 900; pageJumps.length = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "a spread with one page already at the bottom still moves");
assert.deepEqual(Array.from(edgeState().jumps), [], "the page turns only when every spread page is at the edge");
assert.deepEqual(Array.from(edgeState().spread), [1800, 1800], "both spread pages align to the bottom");
vm.runInContext("studyPrefs.imageMode = \"vertical\";", edgeContext);
assert.equal(edge("jumpEdge", 1), false, "vertical comic mode keeps the stage's own scrolling");
vm.runInContext("studyPrefs.imageMode = \"single\"; studyPrefs.zoom = 1;", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "at 100% overflowing images jump to the edge too");
assert.equal(edgeState().top, 1800);
vm.runInContext("studyCurrentPage = 1; single.scrollTop = 0; pageJumps.length = 0;", edgeContext);
assert.equal(edge("jumpEdge", -1), true, "at 100% PageUp at the top goes to the previous page");
assert.equal(edgeState().land, "bottom");
edge("applyLand");
assert.equal(edgeState().top, 1800, "at 100% the previous page opens at the bottom");
vm.runInContext("studyPrefs.zoom = 0.5; single.scrollTop = 0;", edgeContext);
assert.equal(edge("jumpEdge", 1), true, "at 50% an overflowing image still jumps to the edge");
assert.equal(edge("jumpEdge", 1, true), true, "holding at 50% still stops at the edge");
vm.runInContext("studyPrefs.zoom = 1; studyPrefs.imageMode = 'spread'; spread.forEach(n => n.scrollTop = 0);", edgeContext);
assert.equal(edge("jumpEdge", 1), true);
assert.deepEqual(Array.from(edgeState().spread), [1800, 1800], "unzoomed spread pages jump together");
vm.runInContext("studyPrefs.imageMode = 'single';", edgeContext);
vm.runInContext("studyPrefs.zoom = 2; studyCurrentBook = { kind:\"text\", pages:[] };", edgeContext);
assert.equal(edge("jumpEdge", 1), false, "text books keep their own key handling");
vm.runInContext("studyCurrentBook = { kind:\"image\", pages:[{ key:\"a\" }] }; single.scrollTop = 0; elems.studySingleWrap = () => flat;", edgeContext);
assert.equal(edge("jumpEdge", 1), false, "an image that fits the screen has no edge to jump to");
/* ---------- 本の端の「閉じる動作」（全画面を終了して本棚へ） ---------- */
const closeEdgeFn = readerWithCore.match(/function studyCloseToShelf\(\) \{[\s\S]*?\n\}/);
assert.ok(closeEdgeFn, "the close-to-the-shelf action is defined");
const closeContext = vm.createContext({});
vm.runInContext(`${closeEdgeFn[0]}
globalThis.studyFullscreenFallback = true;
globalThis.state = { fullimage:true, exit:0, back:0, sync:0 };
globalThis.room = { classList:{ contains:name => state.fullimage && name === "study-fullimage",
  remove:name => { if (name !== "study-fullimage") throw new Error("removed the wrong class: " + name); state.fullimage = false; } } };
globalThis.document = { fullscreenElement:null, exitFullscreen:() => { state.exit++; return Promise.resolve(); } };
globalThis.window = { Trk: { core: { $: () => room } } };
globalThis.studySyncCurrentBookControls = () => { state.sync++; };
globalThis.studySyncFindRow = () => { state.sync++; };
globalThis.studyBackToShelf = () => { state.back++; return true; };
globalThis.exitAtBookEdge = studyCloseToShelf;
`, closeContext);
const closeState = () => ({ ...vm.runInContext("state", closeContext), fallback:vm.runInContext("studyFullscreenFallback", closeContext) });
vm.runInContext("exitAtBookEdge();", closeContext);
assert.deepEqual(closeState(), { fullimage:false, fallback:false, exit:0, back:1, sync:2 },
  "in image full screen it leaves full screen, clears the fallback flag, fixes the controls, and returns to the shelf");
vm.runInContext("state.fullimage = true; state.exit = 0; state.back = 0; state.sync = 0; document.fullscreenElement = window.Trk.core.$();", closeContext);
vm.runInContext("exitAtBookEdge();", closeContext);
assert.deepEqual(closeState(), { fullimage:false, fallback:false, exit:1, back:1, sync:2 },
  "a real browser full screen is exited through the API");
vm.runInContext("state.fullimage = true; state.exit = 0; state.back = 0; state.sync = 0; document.fullscreenElement = null;", closeContext);
vm.runInContext("exitAtBookEdge();", closeContext);
assert.deepEqual(closeState(), { fullimage:false, fallback:false, exit:0, back:1, sync:2 },
  "a CSS-only image full screen does not call the browser full-screen API");
vm.runInContext("state.fullimage = true; state.back = 0; state.sync = 0; document.fullscreenElement = { other:true };", closeContext);
vm.runInContext("exitAtBookEdge();", closeContext);
assert.deepEqual(closeState(), { fullimage:false, fallback:false, exit:0, back:1, sync:2 },
  "another element's full screen is left alone");
vm.runInContext("state.fullimage = false; state.back = 0; state.sync = 0;", closeContext);
vm.runInContext("exitAtBookEdge();", closeContext);
assert.deepEqual(closeState(), { fullimage:false, fallback:false, exit:0, back:1, sync:0 },
  "outside image full screen it only returns to the shelf");

/* ---------- 長押しの共通ヘルパー（trk125） ---------- */
const holdFn = readerWithCore.match(/function studyBindHoldPress\(node, action\) \{[\s\S]*?\n\}/);
assert.ok(holdFn, "the shared long-press helper is defined");
const holdConsts = readerWithCore.match(/const STUDY_HOLD_MS = (\d+), STUDY_HOLD_MOVE_MAX = (\d+);/);
assert.ok(holdConsts, "the long-press timing constants are defined");
const holdContext = vm.createContext({});
vm.runInContext(`${holdFn[0]}
globalThis.STUDY_HOLD_MS = ${holdConsts[1]}; globalThis.STUDY_HOLD_MOVE_MAX = ${holdConsts[2]};
globalThis.now = 0;
globalThis.timers = new Map(); globalThis.seq = 1;
globalThis.setTimeout = (fn, ms) => { const id = seq++; timers.set(id, { fn, at:now + ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
globalThis.tick = ms => { now += ms; for (const [id, t] of [...timers]) { if (t.at <= now) { timers.delete(id); t.fn(); } } };
globalThis.Date = { now:() => now };
globalThis.calls = 0;
globalThis.events = new Map();
globalThis.node = { addEventListener:(type, fn) => events.set(type, fn) };
globalThis.hold = studyBindHoldPress(node, () => { calls++; });
globalThis.fire = (type, event) => { const fn = events.get(type); if (fn) fn(event); };
globalThis.press = (x = 100, y = 50) => { fire("pointerdown", { button:0, pointerType:"mouse", clientX:x, clientY:y }); };
`, holdContext);
const holds = () => vm.runInContext("calls", holdContext);
const holdRun = code => vm.runInContext(`calls = 0; hold.cancel(); ${code}`, holdContext);
holdRun("press(); tick(650);");
assert.equal(holds(), 1, "holding for 650ms fires once");
assert.equal(vm.runInContext("hold.fired()", holdContext), true, "the click that follows a long press can be swallowed");
holdRun("hold.reset(); press(); tick(640); fire(\"pointerup\", {}); tick(2000);");
assert.equal(holds(), 0, "a press shorter than 650ms does not fire, even after the release");
holdRun("press(); fire(\"pointermove\", { pointerType:\"touch\", clientX:140, clientY:50 }); tick(2000); fire(\"pointerup\", {});");
assert.equal(holds(), 0, "dragging (the pointer moved) cancels the press");
holdRun("press(); fire(\"pointercancel\", { pointerType:\"touch\", clientX:400, clientY:50 }); tick(2000);");
assert.equal(holds(), 0, "a pointercancel that reports a moved pointer cancels the press");
holdRun("press(); tick(300); fire(\"pointerleave\", { pointerType:\"mouse\" }); tick(2000); fire(\"pointerup\", {});");
assert.equal(holds(), 0, "a mouse leaving the button cancels the press");
holdRun("press(); fire(\"pointerleave\", { pointerType:\"touch\" }); tick(650);");
assert.equal(holds(), 1, "a touch pointerleave does not cancel the press");
holdRun("fire(\"pointerdown\", { button:2, pointerType:\"mouse\", clientX:100, clientY:50 }); tick(2000);");
assert.equal(holds(), 0, "the right button does not start a long press");
/* 状態を持ち越す検査（case をまたいで hold.cancel() しない） */
vm.runInContext('calls = 0; hold.cancel(); press(); fire("pointercancel", { pointerType:"touch", clientX:100, clientY:50 }); tick(650);', holdContext);
assert.equal(holds(), 1, "a browser-side pointercancel of a still pointer does not stop the long press");
vm.runInContext('fire("pointerup", {}); tick(2000);', holdContext);
assert.equal(holds(), 1, "the release after a cancelled press does not fire a second time");
vm.runInContext('calls = 0; hold.cancel(); press(); timers.clear(); tick(700);', holdContext);
assert.equal(holds(), 0, "a lost timer does not fire by itself");
vm.runInContext('fire("pointerup", {});', holdContext);
assert.equal(holds(), 1, "releasing after 650ms fires even if the timer was lost");
vm.runInContext('calls = 0; hold.cancel(); press(); tick(650); tick(1200);', holdContext);
assert.equal(vm.runInContext("hold.fired()", holdContext), false, "the swallow flag clears itself after the click");

/* ---------- PCの簡易操作（左右クリック）と中クリックの選択 ---------- */
const mouseFn = readerWithCore.match(/function studyMouseClickPage\(button\) \{[\s\S]*?\n\}/);
assert.ok(mouseFn, "the mouse-click page turn is defined");
const clickContext = vm.createContext({});
vm.runInContext(`${mouseFn[0]}
globalThis.studyLastPointerType = "";
globalThis.studyPrefs = { mouseClickPages:true, mouseClickFlip:false, middleClickAction:"none", imageMode:"single" };
globalThis.studyRoomOpen = true;
globalThis.studyCurrentBook = { kind:"image", pages:[{ key:"a" }, { key:"b" }] };
globalThis.steps = [];
globalThis.studyStep = direction => { steps.push(direction); };
globalThis.mouseClick = studyMouseClickPage;
`, clickContext);
/* pointerdown で覚えた種類を1回だけ使う（同じ種類のまま2回目は効かない＝合成 click を拾わない） */
const clickRun = (button, pointerType) => Array.from(vm.runInContext(
  `studyLastPointerType = ${JSON.stringify(pointerType)}; [studyMouseClickPage(${button}), studyMouseClickPage(${button})]`, clickContext));
const clickSteps = () => Array.from(vm.runInContext("steps", clickContext));
assert.deepEqual(clickRun(0, "mouse"), [true, false], "a mouse left click turns the page once, and the pointer type is consumed");
assert.deepEqual(clickSteps(), [1], "the left click goes to the next page");
assert.deepEqual(clickRun(2, "mouse"), [true, false], "a mouse right click turns the page back");
assert.deepEqual(clickSteps(), [1, -1], "the right click goes to the previous page");
assert.deepEqual(clickRun(0, "touch"), [false, false], "a touch tap keeps the tap zones");
assert.deepEqual(clickRun(0, "pen"), [false, false], "a pen tap keeps the tap zones");
assert.deepEqual(clickSteps(), [1, -1], "taps never use the mouse buttons");
vm.runInContext("steps.length = 0; studyPrefs.mouseClickFlip = true;", clickContext);
assert.deepEqual(clickRun(0, "mouse"), [true, false], "the swap keeps working");
assert.deepEqual(clickSteps(), [-1], "with the swap on, the left click goes back");
assert.deepEqual(clickRun(2, "mouse"), [true, false], "the swap applies to the right click too");
assert.deepEqual(clickSteps(), [-1, 1], "with the swap on, the right click goes forward");
vm.runInContext("steps.length = 0; studyPrefs.mouseClickFlip = false; studyPrefs.mouseClickPages = false;", clickContext);
assert.deepEqual(clickRun(0, "mouse"), [false, false], "without the setting the mouse buttons do nothing");
vm.runInContext("studyPrefs.mouseClickPages = true; studyPrefs.imageMode = \"vertical\";", clickContext);
assert.deepEqual(clickRun(0, "mouse"), [false, false], "vertical comic mode keeps the stage's own scrolling");
vm.runInContext("studyPrefs.imageMode = \"spread\"; studyCurrentBook = { kind:\"text\", pages:[] };", clickContext);
assert.deepEqual(clickRun(0, "mouse"), [false, false], "text books keep their own click handling");
vm.runInContext("studyCurrentBook = { kind:\"image\", pages:[] }; studyRoomOpen = false;", clickContext);
assert.deepEqual(clickRun(0, "mouse"), [false, false], "outside the room the mouse buttons do nothing");
assert.deepEqual(clickSteps(), [], "no page was turned in any of those cases");
/* 中クリックの3択 */
const middleFn = readerWithCore.match(/function studyMiddleClick\(event, act\) \{[\s\S]*?\n\}/);
assert.ok(middleFn, "the middle-click action is defined");
const middleContext = vm.createContext({});
vm.runInContext(`${middleFn[0]}
globalThis.studyPrefs = { middleClickAction:"next" };
globalThis.studyRoomOpen = true;
globalThis.studyCurrentBook = { kind:"image", pages:[] };
globalThis.steps = 0; globalThis.closes = 0; globalThis.prevented = 0;
globalThis.studyStep = direction => { steps += direction; };
globalThis.studyCloseToShelf = () => { closes++; };
globalThis.middle = (button, act) => studyMiddleClick({ button, preventDefault:() => { prevented++; } }, act);
`, middleContext);
const middleRun = (button, act) => vm.runInContext(`middle(${button}, ${act})`, middleContext);
assert.equal(middleRun(1, false), true, "the middle button is recognized on mousedown");
assert.equal(vm.runInContext("prevented", middleContext), 1, "the browser's auto-scroll is suppressed");
assert.equal(vm.runInContext("steps", middleContext), 0, "mousedown only stops the auto-scroll");
assert.equal(middleRun(1, true), true, "the middle click runs its action");
assert.equal(vm.runInContext("steps", middleContext), 1, "the next-page choice turns the page");
assert.equal(middleRun(1, true), true, "the action can repeat");
assert.equal(vm.runInContext("steps", middleContext), 2, "every middle click turns one page");
vm.runInContext("studyPrefs.middleClickAction = \"close\";", middleContext);
assert.equal(middleRun(1, true), true, "the close choice is handled");
assert.equal(vm.runInContext("closes", middleContext), 1, "the close choice returns to the shelf");
assert.equal(vm.runInContext("steps", middleContext), 2, "the close choice does not also turn the page");
vm.runInContext("studyPrefs.middleClickAction = \"none\";", middleContext);
assert.equal(middleRun(1, true), false, "the default choice does nothing");
assert.equal(middleRun(0, true), false, "the left button is left to the tap zones");
vm.runInContext("studyPrefs.middleClickAction = \"next\"; studyCurrentBook = { kind:\"text\", pages:[] };", middleContext);
assert.equal(middleRun(1, true), false, "text books keep their own middle click");
vm.runInContext("studyCurrentBook = { kind:\"image\", pages:[] }; studyRoomOpen = false;", middleContext);
assert.equal(middleRun(1, true), false, "outside the room the middle click does nothing");

const advancedMarkup = html.slice(html.indexOf('<div id="studySettings"'), html.indexOf('<div id="studyHelp"'));
assert.ok(/<input id="studyPageKeysTurnPages" type="checkbox">/.test(advancedMarkup),
  "direct page turning is opt-in; the image edge jump is the default");
assert.ok(/<input id="studyMouseClickPages" type="checkbox">/.test(advancedMarkup) && /<input id="studyMouseClickFlip" type="checkbox">/.test(advancedMarkup),
  "the PC click options start off");
assert.ok(/<select id="studyMiddleClickAction"[^>]*>[\s\S]*?<option value="none"[\s\S]*?<option value="next"[\s\S]*?<option value="close"/.test(advancedMarkup),
  "the middle click selects nothing / the next page / closing to the shelf");
assert.ok(reader.includes('studyBindPref("studyPageKeysTurnPages", "pageKeysTurnPages")') && reader.includes('studyBindPref("studyMouseClickPages", "mouseClickPages"') &&
  reader.includes('studyBindPref("studyMouseClickFlip", "mouseClickFlip")') && reader.includes('studyBindPref("studyMiddleClickAction", "middleClickAction")') &&
  reader.includes("raw.zoomEdgeKeys === false") && reader.includes("studyPrefs.mouseClickPages = raw.mouseClickPages === true") &&
  reader.includes("studyPrefs.mouseClickFlip = raw.mouseClickFlip === true") && reader.includes("STUDY_MIDDLE_CLICK_ACTIONS.includes(raw.middleClickAction)") &&
  reader.includes('raw.middleClickNext === true ? "next" : "none"'),
  "the options are stored and read back with their intended defaults (the old middle-click choice is carried over)");
const clickUiFn = reader.match(/function studyRefreshPrefsUI\(\) \{[\s\S]*?\n\}/);
assert.ok(reader.includes('$("studyMiddleClickAction").value = studyPrefs.middleClickAction') &&
  clickUiFn && clickUiFn[0].includes('$("studyMouseClickFlip").disabled = !studyPrefs.mouseClickPages'),
  "the swap option is only available while the click paging is on, and the middle click reads back its choice");

assert.ok(reader.includes('studyBindPref("studyZoomPercentStep", "zoomPercentStep"'),
  "the zoom-step select is wired to the preference");
const prefsUiFn = reader.match(/function studyRefreshPrefsUI\(\) \{[\s\S]*?\n\}/);
assert.ok(prefsUiFn && prefsUiFn[0].includes("studySyncZoomStepRow()"),
  "opening the room fills the zoom-step select from the saved preference");
assert.ok(/on\("language",[\s\S]{0,900}?studySyncZoomStepRow\(\)/.test(reader),
  "changing the app language relabels the zoom-step options");
assert.ok(reader.includes('option.textContent = tr("studyZoomStepOption"'), "the select options are relabelled from the dictionary");
assert.ok(reader.includes("sweepOrphans:studySweepOrphans") && reader.includes("toggle:() =>"), "the public API exposes sweepOrphans/toggle for hosts and tests");
assert.ok(reader.includes("function studyHelpOpen") && reader.includes("studyHelpTitle"), "the shortcut help overlay exists");
assert.ok(reader.includes("document.body") && reader.includes("isConnected"), "the live <video> is restored even if its old parent was replaced");

/* 4言語の網羅 */
const localizedKeys = {};
for (const lang of ["ja", "en", "zh", "ko"]) {
  const match = reader.match(new RegExp(`Object\\.assign\\(TEXT\\.${lang}, \\{([\\s\\S]*?)\\n\\}\\);`));
  assert.ok(match, `the ${lang} Study translation block exists`);
  localizedKeys[lang] = new Set([...match[1].matchAll(/\b(study[A-Za-z0-9]+)\s*:/g)].map(item => item[1]));
}
assert.ok(localizedKeys.ja.size >= 150, `the Study feature documents its own strings (found ${localizedKeys.ja.size})`);
for (const lang of ["en", "zh", "ko"]) {
  const missing = [...localizedKeys.ja].filter(key => !localizedKeys[lang].has(key));
  const extra = [...localizedKeys[lang]].filter(key => !localizedKeys.ja.has(key));
  assert.deepEqual(missing, [], `${lang} has every Japanese Study string`);
  assert.deepEqual(extra, [], `${lang} has no Study string missing from Japanese`);
}

/* 30種類の文字スキン（既存24種＋trk86の6種）と4分類 */
const themeDeclaration = reader.match(/const STUDY_THEMES = \[([\s\S]*?)\];/);
assert.ok(themeDeclaration, "the supported Study theme IDs are declared");
const studyThemes = [...themeDeclaration[1].matchAll(/"([a-z]+)"/g)].map(match => match[1]);
assert.equal(studyThemes.length, 30, "Study keeps exactly 30 text themes");
assert.equal(new Set(studyThemes).size, 30, "Study theme IDs are unique");
const expectedThemes = ["plain", "paper", "warm", "lined", "genko", "sepia", "dark", "midnight", "terminal", "graphite", "blueprint", "contrast",
  "prompt", "neural", "latent", "matrix", "synth", "neon", "aurora", "sunset", "ocean", "mint", "dream", "prism"];
expectedThemes.splice(6, 0, "sticky", "letter", "diary", "haiku", "newspaper");
expectedThemes.push("staff");
assert.deepEqual(studyThemes, expectedThemes, "the stable theme IDs and category order stay intentional");
assert.ok(reader.includes('if (node.tagName === "OPTGROUP") node.label = translated;'), "language changes update optgroup labels without replacing their options");
for (const key of ["studyThemeGroupWriter", "studyThemeGroupCode", "studyThemeGroupAi", "studyThemeGroupFree"])
  for (const lang of ["ja", "en", "zh", "ko"]) assert.ok(localizedKeys[lang].has(key), `${lang} includes ${key}`);

/* index.html のIDと data-i18n */
const staticIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
const missingIds = [...reader.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]).filter(id => !staticIds.has(id));
assert.deepEqual([...new Set(missingIds)], [], "Study static element references exist in index.html");
const section = html.slice(html.indexOf('<section id="studyRoom"'), html.indexOf('<button id="floatingSafeBtn"'));
const themeSelectMarkup = section.match(/<select id="studyTheme">([\s\S]*?)<\/select>/)?.[1];
assert.ok(themeSelectMarkup, "the Study text-theme selector exists");
const themeGroups = [...themeSelectMarkup.matchAll(/<optgroup\b[^>]*data-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/optgroup>/g)];
assert.equal(themeGroups.length, 4, "text themes have four localized optgroups");
assert.deepEqual(themeGroups.map(group => group[1]), ["studyThemeGroupWriter", "studyThemeGroupCode", "studyThemeGroupAi", "studyThemeGroupFree"]);
const groupedThemes = themeGroups.map(group => [...group[2].matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match => match[1]));
assert.deepEqual(groupedThemes.map(group => group.length), [11, 6, 5, 8], "writer/code/AI/freeform groups have the planned counts");
assert.deepEqual(groupedThemes.flat(), studyThemes, "HTML options match the supported theme list and order");
assert.ok(section.includes('id="studyRoom"') && section.includes('id="studyBookmarkPanel"') && section.includes('id="studyImportWrap"'));
assert.ok(section.includes('id="studyShelfSort"') && section.includes('id="studyFindRow"') && section.includes('id="studyHelp"') && section.includes('id="studyZoomIn"'));
assert.ok(section.includes('id="studyShelfCreateFolder"') && section.includes('id="studyManualShelfOrder"') &&
  section.includes('id="studyFoldersFirst"') && section.includes('id="studySkipDeleteConfirm"') && section.includes('id="studyShelfDragHelp"'),
  "the bookshelf folder and advanced preference controls exist in the room markup");
assert.ok(section.includes('id="studyShelfVisible"') && section.includes('id="studyShowShelfBtn"') &&
  section.includes('id="studyNextKeyBtn"') && section.includes('id="studyPreviousKeyBtn"') && section.includes('id="studyVerticalImageKeys"'),
  "the shelf visibility and configurable navigation controls exist in the room markup");
assert.ok(section.includes('id="studyEditorNotice"') && section.includes('id="studyEditorLabel"') &&
  section.includes('id="studyEditorSafetyText"') && section.includes('id="studyEditorSaveStatus"') &&
  section.includes('aria-labelledby="studyEditorLabel"') && section.includes('aria-describedby="studyEditorSafetyText"') &&
  section.includes('maxlength="12582912"'),
  "the inert local-copy editor includes a safety notice, save state, and accessible label");
assert.ok(section.includes('id="studyEditedTextFolder"') && section.includes('aria-labelledby="studyEditedTextFolderLabel"') &&
  section.includes('aria-describedby="studyEditedTextFolderHint"') && section.includes('id="studyEditedTextFolderHint"') &&
  section.includes('id="studyChooseExportFolderBtn"') && section.includes('aria-describedby="studyExportFolderHint"') &&
  section.includes('id="studyExportFolderHint"') && section.includes('id="studyClearExportFolderBtn"') &&
  section.includes('id="studyExportFolderName"'),
  "advanced options can organize edited books and select a device export folder");
const htmlKeys = new Set([...section.matchAll(/data-i18n=["']([^"']+)["']/g)].map(match => match[1]));
const missingHtmlKeys = [...htmlKeys].filter(key => !localizedKeys.ja.has(key));
assert.deepEqual(missingHtmlKeys, [], "every data-i18n key in the Study markup has a Japanese string");
assert.ok(section.includes('id="studyRoom"') && /role="dialog"/.test(section) && /aria-modal="true"/.test(section), "the room is an accessible dialog");

/* 安全側の作り（外部送信なし・HTML解釈なし） */
assert.ok(!/\bfetch\s*\(/.test(reader) && !/\bXMLHttpRequest\b/.test(reader), "Study never uploads/requests imported files");
assert.ok(!reader.includes(".innerHTML") && !reader.includes("insertAdjacentHTML"), "imported text is never parsed as HTML");
assert.ok(reader.includes('document.addEventListener("keydown", studyKeyDown, true)'));
assert.ok(reader.includes("studyTypingTarget"), "typing in inputs keeps its own keys");
assert.ok(!/createMediaElementSource/.test(reader), "Study never re-routes the audio graph");

/* 見た目（css） */
const css = read("css/study-room.css");
assert.ok(css.includes("background-color:var(--study-theme-page)") && css.includes("color:var(--study-theme-ink)") &&
  css.includes("font-family:var(--study-theme-font)"), "reader colors, backgrounds, and fonts use the active theme");
assert.ok(/#libPanel \.libHeadRight #studyOpenBtn\{[^}]*border:1px solid var\(--ui-accent\)/.test(css) &&
  /#libPanel \.libHeadRight #studyOpenBtn\{[^}]*padding:/.test(css),
  "the Study button at the right of the song list keeps its own accent styling so it stands out");
assert.ok(css.includes("background-color:var(--study-theme-editor)") && css.includes("color:var(--study-theme-editor-ink)") &&
  css.includes("font-family:var(--study-theme-editor-font)") && css.includes("font-size:calc(15px * var(--study-text-size))"),
  "the editing textarea also uses the active theme palette, font, and text sizing");
assert.ok(css.includes("--study-theme-editor:#fcfaf4"), "the standard theme also styles the editor like the reading page");
assert.ok(css.includes(".study-text-stage[data-theme=\"genko\"] .study-memo-editor{writing-mode:vertical-rl;text-orientation:mixed;direction:ltr}"),
  "manuscript-paper writing remains vertical in the editor");
for (const theme of studyThemes.filter(id => id !== "plain")) {
  const themeRules = [...css.matchAll(new RegExp(`\\.study-text-stage\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`, "g"))]
    .map(match => match[1]).join("\\n");
  assert.ok(themeRules.includes("--study-theme-stage:") && themeRules.includes("--study-theme-page:") &&
    themeRules.includes("--study-theme-editor:") && themeRules.includes("--study-theme-ink:") && themeRules.includes("--study-theme-editor-ink:"),
    `${theme} defines coordinated reader and editor colors/backgrounds`);
}
assert.ok(css.includes("AI／プロンプト作業をイメージした装飾テーマ（AI処理・通信機能はありません）"), "AI-themed skins are presentation only");
for (const selector of ['.study-tv-screen[data-look="crt"]', '.study-tv-screen[data-look="aquarium"]', "mark.study-search-hit",
  "--study-zoom", "--study-text-size", "--study-tv-ratio", ".study-bookmark-card", ".study-import-track", ".study-help-card",
  ".study-folder-card", ".study-drop-target", ".study-shelf-title", ".study-settings-card", ".study-key-capture", ".study-shelf-hidden",
  ".study-editor-notice", ".study-editor-save-status", ".study-memo-editor", ".study-export-folder-controls", ".study-export-folder-name"])
  assert.ok(css.includes(selector), `css is missing ${selector}`);
assert.ok(css.includes("grid-template-rows:minmax(220px,44vh)") && css.includes("grid-template-rows:minmax(210px,42vh)"),
  "the responsive bookshelf reserves more vertical space for the shelf and its item list");
assert.ok(css.includes("prefers-reduced-motion"), "reduced motion is respected");

/* TVドック／選曲画面との連携（背景・ジャケット） */
const tv = read("js/tv-dock.js");
const library = read("js/library.js");
assert.ok(tv.includes('className = "tvCover"') && tv.includes('on("studyCoverChanged"'));
assert.ok(library.includes('on("studyCoverChanged"') && library.includes("getSongCoverBlob"));
assert.ok(library.includes("settings.useStudyArtwork && window.TrkStudyRoom") &&
  library.includes("studyCover || it.bgBlob || it.artBlob"), "song selection gates the Study cover setting, then prefers pack background over embedded art");
assert.ok(library.includes("lastUseStudyArtwork") && library.includes('on("options"') && library.includes("applySongBackground(song)"),
  "changing Study cover preference reapplies the selected song background");

/* 書斎を開いている間、ゲーム側のキーを止める（旗は window.Trk.overlay に集めた。旧 window._trk*Open は残さない） */
/* js/fx.js（trk113まで凍結。trk114で解除、未移行）の 1 箇所だけは、core.js の読み取り専用の互換アクセサ window._trkStudyRoomOpen を読む */
for (const file of ["player.js", "main.js", "media-player-mode.js", "catch.js", "modes.js", "stage.js", "truck.js", "speed.js", "extras.js", "video-max.js", "synth-mode.js", "fx.js"]) {
  const src = read(`js/${file}`);
  const yields = /Trk\.overlay\.(is\("study"\)|any\(\))/.test(src) || (file === "fx.js" && src.includes("window._trkStudyRoomOpen"));
  assert.ok(yields, `${file} yields global keys to Study`);
}
{
  const jsFiles = fs.readdirSync(new URL("../js/", import.meta.url)).filter(f => f.endsWith(".js") && f !== "fx.js" && f !== "core.js");
  const oldFlags = jsFiles.filter(f => /_trk(StudyRoom|MediaPlayer|SynthMode)Open/.test(read(`js/${f}`)));
  assert.deepEqual(oldFlags, [], "the old window._trk*Open flags are gone (except the frozen fx.js); use window.Trk.overlay");
  const core = read("js/core.js");
  assert.ok(core.includes("window.Trk.overlay = {"), "core.js defines window.Trk.overlay");
  assert.ok(core.includes('Object.defineProperty(window, "_trkStudyRoomOpen"'), "core.js keeps the read-only compatibility getter for the frozen fx.js");
  assert.ok(!/_trk(MediaPlayer|SynthMode)Open/.test(core), "core.js has no old media／synth flag left");
}

console.log(`OK    Study reader: ${localizedKeys.ja.size} strings × 4 languages, 30 text themes / 4 groups / reader-editor styling, shelf folders/drag ordering/visibility, configurable navigation keys, inert text editing/export, data safety, zoom/search/bookmarks/TV wiring, ↑ / ↓ scrolling of a zoomed image (tap = one screen, hold = small steps, edges handed back to the page keys), percent zoom steps for the wheel / buttons / pinch (1 / 2 / 5 / 10 / 25 %, 5 % by default), PageDown / PageUp jumping to the bottom / top of overflowing images at any zoom and then turning the page at its edges (closing at the ends of the book), one long-press helper shared by the Study launch and the shelf folder (surviving a browser pointercancel), an always-visible 📚 Study button at the right of the song list, opt-in page turning by the mouse left / right click (with a swap for trackballs and left-handed use), middle click selectable between nothing / the next page / closing to the shelf`);

# trk! の堅牢性・読みやすさ点検（外部ツールでの素振り・2026-10-06）

「文法や読みやすさの診断サイトに一度かけてみたら、何か出るかも」という方針で、実際に外部ツールを当ててみた記録です。
**見つけたものは直し、直さないものは理由を書いて残す**（`docs/SECURITY.md` と同じ流儀）。ここは**毎回走る検査ではなく**、必要になったときに手で回す「素振り」の手順書です。

---

## 1. 何で点検したか

| 見たこと | 使ったもの | 結果 |
|---|---|---|
| HTML の文法・ARIA の使い方 | `html-validate` 11.16（W3C Nu HTML Checker 相当のオフライン版） | **41件** → 実質は下記の3種類（後述） |
| 起動後DOMのアクセシビリティ（過去の点検） | `axe-core` 4.14（jsdom 内で起動後の DOM に実行、2026-10-06時点） | 当時は **violations 6件**（critical 2・moderate 2・minor 2）＋ incomplete 6件 → 修正後に設定画面・選曲画面とも0件。**2026-10-09のスキン変更後には未再実行**。別途ユーザー提供の「選曲画面19/44」報告は実DOMで再現していない |
| JavaScript の書き間違い | `eslint` 10.12（possible-problems 系ルールのみ。整形の好みは見ない） | **31件**（重複キー29・不可視空白1・Promise の戻り値1） |
| CSS の文法 | `css-tree` 3.x | **0件**（`css/style.css` 1652行・`study-room.css` 300行・`privacy.css` 69行、インライン `<style>` も無し） |
| Web App Manifest | 手元の検査（必須項目・アイコンの実在とサイズ） | **0件**（`display:fullscreen` / 192px・512px あり） |
| 毎回の見張り番 | **`node tools/check-a11y.mjs`**（依存パッケージ不要・`npm run check` に含まれる） | 8 checks。見出しの飛びは0件（許可リストは空）。飛びが出たら FAIL |

> ⚠ この環境からは **validator.w3.org / jigsaw.w3.org / pagespeed.web.dev に到達できません**（ネットワーク遮断）。
> そのため W3C のオンライン診断と同じ規則を実装したオフライン版で代用しています。**手元のブラウザでは**
> <https://validator.w3.org/nu/> ・ axe DevTools 拡張・Lighthouse を一度かけてみてください（§5 に理由）。

## 2. 見つけて直したもの

| # | 見つけたこと | どう直したか |
|---|---|---|
| 1 | **設定画面の入力欄に読み上げ名が無い**（axe: `select-name` critical 2件。静的に数えると **23か所**） | 隣に出ている見出し（`<span data-i18n="…">`）に `id` を付け、`aria-labelledby` で結びつけた（**新しい翻訳文はいらない**）。`別の見出し`→`アンプの段` |
| 2 | **`role="tablist"` の中に「＋」ボタンが混ざっていた**（axe: `aria-required-children` critical） | タブだけを入れる `role="tablist"` の入れ物（`.libTabsList`＝`display:contents`）を作り、**＋ボタンはその外**へ。見た目は今までどおり（スキンのCSSは `.libTabs` のまま） |
| 3 | **「＋」ボタンに `role="presentation"`**（axe: `aria-allowed-role` / `presentation-role-conflict`） | 削除。押せるものから role を消すと、読み上げから見えなくなる |
| 4 | **書斎の起動（曲リストの見出し長押し）が `<h3 role="button">`**（見出しに button は付けられない） | `<h3><button class="study-launch-title">…</button></h3>` に変更（見出しは見出しのまま、押せるのは本物の button）。CSS は `all:unset` で見た目を維持 |
| 5 | **並べ替えの select に名前が無い** | `data-i18n-aria="…"` という仕組みを1つ足し、`aria-label` も辞書から入るように（`libSortLabel` を4言語で追加） |
| 6 | **アンプの「追加する段」select に名前が無い** | 同じ仕組みで `ampStagePick` を4言語追加 |
| 7 | **ノーツの色・形が「ドン」「カッ」としか読まれない** | `aria-labelledby="noteKindLabel0 noteColorLabel"` のように**種類＋色/形**を続けて読ませる（`noteColorAria` / `noteShapeAria` を4言語追加） |
| 8 | **エフェクターや設定のつまみに名前が無い**（EQバンド・ラック・アンプの所のかんたんEQ・スキンの色・判定の位置 など） | 共通のヘルパーで、**隣の見出しを自動で名前にする**（`fx.js` の `range()`・`fx-dock.js`・`stage.js` の `makeRange()`・`stagefx.js`・`extras.js`・`modes.js` の `makeColorRow()` の6か所。**これで60か所ぶんまとめて直る**） |
| 11 | **JSONエディタ（上級者向け）と「ラックに追加する段」の select に名前が無い** | `aria-label` を辞書から（`sfxEditor` を再利用、`sfxRackPick` を4言語追加） |
| 12 | **お気に入りの「種類」select に名前が無い** | 隣の見出しに `id` を付け `aria-labelledby` |
| 9 | **同じ行が2回書かれていた（コピペの残り）** | `js/core.js` 1か所＋`js/i18n-options.js` 4言語ぶん（重複キーは**後ろが勝つ**ので、片方だけ直すと気づかない）を削除 |
| 10 | Promise の戻り値が読み捨てられていた | `new Promise(r => { setTimeout(r, 30); })` に |
| 13 | **パックの容量計算が、索引の値を使えていなかった**（`IDBIndex.getAllKeys()` は**主キー**を返す。パックの主キーは文字列 `"p…"` なので、高速経路が毎回外れて Blob を含む全件を読んでいた。主キーが数値なら、主キーを size と取り違えて合計がずれた） | `openKeyCursor()` の `cursor.key`（索引の値）を1件ずつ読む（`js/core.js` の `idbStore`）。`tests/idb.test.mjs` が、文字列・数値の主キーで高速経路と合計を検査する。修正前のコードでは 3 件が落ちることを確認。実 Chromium でも仕様どおりの戻り値を確認 |

## 3. 直さない（直せない）と決めたもの

| こと | 理由 |
|---|---|
| **見出しの順番が h1→h3**（`heading-order` moderate） | **2026-10-08 に解消**。曲リストの見出しを `h2` にし（`index.html`・`.libHead > h2.libTitle`）、見た目は従来の `h3` と同じ値を CSS で当てた。16スキン・PC／スマホ・英語の計 19 条件で、計算スタイルと位置が変わらないことを確認。許可リストは空（新しい飛びは FAIL） |
| **`<main>` ランドマークが無い**（`landmark-one-main`） | 画面全体が `.screen` の入れ替え（選曲・設定・書斎…）で、`<main>` を1つに決めると**全画面の入れ替え構造そのもの**を触ることになる。単独画面のゲームでは実害が小さい。 |
| **動画に字幕が無い**（`video-caption` critical） | 読み込むのは**利用者自身の動画**で、字幕トラックは端末内に存在しない。アプリ側で字幕を作ることはできない（該当なし扱い）。 |
| **色のコントラスト**（`color-contrast`） | `tests/skin-contrast.test.mjs` が44内蔵スキンのボタン前景・hover・補助文字など、宣言されたHEX色ペアをWCAG比で静的に検査する。これは実DOMの色合成・opacity・擬似状態を計算せず、ユーザー提供の選曲画面「19/44」axe報告も実DOMでは再現していない。最後は**実ブラウザの axe DevTools / Lighthouse**で確認する。 |
| **JS が作るボタンの `type` が無い（97か所）** | いま `<form>` が1つも無いので実害ゼロ（あれば送信＝リロードになる）。**将来 `<form>` を足すときは要対応**。 |
| **`hidden=""` の書き方**（html-validate 116件） | `el.hidden = true` の結果で、HTML として**正しい**。見た目の問題も無し。 |
| **`hidden` の空白（U+3000）**（eslint 1件） | `js/custom.js` の説明文の**読みやすさのための全角スペース**。意図したもの。 |
| `aria-label` が一部英語のまま（`Zoom` / `Seek` など） | 既存の書き方。**日本語に揃えるなら別作業**として残す（機能の不具合ではない）。 |
| 画面の**見た目そのもの** | jsdom は「計算後の色・大きさ」を持たないので、**実ブラウザで見るしかない**（`docs/HANDOFF.md` の「未確認の実機項目」に記載）。 |

## 4. 毎回走る見張り番（`npm run check` の中）

`tools/check-a11y.mjs`（依存パッケージ不要）:

1. **id の重複が無い**（JS が後から付ける id とぶつかっていないかも見る）
2. **入力欄（select / input / textarea）に読み上げ名がある**（`aria-label` / `label` / `title` / `data-i18n-aria`、`label` で包んでいる）
3. **`<img>` に `alt` がある**
4. **押せるものの role を消していない**（`role="presentation"` / `"none"`）
5. **`role="tablist"` の中身がタブだけ**（＋ボタンを混ぜない。`js/library.js` の `libTabsList` を見る）
6. **見出しの飛びが無い** — 許可リストは空。`h1→h3` は 2026-10-08 に解消（飛びが出たら FAIL）
7. **色コントラストは別のNodeテスト** — `tests/skin-contrast.test.mjs` が44スキンの固定HEXペアを確認する。計算スタイル／DOM opacity／実hover状態／背景合成は測らないため、axeの代わりではない。

## 5. もう一度やりたいとき（手順）

`npm run check` は**依存ゼロ**を保ちたいので、外部ツールはリポジトリの外に入れて使います。

```sh
mkdir -p /tmp/validate && cd /tmp/validate
npm i html-validate axe-core jsdom fake-indexeddb css-tree eslint

# HTML（ソース）: html-validate
node -e 'import("html-validate").then(async ({HtmlValidate})=>{const r=await new HtmlValidate({extends:["html-validate:recommended"]}).validateFile("/home/user/trk/index.html");console.log(r.valid, r.results.flatMap(x=>x.messages).length);})'

# 起動後の DOM に axe: jsdom で index.html を読み、window.eval(axe のソース) → axe.run(document)
# ESLint: リポジトリ内に一時設定を置いて（possible-problems 系のみ）→ 使い終わったら消す
```

- **起動後の DOM を見る**のが大事（`data-i18n` で文字が入るのは起動後。ソースだけ見ると「空の見出し」が大量に出る）
- axe は**隠れている画面を飛ばす**ので、`#settingsScreen` などを `hidden = false` にしてから走らせる
- 実ブラウザでは **axe DevTools**・**Lighthouse**・**<https://validator.w3.org/nu/>** を一度（本番 URL でも可）。この環境からは到達できませんでした
- 点検は**隠れている画面も開けて**行う（axe は隠れた要素を飛ばすため）。設定画面なら `#settingsScreen.hidden = false` ＋ 中の `<details>` を `open = true`

---

最終更新: 2026-10-09（44スキンの固定色ペアのNode検査を追加。実DOM／axeでの再確認は未実施）

# 書体（フォント）スキン 9 種を足す（trk228・2026-10-31）

> **対象**：trk228（trk227 の次）／作業ブランチ `arena/f34c1d66-trk-pwa`
> **状態**：実装・テスト済み。**実機での見た目は未確認**（この作業環境にブラウザも端末もないため）。
> **関連**：`docs/SKIN-PLAN.md`（スキンの数え方）／`docs/PLAYER-BAR-TRK227-2026-10-31.md`（trk227）／`js/data.js` の `SKINS`

---

## 1. 依頼と、この版でやったこと

「ネッスン・ドルマのフォントの変化が人気なので、他のフォント違いのスキンも欲しい」という依頼に対して、
**久々の見た目スキンとして 9 種**を足しました（小さくまとめずに、という指示どおり）。

1. 先に「いま確認しなければならないこと」を書き出して Google Drive に置く
   → `確認事項-2026-10-31-trk227時点.txt`（Drive の `1dyHAneZ3jagoRvzT7BpPP8aCEfj4mmnE`）
2. 人気の無償フォントを調べ、その中から**端末に入っているものを名前で指定する**形で 9 種を実装
3. スキンの棚に **「書体」カテゴリ**と、カード内の**見本の文字**を追加

---

## 2. 調べたこと（事実）

### 2-1. 人気の無償フォント（2025〜2026 の日本語サイト）

`coliss.com`・`321web.link`・`inte-action.com`・`ffont.jp`・`canva.com/ja_jp` の
「無料フォントまとめ／ランキング」を読みました。繰り返し挙がるのは次の系統です。

| 系統 | 名前（サイトで挙がっていたもの） | ライセンス |
| --- | --- | --- |
| ゴシック | Noto Sans JP／源ノ角ゴシック、BIZ UDゴシック | OFL |
| 丸ゴシック | Zen Maru Gothic、M PLUS Rounded 1c、Kosugi Maru、Rounded M+ | OFL |
| 明朝 | Shippori Mincho、Zen Old Mincho、Kaisei Decol、しっぽり明朝、BIZ UD明朝 | OFL |
| 手書き・ポップ | Yusei Magic、Hachi Maru Pop、Klee One、Yomogi、マメロン | OFL |
| 極太 | Dela Gothic One | OFL |
| 欧文 | Palatino／Book Antiqua、Georgia、Courier、Impact など（OS 同梱のものが定番） | OS 同梱 |

**すべて OFL（SIL Open Font License）で、無料・商用可**です。ただし、このアプリは
**CDN も外部 API も使わない**方針なので、Google Fonts を実行時に読む作り方は選べません。

### 2-2. 同梱した場合の重さ（実測）

`@fontsource` の npm パッケージから `japanese-400-normal.woff2` を取り出してバイト数を測りました。

| 書体 | woff2 の大きさ |
| --- | --- |
| Zen Maru Gothic 400 | 1,436,276 B（約 1.4 MB） |
| Shippori Mincho 400 | 1,385,356 B（約 1.4 MB） |
| Dela Gothic One | 944,356 B（約 0.9 MB） |
| Yusei Magic | 895,852 B（約 0.9 MB） |

`pyftsubset` で絞り込むと…

- かな＋英数＋記号だけ → **27,996 B（約 28 KB）**。ただし**漢字が全部欠ける**
- `U+4E00-9FFF`（漢字）を全部入れる → **1,417,968 B（約 1.4 MB）**。元とほぼ同じ

つまり **日本語フォントは「1 書体あたり 1 MB 前後」**が現実的なコストです（`@fontsource` の CSS は
100〜120 個の `unicode-range` 断片に分かれていて、ブラウザは使う断片だけを取りますが、
同梱すると全部が配布物に入ります）。

### 2-3. 結論（この版の選択）

**今回は同梱せず、端末にある書体を名前で指定する**方式にしました。

- 追加のバイト数は 0。オフラインでもそのまま動く
- CDN・外部 API を読まない方針を守れる
- 書体そのものが無い端末でも差が出るよう、**太さ・字間・行間・大文字化**も一緒に変える
- 同梱したくなったら、`css/style.css` に `@font-face` を足して `font` の先頭に家族名を置くだけで足せる形にしてある（§5）

---

## 3. 足したスキン（9 種）

`js/data.js` の `SKINS` に追加。カテゴリは新しい **`type`（書体）** です。

| id | 名前 | 書体（端末にあるもの・左から順に探す） | 色 | 特徴 |
| --- | --- | --- | --- | --- |
| `typeMincho` | 明朝の本 | Hiragino Mincho ProN／Yu Mincho／Noto Serif JP | 生成り×えんじ | 行間 1.75、見出し字間 .06em |
| `typeNewspaper` | 新聞の活字 | 本文明朝＋見出しは角ゴシック極太 | 白×新聞赤 | 見出しだけ極太・字間 -.02em |
| `typeMarugo` | 丸ゴのお茶目 | Hiragino Maru Gothic／M PLUS Rounded 1c | 桃色の夜 | 太さ 500、字間 .02em |
| `typePop` | ポップ看板 | 丸ゴ＋角ゴ太 | 黄×桃 | 太さ 700、行間 1.45 |
| `typeKyokasho` | 教科書の字 | Yu Kyokasho／Hiragino Kyokasho／Klee One | 白×青 | 行間 1.85（いちばんゆったり） |
| `typeTypewriter` | タイプライター | Courier New／Cascadia Mono／Consolas | セピア | 等幅、見出し字間 .14em＋大文字化 |
| `typeKaisho` | 楷書の便箋 | DFKai-SB／KaiTi／STKaiti | 紺×金 | 行間 1.75、字間 .1em |
| `typeOldstyle` | 活字の古典 | Palatino Linotype／Book Antiqua／Georgia | 焦げ茶 | 行間 1.65 |
| `typeGothicHeavy` | 極太ゴシック | Impact／Arial Black／角ゴ太 | 黒×蛍光黄緑 | 行間 1.35、字間 -.03em |

数え方：**本体 49 種（40＋書体 9）＋ ミク 4 種 = 53 種**。
`docs/SKIN-PLAN.md` の「①ゲーム画面スキン」は 40 → 49 になります。

### 3-1. 端末に書体が無いときの保険

`font` は「端末にある書体を左から探し、無ければ次のもの」という並びです。
和文の書体（丸ゴ・教科書・楷書）は Windows や Android に無いことがあります。
その場合でも、**`type` の太さ・字間・行間・大文字化**と、**配色**で違いが出ます。

**推測ではなく実測で確かめたこと**：9 種すべての配色について、本文・補足・ボタン・入力欄・
選択中のボタンの文字が **WCAG AA（4.5:1）以上**であることを計算で確認しました
（`tests/skin-contrast.test.mjs` と `tests/type-skins.test.mjs` が毎回検査します）。

---

## 4. 実装の中身

### 4-1. データ（`js/data.js`）

```js
"typeMincho": {
  cat:["type","light"],
  label:{ja:"明朝の本", en:"Mincho book", zh:"明朝书卷", ko:"명조 책"},
  desc:{…},
  font:'"Hiragino Mincho ProN","Yu Mincho",…,serif',   // 本文の書体（既存の s.font と同じ場所）
  type:{ lh:"1.75", weight:"400", titleWeight:"600", titleSpace:".06em", mark:"あア漢 Aa 12" },
  ui:{…}, game:{…}, shapes:[…], video:"…"
}
```

`type` の持ち物：

| キー | 効くところ | 省略したとき |
| --- | --- | --- |
| `font`（`type` の外） | 本文・ボタン・入力欄など全体 | `FONT_DEFAULT` |
| `type.title` | 見出し（`h1`・`h2`・`.bannerTitle`） | 本文と同じ |
| `type.weight` | 本文の太さ | `inherit`（これまで通り） |
| `type.lh` | 本文の行間 | `inherit`（これまで通り） |
| `type.titleWeight` | 見出しの太さ | `revert`（`h1`/`h2` のブラウザ既定の太字に戻す。`inherit` にすると細くなるため） |
| `type.titleSpace` | 見出しの字間 | `inherit` |
| `type.titleTransform` | 見出しの大文字化（`none`／`uppercase`） | `none` |
| `type.mark` | 棚カードに出す見本の文字 | 出さない |

### 4-2. 当てる（`js/core.js` の `applySkin`）

```js
const ty = s.type || null;
root.setProperty("--font-title",           (ty && ty.title) || "inherit");
root.setProperty("--font-title-weight",    (ty && ty.titleWeight) || "revert");
root.setProperty("--font-title-space",     (ty && ty.titleSpace) || "inherit");
root.setProperty("--font-title-transform", (ty && ty.titleTransform) || "none");
root.setProperty("--font-weight",          (ty && ty.weight) || "inherit");
root.setProperty("--font-lh",              (ty && ty.lh) || "inherit");
```

`type` を持たない既存 44 種は、すべて `inherit` に戻るので**見た目は trk227 と同じ**です。

### 4-3. 見た目（`css/style.css`）

```css
:root{ --font-title:inherit; --font-title-weight:revert; --font-title-space:inherit;
       --font-title-transform:none; --font-weight:inherit; --font-lh:inherit; }
h1,h2,.bannerTitle{font-family:var(--font-title);font-weight:var(--font-title-weight);
                   letter-spacing:var(--font-title-space);text-transform:var(--font-title-transform)}
body{font-weight:var(--font-weight);line-height:var(--font-lh)}
```

既存の `html,body{font-family:var(--font)}` と `button,input,select,textarea{font:inherit}` があるので、
本文の書体は今までどおり 1 か所（`--font`）を変えるだけで全体に届きます。

### 4-4. 棚のカード（`buildSkinGrid`／`buildSkinNow`）

- カードの中だけに書体を効かせるため、`--sk-font`（本文）・`--sk-title`（見出し）・
  `--sk-weight`・`--sk-space` をカードに渡します
- 書体スキンだけ、名前の下に**見本の文字**（`あア漢 Aa 12`）を出します。
  和文と欧文を並べてあるので、和文書体でも欧文書体でも違いが見えます
- 見本は読み上げの邪魔をしないよう、装飾だけの `span` にしています
- カードの**説明文（`small`）だけは本文の書体**（`--sk-note: var(--font)`）に戻しています。明朝の 12px は読みにくいためです（この指定は書体スキンだけ。書体を持つ既存スキンのカードは trk227 のまま）

### 4-5. カテゴリと 4 言語

`SKIN_CATS` の `basic` の次に `type` を追加し、`catType` を 4 言語に足しました。

| 言語 | 表示 |
| --- | --- |
| ja | 書体 |
| en | Type |
| zh | 字体 |
| ko | 서체 |

---

## 5. あとから書体を同梱する場合

利用者の返事待ちです。同梱するなら、たとえば次のように足せます（**今回は入れていません**）。

```css
@font-face{
  font-family:"TrkZenMaru";
  src:url("../assets/fonts/ZenMaruGothic-Regular.woff2") format("woff2");
  font-weight:400;font-display:swap;unicode-range:U+3000-30FF,U+4E00-9FFF,U+FF00-FFEF;
}
```

そのうえで `js/data.js` の `font` の先頭に `"TrkZenMaru",` を足します。必要なもの：

1. `assets/fonts/` に woff2 を置く（1 書体あたり約 1 MB。§2-2 の実測）
2. `NOTICE.md` と `release/README-standalone.txt` に **OFL の全文とクレジット**を書く
3. `sw.js` の事前キャッシュに足す（オフラインでも書体が出るように）
4. 配布 ZIP が 1 書体あたり約 1 MB 増えることを、README に書く

**同梱しない選択（いまの形）の利点**：追加 0 バイト、オフラインで動く、OFL の表記も不要。
**不利な点**：端末に無い書体は出ない（Windows で丸ゴ・教科書体は出にくい）。

---

## 6. 確かめたこと（2026-10-31）

| 項目 | 結果 |
| --- | --- |
| `npm run check`（`TZ=Asia/Tokyo`） | **949 pass / 0 fail**（trk227 の 940 から 9 件増） |
| `npm run check`（`TZ=America/Los_Angeles`） | **949 pass / 0 fail** |
| `node tools/check-repo.mjs` | 0 failure / 0 warning（スキン数の検査を 44 → 53 に更新） |
| `tests/type-skins.test.mjs`（新規） | 9 件 pass |
| `tests/skin-contrast.test.mjs` | 53 種すべてで AA を満たす |
| 外部 URL・`@font-face` を含まないこと | テストで検査（CDN を読みに行かない） |

---

## 7. 確かめていないこと

- **実機・実ブラウザでの見え方**。とくに次の 4 点は、端末で見てもらう必要があります
  1. お使いの PC／スマホで、9 種それぞれ**どの書体で表示されるか**（端末に無い書体は次の候補になります）
  2. 見出しの字間・大文字化（とくに `typeTypewriter` の大文字化）が読みやすいか
  3. 行間を広げた `typeKyokasho`（1.85）で、設定画面の詰まった欄が崩れないか
  4. 棚カードの見本の文字（`あア漢 Aa 12`）が、カードの幅に収まっているか
- スマホ型（`body.trk-mobile`）での見え方。とくに再生バー（`css/player-bar.css`）は
  独自の書体指定を持っていないかを未確認です。

見つけた点は、**端末・OS・ブラウザ・スキン名**を添えて教えてください。

---

## 8. 変更したファイル

| ファイル | 変更 |
| --- | --- |
| `js/data.js` | 書体スキン 9 種を追加（`cat:["type",…]`・`font`・`type`） |
| `js/core.js` | `SKIN_CATS` に `type`／`skinCardType`・`skinSpecNode`／`applySkin` で書体の変数 |
| `css/style.css` | 書体の CSS 変数の既定値、見出しと本文への適用、棚カードと見本の見た目 |
| `js/i18n.js` | `catType` を 4 言語に追加 |
| `sw.js` | cache を `trk-v2026.10.31-trk228` に |
| `tests/type-skins.test.mjs` | 新規（9 件） |
| `tests/skin-contrast.test.mjs` | スキン数の検査を 53 に |
| `tests/skins-access.test.mjs` | 「見やすさ 3 種」の注記を更新（書体は `type` に分けた） |
| `tools/check-repo.mjs` | スキン数の検査を 53 に |
| `docs/PWA.md` | cache の名前・検証の数を更新 |
| `release/README-standalone.txt` | 検証の数と、書体スキンの説明を追加 |

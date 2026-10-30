# レビュー（trk-PWA／trk222・2026-10-31）への対応 ― trk223

対象：`trk-PWA（trk222）レビュー 2026-10-31` の指摘。
対応した版：**trk223**（`sw.js` の cache は `trk-v2026.10.31-trk223`）。
作業ブランチ `arena/6ff4f502-trk-pwa` → `main` へ PR。

この文書は **「直したこと」「機械で確かめたこと」「確かめていないこと」** を分けて書きます。
実ブラウザ・実機は、この作業環境に無いため **未確認** です（§4）。

---

## 1. 指摘ごとの対応

| # | 指摘 | 対応 | 状態 |
| --- | --- | --- | --- |
| ① | スマホ型の「エフェクト」のタブで ▶ TV が出ない／`.songCol` の `gap` が消える | CSS を「エフェクトのタブでも、ライブラリに出す設定でもないときだけ隠す」に変更。`.songCol` は `flex` のまま | 実装・自動検査済み／実機未確認 |
| ② | 拡大率 125% で、カードの下端が再生バーの裏に入る（50% では余りすぎ、100% に戻しても直らない） | 再生バーの倍率の基準を「1080 固定」から「ステージの設計の高さ（`offsetHeight`）」に。カードの上限は `calc(1020px - …)` をやめて `.screen` の内容の高さに。`uiscale` を購読 | 実装・計算で確認／実機未確認 |
| ③ | 手渡し用ZIPに `assets/vendor/…/dist/` が入っていない（ZIPだけMMDが読めない） | リポジトリの `.gitignore` ではなく **`git ls-files`（追跡しているファイル）** から集める道具を追加し、`vendor-lock.json` の全件と `index.html` の参照を照合してから固める | 実装・全件照合済み／ZIPは作り直し済み（§3） |
| ④ | `/trk/` と `/trk-PWA/` を同じオリジンに置くと、片方の更新がもう片方のキャッシュを消す | キャッシュ名に **スコープの印**（`@trk` / `@trk-pwa` / `@root`）を付け、activate では **自分のスコープのものだけ**を削除。旧名（印なし）は中身の URL で見分ける | 実装・vm で確認済み |
| ⑤ | 古い版が保存すると、新しい版の設定（`uiScale`・`uiMode` など）が消える | 保存は「いま保存されている生の値」に重ねる方式へ（知らないキーは残す）。工場出荷リセットの2経路だけは `{fresh:true}` で置き換え。❓謎設定がオフのときは保存値を使わない | 実装・vm で確認済み |
| ⑥ | 拡大率 ≠100% で `#view`・`#fx`（1920×1080 固定）と MMD/VRM のキャンバスがずれる | `#view`・`#fx` を `inset:0;width:100%;height:100%` に、MMD/VRM の描画矩形に `stage.offsetWidth/1920` を掛ける | 実装・自動検査済み／実機未確認 |
| ⑦ | ようこそを閉じても再生バーが出ない | 窓（`.plOverlay`・`.instOverlay`・`.iosInstall`・`[role=dialog][aria-modal]`・`#welcomeBox`）の開閉を監視し、閉じたときに同期。「バーが隠れている」で早期に戻らないように整理 | 実装・自動検査済み／実機未確認 |
| ⑧ | 事前キャッシュが古い JS を拾う／電波が弱いと待ち続ける | 先読みは `cache:"no-cache"`。ナビゲーションは 3 秒で打ち切ってキャッシュへ（`AbortController`） | 実装・自動検査済み |
| ⑨ | `verified.json`・`assets/mmd/lat-miku/preset.json` がオフラインで欠ける | 事前キャッシュの追加一覧（`PRECACHE_EXTRA`）へ | 実装・自動検査済み |
| ⑩ | Pages に `tools/`・`package.json`・`capacitor.config.ts` が公開されている／`blank.yml` が残っている | `pages.yml` の組み立てで開発用を除外し、混ざったら CI が止まるように。`blank.yml` を削除 | 実装済み／次回のデプロイで確認 |
| ⑪ | `display_override` の先頭が `fullscreen`（Android でステータスバーまで消える） | `["standalone", "minimal-ui", "fullscreen"]` に | 実装・自動検査済み／実機未確認 |
| ⑫ | テストが文字列の `includes` だけで、数値・規則を見ていない | CSS の規則を当てて勝つ値を出す小さな道具（`tests/helpers/css-rules.mjs`）と、偽 DOM（`tests/helpers/player-bar-harness.mjs`）を追加。指摘①②④⑤③を数値・規則で検査 | 実装済み（`npm run check` 861 pass / 0 fail） |

指摘のうち **採らなかったもの**：なし。ただし ①〜③ は「実機で見てから配る」、④⑤ は「`/trk/` へ移す前に」というレビューの順序に従い、
**修正が終わるまで配布物を配っていません**。修正が終わったので、**確認用のZIPを Drive の手渡しフォルダに置きました**
（公開URLの配布物は差し替えていません。差し替えは、レビュー手順6・7の実機確認のあとです）。
2026-10-31 の trk222 のZIPと資料は、取り違えないように名前の先頭へ「【旧】」を付けています。

---

## 2. 変更したファイル

| ファイル | 変更 |
| --- | --- |
| `css/mobile-shell.css` | ① `#tvDock` を隠す条件を絞る／`.songCol` を `flex` に／エフェクトのタブの `.detailCol` の指定と重複を整理 |
| `css/player-bar.css` | ② カードの上限を `max-height:100%` に（`calc(1020px - …)` を廃止） |
| `css/style.css` | ⑥ `#view`・`#fx` をステージいっぱいに |
| `js/player-bar.js` | ② 倍率の基準・`uiscale` の購読・`resize` の測り直し／⑦ 窓の開閉の監視 |
| `js/mmd.js`・`js/vrm.js` | ⑥ 拡大率ぶんの描画矩形の補正 |
| `js/core.js` | ⑤ 保存のマージ（`storedPrefsRaw`／`saveUserPrefs({fresh})`） |
| `js/mobile-shell.js` | ⑤ ❓謎設定がオフのときは保存値を使わない・設定欄は実効値を表示 |
| `sw.js`・`js/share-inbox.js` | ④ キャッシュ名にスコープの印／⑧⑨ 先読みと時間切れ |
| `manifest.webmanifest` | ⑪ `display_override` |
| `.github/workflows/pages.yml` | ⑩ 開発用を公開しない |
| `tools/pack-standalone.mjs`（新規）・`release/README-standalone.txt`（新規） | ③ 配布ZIPの作り方 |
| `tests/trk223-review.test.mjs`（新規）・`tests/helpers/css-rules.mjs`（新規）・`tests/helpers/player-bar-harness.mjs`（新規） | ⑫ |

---

## 3. 自動検査で確かめたこと（数値）

`npm run check` → **861 pass / 0 fail**。`node tools/check-repo.mjs` → 0 failure / 0 warning。

- **①** `css/mobile-shell.css` の規則を、要素（`html` → `body.trk-mobile[data-trk-view=…]` → `.songCol` → `#tvDock`）に当てて、
  カスケードで勝つ `display` を出しています。エフェクトのタブでは `none` にならず、ライブラリのタブ（設定オフ）では `!important` で `none`。
  `.songCol` の勝つ値は `flex`、`gap` は `css/style.css` の `14px`。
- **②** 画面 1440×900・再生バーの実寸 60px の条件で、拡大率 50／75／100／125% のそれぞれについて
  ステージの設計高さ（2160／1440／1080／864）から配る値を出し、
  **カードの下端 < バーの上端** を計算で確かめています（例：125% ではカードの下端 721.9px、バーの上端 750px）。
  旧式（倍率の基準 1080・上限 `calc(1020px - …)`）で同じ条件を計算すると、カードの下端は 909px となり、
  バーの上端 750px を越えます（＝重なる）。
- **④** `sw.js` の `scopeTagOf`／`cacheIsOurs` を vm で動かし、`@trk` のキャッシュを `@trk-pwa` のアプリが消さないこと、
  印の無い旧名は中身の URL で見分けること、ルート（`/`）は自分のものとして片付けることを確認。
  `sw.js` と `js/share-inbox.js` が **同じ印** を出すことも確認（`/trk-PWA/` → `trk-pwa`）。
- **⑤** `saveUserPrefs` を vm で動かし、保存済みの `uiScale:125`・`uiMode:"mobile"` が
  古い版の保存で消えないこと、壊れた保存値（配列・文字列・壊れた JSON）でも落ちないこと、
  `{fresh:true}`（工場出荷）では置き換えることを確認。
- **③** `pickFiles()` が `git ls-files` から作り、`vendor-lock.json` の全 100 件（`dist/` を含む）が入り、
  `tests/`・`tools/`・`package.json` 等が入らないことを確認。`index.html` の参照も全件そろっています。

---

## 4. 確かめていないこと（実機・実ブラウザ）

この環境にはブラウザも端末もありません（`@sparticuz/chromium` は必要な共有ライブラリが無く起動できません）。
そのため、次は **未確認** です。見つけたら、端末・OS・ブラウザ・拡大率・スキン名を添えて知らせてください。

1. ①②⑥⑦ の見た目（カードとバーの間隔、エフェクトのタブの並び、拡大率 4 段での背景・MMD/VRM の位置、ようこそを閉じたあとのバー）
2. ⑧ の「3 秒で切り替わる」体感（回線の遅い場所で、殻が出るまでの待ち時間）
3. Safari（と iOS のホーム画面アプリ）での `display_override`・`zoom` の効き方
4. Pages の次回デプロイで、`tests/`・`tools/` が公開されないこと（ワークフローの除外は dry-run 相当の確認のみ）

---

## 5. 配布物

- この版のZIPは **`node tools/pack-standalone.mjs`** で作ります（`index.html`＋`README.txt`＋`trk-files/`）。
  追跡ファイルだけを集めるので、`dist/` のような名前でも必要な vendor は必ず入ります。
- レビューの順序（①〜③ → 実機 → ④⑤ → `/trk/` へ）に従い、**公開URLの配布物は差し替えていません**。
  この確認用のZIPは Drive の手渡しフォルダに置き、実機の確認（①〜③）をお願いしています。

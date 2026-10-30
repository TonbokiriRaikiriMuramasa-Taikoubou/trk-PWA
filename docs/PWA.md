# trk-PWA の運用メモ

最終更新：2026-10-30（Phase 2・3 の実装まで。実機確認は未実施）

## 1. このリポジトリは何か

trk! を **PWA（Webアプリ）として配布する**ためのリポジトリです。iPhone／Androidのブラウザで開き、「ホーム画面に追加」して使う形を本線にしています。

- アプリ本体：上流 [`trk`](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk) の **1.1.8（trk219）** をそのまま取り込み、このリポジトリで配信します。
- 上流コミット：`06cef87`（2026-10-29）。
- 試験用URL（GitHub Pages。**本番の住所は未決定**）：**https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/**
  - 実際のURLは、デプロイ後に [Actions](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA/actions) の `Deploy GitHub Pages` 実行結果でも確認できます。
- 配布方針・iOSの制約・実機チェックリスト：[iPhone向け配布のブレインストーミング](IPHONE-PWA-BRAINSTORM-2026-10-30.md)
- 作業の許可範囲：[作業権限の記録](PERMISSIONS.md)

> ⚠ **データの住所は「ホスト」です。** Webの保存領域はオリジン（scheme + host + port）ごとに別で、**パスは関係ありません**。`...github.io/trk/` と `...github.io/trk-PWA/` は同じオリジンなので、保存データもキャッシュも共有します。ホスト（独自ドメイン等）を後から変えると別オリジンになり、利用者の曲・設定・記録は自動では移りません。

## 2. 現在地

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| Phase 0 | 上流Pages版をiPhoneで触る（画面シェルの要否を判断） | **未実施（実機）** |
| Phase 1 | 1.1.8の取り込み・Pages公開（試験URL） | **取り込み・mainマージ・Pages有効化済み／初回デプロイ待ち** |
| Phase 2 | モバイル画面シェル（下部ナビ・エフェクト画面・取込の折りたたみ） | **実装済み（未実機）**。§9 |
| Phase 3 | iOS向けの調整（manifest・アイコン・インストール案内・保存説明・音・向き・precache） | **実装済み（未実機）**。§10 |
| Phase 4 | 配布の最終判断（オリジン確定／告知／バックアップ導線） | 未着手 |

**ビルドが通ったことと、iPhone実機で動いたことは別**です。実機の結果は日付・iOSバージョン・端末名とセットで記録してください。

## 2.1 同一オリジンの注意（重要）

GitHub Pagesのプロジェクトサイトは、**同じアカウントの `*.github.io` が1つのオリジン**です。`/trk/` と `/trk-PWA/` はパスが違うだけで、次のものを共有します。

| 共有するもの | 影響 |
| --- | --- |
| `localStorage` / `IndexedDB` | 上流 `/trk/` と設定・曲・記録が同じ場所に入る。版が違うと設定の意味がずれることがある |
| `CacheStorage` | `sw.js` は `trk-` で始まるキャッシュを版更新時に消す。**上流とPWAが互いのオフラインキャッシュを消し得る**（`CACHE_PREFIX = "trk-"`） |
| 同じオリジンの他のリポジトリ | 同じアカウントの別プロジェクトサイトも同じ保存領域を読める。公開リポジトリのJS次第では、trk! の保存データに触れ得る |

**このため、`/trk-PWA/` は「本番の住所」ではなく「試験用」と位置づけます。** 不特定多数に案内する前に、最終的なオリジンを決めてください。

- **推奨：独自ドメイン**（例 `trk.example.com`）をGitHub Pagesに向ける。他のプロジェクトと保存領域が完全に分かれる。
- **次点：trk! 専用のGitHub組織／アカウント**（例 `trk-agrg.github.io`）。無料だが、その組織内の他のリポジトリとは共有する。
- パスの変更（`/trk/` → `/trk-PWA/`）では分離できません。

オリジンを変えると保存データは移行されません。**利用者にホーム画面追加を案内する前に決める**のが安く済みます。

専用組織と独自ドメインの比較・移行手順は [配布オリジンの選択](ORIGIN.md) にまとめています。

移行の引き継ぎは [trk-Standalone 引き継ぎ](HANDOFF-TRK-STANDALONE.md) と [trk（上流）引き継ぎ](HANDOFF-TRK.md) にあります。2026-10-30に `trk-Standalone` が作成されましたが、同じ個人アカウントのため**オリジンは分離されません**。0円で分離するには無料組織 `trk-agrg` を使います。

## 3. 上流との差分（意図的に持っているもの）

Phase 1の時点で、上流1.1.8から変えているのは次だけです。

| ファイル | 変更 |
| --- | --- |
| `README.md` | 先頭にPWA配布版の案内。GitHub PagesのURLを `/trk-PWA/` に変更 |
| `index.html` | `og:url` / `og:image` を `/trk-PWA/` に変更（SNSカードの向き先） |
| `docs/PWA.md` | このファイル |
| `docs/PERMISSIONS.md` | 作業権限の記録 |
| `docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` | 配布手段・iOS制約・ロードマップ |
| `docs/ORIGIN.md` | 配布オリジンの比較と移行手順 |
| `docs/HANDOFF-TRK-STANDALONE.md` | 引き継ぎ（状態・ロードマップ・落とし穴） |
| `tools/ios-probe.html` | iPhone用の診断ページ（アプリの一部ではない） |
| `css/mobile-shell.css` | スマホ用の画面シェルの見た目（`body.trk-mobile` のときだけ効く） |
| `js/mobile-shell.js` | 下部ナビ・エフェクト画面・縦向きの案内 |
| `js/mobile-settings-panels.js` | 設定で開いた欄の記憶（スマホだけ） |
| `js/ios-pwa.js` | iPhoneのインストール案内・音のセッション・言い換え |
| `manifest.webmanifest` | `id`・`display: standalone`・アイコン一式（180/192/512/maskable/1024） |
| `sw.js` | install でアプリの殻を先にキャッシュ（trk220） |
| `index.html` | apple-touch-icon 180・`apple-mobile-web-app-*`・取込の折りたたみ・iOSの欄 |
| `icons/icon-180.png` ほか | ホーム画面用のアイコン（同じ絵柄の大きさ違い） |
| `js/i18n.js` | iOS向けの文言（4言語） |

アプリのゲーム部分（`js/game.js`・`js/render.js` など）は上流のままです。画面シェルは**選曲・設定の画面だけ**を組み直し、ゲーム中の1920×1080のステージには触りません。

## 4. 上流の更新を取り込む

```sh
# 初回だけ（.git/config は環境によって保持されないので、都度確認）
git remote add upstream https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk.git

git fetch upstream main
git merge upstream/main
# 衝突は主に README.md（先頭のPWA案内）と index.html（og:url）。
# 上流の変更を残しつつ、PWA向けの差分だけを再適用する。

npm ci
npm run check
git push origin <作業ブランチ>
```

- 上流のバージョン（`HANDOFF.md` の「現在のバージョン」）を確認し、**このファイルの「上流コミット」も更新**します。
- チェックが通らないまま配信しない。`npm run check` は静的検査・セキュリティ・a11y・vendor・各機能テストを含みます。
- `README.md` はチェック上 **12KB（12,288 bytes）が上限**です。Phase 1時点で **12,189 bytes** と余裕が少ないので、上流の追記で超えたら先頭のPWA案内を短くしてください。

## 5. 配信の仕組み

`.github/workflows/pages.yml`（上流から流用）が、リポジトリ直下をそのまま `_site/` にコピーしてGitHub Pagesへ出します。ビルドはありません。

### Pagesの有効化（2026-10-30に完了）

**Pagesの有効化は、リポジトリ設定で人が行う必要があります。**

1. https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA/settings/pages を開く
2. **Build and deployment** → **Source** のドロップダウンで **GitHub Actions** を選ぶ

**2026-10-30に設定済み。** APIでも `build_type: workflow`、`html_url`、`https_enforced: true` を確認しました。次に `main` へpush（PRのマージ）されると `Deploy GitHub Pages` が走ります。

参考：有効化前の初回デプロイ（[run 41086274414](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA/actions/runs/41086274414)）は `Configure Pages` で失敗していました。ログは `Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions`。アプリ側のファイルの不備ではありませんでした。

理由：

- エージェントのGitHub接続（GitHub Appのインストールトークン）にはPagesの管理権限がなく、APIは **403 `Resource not accessible by integration`** を返しました。
- `actions/configure-pages` の `enablement: true` は、action.ymlの仕様上 **`GITHUB_TOKEN` 以外のトークン**（`administration:write` と `pages:write`）が必要です。Secretsを増やさない方針なので採用していません。

### デプロイ

- `main` へpush → 自動デプロイ。
- `workflow_dispatch` は、**ワークフローファイルが既定ブランチ（main）に存在しないと実行できません**。そのため、作業ブランチから直接の試験デプロイはできません。
- **Pagesは「最後にデプロイした内容」を配る**ので、main以外から配信した場合はその内容が本番URLに出ます（現状はmainのみ）。

配信物には `tools/`・`tests/`・`docs/` も含まれます（Phase 1は簡便さを優先）。容量や不要な公開が気になる段階で、除外リストを検討します。

## 6. 公開前に確認すること（Phase 1）

- [x] 上流1.1.8を取り込み、`npm run check` が通る（747 pass）
- [x] Pages用ワークフローがある
- [x] **Pagesを有効化**（2026-10-30、Settings → Pages → Source: GitHub Actions）
- [x] `main` へマージ（2026-10-30、PR #1。マージコミット `8d33db6`）
- [ ] 初回デプロイが成功し、HTTPSのURLが出る（`main` へのマージで実行）
- [ ] `/` が開き、Service Workerが登録される（DevToolsのApplication）
- [ ] `manifest.webmanifest` とアイコンが200で返る
- [ ] オフラインで再読み込みできる（一度開いた後。trk220で**未訪問でも殻は入る**）
- [ ] iPhoneでホーム画面に追加でき、standaloneで起動する
- [ ] `privacy.html` / `credits.html` / `NOTICE.md` が配信物に含まれる

## 7. 素材・ライセンスの注意（公開配信）

- アプリ本体は **GPL-3.0-or-later**。ソースはこのリポジトリで公開されています。
- 同梱の **Lat式ミク**（`assets/mmd/lat-miku/`）はGPLの対象外で、作者のReadMe.txtの条件（ReadMe.txt同梱・作者と改変元の明記）に従います。`NOTICE.md` 3a とフォルダ内の `README.md` を確認してください。**APK版が同梱を見送った経緯**があるため、公開配信で再配布条件を満たすことを配布前に再確認します。
- 同梱デモ音源 `assets/optional-demo-audio/` は任意。不要なら配信物から外せます。
- 第三者の画像・音源・モデル・ライブラリには個別条件があります。`NOTICE.md` と `credits.html` が案内の正です。

## 8. まだやらないこと

- 独自ドメインの取得、App Store／TestFlight／代替マーケットへの登録
- 広告・アナリティクス・アカウント・クラウド保存の追加
- `main` へのマージ（所有者が行う）
- iPad の横向き専用レイアウトなど、実機で必要が分かってから作る調整

## 9. Phase 2：スマホ用の画面シェル（実装済み・未実機）

`trk-apk` のモバイル画面シェル（`js/apk-mobile.js` 215行・`css/apk-mobile.css` 108行・`js/apk-settings-panels.js` 50行）から、
**画面の組み方だけ**を持ってきました。Capacitor の橋渡し（`apk-native.js`・`apk-background.js`・`apk-audio-safety.js`）は持ち込んでいません。

| できること | 実装 |
| --- | --- |
| 下部ナビ（ライブラリ／エフェクト／再生／書斎／ゲーム） | `js/mobile-shell.js`（5つの行き先。選択中は `aria-current="page"`） |
| 1画面に1つの役割（曲リスト／曲の詳細を切り替え） | `body[data-trk-view]` と `css/mobile-shell.css` |
| エフェクト画面（プリセット・EQ・映像の色調） | 設定（⚙）の中の本物の `#fxPanel` の値を映す鏡。二重保存はしない |
| 再生画面に「ゲームモードへ」 | `#mediaPlayerMode .mediaHeader` に足す（プレーヤーの窓ができてから） |
| 取込を「＋ コンテンツを追加」に折りたたむ | `index.html` の `<details class="trk-import">`。**中の id は変えない**ので `library.js` の配線はそのまま |
| 設定の欄の開閉を覚える | `js/mobile-settings-panels.js`（`trk_mobile_settings_panels_v1`） |
| 縦向きでゲームを始めたときの案内 | `.rotateHint`（iOS は `orientation` を解さないため、CSS と案内で対応） |

**PC では何もしません。** `js/lite.js` の端末判定（`TrkLite.info().mobile`）が真のときだけ `body.trk-mobile` を付け、
CSS はすべて `.trk-mobile` の下に置いています。デスクトップの見た目は Phase 1 と同じです。

保存キーは増やしていません（設定の欄の記憶だけ、このシェル専用のキー）。

## 10. Phase 3：iOS の詰め（実装済み・未実機）

| 項目 | 変更 |
| --- | --- |
| manifest | `id: "./"`、`display: "standalone"`＋`display_override: ["fullscreen","standalone","minimal-ui"]`、`orientation: "any"`（iOS は無視するため固定しない）、アイコンに 180/1024 と専用の maskable を追加 |
| アイコン | `icons/icon-180.png`（apple-touch-icon）・`icon-1024.png`・`icon-maskable-512.png`（安全域つき）。絵柄は従来の `trk!` のまま |
| `index.html` | `apple-touch-icon` 180 を先頭に、`apple-mobile-web-app-capable` / `-status-bar-style` / `-title`、`application-name`、`format-detection` |
| インストール案内 | `js/ios-pwa.js`。Safari のタブで開いたときだけ「共有 → ホーム画面に追加」を表示。閉じた印は `trk_ios_install_v1`。⚙ の「🍎 iPhoneで使う」から開き直せる |
| 保存の説明 | 同じ欄に「ホーム画面アプリとSafariのタブは保存場所が別」「7日の削除の対象外」を明記（4言語） |
| 取込の言葉 | iOS では `showDirectoryPicker` が無いので「📤 共有」→「📁 曲のフォルダを選ぶ」に言い換える（`library.js` は変更しない） |
| 音 | タップ・キー入力・再生開始を起点に `navigator.audioSession.type = "playback"`（未対応なら何もしない）。サイレントスイッチの案内も追加 |
| 向き | 縦向きでゲーム中だけ `.rotateHint` を出す（横向き固定はできない） |
| オフライン | `sw.js` の install で、`index.html` と**それが読み込む CSS・JS・アイコン**を先にキャッシュ（trk220）。`assets/vendor`・同梱デモ音源・`docs/`・`tools/` は入れない |
| 更新 | ⚙ の「🔄 アプリを更新する」で Service Worker に確認させ、そのあと開き直す |

### 10.1 iPhone実機チェック（未実施）

`docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` §6 の18項目を、そのまま使ってください。
**実施していない項目を「確認済み」と書かないこと。** 記録は「端末・iOSバージョン・URL・日時」とセットで、この表の下に追記します。

| # | 項目 | 結果 |
| --- | --- | --- |
| 1〜18 | ブレインストーミング §6 のチェックリスト | **未実施**（実機を持っている人が行う） |

## 11. 検証コマンド（2026-10-30時点）

```sh
npm ci
npm run check                                  # 794 pass / 0 fail（trk220 の47件を追加）
node tools/check-repo.mjs
```

ブラウザでの確認（ビルド不要）:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
# http://localhost:8000/          … PC の見た目が変わっていないこと
# http://localhost:8000/?safe=1   … セーフモード
# http://localhost:8000/tools/ios-probe.html … 端末の対応状況
```

スマホの見た目をPCで確かめるには、開発者ツールの端末モード（iPhone の幅・タッチ）で開きます。
`js/lite.js` の判定は「粗いポインタ」を見るので、端末モードなら `body.trk-mobile` が付きます。

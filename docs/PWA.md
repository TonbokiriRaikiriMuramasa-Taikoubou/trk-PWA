# trk-PWA の運用メモ

最終更新：2026-10-30（Phase 1）

## 1. このリポジトリは何か

trk! を **PWA（Webアプリ）として配布する**ためのリポジトリです。iPhone／Androidのブラウザで開き、「ホーム画面に追加」して使う形を本線にしています。

- アプリ本体：上流 [`trk`](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk) の **1.1.8（trk219）** をそのまま取り込み、このリポジトリで配信します。
- 上流コミット：`06cef87`（2026-10-29）。
- 公開URL（GitHub Pages）：**https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/**
  - 実際のURLは、デプロイ後に [Actions](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA/actions) の `Deploy GitHub Pages` 実行結果でも確認できます。
- 配布方針・iOSの制約・実機チェックリスト：[iPhone向け配布のブレインストーミング](IPHONE-PWA-BRAINSTORM-2026-10-30.md)
- 作業の許可範囲：[作業権限の記録](PERMISSIONS.md)

> ⚠ **URLはデータの住所です。** ホーム画面アプリの保存データはオリジン（URL）ごとに別です。後から独自ドメインへ変えると、利用者の曲・設定・記録は自動では移りません。Phase 1では「このPages URLを本番の住所にする」前提で進め、変えるなら利用者に移行手順を示してください。

## 2. 現在地

| フェーズ | 内容 | 状態 |
| --- | --- | --- |
| Phase 0 | 上流Pages版をiPhoneで触る（画面シェルの要否を判断） | **未実施（実機）** |
| Phase 1 | 1.1.8の取り込み・Pages公開 | **このリポジトリで実施中** |
| Phase 2 | `trk-apk` のモバイル画面シェル移植 | 未着手 |
| Phase 3 | iOS向けの調整（manifest・インストール案内・保存説明・取込・音・向き） | 未着手 |
| Phase 4 | 配布の最終判断（独自ドメイン／ストア／ネイティブ） | 未着手 |

**ビルドが通ったことと、iPhone実機で動いたことは別**です。実機の結果は日付・iOSバージョン・端末名とセットで記録してください。

## 3. 上流との差分（意図的に持っているもの）

Phase 1の時点で、上流1.1.8から変えているのは次だけです。

| ファイル | 変更 |
| --- | --- |
| `README.md` | 先頭にPWA配布版の案内。GitHub PagesのURLを `/trk-PWA/` に変更 |
| `index.html` | `og:url` / `og:image` を `/trk-PWA/` に変更（SNSカードの向き先） |
| `docs/PWA.md` | このファイル |
| `docs/PERMISSIONS.md` | 作業権限の記録 |
| `docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` | 配布手段・iOS制約・ロードマップ |
| `tools/ios-probe.html` | iPhone用の診断ページ（アプリの一部ではない） |

アプリのJS・CSS・アセットは上流のままです。**Phase 1ではまだモバイル画面シェルを入れていません。**

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

### 初回だけ人が必要な作業

**Pagesの有効化は、リポジトリ設定で人が行う必要があります。**

1. GitHubのリポジトリ → **Settings** → **Pages**
2. **Build and deployment** → **Source** を **GitHub Actions** にする

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
- [ ] **Pagesを有効化**（Settings → Pages → Source: GitHub Actions。人が行う）
- [ ] `main` へマージし、HTTPSのURLが出る
- [ ] `/` が開き、Service Workerが登録される（DevToolsのApplication）
- [ ] `manifest.webmanifest` とアイコンが200で返る
- [ ] オフラインで再読み込みできる（一度開いた後）
- [ ] iPhoneでホーム画面に追加でき、standaloneで起動する
- [ ] `privacy.html` / `credits.html` / `NOTICE.md` が配信物に含まれる

## 7. 素材・ライセンスの注意（公開配信）

- アプリ本体は **GPL-3.0-or-later**。ソースはこのリポジトリで公開されています。
- 同梱の **Lat式ミク**（`assets/mmd/lat-miku/`）はGPLの対象外で、作者のReadMe.txtの条件（ReadMe.txt同梱・作者と改変元の明記）に従います。`NOTICE.md` 3a とフォルダ内の `README.md` を確認してください。**APK版が同梱を見送った経緯**があるため、公開配信で再配布条件を満たすことを配布前に再確認します。
- 同梱デモ音源 `assets/optional-demo-audio/` は任意。不要なら配信物から外せます。
- 第三者の画像・音源・モデル・ライブラリには個別条件があります。`NOTICE.md` と `credits.html` が案内の正です。

## 8. まだやらないこと

- モバイル画面シェルの移植（Phase 2）
- iOS向けのmanifest・インストール案内・保存説明・取込・音・向きの調整（Phase 3）
- 独自ドメインの取得、App Store／TestFlight／代替マーケットへの登録
- `main` へのマージ（別途確認。Phase 1の公開はこのマージで始まる）

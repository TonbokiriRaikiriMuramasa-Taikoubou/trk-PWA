# 作業権限の記録 — 2026-10-30

この文書は、Arena上のエージェントが `trk-PWA` で行ってよい作業の範囲を、あとから確認できるように残すものです。法的な委任や、無制限の許可ではありません。**ここに書いた作業だけ**を行い、外れるときは事前に確認します。

## 1. 承認

| 項目 | 内容 |
| --- | --- |
| 日付 | 2026-10-30（Asia/Tokyo） |
| 承認者 | リポジトリ所有者（`TonbokiriRaikiriMuramasa-Taikoubou`） |
| 対象リポジトリ | `TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA`（public） |
| 作業ブランチ | `arena/049422a2-trk-pwa` |
| 承認の文面 | 「権限が必要な部分は許諾します〜。必要な権限を文面化して残しておきましょう〜」 |
| あわせて決めたこと | 配布対象は**不特定多数**／**ホーム画面から開く運用**／**Phase 1（1.1.8の取り込みとPages公開）へ進む** |

## 2. 今回（Phase 1）許可された作業

| 作業 | 具体的に | 必要な権限 | 状態 |
| --- | --- | --- | --- |
| 公開リポジトリの閲覧・取得 | `trk`（上流）・`trk-apk`・`trk-PWA` のclone／fetch／履歴参照 | public read | 実施 |
| 上流の取り込み | `trk` の `main`（1.1.8 / `06cef87`）を作業ブランチへマージ | public read、ローカルgit | 実施 |
| このリポジトリへの書き込み | 作業ブランチへのcommit／push、ドキュメント追加 | `contents: write` | 実施 |
| 依存関係の取得 | `npm ci`（npm registry） | ネットワーク | 実施 |
| 静的検査・テスト | `npm run check` | ローカル実行 | 実施 |
| GitHub Actionsの実行 | `Deploy GitHub Pages` の `workflow_dispatch` | `actions: write`、`pages: write`、`id-token: write` | **未実施**（ワークフローがmainに無いためdispatch不可） |
| GitHub Pagesの有効化 | Actions配信（`build_type=workflow`）の設定 | リポジトリ管理（admin）＋Pages権限 | **未実施**（APIは403。人がSettingsで設定） |
| 診断ページの追加 | `tools/ios-probe.html` | `contents: write` | 実施 |
| プルリクエストの作成 | 作業ブランチ → `main`（レビュー用） | `pull_requests: write` | 任意 |

## 3. 実際のGitHub権限（2026-10-30に確認）

- ログイン：`TonbokiriRaikiriMuramasa-Taikoubou`（ArenaのGitHub接続経由）
- このリポジトリの権限：`admin: true` / `maintain: true` / `push: true` / `triage: true` / `pull: true`
- ただし、この接続は**GitHub Appのインストールトークン**で、Pagesの管理権限は含まれていません。`POST /repos/.../pages` は **403 `Resource not accessible by integration`** でした。リポジトリのadmin表示＝Pages管理ができる、ではありません。
- トークンの値は**表示も保存もしません**（`gh auth status` の表示はマスク済み）。
- ワークフローに与える権限は `.github/workflows/pages.yml` の中だけ：`contents: read` / `pages: write` / `id-token: write`。
- 新しいSecrets、環境変数、デプロイキーは**作りません**。

## 4. 今回やらないこと（別途の確認が必要）

- `main` への直接push、および**プルリクエストのマージ**（レビューと判断は人に残す）
- ほかのリポジトリ（`trk`・`trk-apk`）への書き込み・PR
- force push、ブランチ削除、履歴の書き換え、リポジトリの削除・公開範囲の変更
- Secrets・署名鍵・証明書の作成や読み出し
- 課金、ストア登録（App Store／Google Play／代替マーケット）、ドメイン購入
- Google Driveへの書き込み（必要になったら別途確認）
- 利用者データ・個人情報の取得や公開
- 実機で確認していない事項を「確認済み」と書くこと

## 5. 公開とデータの扱い

- リポジトリもGitHub Pagesも**public**です。誰でも閲覧・取得できます。
- アプリの設計上、利用者の曲・設定・記録は端末内（IndexedDB等）に置かれ、サーバーへ送られません。この前提を崩す変更はしません。
- 公開配信物には第三者の素材（Lat式ミク等）が含まれます。`NOTICE.md`・`credits.html`・`assets/mmd/lat-miku/README.md` の条件を確認し、満たせない場合は配信物から外します。
- ログ・issue・PRにsecretや個人情報を書かない。

## 6. 有効期間と見直し

- 有効：**Phase 1が終わるまで**（または次の指示があるまで）。
- Phase 1のうち、**Pagesの初回有効化（Settings → Pages）と `main` へのマージは人が行う**。エージェントはマージ後のデプロイ結果の確認までを担当する。
- 次に再確認する作業：Phase 2（モバイルシェル移植）、Phase 3（iOS調整）、`main` へのマージ、独自ドメイン、ストア登録、外部サービスとの連携、課金、個人情報を扱う変更。
- 上流 `trk` の更新を取り込むときは、この記録の「今回許可された作業」の範囲内で行い、差分を `docs/PWA.md` に追記します。

## 7. 取り消し方

- ArenaのGitHub接続を解除する、作業ブランチを削除する、GitHub Pagesを無効化する、のいずれかで以降の作業を止められます。
- すでにデプロイされたPagesの内容は、**無効化するまで公開されたまま**です。

## 8. 記録の場所

- 変更履歴：`git log`（作業ブランチ）
- 配信履歴：GitHub Actions の `Deploy GitHub Pages`
- 方針：`docs/PWA.md`、`docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md`
- 不明点は、推測で進めずにユーザーへ確認します。

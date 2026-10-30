# 配布オリジンの選択（GitHub組織 vs 独自ドメイン）

記録日：2026-10-30。Phase 1の公開URLを決めるための比較メモです。

## 0. 先に結論

- **アイコン（ホーム画面アプリ）は、どのオリジンでも作れます。** 組織に移すかどうかとは別の話です。決めるのは「保存領域をどこに置くか」＝**ホスト**です。
- **不特定多数に案内するなら、個人アカウントの `tonbokiriraikirimuramasa-taikoubou.github.io` は使わない**。他のプロジェクトサイトと保存領域・キャッシュを共有します。
- **2026-10-30 決定：0円。** したがって独自ドメインは取らず、**A. 専用GitHub組織**で進めます。
- 選択肢は2つ。
  - **A. trk! 専用のGitHub組織**（無料。`trk-agrg.github.io` など）
  - **B. 独自ドメイン**（年1,000〜2,000円程度。`trk.example.com` など）
- どちらも「PWAをホーム画面に追加して使う」形は同じ。違うのは**URLの覚えやすさ・信頼感・分離の強さ・移行の手間**です。
- **利用者に案内する前に決める。** ホストを変えると別オリジンになり、保存データは移行されません。

## 1. なぜホストが重要か

Webの保存領域（`localStorage`・`IndexedDB`・`CacheStorage`）は、**オリジン＝scheme + host + port** ごとに分かれます。**パスは関係ありません。**

| URL | オリジン | 保存領域 |
| --- | --- | --- |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk/` | `https://tonbokiriraikirimuramasa-taikoubou.github.io` | 共有 |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/` | 同上 | **同じ** |
| `https://trk-agrg.github.io/trk-PWA/` | `https://trk-agrg.github.io` | 別 |
| `https://trk.example.com/` | `https://trk.example.com` | 別 |

現在の個人アカウントの `github.io` では、次が起きます。

- 上流 `/trk/` と `/trk-PWA/` で設定・曲・記録が同じ場所に入る。
- `sw.js` は `trk-` で始まるキャッシュを版更新時に消すため、**上流とPWAが互いのオフラインキャッシュを消し得る**。
- 同じアカウントの他の公開リポジトリ（`Actor-si` など）のページも、同じ保存領域を読める。

## 2. 比較

| 観点 | A. 専用GitHub組織 | B. 独自ドメイン | C. 個人github.io（現状） |
| --- | --- | --- | --- |
| 費用 | **0円** | 年1,000〜2,000円程度＋DNS | 0円 |
| URLの例 | `trk-agrg.github.io/trk-PWA/` | `trk.example.com` | `tonbokiri...github.io/trk-PWA/` |
| 覚えやすさ・信頼感 | 中（github.ioが残る） | **高** | 低〜中 |
| 他のプロジェクトとの分離 | **組織内だけ分離**（組織に他のリポジトリを置かなければ実質分離） | **完全に分離** | 分離なし |
| 上流 `/trk/` とのキャッシュ競合 | なし | なし | **あり** |
| リポジトリの移動作業 | **必要**（mirror push、Pages再設定、権限） | 不要 | 不要 |
| この作業セッションとの相性 | 低（セッションは現リポジトリに固定） | **高**（このまま進められる） | 高 |
| HTTPS | GitHubが自動 | GitHubが自動（DNS設定後） | 自動 |
| 向いている人 | 無料で分離したい／組織運用に慣れている | ブランド・信頼感・URLを重視 | 試験だけ |

### アイコンについての補足

「単体アプリとしてアイコンを作れる」は、**A/B/Cのどれでも可能**です。必要なのは次のセットで、ホストとは無関係です。

- `manifest.webmanifest` の `icons`（192 / 512、可能なら maskable）
- `apple-touch-icon`（iOS用。180×180が望ましい。現在は192を指定）
- `display: standalone`（iOS 26はホーム画面追加で既定、古いiOS向けに指定）
- 起動画面（任意。`apple-touch-startup-image`）
- ホーム画面追加の案内（iOSは自動プロンプトが無い）

つまり、**組織に移すかどうかと、アイコンの良し悪しは独立**です。アイコンはPhase 3でどの道でも磨けます。

## 3. A. 専用GitHub組織にする場合

### メリット

- 無料。
- 個人アカウントの他のリポジトリから保存領域を分離できる。
- 将来、共同管理者を置ける。

### デメリット・注意

- URLは `github.io` のまま。一般利用者にはやや技術的に見える。
- 組織内に別のリポジトリを置くと、そのページと保存領域を共有する。**trk! 専用の組織にする**こと。
- リポジトリの移動作業が必要。
- **この作業セッションは `TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA` に固定**されているため、移行後は新しいセッションを開くか、手作業が必要になる。
- 組織にArenaのGitHub接続（GitHub App）をインストールし直す必要がある。

### 手順（案）

1. GitHubで無料の組織を作る（例 `trk-agrg`）。個人アカウントと同じく2FAが必要な場合あり。
2. 組織に空のリポジトリ `trk-PWA` を作る。
3. 現在のリポジトリをmirrorで移す。

   ```sh
   git clone --mirror https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA.git trk-PWA.git
   cd trk-PWA.git
   git push --mirror https://github.com/trk-agrg/trk-PWA.git
   ```

4. 組織のリポジトリで **Settings → Pages → Source: GitHub Actions** を設定。
5. 組織にArenaのGitHub Appをインストール（作業を続ける場合）。
6. `README.md` のURL、`index.html` の `og:url` / `og:image`、`docs/PWA.md` を新URLに更新。
7. 旧リポジトリはアーカイブし、READMEに移転先を書く。
8. 旧URLの利用者データは移行されない。案内文を用意する。

## 4. B. 独自ドメインにする場合

### メリット

- **最も分離が強い**（GitHub Pagesの他のサイトと保存領域を共有しない）。
- URLが短く、覚えてもらいやすい。アプリらしく見える。
- 現在のリポジトリ・セッションのまま進められる。
- 将来ストアやネイティブに移っても、案内URLを変えずに済む可能性がある。

### デメリット・注意

- ドメイン代（年1,000〜2,000円程度）とDNS設定。
- ドメインを失効するとURLも失う。
- 設定後にHTTPS証明書の発行を待つ（通常は数分〜数時間）。

### 手順（案）

1. ドメインを取得（例 `trk-agrg.com`、`trk-game.jp`）。サブドメイン `trk.example.com` でも可。
2. DNSで `trk` の **CNAME** を `tonbokiriraikirimuramasa-taikoubou.github.io` に向ける（apexドメインならAレコード4本）。
3. GitHubの **Settings → Pages → Custom domain** にドメインを入力して Save。
4. DNSチェックが通ったら **Enforce HTTPS** をオン。
5. リポジトリに `CNAME` ファイル（ドメイン名1行）を置く。Actions配信でもカスタムドメインを維持するため。
6. `og:url` / `og:image` / README / docs を新URLに更新。
7. iPhoneで「ホーム画面に追加」→ standalone起動→オフラインを確認。

### 4.4 追加確認（2026-10-30）

- `TonbokiriRaikiriMuramasa-Taikoubou/trk-Standalone` が作成された（READMEのみ、Pages未設定）。ただし**同じ個人アカウント**なので、ホストは `tonbokiriraikirimuramasa-taikoubou.github.io` のまま。**オリジンは分離されない**（コード分割用）。
- `trk-agrg` は空き（APIが404）。`trk` は他人が使用中。`trk-standalone` / `trk-game` / `trkstandalone` も空き。
- 推奨：組織 `trk-agrg` を作り、その中にリポジトリ `trk` を置く → `https://trk-agrg.github.io/trk/`。最短にしたいなら `trk-agrg.github.io` リポジトリでルート配信。
- この作業セッションは `trk-PWA` に固定されている。組織へ移したあとの継続作業は**新しいセッション**で行う（引き継ぎは `docs/HANDOFF-TRK-STANDALONE.md`）。

## 5. どちらを選ぶか（目安）

- **無料を優先し、組織運用の手間を許容できる** → **A. 専用組織**。← **2026-10-30 の決定**。
- **ブランド・信頼感・URLの短さを優先し、年1,000〜2,000円を許容できる** → **B. 独自ドメイン**。
- **まず試験だけ** → 現在の `/trk-PWA/`。ただし一般案内はしない。

どちらでも、**公開告知の前に決める**のが原則です。データはホストをまたいで移りません。

## 6. まだ決めていないこと

1. 組織名を `trk-agrg` にするか、別名にするか（2026-10-30時点で `trk-agrg` は空き）。
2. リポジトリ名を `trk` にするか、`trk-agrg.github.io`（ルート配信）にするか。
3. Arenaの接続を組織へ移してよいか（作業セッションが変わります）。
4. アイコンの方向性（現行の `trk!` ロゴを磨くか、新規に作るか）。
5. 公開告知の時期（Phase 0の実機チェック前か後か）。

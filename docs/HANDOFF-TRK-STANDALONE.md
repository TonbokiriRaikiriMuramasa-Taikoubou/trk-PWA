# trk-Standalone 引き継ぎ（2026-10-30）

> **新しいセッションの最初の指示例**
>
> 「このリポジトリは trk! の iPhone 向け standalone PWA です。まず `docs/HANDOFF-TRK-STANDALONE.md` と `docs/PWA.md` を読んで、Phase 0 の実機チェックから進めてください。0円・不特定多数・ホーム画面運用の方針は変えません。」

## 1. ミッション

**trk! を、iPhone のホーム画面から開ける standalone PWA として、無料・オープンソースで不特定多数に届ける。**

- ストア（App Store / Google Play）は使わない。
- 独自ドメインは買わない（0円）。
- アカウント登録なし。曲・譜面・記録は端末内だけ。
- 広告・トラッキング・課金なし。全員が同じデフォルト体験。
- ライセンスは **GPL-3.0-or-later**。クレジットとソースを保持する。

## 2. 変えない決定事項

| 項目 | 決定 |
| --- | --- |
| 配布対象 | 不特定多数 |
| 開き方 | Safari で「ホーム画面に追加」→ ホーム画面から起動 |
| 費用 | 0円（ドメイン・ストア・有料APIなし） |
| ストア | 使わない |
| バックエンド | 持たない（静的ホスティングのみ） |
| データ | 端末内（localStorage / IndexedDB / CacheStorage） |
| 言語 | 日本語が既定。英語UIは既存のi18nに任せる |
| ライセンス | GPL-3.0-or-later |

## 3. 現在の状態（2026-10-30 夜）

| 項目 | 状態 |
| --- | --- |
| 元リポジトリ | `TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA`（上流 `trk` 1.1.8 を履歴ごと取り込み済み） |
| 上流 | `TonbokiriRaikiriMuramasa-Taikoubou/trk`（1.1.8、`06cef87`） |
| 新リポジトリ | `TonbokiriRaikiriMuramasa-Taikoubou/trk-Standalone`（空。READMEのみ、Pages未設定。**まだ移していません**） |
| 作業ブランチ | `arena/608b424c-trk-pwa`（Phase 2・3 の実装。PR を開く） |
| main | `8d33db6`（PR #1 マージ済み）。PR #2（docs）はこのブランチに取り込み済み |
| テスト | `npm run check` **794 pass / 0 fail**（2026-10-30、trk220 の47件を追加） |
| Pages | `trk-PWA` で有効化済み（Source: GitHub Actions）。初回デプロイは `Configure Pages` で失敗（**Pages 有効化より前の実行**が原因。APIは `Not Found`）。有効化後の `main` への push で再実行される |
| iPhone実機 | **未検証**（このセッションには端末がない） |

### Phase 2・3 で入れたもの（2026-10-30）

- **モバイル用シェル**：`js/mobile-shell.js`・`css/mobile-shell.css`・`js/mobile-settings-panels.js`。
  `trk-apk` の画面の組み方（下部ナビ・1画面1役割・取込の折りたたみ・設定の欄の記憶）を、
  Capacitor の橋渡しを持たずに移植。PC では `body.trk-mobile` が付かないので何も変わりません。
- **iOS向けの調整**：`js/ios-pwa.js`（インストール案内・`navigator.audioSession`・言い換え）、
  manifest（`id`・`display: standalone`・`display_override`・アイコン一式）、
  `apple-touch-icon` 180 と `apple-mobile-web-app-*`、⚙ の「🍎 iPhoneで使う」欄、
  `sw.js` の precache（trk220）。詳細は `docs/PWA.md` §9・§10。

### まだ残っているもの

- **iPhone実機の確認**：Phase 0。`docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` §6 の18項目。**未実施**。
- **初回デプロイの成功**：`main` にマージしたあと、Actions の `Deploy GitHub Pages` を見る。
- **オリジンの確定と移行**：§4・§5。0円で分離するなら組織 `trk-agrg`。**告知前に決める。**
- **公開告知**：Phase 4。バックアップ導線（書き出し／読み戻し）の案内もここで詰める。

## 4. URLとオリジン（最重要）

### 4.1 同じ個人アカウントのリポジトリは、URLを分けても保存領域を分けられない

保存領域は **オリジン（scheme + host + port）** 単位です。パスは関係ありません。

| URL | オリジン | 保存領域 |
| --- | --- | --- |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk/` | `https://tonbokiriraikirimuramasa-taikoubou.github.io` | 共有 |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/` | 同上 | **同じ** |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-Standalone/` | 同上 | **同じ** |
| `https://trk-agrg.github.io/trk/` | `https://trk-agrg.github.io` | 別 |

つまり、**`trk-Standalone` を同じ個人アカウントに作っただけでは、0円でも分離されません。** 上流 `/trk/` と設定・曲・記録・キャッシュを共有します。`sw.js` は `trk-` プレフィックスのキャッシュを消すため、互いのオフラインキャッシュを壊し得ます。

### 4.2 0円で分離する方法：無料のGitHub組織

2026-10-30時点の確認：

- `trk-agrg` は**空き**（`api.github.com/users/trk-agrg` が404）。
- `trk` は**他人が使用中**（`trk.github.io` は使えない）。
- `trk-standalone` / `trk-game` / `trkstandalone` も空き。

**推奨：組織 `trk-agrg` を作り、その中にリポジトリ `trk` を置く。**

- URL：`https://trk-agrg.github.io/trk/`
- 「URLはtrkを使い」を満たしつつ、ホストが分かれる。
- 最短URLにしたいなら、組織内に `trk-agrg.github.io` というリポジトリを作り、`https://trk-agrg.github.io/` で配信する（パスなし）。

**注意**：組織名はあとから変えられるが、URLは変わる。利用者に案内したあとの変更はデータ移行を伴わない。

### 4.3 現在の `trk-Standalone` の扱い

- 同じ個人アカウントのままなら、**コード分割用**としては使えるが、オリジン分離にはならない。
- 組織を作ったら、`trk-Standalone` を組織へ**Transfer ownership**するか、組織に `trk` を作ってmirror pushする。空なので作り直しが早い。
- 旧 `trk-PWA` はアーカイブし、READMEに移転先を書く。旧URLは案内ページだけ残す。

## 5. 移行手順（組織 `trk-agrg` / リポジトリ `trk` の場合）

1. https://github.com/organizations/plan で無料の組織 `trk-agrg` を作る。
2. 組織に空のリポジトリ `trk` を作る（public）。
3. 手元でmirror cloneしてpushする。

   ```sh
   git clone --mirror https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA.git trk-PWA.git
   cd trk-PWA.git
   git push https://github.com/trk-agrg/trk.git refs/heads/main:refs/heads/main
   git push https://github.com/trk-agrg/trk.git --tags
   ```

   PR #2 のdocsを先にmainへマージしておく。マージ前なら、作業ブランチも参考用にpushする。

   ```sh
   git push https://github.com/trk-agrg/trk.git refs/heads/arena/01a1ef52-trk-pwa:refs/heads/handoff/2026-10-30
   ```

4. 組織のリポジトリで **Settings → Pages → Source: GitHub Actions** を設定。
5. 組織にArenaのGitHub Appをインストールし、**新しいセッションを `trk-agrg/trk` で開始**する。このセッションは `trk-PWA` に固定されているため、移行後の継続作業には使えない。
6. `README.md`、`index.html` の `og:url` / `og:image`、`docs/PWA.md`、`docs/ORIGIN.md` のURLを新URLに更新。
7. 旧 `trk-PWA` / `trk-Standalone` をアーカイブし、移転先を書く。
8. iPhoneで「ホーム画面に追加」→ standalone起動→オフライン→データ保存を確認。

## 6. エージェントの方針

### やる

- 変更はPRで。`main` へ直接pushしない（所有者のマージ）。
- 変更後に `npm ci`、`npm run check`、`node tools/check-repo.mjs` を通す。
- UIは日本語を既定にし、既存のi18nキーを壊さない。
- オフライン優先を維持する。実行時にCDNや外部APIへ取りに行かない。
- 端末内データの互換性を意識する。保存キーを変えるときは移行を書く。
- iPhone Safariで確認する。`tools/ios-probe.html` を使う。
- 事実と推測を分ける。実機で見ていないことを「確認済み」と書かない。
- 費用・Secrets・ストア登録・独自ドメインが必要になったら、勝手に進めず相談する。

### やらない

- 広告、アナリティクス、トラッキング、外部フォントの追加。
- アカウント、サーバ、クラウド保存の追加。
- 有料API、ストア登録、独自ドメインの購入。
- `main` のforce push、履歴の書き換え。
- GPLv3の著作権表示・クレジットの削除。
- オリジンを黙って変えること（データが移行されない）。

## 7. ロードマップ

### Phase 0：iPhone実機チェック（最初）

- Safariで開く。初回読み込み、音、タップ、スクロール。
- 「ホーム画面に追加」→ アイコン・名前・起動画面。
- standalone起動、画面回転、セーフエリア。
- 曲の取り込み（ファイル選択、フォルダ選択、`webkitdirectory`）。
- 音声の遅延、BGMとタップ音、画面ロック後の挙動。
- 機内モードで再起動。オフラインでどこまで動くか。
- 記録・設定が再起動後も残るか。
- 結果を `docs/PWA.md` に追記。

### Phase 1：公開

- PR #2 をmainへマージ → `Deploy GitHub Pages`。
- 公開URL、`manifest.webmanifest`、`sw.js`、アイコン、`privacy.html`、`credits.html` を確認。
- ここで一度、PWAとしての土台を確定。

### Phase 2：モバイルシェル移植（約370行）

- iPhone幅のレイアウト、タッチ操作、縦横、セーフエリア。
- 既存のデスクトップUIを壊さない。
- 詳細は `docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md`。

### Phase 3：iOS調整

- `manifest` に `id`、`display: standalone`、`display_override` を追加。
- `apple-touch-icon` 180×180、`apple-mobile-web-app-capable`、`apple-mobile-web-app-title`。
- `navigator.audioSession.type = "playback"` をユーザー操作起点で設定（画面ロック後の音）。
- インストール案内（iOSは自動プロンプトがない）。
- アイコン一式（180 / 192 / 512 / maskable / 1024）。現行の `trk!` ロゴを磨くか、太鼓モチーフにするか。
- `sw.js` のプリキャッシュ（未訪問でもオフライン起動）。

### Phase 4：公開・運用

- 告知（X、README、QRコード、コミュニティ）。
- バックアップ導線（書き出し／読み戻し）。
- フィードバックの受け皿（Issues）。
- オリジンは**告知前に確定**。後から変えない。

## 8. 検証コマンド

```sh
npm ci
npm run check          # 794 pass / 0 fail（2026-10-30時点）
node tools/check-repo.mjs
node tools/check-security.mjs
node tools/check-a11y.mjs
```

ローカル確認：

```sh
python3 -m http.server 8000 --bind 0.0.0.0
# http://localhost:8000/ と /tools/ios-probe.html
```

## 9. 既知の落とし穴

- **同一オリジン**：`*.github.io` のプロジェクトサイトはホスト共有。パスを分けても保存領域は分離されない。
- **7日削除**：Safariのタブは非インストールだと7日で保存が消え得る。ホーム画面アプリは対象外だが、Safariタブとは**ストレージが別**。再追加するとデータは空。
- **iOSのインストール**：`beforeinstallprompt` はない。「共有 → ホーム画面に追加」を案内する。iOS 26以降はmanifestなしでもstandalone起動が既定。
- **manifestの無視項目**：`display: fullscreen`、`orientation`、`share_target`、`file_handlers` はiOSで効かない前提。横向き固定はできない。
- **オーディオ**：画面ロック後の再生は、`navigator.audioSession.type = "playback"` をタップ起点で設定する必要がある。Chromiumには `audioSession` がない。
- **フォルダ取込**：`webkitdirectory` はiOS 18.4以降。それ以前はフォルダ選択が限定的。
- **Service Worker**：通信優先＋install での殻のプリキャッシュ（trk220）。未使用の 3D（`assets/vendor`）・同梱デモ音源・`docs/`・`tools/` は、使ったときに初めて入ります。
- **キャッシュ**：`sw.js` は `trk-` プレフィックスのキャッシュを版更新で消す。同じホストに別サイトを置くと干渉する。
- **データ移行**：オリジン変更＝データ移行なし。バックアップ導線を先に用意する。

## 10. 未決事項

1. 組織名は `trk-agrg` でよいか。リポジトリ名は `trk` か `trk-agrg.github.io` か。
2. 旧 `trk-PWA` / `trk-Standalone` をいつアーカイブするか。
3. アイコンの方向性（現行ロゴを磨く／太鼓モチーフ／新規）。
4. 公開告知の時期（Phase 0の後か、Phase 3の後か）。
5. 上流 `trk` にモバイルシェルを還元するか（別PRで相談）。
6. バックアップ／読み戻しを公開前の必須にするか。

## 11. 参照

- `docs/PWA.md` — 配布・Pages・実機チェックの現在地
- `docs/ORIGIN.md` — 組織／ドメインの比較と移行手順
- `docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` — iPhone PWAの調査とPhase設計
- `docs/PERMISSIONS.md` — 権限と人の操作が必要な箇所
- `docs/HANDOFF-TRK.md` — 上流 `trk` 側の引き継ぎ

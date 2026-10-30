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

## 3. 現在の状態（2026-10-31）

| 項目 | 状態 |
| --- | --- |
| 元リポジトリ | `TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA`（上流 `trk` 1.1.8 を履歴ごと取り込み済み） |
| 上流 | `TonbokiriRaikiriMuramasa-Taikoubou/trk`（1.1.8、`06cef87`） |
| 新リポジトリ | `TonbokiriRaikiriMuramasa-Taikoubou/trk-Standalone`（空。READMEのみ、Pages未設定。**まだ移していません**） |
| 作業ブランチ | `arena/608b424c-trk-pwa`（Phase 2・3 の実装。PR を開く） |
| main | `8d33db6`（PR #1 マージ済み）。PR #2（docs）はこのブランチに取り込み済み |
| テスト | `npm run check` **835 pass / 0 fail**（2026-10-31、trk220 の47件・trk221 の27件・trk222 の13件を追加） |
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

### Phase 4 で入れたもの（2026-10-31・trk221）

- **画面の形の切り替え**：`settings.uiMode`（自動／PC型／スマホ型）。PC でもスマホ型にできるので、縦型のスタンドや小さい窓でも指の操作で使えます。大きいタブレットは PC型も選べます。入口は ⚙ の「🖥 画面と再生バー」と、選曲画面の右上の 📱／🖥。開き直さずにその場で切り替わります。
- **下の再生バー**：`settings.playerBar`（つねに／曲を選んだら／出さない、既定は曲を選んだら）。`js/player-bar.js`・`css/player-bar.css`。曲名・ジャケット・⏮▶⏭・シーク線・音量・再生画面・✕。色はスキンに追従し、ゲーム中・再生画面・書斎・ほかの窓では引っ込みます。
- 保存キーは増やしていません（`core.settings` のみ。`?reset=all` で既定へ）。
- **trk222（2026-10-31）**：再生バーの既定を「つねに表示」へ。**拡大率（50／75／100／125%）** を追加（PC型の画面と再生バー。ゲーム中は100%）。**アイコンの大きさは100%で固定**（既定オン）。右上の 📱／🖥 を **PC型 ↔ スマホ型 の2択**にし、❓ 謎設定に「画面の形は、常に選んだものを使う」（既定オン）を追加。スマホ型のエフェクト欄（音楽・映像・くわし・TRKアンプ・TRKエフェクト・MIX）を**エフェクトのタブへ集約**し、ライブラリのタブにも出せる設定（既定オフ）を追加。
- 詳しい設計・検証・未実施の項目は `docs/UI-MODE-AND-PLAYER-BAR.md`（§8 が trk222）、要約は `docs/PWA.md` §9.1。

### まだ残っているもの

- **iPhone実機の確認**：Phase 0。`docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` §6 の18項目。**未実施**。
- **実ブラウザでの見た目**：trk221 の再生バーと画面の形の切り替え。jsdom の通し確認だけで、Chrome／Safari での見た目は**未実施**（`docs/UI-MODE-AND-PLAYER-BAR.md` §5・§6）。
- **初回デプロイの成功**：`main` にマージしたあと、Actions の `Deploy GitHub Pages` を見る。
- **オリジンの移行作業**：§4.2・§5。URL は `.../trk/`（リポジトリ `trk`）に決まりました。**コードを `trk` へ移す作業と、告知の時期は所有者の判断**です。
- **公開告知**：Phase 4。バックアップ導線（書き出し／読み戻し）の案内もここで詰める。

## 4. URLとオリジン（最重要）

### 4.1 同じ個人アカウントのリポジトリは、URLを分けても保存領域を分けられない

保存領域は **オリジン（scheme + host + port）** 単位です。パスは関係ありません。

| URL | オリジン | 保存領域 |
| --- | --- | --- |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk/` | `https://tonbokiriraikirimuramasa-taikoubou.github.io` | 共有 |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/` | 同上 | **同じ** |
| `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-Standalone/` | 同上 | **同じ** |
| `https://trk-company.github.io/trk/`（組織を作った場合の例） | `https://trk-company.github.io` | 別 |

つまり、**`trk-Standalone` を同じ個人アカウントに作っただけでは、0円でも分離されません。** 上流 `/trk/` と設定・曲・記録・キャッシュを共有します。`sw.js` は `trk-` プレフィックスのキャッシュを消すため、互いのオフラインキャッシュを壊し得ます。

### 4.2 決定：URL は `.../trk/`（リポジトリ `trk` を使う）

**2026-10-31 決定（所有者）。** 配布URLは次のとおりです。

- URL：`https://tonbokiriraikirimuramasa-taikoubou.github.io/trk/`
- リポジトリ：`TonbokiriRaikiriMuramasa-Taikoubou/trk`（**フルバージョンの本体**。既に存在します）

理由：**いちばん短く、覚えやすい**（`/trk/`）。`trk-Standalone` は名前のとおり
**「通信を行わない」ことを守った完成系**として残します。

**事実（2026-10-31 時点）**

- `api.github.com/repos/TonbokiriRaikiriMuramasa-Taikoubou/trk` は **200**（リポジトリは存在する）。
- `trk` 個人アカウントの `trk.github.io` は使えません（**別の人が使っている**ので、そのURLは取れません）。
- このURLのホストは `tonbokiriraikirimuramasa-taikoubou.github.io` で、**同じアカウントの他のページと保存領域を共有します**（§4.1）。パスだけでは分離されません。

**決めていないこと／保留**

- 保存領域を分けたくなったときのための**GitHub組織**は、名前だけ決めています（**Trk Company**）。
  slug の候補 `trk-company`・`trkcompany`・`trk-co` は 2026-10-31 の API で **404（空き）**、`trk-corp` は使用中でした。
  **組織の作成は未実施**です。作ると URL が変わり（例 `https://trk-company.github.io/trk/`）、
  保存データは移行されません。**告知の前に決める**という原則は変えません。
- 旧 `trk-PWA` の扱い（アーカイブするか、`trk` へ集約するか）と、告知の時期。

### 4.3 現在の `trk-Standalone` の扱い

- 同じ個人アカウントのままなら、**コード分割用**としては使えるが、オリジン分離にはならない。
- 組織を作ったら、`trk-Standalone` を組織へ**Transfer ownership**するか、組織に `trk` を作ってmirror pushする。空なので作り直しが早い。
- 旧 `trk-PWA` はアーカイブし、READMEに移転先を書く。旧URLは案内ページだけ残す。

## 5. 移行手順（リポジトリ `trk` へ。実行は所有者の判断）

> 組織（Trk Company）を作る場合も、下の `TonbokiriRaikiriMuramasa-Taikoubou` を slug（例 `trk-company`）に読み替えるだけで同じ手順です。

1. （組織にする場合だけ）https://github.com/organizations/plan で無料の組織を作る。
2. リポジトリ `trk` を用意する（**個人アカウントの `trk` は既にあります**。組織にするなら組織に作る）。
3. 手元でmirror cloneしてpushする。

   ```sh
   git clone --mirror https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA.git trk-PWA.git
   cd trk-PWA.git
   # 個人アカウントの trk へ（組織にするなら https://github.com/trk-company/trk.git など）
   git push https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk.git refs/heads/main:refs/heads/main
   git push https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk.git --tags
   ```

   PR #2 のdocsを先にmainへマージしておく。マージ前なら、作業ブランチも参考用にpushする。

   ```sh
   git push https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk.git refs/heads/arena/608b424c-trk-pwa:refs/heads/handoff/2026-10-31
   ```

4. 組織のリポジトリで **Settings → Pages → Source: GitHub Actions** を設定。
5. （組織にする場合）組織にArenaのGitHub Appをインストールし、**新しいセッションを `trk-company/trk` などで開始**する。このセッションは `trk-PWA` に固定されているため、移行後の継続作業には使えない。個人アカウントの `trk` へ移す場合も、セッションは `trk` で開き直すのが確実です。
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
- オリジンは**告知前に確定**。後から変えない（2026-10-31 に `.../trk/` へ決定。§4.2）。

## 8. 検証コマンド

```sh
npm ci
npm run check          # 835 pass / 0 fail（2026-10-31時点）
node tools/check-repo.mjs
node tools/check-security.mjs
node tools/check-a11y.mjs
```

ローカル確認：

```sh
python3 -m http.server 8000 --bind 0.0.0.0
# http://localhost:8000/ と /tools/ios-probe.html
# trk221 の確認：選曲画面の右上の 📱 を押す → PC のままスマホ型／曲を選ぶ → 下に再生バー
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

1. 組織を作るかどうか（名前は **Trk Company**、slug 例 `trk-company`）。作らないなら、リポジトリ `trk` の個人アカウントのまま進めます。
2. 旧 `trk-PWA` / `trk-Standalone` をいつアーカイブするか。
3. アイコンの方向性（現行ロゴを磨く／太鼓モチーフ／新規）。
4. 公開告知の時期（Phase 0の後か、Phase 3の後か）。
5. 上流 `trk` にモバイルシェルを還元するか（別PRで相談）。
6. バックアップ／読み戻しを公開前の必須にするか。

## 11. 参照

- `docs/PWA.md` — 配布・Pages・実機チェックの現在地
- `docs/ORIGIN.md` — オリジンの決定（`.../trk/`）と、組織／ドメインの比較・移行手順
- `docs/UI-MODE-AND-PLAYER-BAR.md` — 画面の形の切り替えと下の再生バー（trk221）
- `docs/IPHONE-PWA-BRAINSTORM-2026-10-30.md` — iPhone PWAの調査とPhase設計
- `docs/PERMISSIONS.md` — 権限と人の操作が必要な箇所
- `docs/HANDOFF-TRK.md` — 上流 `trk` 側の引き継ぎ

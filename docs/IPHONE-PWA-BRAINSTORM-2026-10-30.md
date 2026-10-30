# iPhone向け trk! 配布 — ブレインストーミング

記録日：2026-10-30。対象：`trk-PWA`（このリポジトリ）。
これは**決定事項ではなく、比較と提案のメモ**です。実装・実機確認をしたという意味ではありません。

---

## 0. 先に結論

1. **iPhone向けの第一候補はPWAで妥当**。ただし「PWAに整える」作業の中心は、マニフェストやService Workerの新規実装ではなく、**iOS固有の配布・保存・取込・音の詰め**です。
2. **`trk-apk` を丸ごと土台にするのは損**。`trk-apk` のアプリ本体は **1.1.4（trk214）＋1.1.5〜1.1.7の一部**で、最新の **1.1.8（trk219）**ではありません。持ち込む価値があるのは**モバイル用の画面シェル**です。
3. **今日いちばん安い実験は、既存のGitHub Pages版 1.1.8 をiPhoneのホーム画面に追加して触ること**。30分で「画面シェルが要るか」の判断材料が取れます。新しいリポジトリを作るのは、そのあとで十分です。

---

## 1. 事実確認（2026-10-30時点で確認したこと）

### 1.1 3つのリポジトリの関係

| リポジトリ | 状態 | 中身 |
| --- | --- | --- |
| `trk`（Web版） | 最新。HEAD `06cef87`（2026-10-29 17:50 JST） | **1.1.8 / trk219**。GitHub Pages配信のワークフローあり |
| `trk-apk`（Android版） | HEAD `65c8b36`（2026-10-29） | 1.1.4（trk214）を基礎に、PC版1.1.5〜1.1.7の一部を統合。**Capacitor＋モバイル画面シェル** |
| `trk-PWA`（このリポジトリ） | **空**（`README.md` 9バイト、`20bbdac`）。Pages未設定（APIが404） | これから作る |
| Google Drive `trk-1.1.8` | 2026-10-29 08:49 UTC | `trk-1.1.8.zip` 3,933,293 bytes / sha256 `8075ce5b…be9c2` / 227エントリ |

- Driveの1.1.8は、`trk` のHANDOFFにあるZIPの値（227エントリ・3,933,293 bytes・sha256 `8075ce5b…`）と一致しています。**「Drive内が最新」は 1.1.8 を指す**と判断しました。
- 指定のDriveフォルダ `trk-apk-debug-65c8b36…` には `app-debug.apk`（9,391,925 bytes）と `SHA256SUMS.txt`（80 bytes）の2ファイルがあります。**APK本体のハッシュ照合は今回していません**（ソース比較を優先）。またAPKはAndroid用なのでiPhoneには入りません。

### 1.2 「土台」の中身を分けて数える

`trk-apk` が上流Web版に足しているものは、大きく2種類です。

| 種類 | ファイル | 行数 | iPhoneで使えるか |
| --- | --- | --- | --- |
| **モバイル画面シェル** | `js/apk-mobile.js` / `css/apk-mobile.css` / `js/apk-settings-panels.js` | 215 / 108 / 50 | **使える（移植価値あり）** |
| Android固有の橋渡し | `js/apk-native.js` / `js/apk-background.js` / `js/apk-audio-safety.js` | 121 / 121 / 62 | ほぼ不要（Capacitor判定で無効になるが、iOS PWAでは意味がない） |
| HTML/CSSの調整 | `index.html` の `body.apk-shell`、取込の折りたたみ、下部ナビの土台 | ― | 使える |

つまり「apkから土台を持ってくる」の実体は、**アプリ全体のコピーではなく、約370行のシェル＋HTMLの小改修**です。ここを分けて考えれば、1.1.8の新しい修正を捨てずに済みます。

### 1.3 Web版の規模（PWA配信の前提）

- 作業ツリー 33MB。`js/` 3.14MB（59ファイル）、`css/` 235KB、`index.html` 130KB。
- `assets/vendor/` 5.3MB（three.js / three-vrm / MMDローダー）は**初回には読まれず、VRM・MMDを使うときに動的import**。
- 同梱デモ音源 `assets/optional-demo-audio/` 729KB（削除可能）。
- テストは86スイート。HANDOFFでは `npm run check` 746 pass。

初回の転送は「HTML＋CSS＋JS＋アイコン」が中心で、3Dやデモ音源は後追いです。PWAの初回キャッシュ設計はこの分離を活かせます。

---

## 2. 配布手段の比較

### 2.1 費用と手間

| 手段 | 費用 | 期間 | 審査 | 更新 | 配布できる相手 | trk!との相性 |
| --- | --- | --- | --- | --- | --- | --- |
| **PWA（GitHub Pages）** | **0円** | すぐ | なし | 即時 | URLを知っている人 | **◎** |
| PWA＋独自ドメイン | 年1,000〜2,000円程度 | すぐ | なし | 即時 | 同上 | ◎（URLとデータが安定） |
| TestFlight | Apple Developer Program **99ドル/年** | 数日 | ベータ審査 | ビルドごと | 最大1万人（外部） | △（Mac・GPL・審査） |
| App Store | **99ドル/年** | 数週間 | 本審査 | 審査 | 全世界 | **×〜△**（下記） |
| 個人ビルド（Xcode） | 0円 | 中 | なし | **7日ごとに再署名** | 自分の端末のみ | △（配布不可） |
| AltStore等のサイドロード | 0円〜 | 大 | なし | 7日更新の維持にPC | リテラシーのある人 | △（一般向けでない） |
| 日本の代替マーケット | Appleの年会費＋公証 | 大 | 公証＋市場の条件 | 公証 | 日本国内 | △（PWAより重い） |
| APK（Google Play / GitHub Releases） | 25ドル（Play） / 0円 | ― | ― | ― | **Androidのみ** | iPhoneでは不可 |

### 2.2 見落としやすいポイント

- **Google Playの25ドルはiPhoneと無関係**。iPhone側の比較対象は「0円のPWA」か「年99ドルのApple」です。
- **iOS 26.2以降、日本でも代替アプリマーケットが利用可能**になりました（2025年12月）。ただしAppleの説明では、配信には**公証（Notarization）**とデベロッパープログラムの条件が絡みます。**「25ドルを払わないための抜け道」にはなりません**。
- **Appleの年会費免除**は、米国拠点の非営利・教育・政府機関向けの制度です。日本拠点の個人・団体が対象になるかは別問題で、期待しない方が安全です。
- **GPLv3 と App Store の相性**。App StoreのDRM・利用条件とGPLの再配布条件は以前から衝突が指摘され、VLCが2011年にApp Storeから外された事例があります。trk! は GPL-3.0-or-later なので、**App Store配信は技術より先にライセンスの整理が必要**です（法的判断は専門家へ）。PWAはこの問題を回避できます。
- **PWAはストアに出ない**。発見性はURLと告知だけ。これは欠点であると同時に、審査・手数料・署名から自由という利点でもあります。

### 2.3 現時点のおすすめ

**「PWAを本線、ネイティブは“PWAで足りないと実測できた機能”のために保留」**。
理由は、①既に動くWeb資産がある、②iPhoneのインストール要件がiOS 26で実質なくなった、③GPLとストアの摩擦を避けられる、④更新が即時、の4点です。

---

## 3. PWAの「足りないもの」— コードを見た結果

前回の相談では「manifestやService Workerが足りないかも」という話がありましたが、**1.1.8には既にあります**。本当の差分はiOS側です。

### 3.1 すでにある（心配しなくてよい）

| 項目 | 実装 |
| --- | --- |
| manifest | `manifest.webmanifest`（名前・相対`start_url`/`scope`・アイコン・テーマ色） |
| Service Worker | `sw.js`。通常は通信優先、失敗時にキャッシュ。vendorはSHA-384固定 |
| ホーム画面アイコン | `icons/icon.svg` / 192 / 512、`apple-touch-icon` |
| セーフエリア | `viewport-fit=cover`、`env(safe-area-inset-*)`、`100dvh` |
| 保存 | IndexedDB＋`navigator.storage.persist()`の要求UI（設定） |
| 軽量化 | 自動判定・フレームレート・3Dレート・解像度・解析オフなど |
| 遅延補正 | `settings.latency`（-300〜+500ms）＋プレイ中の`-`/`=`調整 |
| Wake Lock / Media Session | 動画プレイヤー側に実装（iOSの対応差は要確認） |
| Capacitor判定 | `window.Capacitor`を見てネイティブ時だけ分岐する箇所が複数 |

### 3.2 iOSの仕様上できないこと（設計で回避する）

| 機能 | iOSの扱い | trk!への影響 |
| --- | --- | --- |
| `display: fullscreen` | **非対応**。`standalone`/`browser`のみ。iOS 26では「ホーム画面に追加したサイトは既定でWebアプリとして開く」 | 現状のmanifestは`fullscreen`。iOS 26なら結果的にstandaloneだが、**古いiOSではSafariのUIが出る可能性**。`display: standalone`＋`display_override`へ整理したい |
| `orientation: landscape` | **無視** | 縦向きで起動し得る。ゲームは横向き前提なので案内・レイアウトが必要 |
| `share_target` / `file_handlers` | **非対応** | OS共有シートからtrk!へ送れない。「共有」という文言が誤解を生む |
| `showDirectoryPicker` | **非対応**（OPFSのみ） | フォルダ取込は`<input webkitdirectory>`へフォールバック。iOS 18.4以降はフル対応、それ以前はiCloud Drive中心の部分対応 |
| `beforeinstallprompt` | **なし** | インストール導線は自前の案内（共有→ホーム画面に追加） |
| 7日間のストレージ削除 | **ホーム画面のWebアプリは対象外**。Safariのタブは対象 | 「Safariで開いていたデータ」と「ホーム画面アプリのデータ」は**別領域**。追記アイコンを作り直すと空になる |
| 背景音声 | Web Audioは再生セッションの扱いが絡む。`navigator.audioSession.type = "playback"`が鍵（要実機確認） | trk!は`audioSession`を設定していない。画面ロック・背景で止まる可能性 |
| Push / Wake Lock / PiP | Pushは16.4+（ホーム画面のみ）、Wake Lockは18.4+、PiPはvideo要素に制約 | 通知は不要。PiP・Wake Lockは「非対応時の案内」で足りる |

### 3.3 trk! 固有のギャップ（優先順）

#### P0：配布前に直したい

1. **manifestの表示モード**
   - `display: "fullscreen"` → `display: "standalone"` ＋ `display_override: ["fullscreen", "standalone"]`。
   - `id` を追加（`"./"`）。`apple-mobile-web-app-capable` / `apple-mobile-web-app-title` も併記。
   - 効果：Androidは従来どおり全画面、iOSは確実にstandalone。

2. **iOS用のインストール案内**
   - `navigator.standalone` または `matchMedia("(display-mode: standalone)")` で判定し、Safariタブのときだけ「共有 → ホーム画面に追加」を表示。
   - 効果：初回の離脱を減らす。iOSには自動プロンプトが存在しない。

3. **保存の説明をiOS向けに**
   - 「ホーム画面から開いてください」「Safariのタブとは別の保存領域です」「消えたときに備えてバックアップを書き出してください」を設定に明記。
   - 既存の`storagePersistHint`はブラウザ一般向けなので、iOSの別領域・7日ルールの注記を足す。

4. **取込UIの言葉と経路**
   - iOSでは`showDirectoryPicker`が無いので、`webkitdirectory`フォールバックが本線。フォルダによっては選べない（特にiOS 18.4未満）ため、**「曲を選ぶ」を主、「フォルダ」を副**に。
   - 「ミュージックフォルダを共有」はshare_targetと紛らわしい。iOSでは「フォルダを選ぶ」に言い換える。

5. **オフラインの約束をどこまでにするか**
   - 現行SWは「見たファイルをキャッシュ」する方式。インストール直後に機内モードにすると、未訪問の画面が欠ける可能性。
   - 案：`index.html`・`css/`・`js/`・アイコンだけ**install時にprecache**（約3.5MB）。vendor・デモ音源・docsは除外。
   - 効果：初回起動後は主要画面がオフラインで動く。更新時の混在リスクはキャッシュ名の更新で管理。

#### P1：実機で差が出たら直す

6. **音のセッション**
   - 再生開始のユーザー操作時に `navigator.audioSession.type = "playback"` を試す（存在する場合だけ）。
   - サイレントスイッチでWeb Audioが無音になる挙動は実機で確認。案内文が必要なら設定に追加。

7. **向き**
   - 縦向き時のレイアウト、または「横向きにしてください」のオーバーレイ。ゲーム開始時だけでも効果が大きい。
   - iOSは`screen.orientation.lock()`が使えないため、**CSSと案内で対応**するしかない。

8. **共有シート非対応の明示**
   - iOSでは「共有で受け取る」を非表示にし、ヘルプに「iOSは非対応」と書く（既にガイドには記載あり）。

9. **更新の見え方**
   - `skipWaiting`＋通信優先なので次回読み込みで更新されやすいが、**起動中に新旧が混ざる**可能性は残る。設定に「再読み込み」ボタンを置くと安心。

#### P2：磨き

10. `apple-touch-icon` 180×180、maskableアイコンの安全域、起動画面（任意）。
11. 初回起動の転送量削減（`docs/`を配信しない、デモ音源を外す選択肢）。
12. 外部リンク・`target=_blank`の扱い（standaloneで戻れなくなる問題）。

### 3.4 「iPhoneに一式コピーして使う」は現実的か

**現実的ではありません。** iPhoneの「ファイル」にHTML一式を置いて開いても、`https`相当のセキュアコンテキストにならず、Service Worker・永続ストレージ・フォルダ取込の前提が崩れます。配布は「**配る人がHTTPSの場所に置き、使う人がURLからホーム画面に追加**」の形になります。

---

## 4. 「apkから土台を持ってくる」の3案

| 案 | 中身 | 得るもの | 失うもの | 作業量 | リスク |
| --- | --- | --- | --- | --- | --- |
| **A. trk-apkを丸ごとコピー** | 1.1.4＋一部1.1.5〜1.1.7＋Capacitor | Android版と同じ画面 | **1.1.8（trk219）の修正**、上流のテスト・CI、最新の音声修正 | 小 | 中〜大（古い土台に固定される） |
| **B. 1.1.8＋モバイルシェル移植（推奨）** | `trk` 1.1.8 に、シェル約370行とHTML小改修だけを載せる | 最新の本体＋スマホ向け画面 | ほぼなし（Android固有の橋渡しは載せない） | 中（1〜2日） | 小〜中（移植漏れ） |
| **C. 1.1.8をそのままPWA配信** | 画面シェルなし | 今日すぐ試せる。差分ゼロ | 下部ナビ・取込の折りたたみ・大きいタップ領域 | 極小 | 小（iPhoneで使いにくい可能性） |
| **D. シェルを上流`trk`へ還元** | Web版自体にモバイルUIを入れる | リポジトリを増やさない。全員が恩恵 | 実験の自由度は下がる | 中＋レビュー | 中（上流の判断待ち） |

**推奨は B、その前段として C（今日の実機確認）。**
Dは「PWA専用リポジトリを保守したくない」場合の本命で、Bで固めてから還元する順序が安全です。

### 4.1 リポジトリの持ち方（Bの場合）

上流の更新が速い（1.1.5→1.1.8が数日）ので、**上流の履歴ごと取り込み、マージで追従**する形が有利です。

```
trk-PWA/
  （trk 1.1.8 のファイル一式）
  js/apk-mobile.js          ← 追加（シェル）
  css/apk-mobile.css        ← 追加
  docs/IPHONE.md            ← iOS向けの注意
  .github/workflows/pages.yml ← trk から流用
```

- 初期化：`git remote add upstream https://github.com/.../trk.git` → `git fetch upstream` → `git merge --allow-unrelated-histories upstream/main`。
- 以後：上流のリリースごとに `git merge upstream/main`。衝突はシェルが触った`index.html`だけに閉じ込める。
- 代替：スナップショットをコピーして`UPSTREAM.md`に同期手順を書く（簡単だが、追従は手作業）。

**やらない方がよいこと**：`trk-apk`の`android/`・`capacitor.config.ts`・`apk-native.js`等をPWAに持ち込むこと。iOS PWAでは動かず、テストと文言の保守だけ増えます。

---

## 5. おすすめロードマップ

### Phase 0：今日（30分・0円）

既存の `https://tonbokiriraikirimuramasa-taikoubou.github.io/trk/` をiPhoneのSafariで開き、ホーム画面に追加して触る。**新しいコードは書きません。**

チェック（詳細は§6）：インストール → 起動 → 曲を1つ取込 → 再生 → ゲーム1つ → 保存固定 → 機内モード → 再起動。

**判断すること**：画面シェル（下部ナビ）が無いと辛いか。辛いならB、許容ならCのまま磨く。

### Phase 1：配布の器を作る（半日）

1. `trk-PWA` に 1.1.8 を取り込む（履歴ごと）。
2. `pages.yml` を流用し、HTTPSの試験URLを出す。
3. `npm run check` が通ることを確認。
4. iPhoneでPhase 0と同じ確認。

**完了条件**：`trk-PWA` のURLがHTTPSで開き、ホーム画面に追加でき、オフラインで再起動できる。

### Phase 2：モバイルシェル移植（1〜2日）

- `js/apk-mobile.js` / `css/apk-mobile.css` / `js/apk-settings-panels.js` を移植。
- `index.html`：CSSリンク、`body.apk-shell`、取込の折りたたみ、スクリプト順。
- Android固有の3ファイルは**載せない**（将来Capacitor iOSを作るなら別ブランチ）。
- テスト：既存の`apk-*`テストのうち、画面遷移・シェルに関するものを移植。`check-repo`の期待値を更新。

**完了条件**：下部ナビの5画面、取込の折りたたみ、設定パネルがiPhoneで動く。Android固有の文言・ボタンが出ない。

### Phase 3：iOSの詰め（1〜3日）

P0（manifest・インストール案内・保存説明・取込・precache）→ P1（audioSession・向き・共有非対応・更新）。

**完了条件**：§6のチェックリストが「合格／既知の制限」で埋まる。未確認を推測で埋めない。

### Phase 4：配布の判断

- 独自ドメインを取るか（**ホスト＝データの住所**。パス変更では分離できず、ホストを後から変えると利用者データは移行されない）。
- 代替マーケット・TestFlightに進むか（費用・GPL・Macの有無）。
- バックアップ導線（書き出し／読み戻し）を配布前の必須にするか。

---

## 6. iPhone実機チェックリスト（Phase 0でそのまま使う）

> 記録は「端末・iOSバージョン・URL・日時」とセットで。**できなかった理由**も書く。

| # | 項目 | 見ること | 結果 |
| --- | --- | --- | --- |
| 1 | インストール | Safari共有 → ホーム画面に追加。「Webアプリとして開く」が既定でオン | |
| 2 | 起動 | アドレスバーなし。縦／横の両方で崩れない | |
| 3 | セーフエリア | ノッチ・ホームバーに文字やボタンが隠れない | |
| 4 | 取込（単体） | 「ファイル」から曲を1つ。動画も1つ | |
| 5 | 取込（フォルダ） | ミュージックフォルダを選べるか。選べない場合の案内 | |
| 6 | 再生 | タップ後に音が出る。シーク・音量・エフェクト | |
| 7 | 音の経路 | 内蔵スピーカー／有線／Bluetooth、サイレントスイッチ、画面ロック | |
| 8 | ゲーム | 5モードのうち1つ。判定・オフセット・タッチキー | |
| 9 | 保存 | 設定の「保存を固定する」の結果表示 | |
| 10 | 再起動 | アプリを終了→再起動。曲・設定・記録が残る | |
| 11 | オフライン | 機内モードで再起動。主要画面が開くか | |
| 12 | 書斎・3D | CBZ、MMD/VRM（重い処理）で落ちないか | |
| 13 | バックアップ | 書き出し→復元。大きいデータで失敗しないか | |
| 14 | 領域の分離 | Safariタブで開いた場合と、ホーム画面アプリでデータが別なこと | |
| 15 | 更新 | 配信側を更新→アプリ再起動で反映されるか | |
| 16 | 共有シート | 写真／ファイルの共有にtrk!が出ない（iOSの仕様） | |
| 17 | 画面ロック | 音楽が続く／止まる。止まる場合の再開操作 | |
| 18 | 発熱・電池 | 10分ゲーム＋3Dで極端に熱くならないか | |

補助として `tools/ios-probe.html` を用意しました。Pages公開後に開くと、その端末の対応状況（standalone判定・保存容量・persist・webkitdirectory・audioSession・セーフエリア等）を1画面で確認できます。

---

## 7. 未決の論点（次に決めたいこと）

1. **誰に配るか**：自分／身内／不特定多数。不特定多数なら、ドメイン・説明ページ・バックアップ導線・問い合わせ先まで要る。
2. **ホーム画面前提でよいか**：Safariのタブ運用だと7日で保存が消え得る。「ホーム画面から開いて」をどこまで強制するか。
3. **フォルダ一括取込は必須か**：iOS 18.4未満も切り捨てないなら、曲を1つずつ選ぶ導線を丁寧に。
4. **背景再生・ロック画面操作は必須か**：PWAでできる範囲と、できない範囲を実測してからネイティブを判断。
5. **ドメインを取るか**：`*.github.io` のプロジェクトサイトは同一オリジンで、保存領域とキャッシュを共有する。試験用と本番用を分けるならホストを分ける必要があり、後から変えるとデータは移行されない。最初に決めた方が安い。
6. **Macはあるか**：ネイティブ／TestFlightを検討する場合の前提。ないならPWA一択に近い。

---

## 8. 参考（一次情報・確認先）

- Apple Developer「Changes to iOS in Japan」（iOS 26.2以降の代替マーケット／公証）: https://developer.apple.com/news/?id=074b3wzz
- Apple Developer Program 年会費免除（米国拠点の非営利等）: https://developer.apple.com/help/account/membership/fee-waivers/
- WebKit / iOS 26のホーム画面Webアプリ（既定でstandalone）に関する解説:
  - https://webkit.org/blog/ （iOS 26リリースノート）
  - https://synthetixis.com/writing/pwa-ios-2026
- iOSでのmanifest対応（`fullscreen`・`orientation`・`share_target`非対応）: https://developer.mozilla.org/en-US/docs/Web/Manifest
- `webkitdirectory` のiOS対応（18.4でフル対応）: https://caniuse.com/input-file-directory
- File System Access API（SafariはOPFSのみ）: https://developer.chrome.com/articles/file-system-access/
- Safariのストレージ（7日削除とホーム画面アプリの除外）: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- `navigator.audioSession` とWeb Audioの背景再生（WebKit実装の解説）: https://github.com/WebKit/WebKit
- App StoreとGPLの衝突（VLCの事例）: https://www.zdnet.com/article/no-gpl-apps-for-apples-app-store/

> 注：Web上の解説は更新されます。実装前にApple/WebKitの一次情報と、手元のiPhone実機で確認してください。

---

## 9. このメモの限界

- 実装・実機確認はしていません。すべて「コードを読んだ結果」と「公開情報」です。
- APK本体のハッシュ照合、APKのインストール、iPhone実機での挙動は未確認です。
- iOSのバージョンによって挙動が変わります（特に26系）。チェックリストの結果で上書きしてください。

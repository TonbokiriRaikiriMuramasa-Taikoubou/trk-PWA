<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Android / APK の準備

trk! はまずWeb版・PWA版を正本にし、その同じ静的Web資産をCapacitorのAndroid WebViewへコピーする構成にしています。Androidプロジェクトそのものはまだ生成・配布していません。

## 方針

- Web版の `index.html`、`css/`、`js/`、`assets/`、アイコン、`manifest.webmanifest`、`sw.js` をそのまま使います。
- `tools/prepare-mobile-web.mjs` が `mobile-web/`（Git管理外）へアプリ用の静的ファイルをコピーします。
- `capacitor.config.ts` は `mobile-web/` を `webDir` に指定します。Android側からWebサーバーへ接続する構成ではありません。
- `package.json` の devDependency `typescript` は、この `capacitor.config.ts` を Capacitor CLI が読むために必要です（入っていないと `cap` は「TypeScript が見つからない」で止まります。2026-10-08 に `npx cap config` で確認）。TypeScript 7 はコンパイラ API を外しているため、CLI は Node 22.6 以降の型除去機能で読みます。`typescript` は削除しないでください。
- `privacy.html`、`credits.html`、`NOTICE.md`、`docs/` も同じアプリ資産に含め、権利とプライバシーをアプリ内から確認できるようにします。
- いまのAPK準備だけでは、Android WebViewでFile System Access APIがデスクトップChromeと同じように使えるとは限りません。音楽ライブラリへのネイティブアクセスは、別途CapacitorプラグインまたはAndroidブリッジを設計します。
- アプリ版で追加のネイティブ権限を導入する前に、`privacy.html`、ストア説明、アプリ内の案内を更新します。

## 必要な環境

- Node.js 22以上（Capacitor CLI 8の要件）
- npm
- Android Studio、Android SDK、エミュレーターまたはUSBデバッグ可能なAndroid端末
- Java / Gradleは、使用するAndroid StudioとCapacitorの案内に合わせる

## 初回セットアップ

リポジトリのルートで実行します。

```sh
npm install
npm run prepare:mobile
npm run cap:add:android
npm run cap:open:android
```

`cap:add:android` はAndroidプロジェクトを初めて作るときだけ実行します。生成された `android/` は、チームでAPKを管理する段階ではGitに追加してください。Android Studioで署名鍵・アプリ表示名・アイコン・バージョンコードを確認してから配布します。

## 更新して実行する

Web側を変更した後は、次のコマンドで同じWeb資産をAndroid側へ同期します。

```sh
npm run cap:sync
npm run cap:run:android
```

APKをビルドする場合は、Android Studioで署名設定を確認したうえで次を使えます。

```sh
npm run cap:build:android
```

これは署名済みの一般公開APKを自動で作る手順ではありません。Google PlayやGitHub Releasesへ出す前に、権限、署名、アプリ名、プライバシーポリシーのURL、端末での音声・ファイル選択を確認してください。

## 現時点の制限

1. Android WebView内では、PWAのService Worker、File System Access API、IndexedDB、Web Audio、CDN読込の挙動がブラウザ版と異なる場合があります。
2. `📤 ミュージックフォルダを共有` は、Android Chromeで動く場合でも、Capacitor WebViewで同じ動作になるとは限りません。
3. Androidの共有ストレージや音楽ライブラリを読む機能は、まだ実装していません。`READ_MEDIA_AUDIO` を追加する場合は、必要性と対象SDKの要件を再確認し、権限なしでも遊べるフォールバックを残します。
4. 現在のMMD／VRM機能の3D部品（three.js、three-vrm、three-mmd-loader）は `assets/vendor/` に同梱しており、CDNへは接続しません。ただし、利用者が用意するモデル・モーションの読込元は利用者の判断に従うため、完全オフラインのAPK機能としては扱いません。
5. APKの実機確認は未完了です。起動、横画面、音声、タッチ鍵盤、曲の選択、保存、戻る操作、画面回転、スリープ復帰を確認するまで完了扱いにしません。

## リリース前チェック

- [ ] `privacy.html` をアプリから開ける
- [ ] Android端末で初回起動・再起動・横画面固定を確認
- [ ] Web Audioの音量、Bluetooth出力、バックグラウンド移行時の挙動を確認
- [ ] 曲の選択・譜面生成・端末保存・削除を確認
- [ ] File System Access APIがない場合の案内を確認
- [ ] MMD／VRMを使わない場合にCDN通信なしで遊べることを確認
- [ ] アプリID、アイコン、バージョン、署名、プライバシーポリシーURLを確認
- [ ] 公開APKのハッシュと配布場所を記録

> 📱 PWA配布版です。→ [PWA配布メモ](docs/PWA.md)

# trk! — AGRG

> **trk! is AGRG!** — an **A**ll-**G**eneration **R**hythm **G**ame
> 手持ちの曲ひとつで、叩いても、走っても、回っても、舞台に立っても、荷物を運んでもOK🚚

[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3+-blue.svg)](LICENSE)
[![Play](https://img.shields.io/badge/▶_Play-GitHub_Pages-ff3b55.svg)](https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/)
[![X](https://img.shields.io/badge/X-@ttrk143-000000.svg)](https://x.com/ttrk143)

trk!（トラック）は、ブラウザだけで動く**非営利のリズムゲーム**です。
手持ちの音楽や動画（MP3・MP4など）を読み込むと、**譜面を自動で作って**すぐに遊べます。
インストールもアカウント登録もいりません。曲やデータは**どこにもアップロードされません**。
エフェクトを付けて聴く**音楽プレイヤー**としても使えます。

▶ **遊ぶ：** https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/

> ⚠ 開発中です。不具合を見つけたら [Issues](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues) か X [@ttrk143](https://x.com/ttrk143) に教えてください。

---

## 🚀 3ステップで遊ぶ

1. 上の **▶ 遊ぶ** のリンクを開きます。
2. 「**📤 ミュージックフォルダを共有**」を押します（端末に**1回だけ**許可を求めます）。曲が一気に取り込まれます。
3. 曲とプレイ方法・難易度を選んで、**▶ PLAY**！

> 🧭 初めてなら、画面上部の **チュートリアル** から（手順は8つ。「チュートリアルを開始」で開き、「スキップ」で閉じます）。ゲームをせずに使う方法は [docs/guide/start.md](docs/guide/start.md) にあります。

## 🧰 ひとつの箱で、いろいろ遊べます

初めて開くと **「trk!にようこそ！」** が出ます（一度だけ）。主な機能は次のとおりです。

- 🎵 **音ゲー**：手持ちの曲から譜面を自動で作って遊べます
- 🎧 **再生プレイヤー**：エフェクトやプレイリストで聴けます
- 🎬 **動画**：MP4などの動画をそのまま見られます
- 📚 **書斎**：画像の本やテキストを読めます
- 🔒 **インターネットに繋がなくても遊べます**。曲や記録は端末の外へ送られません

まだ見つかっていない仕掛けも、いくつかあります。

### 🎵 カタログと曲名の照合

**曲名の表記ゆれは自動で照合します。カタログの曲名は公式タイトルを基準に、出典で確認した別表記にも対応します。** すべての名前に対応するものではなく、言語・Short・Instrumentalなどの版違いは区別します。元ファイルや表示名を自動で書き換えることはありません。一致しない場合は、曲プロフィールの「カタログ照合メモ」で補えます。詳しくは[曲名の照合方針](docs/TITLE-MATCH.md)へ。

### 自分のPCで動かす
ビルドは不要です。ただし、フォルダの記憶・VRM・公認パックの確認には **http(s) で開く**必要があるので、簡単なサーバーを使ってください。

```bash
git clone https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk.git
cd trk
python -m http.server 8000
# → http://localhost:8000 を開く
```

配布ZIPは `index.html`・`README.txt`・`trk-files/` の3つだけの形で作ります（OS共通の1本）。`npm run release`（手順は [docs/HANDOFF.md](docs/HANDOFF.md) の §9）。

### 📦 同梱曲と保存場所（プレイヤーだけ使いたい人へ）

ダウンロードにはオリジナル曲が付いてきます。場所は次のとおりです。

- **楽曲ファイル**：`assets/optional-demo-audio/`（FIRST SPARKデモ約704 KiB）だけです。起動時は小さな `manifest.json` だけ読み、音源は選んだときにだけ読み込みます。
- **プレイリスト**：アプリ内の「🐔 trk's playlist」→「🎓 trk's OST Vol.1」に自動で並びます（ブラウザの localStorage に保存）。
- **スコア**：全曲の作曲データ（JSON＋ABC譜）が `tools/ost-scores/` にあります。

プレイヤーとしてだけ使いたい場合は、上のフォルダーを**削除してOK**です（約704 KiBの軽量化。ゲーム・プレイヤー・自分の曲の再生には影響しません）。曲なしのプレイリストが残ったら、中クリック／長押しメニューで消せます（一度消したリストは作り直しません）。

### 🎵 trk's OST Vol.1 は music-library で配布しています

trk! 本体を軽く保つため、オリジナル曲集「trk's OST Vol.1」は別のリポジトリ [music-library](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library) に移しました。チュートリアル曲「FIRST SPARK」は、これまでどおり trk! に入っています。

1. music-library の [Releases](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library/releases) から `trk-ost-vol1.stpack` をダウンロードします。
2. trk! で **設定 → 📦 カスタムパック → 📂 パックを選ぶ** を開き、そのファイルを選びます（画面へのドロップ、Android の共有メニューからでも入ります）。
3. 曲リストと「🎓 trk's OST Vol.1」プレイリストに OST の曲が並びます。譜面は端末の中で自動生成されます。

- 曲はこの端末のブラウザに保存され、trk! がどこかへ送信することはありません。trk! が music-library へ自動で接続することもありません。
- 「📦 まるごとバックアップ」にパックを含めれば、端末を替えても持ち運べます。要らなくなったら、📦 カスタムパックの一覧から削除できます。
- 音源は © 2026 TRMTKB、**CC BY 4.0** です。クレジットを表示すれば、配信や動画のBGM・改変・再配布・商用利用ができます（例：`"SUNRISE DASH" by TRMTKB (trk's OST Vol.1), CC BY 4.0`）。trk! 本体の GPL-3.0 はアプリのコードの許諾で、曲の利用条件ではありません。
- 第三者の録音・サンプル・引用メロディは使っていません。music-library には他の人の曲を置きません。

---

---

## 🎮 5つのプレイ方法

| モード | 一言 |
|---|---|
| 🥁 **MANUAL** | 流れてくるドン（赤）とカッ（青）を叩く、いちばん基本のモード |
| 🚚 **TRUCK** | トラックでレーンを移動。全世代向けのやさしいモード |
| 🪐 **ORBIT** | どのキーでもOKのワンボタン。うねる道が中央の判定点へ流れ込む |
| 🎪 **STAGE** | 縦レーン（4／5／6）。階段・トリル・ワイドノーツ |
| 🚛 **CATCH** | 落ちてくる荷物を荷台で受け止める。ニトロ缶 🚀 で「ぶっ飛ばしモード」 |

譜面は曲から**自動で作られます**（Seed を変えると譜面も変わります）。AUTO・📻 ラジオ・練習機能・書斎（画像と文章のビューア）などは、[ガイド](docs/guide/index.md)にまとめています。

---

## 📚 くわしい説明・関連資料

- [📚 ガイド目次](docs/guide/index.md)：操作・見た目・サウンド・書斎・パック・スマホ・動作環境・セキュリティ・MOD・ファイル構成・クレジット
- [パック形式](docs/pack-format.md)（`.stpack`）・[公認パックの確認](docs/verified.md)
- [MOD（アドオン）の作り方](docs/ADDONS.md)
- [セキュリティ](docs/SECURITY.md)（[突き合わせ表](docs/SECURITY-CHECKLIST.md)）・[品質の確認](docs/QUALITY-CHECKS.md)
- [プライバシー方針](privacy.html)・[クレジット](credits.html)・[ファイル構成](docs/guide/files.md)

---

## 💬 感想・要望・不具合の報告

- 感想：X [@ttrk143](https://x.com/ttrk143)（ハッシュタグ **#trkAGRG**）
- 不具合・要望：[GitHub Issues](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues)（[不具合](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues/new?template=bug_report.yml)・[譜面](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues/new?template=chart_feedback.yml)・[要望](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues/new?template=feature_request.yml)のテンプレートあり）

---

## ⚖ ライセンスと権利

- **ソースコード**：GNU GPL v3.0 or later（[LICENSE](LICENSE)）。「trk!」の名前はライセンスの対象外です。派生版は別の名前で公開してください。
- **権利の要点**：初音ミク（PCL・GPLの対象外）、東方のキャラ肌（上海アリス幻樂団）、第三者ライブラリ、利用者が読み込む曲・モデル・パックは、それぞれの権利者のものです。詳細と条件は [NOTICE.md](NOTICE.md) にまとめています。
- **お願い**：権利のない曲を配らないこと、VRM・MMDモデルは作者の利用条件を確かめてから使うこと（[NOTICE.md の §3](NOTICE.md)）。

---

## English

**trk! is AGRG!** — an All-Generation Rhythm Game that runs entirely in your browser.
Load your own music or video and trk! **auto-generates a chart** for it. Nothing is uploaded.

Catalog matching automatically handles supported title variations, using official titles and documented aliases as its reference. Language, Short and Instrumental versions remain distinct; original files and display names are not renamed. Use the song profile’s catalog match note for unsupported names.

▶ **Play:** https://tonbokiriraikirimuramasa-taikoubou.github.io/trk-PWA/

**Run locally:** `python -m http.server 8000`, then open `http://localhost:8000`.

**Release ZIP:** one archive for all desktop OSes; unzipping shows only `index.html`, `README.txt` and `trk-files/`. `npm run release` (§9 of [docs/HANDOFF.md](docs/HANDOFF.md)).

Five play styles (MANUAL, TRUCK, ORBIT, STAGE, CATCH), Study Room, verified packs and lighter builds are described in the **[full English guide](docs/guide/en.md)**.

The bundled song is the FIRST SPARK demo in `assets/optional-demo-audio/` (about 704 KiB); the app reads only a small `manifest.json` at startup and fetches the MP3 when selected. For a player-only lightweight build, delete that folder — the game, the player, and your own songs are unaffected. An empty leftover playlist can be deleted and will not come back.

**trk's OST Vol.1 is distributed from music-library.** To keep trk! small, the original album "trk's OST Vol.1" now lives in [music-library](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library). The tutorial song "FIRST SPARK" is still bundled. Download `trk-ost-vol1.stpack` from its [Releases](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/music-library/releases), then in trk! open **Settings → 📦 Custom packs → 📂 Choose pack** (or drop the file onto the window). The songs also appear in the "🎓 trk's OST Vol.1" playlist. Songs are stored only on your device; trk! never uploads them or connects to music-library by itself. The audio is © 2026 TRMTKB under **CC BY 4.0** — share, adapt and use it (including commercially) with credit. trk!'s GPL-3.0 covers the app's code, not the music.

**Feedback:** [@ttrk143](https://x.com/ttrk143) (hashtag **#trkAGRG**), bugs and ideas on [GitHub Issues](https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk/issues).

**License:** code under **GPL-3.0-or-later**. The name “trk!” is not licensed — please rename forks. See [NOTICE.md](NOTICE.md) for the rights of the characters and third-party material.

This work depicts the character “Hatsune Miku” of Crypton Future Media, INC. under the Piapro Character License.

trk! is an unofficial fan project and is not affiliated with any of the games listed above.

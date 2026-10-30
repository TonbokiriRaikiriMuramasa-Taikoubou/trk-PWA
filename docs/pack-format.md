<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# trk! 曲・見た目パック仕様（`.stpack`）

> trk! is AGRG! — an All-Generation Rhythm Game
> この文書は、`shadow-taiko-pack` 形式の `.stpack` を作る人向けの仕様です。

## 1. まず知っておくこと

- `.stpack` は **ZIP** です。
- ZIPの最上位に、必ず `pack.json` を置きます。
- `pack.json` の `format` は、互換性のため **`shadow-taiko-pack`** のままにします。
- ファイル名は半角英数字、`_`、`-`、`.`、`/`だけで書きます。絶対パスや `..` は使えません。
- パックは、作者が再配布する権利を持つ曲・画像・音声・モデルだけで作ってください。
- 本体は `pack.json` に書かれたファイルだけを読み込みます。未知の項目や未知の難易度は無視されます。

## 2. サイズと個数の上限

| 種類 | 上限 |
|---|---:|
| 1ファイルの `.stpack` 全体 | 500 MiB |
| インストール済みパックの展開後合計 | 1 GiB（ブラウザの保存 quota が小さい場合はそちらが上限） |
| 1パックの曲数 | 50曲 |
| ノーツ画像（PNG / WebP / JPG） | 4 MiB |
| 背景画像 | 8 MiB |
| ドン／カッのヒット音（WAV / MP3 / OGG / M4A） | 5 MiB |
| 曲の音源・動画（MP3 / M4A / OGG / OGA / OPUS / WAV / FLAC / AAC / MP4 / WebM） | 250 MiB |
| 譜面JSON | 2 MiB |
| VRM | 200 MiB |
| VRMAモーション | 30 MiB |

設定の「容量の上限を無視」は、1パック500 MiB・インストール済み合計1 GiBの**保存量上限だけ**を解除します。上の種類ごとのファイル上限と1パック50曲の上限は、安全のため解除しません。ZIPの構造解析にも別の固定上限（1ファイル25万項目・中央目録64 MiB）があり、この設定では解除されません。

アプリは通常、保存済みパックの**展開後ファイル合計を1 GiBまで**に制限します。公認・非公認で上限は変わりません。同じ名前・作者のパックを更新するときは、置き換える前の容量を差し引いて判定します。ブラウザ／端末の IndexedDB quota がそれより小さい場合もあります。容量不足や確認不能は画面に案内し、保存に失敗した更新は既存パックを置き換えません。不要なパックを削除してから再試行してください。

VRMはVRM 1.0を想定しています。MMDモデル（`.pmx` / `.pmd`）や `.vmd` は、このパック形式では扱いません。

## 3. 最小の `pack.json`

見た目だけのパックなら、次の形で読み込めます。

```json
{
  "format": "shadow-taiko-pack",
  "version": 1,
  "name": "My trk skin pack",
  "author": "Your name",
  "description": "A short description",
  "license": "CC BY 4.0",
  "url": "https://example.com/your-pack"
}
```

`name` は必須です。`format` は固定値です。`author` と `description` は画面表示用で、URLを指定する場合は `https://` から始めます。

## 4. `pack.json` の項目

### 共通項目

| 項目 | 型 | 内容 |
|---|---|---|
| `format` | string | 必ず `shadow-taiko-pack` |
| `version` | number | 現在は `1`。読み込み時は1として扱われます |
| `name` | string | パック名、40文字まで。必須 |
| `author` | string | 作者名、40文字まで |
| `description` | string | 説明、200文字まで |
| `license` | string | 曲・素材の利用条件やクレジット、400文字まで |
| `url` | string | `https://` のURL、200文字まで |

### 権利カード（`creditCard`）

`creditCard` は任意の「権利カード／名刺」欄です。パック一覧で折りたたみ表示され、作者名・肩書き・ひとこと・権利メモ・利用条件・配布ページを一つにまとめられます。`contributors` を使うと、役割や権利メモの異なる共同制作者を最大12人まで記載できます。画像を持たないテキスト形式なので、カード自体に別の素材ライセンスは発生しません。

```json
{
  "creditCard": {
    "version": 1,
    "name": "Example P",
    "role": "Composer / charter",
    "tagline": "Original songs and charts for trk!",
    "rights": "Redistribution allowed with credit",
    "license": "CC BY 4.0",
    "handle": "example_p",
    "url": "https://example.com/example_p",
    "contributors": [
      {
        "name": "Example Q",
        "role": "Illustrator",
        "rights": "Artwork may be shared with this pack",
        "license": "CC BY 4.0",
        "handle": "example_q",
        "url": "https://example.com/example_q"
      }
    ]
  }
}
```

| 項目 | 型 | 内容 |
|---|---|---|
| `name` | string | 必須。表示名、60文字まで |
| `role` | string または言語オブジェクト | 肩書き、80文字まで |
| `tagline` | string または言語オブジェクト | ひとこと、160文字まで |
| `rights` | string または言語オブジェクト | 再配布条件など、240文字まで |
| `license` | string | ライセンス名や利用条件、200文字まで |
| `handle` | string | SNS等の表示用ハンドル、80文字まで。自動リンクはしません |
| `url` | string | `https://` の配布ページ、200文字まで |
| `contributors` | array | 共同制作者、最大12件。各要素は `name` 必須で、`role` / `rights` / `license` / `handle` / `url` を持てます |

言語オブジェクトは `{"ja":"日本語", "en":"English"}` のように書きます。表示言語に該当する値がなければ英語、次に日本語などへフォールバックします。`creditCard` は権利の証明そのものではないため、必要な原文ReadMeや正式なライセンス文書はパック内または配布ページに残してください。

### 自動生成ファイル

trk! の書き出し機能は、`pack.json` と `README.txt` に加えて、`creditCard` の内容をまとめた `CREDITS.md` をパックのルートに自動生成します。共同制作者ごとに名前、役割、権利メモ、ライセンス、ハンドル、URLを記載します。これは作者申告の要約であり、原文ライセンスや同梱ReadMeの代わりにはなりません。インポート時は `pack.json` の宣言と実ファイルを正本として扱い、`CREDITS.md` は再エクスポート時にも生成し直されます。

パック一覧で権利カードを開くと、contributors を確認でき、パック名と作者名を含むテキストのみのSVG名刺をダウンロードできます。SVGは外部画像や外部リソースを参照しません。

### 見た目

- `skin`：trk!のスキン定義。設定画面から書き出したスキンJSONを元にできます。
- `notes.don` / `notes.ka`：ノーツの色・形・画像。
- `sounds.don` / `sounds.ka`：ドン／カッのヒット音。
- `fx.power`：ゲーム連動エフェクトの強さ。0〜3。

```json
{
  "format": "shadow-taiko-pack",
  "version": 1,
  "name": "Neon starter",
  "notes": {
    "don": { "color": "#ff3b55", "shape": "circle", "image": "notes/don.png" },
    "ka":  { "color": "#55aaff", "shape": "circle", "image": "notes/ka.png" }
  },
  "sounds": {
    "don": "sounds/don.wav",
    "ka": "sounds/ka.wav"
  },
  "fx": { "power": 1.5 }
}
```

画像の `shape` は、本体がその時点で受け付けるノーツ形状だけが有効です。画像や音声の拡張子と、ZIP内の実ファイル名は一致させてください。

### VRMとモーション

```json
{
  "mascot": {
    "vrm": "mascot/model.vrm",
    "motion": "mascot/motion.vrma",
    "motionBpm": 120,
    "frame": "full",
    "turn": -20,
    "captions": {
      "capStart": { "ja": "よろしく！", "en": "Let's play!" },
      "capCombo": { "ja": "いい調子！" },
      "capBreak": { "ja": "もう一度！" }
    }
  }
}
```

- `motionBpm` は40〜300の範囲です。
- `frame` は `full` / `upper` / `face` のいずれかです。
- `turn` は−60〜＋60度です。
- セリフは `capStart` / `capCombo` / `capBreak` ごとに、言語キー（`ja` / `en` / `zh` / `ko`）を指定できます。各言語60文字までです。
- VRMやモーションの作者の規約を確認し、再配布が許可されている場合だけ入れてください。

## 5. 曲パック

曲は `songs` 配列に入れます。音源が見つからない曲は一覧に出ません。

```json
{
  "format": "shadow-taiko-pack",
  "version": 1,
  "name": "Original songs",
  "author": "Your name",
  "songs": [
    {
      "id": "song01",
      "title": "My Original Song",
      "artist": "Composer",
      "charter": "Charter",
      "license": "CC BY 4.0",
      "audio": "songs/song01/audio.mp3",
      "background": "songs/song01/bg.jpg",
      "bpm": 138,
      "offset": 0,
      "previewStart": 12,
      "charts": {
        "easy": "songs/song01/easy.json",
        "normal": "songs/song01/normal.json",
        "hard": "songs/song01/hard.json",
        "master": "songs/song01/master.json",
        "rush": "songs/song01/rush.json"
      }
    }
  ]
}
```

### 曲項目

| 項目 | 型 | 内容 |
|---|---|---|
| `id` | string | 英数字・`_`・`-`、32文字まで。同じパック内で重複不可 |
| `title` | string | 曲名、80文字まで。空なら音源名から補います |
| `artist` | string | アーティスト名、60文字まで |
| `charter` | string | 譜面作者、40文字まで |
| `license` | string | 曲・譜面・背景の利用条件、400文字まで |
| `audio` | string | 必須。対応する音源または動画のパス |
| `background` | string | 任意。PNG / WebP / JPG |
| `bpm` | number | 60〜300。省略すると自動設定に任せます |
| `offset` | number | −5000〜＋5000ms |
| `previewStart` | number | 0〜36000秒 |
| `charts` | object | `easy` / `normal` / `hard` / `master` / `rush` の譜面パス |

譜面はMANUAL・TRUCK・ORBIT・STAGE・CATCHで共通です。`charts` に書かれたJSONは、通常の `shadow-taiko-chart` 形式で作成してください。曲と譜面の指紋が一致しない単体譜面とは異なり、パック内の譜面はパックの音源と一緒に扱われます。

## 6. ZIPの例

```text
my-pack.stpack
├── pack.json
├── README.txt                 # 任意
├── notes/
│   ├── don.png
│   └── ka.png
├── sounds/
│   ├── don.wav
│   └── ka.wav
└── songs/
    └── song01/
        ├── audio.mp3
        ├── bg.jpg
        ├── easy.json
        └── hard.json
```

## 7. 作成と検証

- trk!の設定画面の「＋ 今の設定からパックを作る」から見た目パックを作れます。
- 選曲画面の「📦 この曲を曲パックにする」から曲パックを作れます。
- `.stpack` を画面へドロップするか、設定画面から読み込めます。
- リポジトリの基本検査は次で実行できます。

```sh
node tools/check-repo.mjs
```

公認パックにしたい場合は、作者・権利・クレジットを確認したうえで [`docs/verified.md`](verified.md) の手順に従ってください。`.stpack`を少しでも作り直すとSHA-256が変わるため、公認登録も更新が必要です。

## 8. 互換性と安全性

`shadow-taiko-pack` は古い名称を含む互換形式です。外部パックのJSONはプログラムとして実行されず、決められた項目だけが検証・取り込みされます。画面表示もテキストとして扱われます。

なお、パックのファイル自体に含まれる曲・画像・音源・VRM・VRMAの権利は作者にあります。配布者が利用許諾を持っていることを確認してください。

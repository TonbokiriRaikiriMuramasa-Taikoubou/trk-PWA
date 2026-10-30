# 🐔 trk's playlist：trk-apk の新基準を trk に取り込むための精査（2026-10-29）

対象：`TonbokiriRaikiriMuramasa-Taikoubou/trk-apk`（確認した基準 **`37405fa`**・`docs/APK-SPEC-2026-10-29.md` の「trk's playlist」の行）
比較元：このリポジトリの `main`（trk216／1.1.5 まで）

---

## 1. 結論（先に）

- **APK の「起動時に一括自動作成せず、設定のカタログから必要なプレイリストを個別追加」は、そのまま取り込む価値がある。** 理由は次の3つ。
  1. 起動のたびに全カタログ（数十本）の `ensureTrkDistributionPlaylists()` が走るので、**起動が重い**（wish の突き合わせ・legacy 移行を毎回やっている）。
  2. 使わないシリーズのリストまでタブとして並ぶので、**棚が増えすぎる**。
  3. 追加のたびに `catalog.js` を触るので、**新しいシリーズを足すときに「作成の条件」を書かなくてよい**（APK のピッカーはカタログを読むだけ）。
- ただし **APK のやり方をそのまま写すと、このリポジトリが持っている「旧データの移行」が起動時に走らなくなる**（後述 §4）。ここは分けて設計する。
- 段階案は §5。まず **Stage 1（ピッカー＋新規作成の停止）** を trk217 として入れ、**Stage 2（♻ の統合・文書）** を trk218 にするのが安全。

---

## 2. APK 側の仕様（確認したこと）

`docs/APK-SPEC-2026-10-29.md` の表：

> | trk's playlist | 起動時に一括自動作成せず、設定のカタログから必要なプレイリストを個別追加。編集済みリストは上書きしない。 | カタログは音源を配布しない。内蔵デモを除き音源は別途必要。 |

コード（`js/library.js` の `apkTrk*` 群・約110行）：

| 部品 | 役割 |
|---|---|
| `apkTrkPickerEntries()` | 特別枠（`🎓 OST Vol.1`・`🐔 Game Vol.1`・`🎻 Classic Vol.1`・`🎼 Agent OST`）＋**カタログの全プレイリスト**を、100曲ごとの Vol に分けて1つの配列に。ID は `("trk-" + playlist.id).slice(0, 24 - suffix) + suffix`（`plSanitize` の24文字制限に収める） |
| `apkTrkPickerHas(entry)` | 追加済みかの判定（`id` 一致、または `cat` が `series:playlist`／`trk:series:playlist`） |
| `apkTrkAddEntry(entry)` | 上限（プレイリスト200本・フォルダ上限）を見てから、**その1本だけ**作る。特別枠は既存の `ensureTrkPlaylist`／`ensureTrkClassicPlaylist`／`ensureTrkOstPlaylist`／`ensureAgentOstPlaylist` を呼ぶ |
| `apkTrkRenderPicker()` | `<select>` に `optgroup`（シリーズごと）で並べ、追加済みは `disabled` ＋「追加済み」 |
| 起動処理 | 自動生成のブロックを削除。**OST は既にあるときだけ**更新（`ensureTrkOstPlaylist`） |
| チェックボックス | `trkPlaylistChk`／`trkClassicChk` は**表示のオン/オフだけ**（作らない） |
| ♻ | 非表示（削除したリストはカタログから個別に戻す） |
| `apkTrkSelectedFoldersOnly` | ピッカーからの追加中は `ensureTrkFolder()` が**サブフォルダ（Blue Archive・LoL・東方…）をまとめて作らない**ためのフラグ |

---

## 3. こちらの現状（trk216 時点）

- `js/library.js` の起動（`loadAll` の終わり・5657行付近）で、
  - `ensureTrkPlaylist()`／`ensureTrkClassicPlaylist()` は `TRK_AUTO_GAME_CLASSIC = false` なので**もともと作らない**。
  - **`ensureTrkOstPlaylist()` と `ensureTrkDistributionPlaylists()` は `tutorialDone` なら毎回走る**（ここが重い）。
- `trkPlaylistChk`（5437行付近）は**オンにすると `ensureTrkPlaylist()` を呼ぶ**（＝設定を触ると勝手に1本増える）。
- `trkRestoreBtn`（♻ 消したリストを戻す）は `syncTrkUI()` が出し入れする。
- `ensureTrkDistributionPlaylists()` は「作る」だけでなく、**旧データの移行**もしている：
  - ブルアカ ミカの旧3本 → 1本への統合（`BA_MIKA_LEGACY_PL`）
  - Lone Trail・So Long Adele などの**古い曲目 → 新しい曲目**への更新
  - `cat` ごとの `wish`／`guide` の更新（ユーザーの曲・名前・凍結は触らない）
- カタログ側は `js/catalog.js`（`trkCatalog()`）と `js/touhou-theme-data.js`。**音源は含まない**（既存方針）。

---

## 4. そのまま写すと壊れるところ

| 問題 | なぜ | 対策案 |
|---|---|---|
| 旧データの移行が走らない | APK は `ensureTrkDistributionPlaylists()` の**呼び出しごと**消している。この関数は「作成」と「移行」が混ざっている | 関数を **`trkRefreshCatalogPlaylists({ create:false })`（既存の更新だけ）** と **`create`（作成）** に分ける。起動時は更新だけ、作成はピッカーから |
| 既存ユーザーのタブが消える | 自動生成を止めると、まだ持っていないユーザーは OST・各シリーズのリストが無くなる | **既にあるリストはそのまま**（消さない）。新規はピッカーから。`trkRemoved` の印も今までどおり尊重 |
| チェックを入れただけで増える | 今の `trkChk` は `ensureTrkPlaylist()` を呼ぶ | APK と同じく**表示のオン/オフだけ**に。増やしたい人はピッカーから（`trkOpenBtn` は残す） |
| ♻ が消えると戻す道が分からない | APK はボタンを隠してカタログに統合 | ピッカーの「追加済み」を外す／`trkRemoved` の印を外す導線をピッカーに用意する（Stage 2） |
| フォルダが増えすぎる | `ensureTrkFolder()` は9つのサブフォルダも作る | APK と同じ `trkSelectedFoldersOnly` フラグ（ピッカーからの追加中は作らない） |

---

## 5. 実施したこと（trk217・2026-10-29）

- **起動時は作らない**：`ensureTrkDistributionPlaylists({ create: false })`。既にあるリストの曲目・ガイド・旧データの移行だけ行う。
  `🎓 trk's OST Vol.1` も**あるときだけ**更新する（新規ユーザーには作らない）。
- **設定の 🐔 に「プレイリストを選択」**（`#trkPickSelect`／`#trkPickAdd`）：`trk オリジナル`＋カタログ全リストを `optgroup` で並べ、
  追加済みは選べない。100曲ごとの Vol 分割・24文字の ID は APK と同じ規則。
- **棚は要るものだけ**：`TRK_SHELVES`（9つの棚）を一覧にし、`ensureTrkFolder()` はふだん全部を作るが、
  追加中（`trkSelectedFoldersOnly`）は 🐔 だけ。追加するリストの棚（Endfield のキャラクターテーマは親の棚から）だけを作る。
- **消したリストはピッカーから戻す**：`trkPickAdd` が `trkUnmarkRemoved` してから作る。♻ ボタンは出さない（`restore.hidden = true`）。
- **表示チェックは表示だけ**（リストを作らない）。
- **文言は4言語**、`sw.js` の cache は `trk-v2026.10.29-trk217`、`tests/trk217-playlist-catalog.test.mjs`（11件）。
- **入れなかったもの**：APK 専用（音声安全・PiP・バックグラウンド・下部ナビ・Back の段階処理）は対象外。
  APK が `folder: TRK_FOLDER_ID`（🐔 直下）に置くのに対し、こちらは**シリーズの棚**へ置く（このリポジトリの階層を保つ）。

## 6. テスト（trk217）

`tests/trk217-playlist-catalog.test.mjs`（11件）

- 候補：`trk オリジナル`4本＋カタログの94本（`touhou:th-pc98`／`touhou:th-zun-cds` は曲が無いので出さない）。ID は24文字以内・重複なし・シリーズ名がある。
- 100曲超は `-v1`／`-v2` に分かれ、接尾辞は削られない。
- 追加済み判定：ID／`series:playlist`／`trk:series:playlist` の3通り。
- 追加：1本だけ増える・棚は要るものだけ（`trk`＋`trk-lol`）・🎭 は親の棚から・上限（200本／棚）で作らない・
  `trk` オリジナルは表示フラグを一時的に立て、失敗したら戻す。
- 配線：起動は `create:false`・チェックは表示だけ・♻ を出さない・HTML と4言語のキー。

## 7. 残り（次の候補）

1. 実ブラウザでの操作感（サンドボックスにブラウザーが無い）。
2. APK の「追加済みを解除」に相当する**ピッカーからの削除導線**は、いまは 🗑（プレイリストの削除）で代用。必要なら次版でピッカーに「外す」を足す。
3. 旧データ（自動で作られた数十本）を**まとめて片付ける**導線は入れていない（消したものは戻せる）。

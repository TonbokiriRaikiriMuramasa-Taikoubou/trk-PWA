# trk! 開発引き継ぎ

> **最終更新：2026-10-29（trk217・**1.1.6**＝🐔 trk's playlist を trk-apk の新基準に揃えた版。🐔 trk's playlist を **trk-apk の新基準**に揃えた＝起動時にカタログを一括で作らず、設定の「プレイリストを選択」から**選んだリストだけ**を追加する（`create:false` の起動・100曲ごとの Vol 分割・24文字の ID・消したリストもここから戻す・♻ は出さない）。trk216・**1.1.5**＝🎼 譜面生成方式の既定を **Bタイプ（方式4）** に（触った感触で B が良い、という利用者の判断。**設定で選んだ人＝`chartGenChosen` はそのまま**・アップデート後に B へ移るのは選んだ印が無い人だけ）。trk215・⭐ お気に入りの4フォルダ（⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入り）を全部使えるようにした：2軍〜元お気に入り・ピン・🧊凍結・選んでいたフォルダを `settings.favs` に保存（1.1.4 までは保存していなかったので、0個の2軍を選ぶとタブごと消え、リロードで戻っていた）、⭐タブはどのフォルダかに入っていれば出し、凍結の解除は 🧊／🔒 の3秒長押し（❓謎設定「フリーズの解除をワンタップにする」＝**既定オフ**で1タップ）。2026-10-27（trk214・**1.1.4**＝1.1.3 レビュー反映：🖥 ドラッグ中はポインターを掴んで外へ出てもずらす・ピンチのあと残った1本指でそのまま動かす・配布物のリンク切れ検査。trk212・trk213・**1.1.3**：🖥 全画面の動画をホイール／ドラッグ／ピンチで拡大・縮小（100〜500%・ポインター中心・1回 2/5/10%）、⏱ 曲名タブの「ここをプレビュー開始位置にする」を設定で出す（**初期オフ**）。**1.1.3 は trk213 を配る版**。1.1.0→1.1.1→1.1.2 のレビュー反映もそれぞれのZIPに同梱済み。1.0.9〜1.1.2 の配布ZIPの形と時刻もここに集約）**。現在の仕様・守る条件・未確認事項の要約です。過去の詳細な変更履歴・検証記録は [`HANDOFF-ARCHIVE.md`](HANDOFF-ARCHIVE.md)、利用者向け仕様は [`README.md`](../README.md) と [`guide/`](guide/)、権利表記は [`NOTICE.md`](../NOTICE.md)、品質・安全確認は [`QUALITY-CHECKS.md`](QUALITY-CHECKS.md) と [`SECURITY.md`](SECURITY.md) を参照してください。
>
> **本書の読み方**：§2＝今の仕様、§3＝壊してはいけない条件、§4＝実機で確認していないこと（ここが最重要）、§5＝ファイルの場所、§6＝自動検査で確かめたこと、§7＝最近の変更、§8＝変更時の点検、§9＝配布ZIPの形と作り方（1.0.8〜・現在 1.1.4）。

## 1. 作業の基本

- 作業前に `git status --short` と差分を見て、既存の変更を破棄・上書きしない。
- Arenaで指定された作業ブランチを維持し、`main` へ直接 push しない。反映はPR経由。
- バンドラーはありません。`index.html` の `<script>` 順が依存関係と実行順を決めます。
- 変更後は `npm run check` と `git diff --check` を実行。静的・VM・スモーク検査の成功を、実音声・実機での確認済みとは扱いません。
- 公開JSを変更したら関連テスト・文書・`sw.js` のcache名更新要否を確認します。vendor pinの正は `tools/vendor-lock.json` です。
- `js/fx.js`／`js/fx-presets.js` の凍結は **trk114で解除**しました（2026-10-11、空さんの判断。trk109でfx.jsに足したMIDI MIXの経路も追認）。ほかのファイルと同じく、変更時はテスト・文書・実音声で確認します。fx.jsが読むための互換名（`chartMeta`・`phase`・`prefs`・`stats`・`videoReady`、読み取り専用の `_trkStudyRoomOpen`）はまだ残っていて、fx.jsを書き換えれば外せます（`docs/ADDONS.md` §0、`docs/NAMESPACE-PLAN.md`）。

## 2. 現在の実装状態

### 1.0.9 の仕様（trk200〜trk206・配布済み）

**1.0.9 は「配布名と文書の版」**：アプリ本体は trk206 のまま（1.0.8 の配布ZIPと同一のコード）。`sw.js` の cache を `trk-v2026.10.27-trk207` に上げ、配布ZIP・README・`release/README.txt`・`release-manifest.json` の版を 1.0.9 にそろえた（§7・§9）。

- **🔊 音が出ない理由を先に言う（trk200）**：`.mkv` の AC3・E-AC3・DTS・TrueHD などは映像が出ても音が鳴らない。`js/media.js` の `probeMatroska` が `audioCodecs`／`videoCodecs` を返し、`AUDIO_CODEC_OK`（AAC・Opus・Vorbis・MP3・FLAC・PCM）に1つも入っていないときだけ `explainAudioWarning` が `loadAudioUnsupported` を作る。`loadMedia` が `core.mediaLoadWarning` に残し、プレーヤーの状態行（**停止中だけ**）とトーストで案内する。再生中に「読み込めません」とは言わない。
- **🗂 フォルダー曲の📄参照は保存しない（trk201）**：`rememberSongRef` は `source==="folder"` を書かない（起動のたびに最大3000件を保存していた）。フォルダーは選び直せば戻るので参照は持たない。**追加した曲・動画の参照は従来どおり**。旧版が残したフォルダー参照は `pruneFolderRefsOnce(force)` が**一度だけ**消す（`trkFolderRefsPrune1`・`docs/MIGRATIONS.md` に削除予定日）。
- **🛟 セーフモードはURLのあいだだけ（trk202）／保存されるもの・されないもの（trk205）**：`saveUserPrefs()` は `prefsForSave()` を保存し、セーフモード中は `SAFE_SESSION_KEYS`（`previewEnabled`・`mediaStartFromZero`・`folderAutoRead`・`libKeepShared`）だけ**倒す前の値に戻したコピー**を書く（`settings` 自体は汚さない＝その場の安全動作は保つ）。自動リロード・緊急パネル・`trkReset("safe")` は `reloadInSafeMode()`（`?safe=1` を付け直す）を通る。**映像スタイル・TVのお気に入り・演出の強さ・TVスキンなどは安全側の値のまま保存される**（壊れた見た目の設定から立ち直るのがセーフモードの役目なので、これは意図どおり）。案内文（`safeModeNotice`・4言語）と緊急パネルの文面もこの区別どおりに書く（trk205）。
- **🎬 ドロップした動画も 🎬 と同じ道（trk203）**：`js/main.js` のウィンドウ全体の `drop` が `VIDEO_EXT`／`video/` MIME で振り分け、`addVideoFiles(vids, { openViewer:false })` で**全画面ビューアを勝手に開かない**。JSON（譜面）のドロップとタイトル画面以外のガードは従来どおり。
- **🚪 メディアプレイヤーを抜けても曲はそのまま（trk206）**：`closeMedia()` の抜け方を純粋関数 `mediaExitPlan()` が決める。**既定は `keep`＝止めない・読み込み直さない**（メディアプレイヤーへ入るときと同じで曲が途切れず、曲リストでエフェクトや設定を触っても音が消えない）。流し続けるときは位置を動かさず、`library.js` の `previewContinue()` が音量だけプレビュー相当（`musicVolume × 0.8`）へ600msで戻す。ゲーム開始などで閉じる（`closeMedia(false)`）ときと、プレビューがオフのときは従来どおり止める。**❓謎設定「🚪 メディアプレイヤーを抜けた時に曲を再読込する」**（`core.settings.mediaReloadOnExit`・**既定オフ**）をオンにすると昔の動き＝いったん止めてプレビューの開始位置から鳴らし直す（不具合の再現用）。
- **📦 配布ZIPの形（trk204）**：`index.html`＋`README.txt`＋`trk-files/` の3つだけ、**OS共通の1本**。ルートの `index.html` は入口。詳しくは §9。

### 📂 フォルダー共有の仕様（trk208〜trk211・1.1.2 で配布）

**📂 フォルダー共有の拡張（trk208）**：trk194 の「📤 ミュージックフォルダを共有」を、**何本でも・動画も・書斎の画像も**に広げた。共通部品は新しい `js/shared-folders.js`（`window.TrkSharedFolders`＝純関数とフォルダーの歩き方だけ。DOM も IndexedDB も触らない）。
- **📤 曲リストは登録簿で覚える**：`shadow_taiko_library` の `kv` キー **`"folders"`** に `[{id,name,kind:"music"|"video",handle,addedAt,label}]` を保存（従来の `"share"` 1本は起動時にここへ移す＝**後方互換**。`"share"` は消さない）。`libKV` キー `"dir"`（📁 開く）はそのまま。
  - **🎬 動画フォルダ**：`#libShareVideoBtn` → `showDirectoryPicker({id:"trk-video-share", startIn:"videos"})`。音楽は `startIn:"music"`。どちらも `scanHandle`（`MEDIA_EXT`＋`.shadow-taiko.json`／`.lrc`／`.srt`／`.vtt`）で拾い、`TrkSharedFolders.mergeScans` で1本の曲リストにまとめる（同名フォルダーは `Music (2)` に）。
  - **一覧と ×**：`#libSharedFolderList` にフォルダーごとの曲数と ×（`removeSharedFolder(id)`）。上限 `FOLDER_KIND_MAX=8` 本。🚫 共有をやめる＝`"folders"` も削除。
  - **起動時**：`restoreFolderAccess()` は登録簿があれば `restoreSharedFolders()` へ（許可が生きていれば `scan`／要確認なら `ask`）。最初のタップは **`folderAutoKickShared()`** が**1本ずつ**確認する（まとめて確認を出さない。残りは再び待ち合わせ）。
- **📚 書斎は「フォルダーのまま読む本」**：`#studyShareFolderBtn` → `showDirectoryPicker({id:"trk-study-folder", startIn:"pictures"})`。**コピーしない**ので、何千枚のフォルダーでも端末の容量を食わない。
  - 走査は名前だけ（`TrkSharedFolders.walk({read:false})`・`MAX_IMAGES=5000` 枚）→ `STUDY_UTIL.folderBookGroups(entries, albumNesting)` で本に分ける（`split`＝1フォルダ1冊＋サブフォルダは別／`flat`＝まとめて1冊）。
  - 本は `{ kind:"image", linked:true, sharedFolder:"<フォルダー名>", pages:[{key:"link:<id>:<i>",name,path,size,type}] }`。**`pages` ストアには何も入れない**（`page.path` はフォルダー内のフルパス）。id は `stableId("link", "<フォルダー名>:<sourcePath>")`＝端末が変わっても同じ本。
  - ハンドルは `shadow_taiko_library` の `kv` キー **`"studyFolders"`**（`[{id,name,handle,addedAt}]`）。**書斎のDBには入れない**（バックアップに構造化複製できない値を持ち込まないため）。
  - 読むとき：`studyLoadPageImage` が `studySharedPageBlob()` → `TrkSharedFolders.readFileAt(handle, path)`（ルート名は外す・`..` は捨てる）。許可が切れていたら `studyOpenBook` の中（クリック）で1回だけ確認。ジャケットも `covers` に `linked/sharedFolder/path` を足して同じ経路で読む。
  - `studyBookClean` は `linked`／`sharedFolder` を保持。一覧の印は `studyLinkedBadge`（📂 …（フォルダのまま））。`STUDY_UTIL.bookSize` は linked を **0** と数える（端末に実体が無い）。
  - バックアップ：`DB_LIBRARY.skip.kv` に `"folders"`・`"studyFolders"` を追加（ハンドルは端末ごとの値）。`checkStudyLimits` は **`linked !== true` の本だけ**数える（実体が無いページで上限に引っかからないように）。

**1.1.2 は「trk211 を配るための版」**：アプリ本体は **trk211**（1.1.1 の配布ZIPの `trk-files/` を土台に、trk211 で変えた**2ファイル**＝`js/library.js`・`sw.js` だけを差し替え）。配布ZIP・`README-1.1.2.md`・`release/README.txt`・`release-manifest.json` の版を 1.1.2 にそろえ、ZIP を **`2026-10-27 20:00`（UTC）** で組んだ（1.1.1 の `19:00` より新しい。§6・§7・§9）。`sw.js` の cache は **`trk-v2026.10.27-trk211`**。

**1.1.0・1.1.1 の ZIP と Drive の `trk-1.1.0`／`trk-1.1.1` はそのまま残す**（同じ名前で作り直さない）。1.1.2 は別のZIP・別のフォルダー（Drive の `trk-1.1.2`）として配る。

### 1.1.1 のレビュー反映（trk210・1.1.1 で配布済み）

**1.1.0 の配布ZIPレビュー（2026-10-27）で見つかった共有フォルダーまわりの3点**を直した。🔓 の扱いも「1タップ＝1本」にそろえている。実機で見つかった不具合ではなく、**1.1.0 を配ったままでよいとレビューで確認済み**（SHA256 一致・304 問題なし・`?safe=1` と `file://` も確認済み）。この4点は **1.1.1 のZIPに入れて配る**（1.1.0 のZIPはそのまま）。

- **📤 × で外したフォルダーが次の起動で戻る（trk210）**：1.0.x の `"share"`（1本だけの共有）は登録簿へ移したあとも残していた（読めない環境でも失わないため）。そのため最後の1本を × で外すと登録簿が空になり、次の起動の `loadSharedFolders` が `"share"` を**移し直して**戻してしまっていた。`removeSharedFolder` が最後の1本を外したときに `"share"` も消す（🚫 共有をやめる は前から両方消している）。
- **📤 1本でも「確認が必要」「拒否」だと、ほかのフォルダーの曲も出ない（trk210）**：`restoreSharedFolders` は「1本でも許可待ちなら、起動時は読まない（最初のタップ待ち）」だった。**許可が生きているフォルダーは先に読む**ようにし（`plan !== "scan" && autoRead && need.length < sharedFolders.length` のとき `readSharedFolders()`）、**🔓 は許可待ちが残っている間だけ**出す（`readSharedFolders` の `hidden = granted >= sharedFolders.length`）。
- **🔓 は1タップ＝1本（trk210）**：これまでは1クリックの中でフォルダーの数だけ `requestPermission` を続けて呼んでいた。Chrome は1回の操作で2本目以降が `NotAllowedError` になりうるので、自動の流れ（`folderAutoKickShared`）と同じく**まだ許可が要る先頭の1本だけ**を聞き、残りは次のタップへ回す（`sharedPendingName` を 🔓 の文面に出す）。
- **📚 書斎：同名の別フォルダーで前の本が消える（trk210）**：`studySharedFolderNameFor(handle)` が `isSameEntry` で見分け、**別のフォルダーなら `Manga (2)`** として並べる（同じフォルダーを選び直したときは今までどおり同じ本・しおりを保つ）。`isSameEntry` が無い環境は名前で同じとみなす（従来どおり）。
- **📚 覚えたフォルダーの後始末（trk210・軽微）**：`STUDY_UTIL.sharedFoldersInUse(books)` に載っていない（＝リンク本が1冊も無い）フォルダーは、本を消したときに `studySharedFoldersPrune()` が登録から外す。本を消してもハンドルだけ残る、を防ぐ。

### 1.1.2 のレビュー反映（trk211・1.1.2 で配布）

**1.1.1 のレビュー（2026-10-27）の軽微な指摘**を直した。レビューは「直さなくても配布には支障なし」としていたが、🔓 の文面が実際に聞くフォルダーと食い違うのは案内として不親切なので、配る版に含める。

- **🔓 の文面が、さっき断ったフォルダーの名前のままになる（trk211）**：最初のタップでの自動確認（`folderAutoKickShared`）で許可を断ると、`sharedPendingName` を更新しないまま `showReconnect()`／`syncShareUI()` を呼んでいた。そのため 🔓 には**いま断った1本**（またはさらに前のフォルダー）の名前が残ることがあった。断ったあと**残りを数え直してから**文面を合わせるようにした。🔓 ボタン側（クリックの中で1本だけ聞く道）も同じ決め方にそろえた。
- **決め方は1か所（`sharedPendingNameFrom(list)`）**：🔓 に出すのは**次に聞く1本**＝まだ許可待ち（`prompt`）の先頭。残りが全部「拒否」のときは先頭の1本を出す（空にして `libHandle.name` に落ち、別のフォルダー名が出るのを避ける）。`readSharedFolders`・`restoreSharedFolders`・`folderAutoKickShared`（拒否の後と読んだ後）・🔓 ボタン（拒否の後と成功後）がこの関数を通る。
- **`sw.js` の cache は `trk-v2026.10.27-trk211`**。`tests/trk211-review.test.mjs`（6件）を追加（純関数の選び方・断ったとき／全部拒否のとき／許可できたときの文面・🔓 側の配線・cache）。trk208 のサンプルは新しい関数も読み込むようにし、trk210 の cache 検査は「trk210 以降」に緩めた（版が進むたびに直さないため）。

### 🖥 全画面の動画をホイールで拡大・縮小（trk212・1.1.3 で配布）

**全画面ビューア（`#videoMaxView`）で、再生中の動画をマウスホイールで拡大・縮小できるようにした**（2026-10-27）。背景映像の `videoZoom`（0.5〜3x）とは別で、**全画面の中だけ**に効く。

- **操作**：映像の上で**ホイール上＝拡大／下＝縮小**。**ポインターが合っている位置を中心**に寄る（指した場所が動かない）。**1回あたりは 2%／5%（既定）／10%** から選ぶ（⚙ 設定 → 🎨 見た目 →「全画面の拡大・縮小（ホイール1回）」＝`#videoMaxWheelStep`・`core.settings.videoMaxWheelStep`。工場出荷に戻すと5%）。
- **100%＝従来の全体表示**（`containSize` がアスペクトを保って枠に収める）。範囲は **100〜500%**（`ZOOM_MIN=1`／`ZOOM_MAX=5`）。
- **ドラッグで移動**：**拡大中だけ**、6px 以上動かしたら「つまんで移動」（`DRAG_START=6`・カーソルは `grab`／`grabbing`）。**100% ではわざと効かせない**（左右の長押しシークとぶつけない）。離したときの click は `suppressHoldClick` で再生／停止にしない。
- **2本指のピンチ**も同じ倍率で効く（`zoomPointers`）。上部の **🔍 ボタン**（`.videoMaxZoom`）は拡大中は「🔍 {n}%（クリックで100%に戻す）」、100% ではホイールの案内を出し、押すと 100% に戻る。
- **戻るタイミング**：全画面を開くたび・曲が替わるたび（`songSelected` → `resetZoomView`）に 100%。`panX`／`panY` は**画面の幅・高さに対する割合**で持つので、ウィンドウの大きさが変わっても同じ見え方になる。
- **実装**：`js/video-max.js` の純関数（`zoomStepPercent`・`containSize`・`panLimit`／`clampPan`・`accumulateWheel`・`zoomAround`・`zoomFrame`）＋ `paint()` が `zoomFrame(W,H)` の矩形で `drawImage`。FI（`TrkFrameInterp.drawTo`）も同じ矩形へ `setTransform` で掛ける。**パック画像（映像が無い曲）は拡大・縮小しない**（従来の全体表示）。
- **ホイールの量の数え方**：`WHEEL_NOTCH=100`（px 相当）でノッチに直す。`deltaMode` は **行（1）＝1行34px・ページ（2）＝100px**。`accumulateWheel` は同符号で積み上げ、1イベントで動かすのは ±4段まで（トラックパッドの細かい動きも合計で1段ずつになる）。ホイールの既定動作は全画面の中だけ `preventDefault` で止める。`touch-action:none` と長押しシーク（trk188）はそのまま。
- **文言は4言語**（`videoMaxZoomReset`・`videoMaxZoomHint`・`videoMaxHint` の追記・`videoMaxWheelStep`）。`sw.js` の cache は **`trk-v2026.10.27-trk212`**。`tests/trk212-video-zoom.test.mjs`（11件）を追加。
- **未確認**：実機のホイール・トラックパッド・ピンチの感触（サンドボックスにブラウザーが無い）。

### 🐔 trk's playlist：カタログから選んだリストだけを追加（trk217・1.1.6 で配布）

**trk-apk（`37405fa`）の `docs/APK-SPEC-2026-10-29.md` の「trk's playlist」の行**を、このリポジトリに取り込んだ版。精査の記録は [`PLAYLIST-CATALOG-REVIEW.md`](PLAYLIST-CATALOG-REVIEW.md)。

- **起動時に作らない**：`ensureTrkDistributionPlaylists({ create: false })` で、既にあるリストの**曲目・ガイド・旧データの移行だけ**を行う（新規作成はしない）。`🎓 trk's OST Vol.1` も**あるときだけ**更新する。`ensureTrkFolder()` は 🐔 の棚だけを用意する（`TRK_SHELVES` の一覧を `for` で作る形に整理）。
- **設定の 🐔 に「プレイリストを選択」**（`#trkPickSelect`／`#trkPickAdd`／`#trkPickHint`／`#trkPickStatus`）：`trk オリジナル`（🎓 OST・🐔 Game Vol.1・🎻 Classic Vol.1・🎼 Agent OST は曲があるときだけ）＋カタログの全リスト（曲の無い2本は出さない）を `optgroup`（シリーズごと）で並べ、**追加済みは選べない**（`trkPickHas`：ID 一致、または `cat` が `series:playlist`／`trk:series:playlist`）。
- **ID は `("trk-" + playlist.id).slice(0, 24 - suffix) + suffix`**（`plSanitize` の24文字に収める。100曲を超えるリストは `-v1`／`-v2` に分かれ、接尾辞は削らない）。**上限は200本**（`TRK_LIST_MAX`）と棚の数（`plFolderRoom`）を**作る前に**確かめる。
- **棚は要るものだけ**：追加中は `trkSelectedFoldersOnly` を立て、`ensureTrkFolder()` がシリーズの棚をいっせいに作らないようにする。🎭 Endfield のキャラクターテーマは `trk-endfield` → `trk-endfield-character` の順に作る。
- **消したリストの戻し**：`trkPickAdd` が `trkUnmarkRemoved` してから作る。**♻ ボタンは出さない**（`restore.hidden = true`。`trkRestoreRemoved()` は残すが UI からは呼ばない）。`trkRestoreHint` の文言もピッカーへ案内する形に変更。
- **表示チェック（`trkPlaylistChk`／`trkClassicChk`）は表示だけ**（リストを作らない）。
- **文言は4言語**（`trkPickHint`・`trkPickLabel`・`trkPickAdd`・`trkPickAdded`・`trkPickOk`・`trkPickFail`・`trkPickOriginals`、`trkPanelHint`／`trkPlaylistNote`／`trkClassicNote`／`trkClassicPanelHint`／`trkOrderEmpty`／`trkRestoreHint` の改訂）。`sw.js` の cache は **`trk-v2026.10.29-trk217`**。
- **入れなかったもの**（APK 専用）：`core.audioSafety`・`keepInBackground`・`TrkApkPip`・下部ナビ・Back の段階処理・向きの10秒長押しなど。カタログの音源を同梱しない方針も従来どおり。
- **未確認**：実ブラウザでのピッカーの操作感（サンドボックスにブラウザーが無い）。

### 🔈 出力デバイスを切り替えても、再生を止めない（trk219・1.1.8 で配布）

Windows の「サウンド」などで**音の出力先（スピーカー／ヘッドホン／HDMI など）を切り替えると、再生が止まったまま戻らない**という実機の指摘への対応。ブラウザーが音の出口を作り直すときに、`<video>`（全曲・動画・プレビューで使う**唯一の再生要素**）が勝手に一時停止したり、Web Audio の出口が黙ることがあるため、**「利用者が止めたのではない停止」を見つけて続きから鳴らし直す**。

- **`js/audio-keep.js`（新規）**：`#video` の `play()`／`pause()` を**その要素だけ**包み、`pause()` を呼んだ時刻（`askedPauseAt`）を記録する＝**アプリが頼んだ停止**と区別する。`media.js` の次に読む（`index.html`）。
- **判断は純関数 `keepPlan(state)`**：`want`（アプリが再生を望んでいる）・`hidden`（別タブ・最小化）・`ended`・`paused`・`stalled`・`contextRunning`・予算（60秒に6回）・休み（3回続けて失敗で30秒）で `"play"`／`"context"`／`"none"` を返す。
- **見張り（1秒ごと）**：①アプリが頼んでいない `pause` → 250ms 後に再開（位置はそのまま）②`readyState >= 3` なのに `currentTime` が 2.6 秒進まない → `play()` をやり直す ③`AudioContext` が running でない → `resume()` ④`mediaDevices` の `devicechange` → 出口を起こし、🎛 の出口もつなぎ直す。
- **守る約束**：画面が隠れているときは再開しない／終端では再開しない／1分に6回まで／3回続けて失敗したら30秒休む／**`window.Trk.audioKeep`** に `plan`・`recover`・`state`・`limits` を出す（テスト用）。
- **`js/fx.js`**：`wakeAudioHard(force)` を足して **`TrkFX.context()`／`TrkFX.wake(force)`** を公開。`AudioContext` が running でないときに `resume()` し、`wake(true)`（デバイスの切り替え）では**出口 `G.out` を destination へつなぎ直す**（つなぎ直しは 120ms 後・1回）。
- **ロック画面・キーボードの停止キーは今までどおり**：`Media Session` の `pause` ハンドラ（`fx-dock.js`・`media-player-mode.js`）がアプリ側で `pause()` を呼ぶので「頼まれた停止」＝再開しない。
- 設定は増やさない（UI・i18n の追加なし）。`sw.js` の cache は **`trk-v2026.10.29-trk219`**、`tests/trk219-audio-output-keep.test.mjs`（17件）で **746 pass**。利用者向けの説明は `docs/guide/sound.md`・`docs/guide/en.md` に1節ずつ。
- **未確認**：実ブラウザ／実機で出力デバイスを切り替えたときの挙動（サンドボックスに音声デバイスもブラウザーも無い）。

### 🐔 trk's playlist：曲画面の一覧に出さない・編集できるコピー（trk218・1.1.7 で配布）

実機でピッカー（trk217）を触った利用者からの UX 改善。**trk のリストが「プレイリストに入れる」に並ぶと画面が埋まる**ため、初期は出さず、要るときだけ出せるようにした。

- **② 初期状態では出さない**：曲画面の「プレイリストに入れる」（`songProfile`）は `core.settings.playlists.filter(trkListShown)` で絞る。**trk のリスト（`trk-…`）は `settings.trkListed` に入っているものだけ**を出し、利用者のリスト（`pl…`）はいつも出す。隠した件数は `plInListsHidden`（`{n}`）で「⚙ → 🐔 の 👁 で出せます」と案内する。**リストは消さない**。
- **① ⚙ → 🐔 trk's playlist の一覧に 👁／🗑**：`settings.trkListed`（出すIDの一覧・初期 `[]`）を `trkListSetShown(p, on)` が出し入れする。隠れているときは 👁 を `.plTrkHidden` で淡くし、`aria-pressed` で押下状態を読み上げに出す。**ボタンを出すのは `trkIsFixedList(p)`＝`trk-…` のリストだけ**（📋 のコピーは利用者のリストなので、この2つは出さず・いつもの開く／↑↓だけ）。
- **③ 📋 編集できるコピー**：`trkCopyAsUser(p)` が**通常のプレイリスト**（`pl…` の ID・`frozen/locked:false`＝中クリックで消せる）を作る。`cat:""` で**カタログの自動更新と切る**（次の起動で中身を上書きされない）。名前は `trkCopySuffix`（「〜（コピー）」）を足して**24文字以内**、同じ棚に置き、`songs`／`wish`／`guide`／`tags` を引き継ぐ。上限は `TRK_LIST_MAX`（200本）で、超えるときは `trkCopyFail`。
- **既に編集していた人への案内**：`settings.trkFixedNotice`（0/1）。`initLibrary` の起動時に `trkFixedNoticeOnce()` が、**trk のリストを持つ人に1回だけ** `trkFixedNotice` をトーストする。`resetAllPrefs` で 0 に戻り、設定Importでも `trkListed`（`cleanTrkRemoved` で ID を検証）と `trkFixedNotice` を扱う。登録簿は [`MIGRATIONS.md`](MIGRATIONS.md)（削除予定 2027-02-28）。
- `plDelete` は `settings.trkListed` からも同じ ID を消す（消したリストの 👁 が残らない）。
- 文言は4言語（`trkListShow`／`trkListHide`／`trkListShown`／`trkListHidden`／`trkListNote`／`trkCopyBtn`／`trkCopyDone`／`trkCopyFail`／`trkCopySuffix`／`plInListsHidden`／`trkFixedNotice`）、`sw.js` の cache は **`trk-v2026.10.29-trk218`**、`tests/trk218-trk-list-visibility.test.mjs`（14件）で **729 pass**。
- **未確認**：実ブラウザでの 👁／🗑／📋 の操作感（サンドボックスにブラウザーが無い）。

### ⭐ お気に入りの4フォルダを、どれも使えるようにする（trk215・1.1.5 で配布）

1.1.4 で「⭐1軍 以外が正常に動かない」と確認された（2026-10-29）。原因は**保存する場所が無かったこと**と、**タブをいまのフォルダの曲数だけで出し入れしていたこと**。4フォルダ（⭐1軍／⭐2軍／🧊フリーズ／📤元お気に入り）を同じように使えるように直した。

- **保存**：1軍は今までどおり `settings.tvFav`／`fxFav`／`songFav`。**2軍〜元お気に入り・📌ピン・🔒凍結・選んでいたフォルダは `settings.favs[kind]`** に保存する（`core.js` の既定に `favs`、`save()` は `snapshot()` を書いて `saveUserPrefs()`）。1.1.4 までは `core.prefs.favs` を読むだけで、どこにも書いていなかった＝**2軍に入れてもリロードで消え、曲は元お気に入りへ落ちていた**。
  - **凍結は最初からオンにしない**（`boot()` の `locks` 既定を `["frozen"]` → `[]`）。1.1.4 までは 🧊フリーズが最初から凍結されていて、そこへ入れられなかった。
  - `tidy()` は `st.main` などを**別の配列に差し替えない**（`rewrite()` で中身だけ入れ替える）。1軍の配列は `settings.songFav` と同じものなので、差し替えると次の `state()` の `syncMain` が古い配列に戻してしまう。
- **⭐タブの出し入れ**（`js/library.js` の `libFavTab`）：1軍／2軍／🧊のどれかに1曲でも入っていれば出す。数は、いま選んでいるフォルダの曲数。**いま ⭐ を見ているなら0曲でも出す**（フォルダを選んだ直後にタブごと消えない）。0曲のときは `libFavEmpty` で「上のチップで切り替える／☆で入れる」と案内する。
- **フォルダの切り替え**：⭐タブの上のチップ（`js/favs.js` の `chips`）は常に **⭐1軍／⭐2軍／🧊フリーズ**（＋📤元お気に入り）を出す。選ぶと `settings.favs[kind].active` に覚える。**曲の行の ☆ は、いま開いているフォルダへ入れる**（📤元お気に入りを見ているときは1軍へ戻す）。行には 📌ピンと 🧊フリーズの印を出す。
- **凍結の解除は3秒長押し**：🔒（凍結中）と、凍結中の 🧊 のチップを**3秒押し続ける**と解除する（`holdButton`。押している間はチップの下に3秒ぶんのバーが伸びる＝CSS `.holding`）。短く押したときは「3秒長押しで解除」と伝える（`favLockHint`）。凍結するほうは安全側なので1タップ。
  - ❓謎設定「**🧊 フリーズ（凍結）の解除をワンタップにする**」（`settings.favQuickUnfreeze`・**既定オフ**）を入れると、🔒／🧊 の1タップで解除できる（`quickUnfreeze()`）。一括で管理・解除したいときの暫定的な逃げ道。
  - 凍結中は、そのフォルダへの**追加・削除を止める**（`add`／`remove` が `why:"locked"`）。
- **文言は4言語**（`favs.js` の `favLockHint`・`favLockHintQuick`・`favPinCount`・`favFrozenBadge`・`favUnlockHold`・`favLock`／`favIntro` の改訂、`library.js` の `libFavEmpty`、`i18n-options.js` の `favQuickUnfreeze`・`favQuickUnfreezeHint`）。`sw.js` の cache は **`trk-v2026.10.27-trk215`**。`tests/trk215-favs.test.mjs`（17件）。
- **未確認**：実機での3秒長押しの感触（サンドボックスにブラウザーが無い）。**配布（ZIP・Drive）は未指示**。

### 🔍 全画面ズームの仕上げ（trk214・1.1.4 で配布）

1.1.3 の実機レビューで出た2点（配布の妨げにはならない軽微）を直した（2026-10-27）。**倍率・操作・見た目は trk212 のまま**で、指を離したとき／外へ出たときの続き方だけが変わる。

- **ドラッグ中はポインターを掴む**：`stage.setPointerCapture(pointerId)`（`captureZoomPointer`／`releaseZoomPointer`・`capturedPointers`）。これまでは映像の外へマウスが出ると `pointermove` が届かず、ずらしが止まっていた。捕まえている間はウィンドウの外へ出ても追い続ける。
  - **押しただけ（長押しシーク）では捕まえない**：trk188 の「外へ出たら長押しシークを止める」をそのまま残すため、捕まえるのは**ドラッグが始まった（6px を越えた）とき**と**2本目の指が触れたとき**だけ。掴んだあとは `suppressHoldClick` が立っているので、click の取り違え（黒いところで閉じる／再生の切り替え）は起きない。
  - 離す・取り消す・`blur` で必ず返す（`lostpointercapture` でも `capturedPointers` から外す）。
- **ピンチのあと、残った1本指でそのまま動かせる**：`endZoomGesture` で「2本→1本」になったとき、残った指を**その場で掴み直した状態**（`dragState` を `active:true` で作り直す）に切り替える。置き直さなくてもずらせる。100%（動かす余地が無い）ときは切り替えない。
- **自動検査**：`npm run check` は 673→**680 pass**（`tests/trk212-video-zoom.test.mjs` に trk214 の4件）。`sw.js` の cache は **`trk-v2026.10.27-trk214`**。
- **未確認**：実機のトラックパッド・スマホのピンチ（ヘッドレスでは触れない）。

### 📄 配布物の文書のリンク切れを見つける（trk214・1.1.4 で配布）

1.1.3 のレビューで、配布版だけの文書に**古い版の表記とリンク切れ**が残っていると指摘された（`docs/guide/{files,mods,appearance,en,start}.md`・`CONTRIBUTING.md`・`docs/SECURITY.md`・`privacy.html` に「1.0.4 ポータブルZIP」、`README-1.0.4.md`／`README-1.0.8.md` への参照）。原因は「前の版の `trk-files/` に変わったファイルだけを載せ替える」作り方。**表記そのものは文脈が要るので人が直し**（§9 の手順）、**名前の取り違えは機械で止める**ようにした。

- `tools/prepare-release.mjs` に **`checkDocLinks(dir)`** を追加し、`checkLayout()` から呼ぶ（`--check` と組み立ての両方で効く）。見るのは `trk-files/` の中の `.md`／`.html`／`.txt`。
  - **相対リンクの先が実在するか**（`](…)` と `href="…"`。`http(s)`・`mailto`・`#アンカー`・`/絶対`・`../` で配布物の外は見ない）。
  - **本文に書いただけの `README-x.y.z.md`** も、同じ名前のファイルが配布物のどこかに入っているか。
- 1.1.3 のZIPに当てると **8件**（`CONTRIBUTING.md`・`README-1.1.3.md`／`README.md` の `trk-files/README-1.0.8.md`・`trk-files/README-1.1.1.md`・`docs/guide/en.md`・`files.md`・`mods.md`）が出る。**1.1.4 を組むときに全部直す**（§9 の「配布版だけの文書」）。
- `tests/release-layout.test.mjs` に3件（リンク切れを拾う・見逃す種類を拾わない・cache が trk214 以降）。

### ⏱ 曲名タブの「ここをプレビュー開始位置にする」を設定で出す（trk213・1.1.3 で配布）

**曲名タブ右上の「⏱ ここをプレビュー開始位置にする」を、初期状態では出さない**（2026-10-27）。使わない人が誤って触り、その曲のプレビュー開始位置（`previewStart`）が変わるのを避けるため。出すかどうかは**設定**で持ち、**初期オフ**。

- **設定**：`core.settings.previewStartShow`（`prefs.previewStartShow === true`・初期オフ）。`resetVideoPrefs()` で `false` に戻す（📊 スペクトラムの初期化と同じ場所）。
- **置き場所**：📊 スペクトラムの設定（`js/spectrum.js` の `buildBox`）に **「⏱ 「ここをプレビュー開始位置にする」を表示」**（`specPreviewSet`／説明 `specPreviewSetHint`・4言語）。⚙ 設定 →「📊 スペクトラム（音の見える化）」と、ラックの「くわしい設定」の両方に出る（同じ `buildBox`）。設定の検索でも「プレビュー開始位置」で見つかる。
- **出し入れ**：`js/library.js` の `previewSetShown()`（設定オン＋曲＋音源の準備完了）と `syncPreviewSetBtn()` が1か所で決める。`renderBanner()`・`updateSpBuilder()` が通り、チェックを変えたときは `window.Trk.library.syncPreviewSetBtn()` でその場で合わせる。**オフにしたら、開いていた開始位置のバーも閉じる**。
- **今までどおり使えるもの**：曲ごとの `previewStart` は消さない（オンにすれば使える）。**「⏮ 常に最初から再生する」は ⚙ 設定 → 🎵 サウンドとメディアプレーヤーから**、ボタンを隠していても切り替えられる（開始位置のバーは3か所のうちの1つだったため、隠しても残り2か所で足りる）。
- **文言は4言語**（`specPreviewSet`・`specPreviewSetHint`）。`sw.js` の cache は **`trk-v2026.10.27-trk213`**。`tests/trk213-preview-set-toggle.test.mjs`（6件）。ガイド（`docs/guide/start.md`・`docs/guide/en.md`）にも「初期は出ていない・オンにする場所」を書いた。
- **未確認**：実機での見え方（曲名タブの右上が空くこと・チェックの位置）。

**1.1.4 は「trk214 を配る版」**：アプリ本体は **trk214**（1.1.3 の配布ZIPの `trk-files/` を土台に、変わった**2ファイル**＋ガイド2＋**配布版の文書9本**を直した）。ZIP を **`2026-10-27 22:00`（UTC）** で組んだ（1.1.3 の `21:00` より新しい）。`sw.js` の cache は **`trk-v2026.10.27-trk214`**。
- **変わったアプリのファイルは2つだけ**：`js/video-max.js`（ポインターの捕捉・ピンチ→1本指）と `sw.js`（cache）。`index.html`・`css/style.css`・`js/{core,i18n,library,main,spectrum}.js` は 1.1.3 と**バイト同一**。
- **配布版の文書**：`docs/guide/{files,mods,appearance,en,start}.md`・`CONTRIBUTING.md`・`docs/SECURITY.md`・`privacy.html`・`NOTICE.md`・`README-1.1.4.md`／`README.md` の「1.0.4 ポータブルZIP」等の表記と、入っていない `README-1.0.x.md` への参照を直した（§9 の「配布版だけの文書」）。**これで `checkDocLinks()` は 0件**（1.1.3 では8件）。
- **1.1.0〜1.1.3 の ZIP と Drive の `trk-1.1.0`〜`trk-1.1.3` はそのまま残す**（同じ名前で作り直さない）。

**1.1.3 は「trk212・trk213 を配るための版」**：アプリ本体は **trk213**（1.1.2 の配布ZIPの `trk-files/` を土台に、変わった**9ファイル**＝`index.html`・`css/style.css`・`js/core.js`・`js/i18n.js`・`js/library.js`・`js/main.js`・`js/spectrum.js`・`js/video-max.js`・`sw.js` を差し替え、配布版ガイドの `docs/guide/start.md`・`docs/guide/en.md` には trk212・trk213 の段落だけを足した）。配布ZIP・`README-1.1.3.md`・`release/README.txt`・`release-manifest.json` の版を 1.1.3 にそろえ、ZIP を **`2026-10-27 21:00`（UTC）** で組んだ（1.1.2 の `20:00` より新しい。§6・§7・§9）。`sw.js` の cache は **`trk-v2026.10.27-trk213`**。

**1.1.0〜1.1.2 の ZIP と Drive の `trk-1.1.0`／`trk-1.1.1`／`trk-1.1.2` はそのまま残す**（同じ名前で作り直さない）。1.1.3 は別のZIP・別のフォルダー（Drive の `trk-1.1.3`）として配る。

### TouhouカタログとローカルMIDI

- `js/touhou-theme-data.js` はTouhouThemeDBの固定スナップショット（commit `e70e645`、The Unlicense）。カタログは曲名等のメタデータだけで、ゲーム音源や抽出物は含みません。904 release IDのうち862をTouhou Project、関連ゲーム42 IDを別系列として扱います。完全性を保証する数字ではありません。
- ID形式のローカル名はユーザー設定名 → カタログ曲名 → 元ファイル名の順で表示します。例：`th06_05.mid`。**元ファイル名・保存済みタイトルは書き換えません。** 曲リストとの照合に使う別名は、根拠があるものだけです。
- `.mid`／`.midi` はローカルでコード生成WAVに変換します。SMF 0/1・PPQ対応、SMPTE非対応、入力上限8 MiB、10分。全曲・全作品にMIDIがあるわけではありません。
- 変換の処理量の上限（trk114）：各音が鳴る時間の合計×22050で **2億**（`MAX_RENDERED_VOICE_SAMPLES`）。聞こえなくなった余韻（音色の減衰が−72 dB以下、ドラムは各打楽器の減衰から決まる秒数以降）は描かず、数えません。ノートオフの無いドラムが曲末まで鳴り続けて上限を食う問題もこれで解消。超えたときは専用の文言「長い、または同時に鳴る音が多すぎる」（`midiTooDense`）を出し、イベント数・トラック数の上限（`midiTooComplex`）と分けました。変換中は5%刻みで進み具合を出し、別の曲を選ぶと次の区切りで止めます。合成ループは同じ音のまま約1.7〜2.4倍速く（出力差は1 LSB以内。7・10ビット化するプロフィールは量子化1段まで）。手元のMIDIの処理量は `node tools/midi-budget.mjs ファイル.mid [--render]` で測れます（読むだけ・送信なし）。
- 音色プロフィールは**24種**（一般的な音色傾向の参考10種＋trkオリジナル14種）。設定は次にMIDIを読み込んだとき反映されます。実SoundFont・SF2/SF3・PCM/WAVサンプル・ROM・東方ゲーム音源は含まず、実機や製品のエミュレーションでもありません。製品名に似た表記は広い着想を示すだけです。
- 選曲画面左下の `#richPanel` 直下に **TRK MIDI MIX** があります。プロフィール由来のDSPを通常音声に適用する機能で、初期オフ。SoundFont合成でも音声→MIDI変換でもありません。MIDI音色プロフィールとは別設定です。
- Audio設定のExport/Import、enum検証、リセット、セーフモードにプロフィール／MIX状態を接続済み。MIXはリセットとセーフモードでオフになります。
- 抽出ツールTouhou Music Room等は案内だけで、本体・実行ファイルを組み込んでいません。利用・抽出・再配布の注意は [`guide/touhou-midi.md`](guide/touhou-midi.md) を正とします。

### Riot系カタログとCreator-Safe（LoL・VALORANT・LoL関連ゲーム）

| シリーズ（`js/catalog.js`） | 中身 | 作られ方 |
|---|---|---|
| ⚔️ League of Legends（`lol`） | 22リスト・614曲（Sessions 3作、Champion Themes、Worlds、MSI、K/DA、Season 1〜9 OST、Warsongs、人気曲、trk118の4リスト＝Pentakill・ログイン／イベント／スキンのテーマ・eスポーツのテーマ・2025〜26年のサウンドトラック） | 自動（🐔 trk-lol） |
| 🎯 VALORANT（`valorant`） | 3リスト・48曲（Championsアンセム6曲・エージェント関連曲3曲・VALORANT Creator-Safe 39曲） | 🛒公式カタログから取り込む |
| 🛡️ Riot Games — LoL関連ゲーム（`riot-games`・trk118） | 7リスト・342曲（Ruined King・The Mageseeker・Hextech Mayhem・Teamfight Tactics Vol.1／Vol.2・2XKO・Wild Rift & Runeterra） | 🛒公式カタログから取り込む |

- **照合状態はプレイリストごと**に `js/catalog.js` の `LOL_CREATOR_SAFE`・`VAL_CREATOR_SAFE`・`RIOT_GAMES_CREATOR_SAFE` に持たせ、入手先ガイドの文言は `js/library.js` の `RIOT_GUIDE_KEYS` で選ぶ。照合していないものを対象と書かない（表に無い状態は「公式リンク集・Creator-Safeの対象と条件を要確認」）。

  | 状態 | 意味 | 文言キー | 該当リスト |
  |---|---|---|---|
  | verified | アルバムの全曲がプレイリストにある | `plGuideLolCsVerified` | Season 1〜9、Sessions: Vi・Star Guardian Taliyah |
  | partial | アルバムの一部だけ（`notFound`＝見当たらない曲） | `plGuideLolCsPartial` | Warsongs 10/11、Sessions: Diana 42/43 |
  | links-verified | 公式リンク集の全曲がある（プレイリストの曲から作ったリスト） | `plGuideRiotLinksVerified` | LoLの4リスト、VALORANT Creator-Safe、LoL関連ゲームの7リスト |
  | links-partial | 公式リンク集の一部だけ | `plGuideRiotLinksPartial` | Champion Themes 39/41、Worlds/WCSアンセム 1/13 |
  | links-absent | 1曲も見当たらない | `plGuideRiotLinksAbsent` | MSIアンセム、K/DA、VALORANTのChampionsアンセム・エージェント関連曲 |
  | mixed | 人気曲スナップショット（一部だけ） | `plGuideLolPopular` | LoL人気曲 7/30 |

  `unverified`（未照合）は後から足すリスト用で、今は使っていない。
- **根拠**：Riot Games Creator-Safe Playlist（979曲）の先頭100曲は公式の埋め込み表示（trk114）、101曲目以降は第三者サイト songdata.io の一覧（trk115〜116。表示は977曲で、出ない2曲は701〜750番目）。VALORANT Creator-Safe Playlist（40曲）は公式の埋め込み表示で全曲。記録は `tools/leagueoflegends-*-tracklist.json`（各リストの `creatorSafe`）、`tools/riot-games-creator-safe-playlist.json`（51〜977行目の曲名・アーティスト・SpotifyトラックID）、`tools/valorant-creator-safe.json`。`check-repo` が状態・曲数・見当たらない曲・根拠の一致、trk118のリストの全曲が記録したトラックIDと一致すること、記録した927行がすべてどこかのリストにあることを検査する。
- **見当たらなかった曲**（Warsongs「Silver Scrapes」、Champion Theme「Smolder, the Fiery Fledgling」「Yunara, the Unbroken Faith」、Sessions: Diana「Oh Baby」）は、空さんの判断で追加確認をしない（2026-10-12）。「見当たらない」のまま扱う。
- trk108〜113の「Season 1〜9・Warsongsは確認済み」は根拠の無い過大表記で、trk114で訂正した（経緯はアーカイブ）。
- Creator-Safe でも Riot の法務表記（Legal Jibber Jabber）に従うことが条件で、音源の同梱・再配布・販売や企業広告での利用は別条件。音源はカタログにも同梱しない。曲別出典・範囲・権利上の注意は [`LEAGUE-OF-LEGENDS-MUSIC.md`](LEAGUE-OF-LEGENDS-MUSIC.md) と [`VALORANT-MUSIC.md`](VALORANT-MUSIC.md)。

### ブルーアーカイブ・ミカ（trk157〜159）

既存OST Vol.1〜8・225曲は維持。メモリアルロビー2曲と旧3リスト（kiss angel／Aria to the Star／ソロ＆参加曲）を1つのプレイリスト **`ba-mika`（自動作成ID `trk-ba-mika`）「🪽 聖園ミカ」**（タブ色 `pink`）にまとめ、**BA全体は9リスト・239項目**です。ミカ部分はメモリアルロビーBGM2曲と歌唱6楽曲を言語・媒体・伴奏で分けた14項目（音源10／映像4）であり、「14曲」でも全作品の網羅数でもありません。

| 曲の並び（`ba-mika`「🪽 聖園ミカ」内） | 項目数 | 収録範囲・案内先 |
|---|---|---|
| 1〜2：メモリアルロビー曲 | 2項目 | Daily Routine 24/7（Nor、OST Vol.1／mora、`Daily Routine 247` も照合）＋You’re My Princess（EmoCosine、2026年10月時点で公式配信先未確認のため作曲家Xの1分投稿へ案内） |
| 3〜7：kiss angel | 5項目 | PV2本（中／日、公式bilibili）＋音源3曲（中文版／日文版／伴奏版、Apple Music中国ストア） |
| 8〜10：Aria to the Star | 3項目 | Prismatic Diary／The Incandescent Blue and the Cometの音源2曲（Apple Music英国ストア）＋グローバル公式ミニミュージカル本編（YouTube） |
| 11〜14：ソロ＆参加曲 | 4項目 | 幸せになるよ／ワンダー・ファニー・ハーモニー／Let's Go With...の歌入り3曲（Apple Music日本ストア）＋最後の曲の公式MV（YouTube） |

- 既存ブルアカ棚 `trk-ba` に自動作成し、共通タグは `Mika`。新しいMikaフォルダへの移動はしません。trk157〜158の旧3リスト（`trk-ba-mika-kiss`／`trk-ba-mika-aria`／`trk-ba-mika-vocals`）が保存されている場合は、所持曲・開いているタブ・ユーザー編集・削除状態を引き継いで `trk-ba-mika` 1つへ自動統合します（`BA_MIKA_LEGACY_PL`、削除予定日 2027-01-14）。
- 案内キーは `plGuideBlueArchiveMika`（4言語）。地域差、ローカルファイル提供の保証なし、配信・購入は二次利用許諾ではないことを明記。
- **英語掲載名≠英語歌唱**。Ariaの韓国語公式曲名は音源の照合別名。本編と曲別MV、音源と映像は分け、英韓チャンネルの投稿数を楽曲数に加算しません。合唱クレジットはCV括弧のみ省略し、全キャラクター名を80文字内に保持。
- kiss angelのShort音声2版は公式の単独配信先未確認で未収録。Ariaの会話・伴奏・曲別MV、日本語曲の別バージョン、映像出演だけの候補は今回の収録対象外（存在未確認とは区別）。
- 出典・各曲の範囲は [`BLUEARCHIVE-MIKA-INDEX.md`](BLUEARCHIVE-MIKA-INDEX.md)、作品別は [`BLUEARCHIVE-MIKA-MUSIC.md`](BLUEARCHIVE-MIKA-MUSIC.md)／[`BLUEARCHIVE-MIKA-ARIA.md`](BLUEARCHIVE-MIKA-ARIA.md)。音源・動画・歌詞は同梱しません。

### 曲名と媒体の照合（trk155〜159）

- **元ファイル名・表示名は変更しない**。公式タイトルと根拠のある `matchAliases` で照合します。方針はREADME（日英）、仕様と未対応例は [`TITLE-MATCH.md`](TITLE-MATCH.md)。
- クラシックは `Cm`／`C minor`・空白・句読点を吸収し、調・作品番号・楽章は保持。BeethovenのMusopen掲載名を別名として登録し、保存済みClassic Vol.1へも同じ曲の別名だけを補います。全クラシックの配布名を確認したわけではありません。
- `24/7`（半角 `/`・全角 `／`）を含む曲名からは `247` の照合キーも生成し、`Daily Routine 24/7` と `Daily Routine 247` のどちらの表記でも整合します。
- 装飾救済は `【高音質】`／`[HQ]`／`[High Quality]`／先頭🎧／`Theme 数字 -` に限定。通常照合の後、全候補が一意なときだけ採用。作者クレジットはカタログのartistを含む完全なキーと照合し、ローカル名のbyを推測で削りません。
- JP／CN／Short／Instrumental等の版名は保持。版やクラシックの見出しを左右に分割して別曲を拾わず、装飾救済を共有プレイリストの取り込みに広げません。旧テストの `Do you wanna kiss by angel` は仮想例で、公式曲名・別名には登録していません。
- ミカの項目は `matchMedia: audio | video` を指定。通常／別名／装飾／照合メモの候補を媒体で絞ります。動画取込flag→実FileのMIME→実ファイル名の拡張子の順に判定し、媒体不明は未一致。`trkWishFromTrack`／`plSanitize`で条件を保存します。**内容の鑑定ではなく、誤った形式情報や録音・歌唱言語を検証するものではありません。** 条件のない既存項目は従来どおり。

### その他のカタログ

- **Endfieldカタログ**（trk110〜trk111・trk128で整頓）は初号指令OSTと公式アルバム6作の2系統です。いずれも公式Spotify収録順・各曲は公式Spotify個別曲ページへリンクし、取り込み時に自動でプレイリスト化します。音源は同梱しません。
  - **並び順（trk128）**：①初号指令OST 上下2巻を**最上**（ゲームのオープニングBGMがここにある）。表示名はtrk129で24文字に収まる「初号指令 (上) ZD OST Vol.1」／「初号指令 (下) ZD OST Vol.2」へ（trk128の長い名前は保存時に「初号指令 (上) ― Zeroth Direct」と語の途中で切れていました。旧既定名からの改名はセーフリフレッシュ・§2参照）。②公式アルバム6作を**リリース順**（Eve of Departure 2026-04-11 → Thunder's Legacy 2026-04-22 → At the Wake of Spring OST 2026-04-30 → Contingency Contract Re-Ignition OST 2026-06-20 → Homecoming OST 2026-07-31 → Dreamscape of Wind and Snow OST 2026-09-10）。③**キャラクターテーマ4リスト**（ef-blurring・ef-ashen・ef-floaty・ef-makers。Talos Wiki（コミュニティ）では Laevatein×2・Gilberta・Yvonne のOperatorテーマ）をネスト棚 **`trk-endfield-character`「Endfield Character Theme」（🎭、trk-endfieldの子）**にまとめる。④紹介リスト ef-signal を最後に。順序の正は `tools/endfield-zeroth-directive-tracklist.json` の `seriesPlaylistOrder`（check-repo がシリーズ全13リストの順を検査）。
  - **一回限りの整頓（trk128）**：`js/library.js` の `trkEndfieldTidyOnce` が初回起動だけ、既存取り込みを上記の順へ並べ替え（配列順・`playlistOrder`・`createdAt` の3系統）し、キャラクターテーマ4リストをまだ既定場所（trk-endfield）にあるものだけ棚へ移動する。`settings.trkEndfieldTidy1` の印が付いた後は並び・配置とも二度と触らない（利用者の配置・手動並べ替えを守る）。改名は**保存データに実際にある24文字切り名「Endfield — Zeroth Direct」にも命中**する（実アプリでは保存名が `plSanitize` で24文字に切られ、trk110の上下の名前が同じ文字列になる）。フォルダ上限は 12→13（`plTighten`・`core.js`）。🐔階層メニュー（plTrkMenu）は一段深い棚も表示する。
  - **trk128で修正した既存欠陥**：サブフォルダ（🐔 の中の棚など）を開いたとき、そのフォルダがタブ帯に無かったため表示が「すべて」へフォールバックしていた。`libTabsOf` が見ているサブフォルダのタブを出すようにした（`plNested` 付き・見なくなったら消える＝フォルダ内プレイリストタブと同パターン）。
  - 初号指令OST「Zeroth Directive」：Vol.1 37曲＋Vol.2 23曲（2026-02-15 配信開始）。各巻は公式告知のffm.to配信一覧へリンクし、中国語公式曲名を照合別名に登録済み。旧「初号指令 OST」4パート紹介版は永続ID `ef-firstorder` を保ったままVol.1全曲版へ、旧既定名（trk110・trk128の名前＝保存は24文字切り）も安全更新されます（所持曲・ユーザー変更は維持）。
  - **表示名は24文字に収める（trk129）**：保存名は `plSanitize` が24文字で切るため、trk128 の長い名前は「初号指令 (上) ― Zeroth Direct」のように語の途中で切れていました。trk129 で「初号指令 (上) ZD OST Vol.1」／「初号指令 (下) ZD OST Vol.2」（21文字。ZD＝Zeroth Directive。フル名はタグに残る）へ改名し、旧既定名からの改名表を `js/library.js` の `ENDFIELD_FIRSTORDER_OLD_NAMES` にまとめました。`check-repo` が24文字に収まることも検査します。
  - Metal Scar Radio 公式アルバム6作・計81曲（trk111）：各アルバムは公式Spotifyアルバムページへリンクし、`trk-ef-*` プレイリストとして自動作成。
  - 権利表記：©/℗ GRYPHLINE（Hypergryph）、レーベルは Metal Scar Radio（鐵痕電台）。配信・購入は二次利用許諾ではなく、公式二次創作ガイドラインは公式素材のそのままの複製・抽出を禁止します。
  - 未確認（断定しない）：6作の中国語公式曲名・公式告知のffm.to配信一覧（Homecoming を除く）・VGMdb照合・他ストアの曲別URL。照合別名は付けていません。「配信なし」とも書きません。trk128 で Talos Wiki（コミュニティ運営）から確認したキャラクター分類・発売日・3アルバムのSpotifyID（Ashen Remains 6aFenM2edcPyIfzg6ZtQnz／Maker's Luv 4ZZOkqQONyAFHzEG31Qss4／The Floaty Envelope 44qElu191kLQ5fit5fAQ6g・Blurring曲 0QqtGr91Q6JxiUW7sCukIg）は**公式ページでの再確認が未実施**＝台帳の「調査中の他の公式リリース」へ記録。
  - 台帳とfixture：[`ARKNIGHTS-ENDFIELD-MUSIC.md`](ARKNIGHTS-ENDFIELD-MUSIC.md)、`tools/endfield-zeroth-directive-tracklist.json`、`tools/endfield-msr-albums-tracklist.json`。

### 初回の案内（trk140）

- 1行のバー（`#quickGuide`）＋開くと出る8つの手順（`#guideSteps`）。スタンプは `GUIDE_STAMPS`（js/main.js）。完了は Seed 欄の `trk!`（演出つき 🥚 の言葉も残す）。
- 検知：設定の開閉（`settings`／`settingsClose`）、書斎の開閉（`studyOpen`／`studyClose`）、TRKアンプの `#ampUseInp`、スキンは `applySkin`、曲は `phase` が playing。
- 保存：`tutorialStamps`（js/core.js）。旧 `song` は `play` に移し、未知の値は捨てる。

### 書斎のCBZ／ZIP（trk138）

- 1ファイル＝1冊の画像の本。ページは `page:{id}:{generation}:{n}` のキーで保存し、置き換えは画像フォルダと同じ `studyWriteImageRecord` を使う。
- 通常上限は書斎の画像と同じ（3000ページ・合計600MiB・1ページ100MiB）。「容量の上限を無視」で冊数・ページ数・合計容量・通常画像の単体上限は外せますが、圧縮爆弾対策の **CBZ／ZIP内1ページ100MiB展開上限は常に残す**。ZIP読取の固定構造上限（1アーカイブ25万項目・中央目録64MiB）も設定では解除されません。上限の判定は取り込み前に行い、超えるファイルは作らない。
- 失敗の理由は、1冊も入らなかったときは状態欄に、途中まで入ったときは集計の後ろに添えて出す（取り込みの開始と本を開く処理は状態欄を消すため、その後に出す）。
- 失敗の表示は、ファイルごとの文言が最後の集計（`Done: …`）で上書きされる。画像フォルダと同じ動き。

### 📦 まるごとバックアップ・端末保存（trk136〜137・160〜163・177）

- 設定画面から `navigator.storage.persist()` を要求／状態表示します（`?safe=1` は要求しない）。まるごとバックアップは core（localStorage許可リスト＋ライブラリ）・書斎・パックを既定で含み、曲・VRM・MMDなど大きいmediaは任意です。ZIP64対応、復元前に全エントリーのCRC・サイズをストリームで確認し、宣言サイズを超えた展開はその場で止めます。localStorageは `LS_KEYS` の許可リストだけを読み書きします。
- 書き出し側のCRCもBlobの `stream()` で計算し、ファイル全体を `arrayBuffer()` にしません。復元のBlob参照はZIP内のsliceで保持します（JSON化・IndexedDB書込み自体は必要な箇所で行います）。`.stpack`の読み込み・生成も共通ZIP経路を使い、パック全体を`ArrayBuffer`へ載せず、個々の展開ファイルもCRC・実サイズを確認します。
- **固定の解析安全上限（trk162）**：共通ZIP reader/writerは1アーカイブ250,000項目・中央目録64MiB。バックアップはさらにメタデータ1MiB、設定JSON20MiB、DBストアJSON64MiB／250,000レコード／ストア、圧縮エントリー展開64MiBまで（backup.jsonは1MiB・local.jsonは20MiB）。書き出し側も早めに検査し、「容量の上限を無視」では外しません。CBZ／ZIPはこの構造上限に加え、展開後1ページ100MiBを維持します。
- **ZIP作り手の互換性（trk163・F-37）**：Info-ZIPが標準入力・パイプからメンバーを読むZIP（`printf abc | zip - - > x.cbz` など）は、大きさが事前に分からないため32bitで足りていてもZIP64終端レコード＋ロケーターを必ず置きます（trk162はこれを`zipBad`で拒否する回帰でした）。ロケーターが正しく指し、終端レコードの中身（ディスク番号・件数・中央目録の大きさ／位置）がEOCDと一致するときだけ、その位置を中央目録の終わりとして認めます。中身が食い違うファイルは従来どおり拒否し、読む値は常にEOCD側だけ＝二重解釈は許しません。実Info-ZIP 3.0出力（store・deflate）の受理と嘘ロケーター／中身違いの拒否fixtureは `tests/zip-io.test.mjs` に固定。**ローカルヘッダと中央目録の `flags` 完全一致の要求は緩めていません**（実機確認は§4-15）。
- **書斎ストアの復元順（trk163）**：参照される側から書きます（pages→covers→books→settings）。容量不足などで途中失敗しても本側は無傷のままで、残る不整合は「参照されないページ」（書斎の整理で消せる）になり、「存在しないページを指す本」にはなりません。失敗時の案内に逃げ道も明記（4言語）：固定上限を超えたとき（backupHardLimit）は「作成時に📚書斎などの領域のチェックを外す／範囲を分ける」、パック導入失敗の内訳（backupRestorePackFailedKept）は「空き容量が足りないときは不要なパックを削除してからもう一度復元」。
- 復元時のアプリ上限（無視設定がオフのとき）は、書斎500冊・1冊3000ページ・画像アルバム600MiB／100MiB/画像・文章12MiB、パック500MiB/件・合計1GiB。画像サイズは `page.size` ではなくZIPの検証済みBlobエントリー実サイズを確認。すべての上限を無視してもブラウザ容量・メモリ上限は残ります。
- パック領域の復元は、先に既存インストーラで各パックを試し、最後にバックアップに無いIDだけ削除します。IDは正規化後の名前＋作者から算出。対象パックの導入失敗時は同じIDの既存版を残し、manifestから全IDを特定できないバックアップでは削除処理をしません。完了時に導入・失敗・削除件数と、同一ID保護／整理見送りをダイアログで表示し、確認後に再読み込みします。保存容量不足時に成功を保証するものではありません。
- **trk177レビュー対応**：復元前の確認ではバックアップに含まれるアドオンの件数と名前（最大3件＋省略数）も表示します。名前は制御文字・双方向制御文字を除去して80文字までに制限し、バックアップ中のコードは実行しません。復元したアドオンはすべて `enabled:false` にしてから保存します。コードと同意指紋は残しますが、自動実行はされず、利用者がアドオン画面で個別に有効化するまで動きません。確認情報が読めない場合は「不明／一覧を確認できない」と表示します。`trk_lyrics_v1` と `trk_subs_v1`（字幕遅延を含む）も localStorage 許可リストに追加し、手動選択した歌詞・字幕をバックアップ対象にします。

### 書斎の設定と画像キー（trk133〜135）

- **全画面フィット（trk135）**：設定の一番上「全画面時に強制的に画面にフィットにする」（`fullscreenFit:false` が既定、保存値は boolean `true` だけオン）。全画面中だけ画像全体を縦横比を保って表示（単ページ・見開きの左右それぞれ・縦読みの1枚ごと）。`studyFullscreenFitActive` と `studyApplyZoomValue` が保存済み `zoom` を変えず、表示倍率だけ1／`data-fullscreen-fit=1` にします。CSSは `minmax(0,1fr)` で縦横の枠を確定し `object-fit:contain`（単に倍率を1へ戻すだけでは大きな画像がはみ出すため）。強制中はキー・ホイール・ピンチで倍率を変えず、ドラッグのパンも止めてスワイプを維持。ネイティブ全画面・CSS代替・ブラウザからの全画面終了・リサイズに対応し、終了後は元の拡大率へ。縦読みは各ページを画面高に収め、一覧は引き続きスクロールします。
- **書斎上部に常時「⚙ 設定」**（trk134）。本を未選択・本棚非表示でも開けます。読書見出しの **「画像を全画面化」の左にも「⚙ 設定」**。本棚にも入口があり、従来の上級者向け項目を同じモーダルへ移設（コントロールは複製しない）。本棚非表示・テキスト閲覧中にも読書側から開けます。変更は即保存。Esc／閉じる／背景クリックで設定だけを閉じ、入口へフォーカスを戻します（本棚を隠して入口が消えたら、見える入口へ）。設定中は本体を inert にし、Tab はパネル内、読書ショートカットは止めます。キー割り当ては引き続き設定内で使えます。
- **PageDown＝画像の下端、PageUp＝上端が倍率に関係なく標準**。はみ出す画像が対象（単ページ・見開き、100%・縮小も）。端で押し直すと次／前ページを続きの端から開き、本の端では全画面を終了して本棚へ。**「最後のページ時PageDownで本を閉じる」**（`closeOnLastPageDown:true` が既定、trk134）をオフにすると、最後の画像の下端で止まって本・全画面を維持します（キーは処理済みにしてページ送りへ落とさない）。単ページ・見開きの画像端移動に適用。先頭でのPageUp・中クリック・直接ページ送りモード・縦読み・テキストには変更なし。保存値は `false` だけオフ、未保存・不正型は初期オン。押しっぱなしでは端で停止。`↑`／`↓` の拡大時スクロール、縦読み・テキスト・画面に収まる画像の従来動作は変更なし。
- 設定 **「PageUP、PageDownをページ動作にする」**（`pageKeysTurnPages:false` が既定）をオンにすると直接ページ送り。旧 `zoomEdgeKeys:false` は新設定 `true` として引き継ぎます（新設定の boolean があれば優先、文字列は boolean として扱わない）。保存先は従来どおり書斎専用 IndexedDB の `settings/ui`。アプリ全体の設定 Import/Export・リセットとは別の既存経路で、`?safe=1` では書斎を開かず保存領域を読みません。明示的に割り当てた「次へ／前へ」のキーは引き続き優先。

### 📜 書斎の自動スクロールと 🌗 読書用フィルタ（trk175〜176・PLAYER-ROADMAP #12〜#13）

- **📜 自動スクロール（trk175・ハンズフリー縦読み）**：**縦読み漫画モードだけ**＝台紙（`.study-image-stage`）そのものがスクロールする並べ方なので等速スクロールが成立します（一枚ずつ・見開きはページ送りモデルなので対象外。テキストの本はページ送りではないが ROADMAP #12 の「縦読みモード」の範囲に絞り、対象外）。開始はツールバーの **⏩ ボタン（`studyAutoScrollBtn`・対象のときだけ表示）か `A` キー**。実装は rAF の等速ループ（`studyAutoScrollFrame`）で、**端数（carry）を持ち越して整数 px だけ `stage.scrollTop` に足す**（小数の scrollTop 代入は環境で丸められて低速が止まり得るため）。**コマ間の時間差は最大100msに丸める**＝裏タブで rAF が止まっていても、復帰時に一気に飛ぶことはない（意図した仕様）。下端（`scrollTop + clientHeight >= scrollHeight - 1`）で自動停止し「最後のページに着きました」と案内する。速度は **20/45/75/120/180 px/秒の5候補だけ（既定75・`STUDY_AUTO_SCROLL_SPEEDS`）**＝自由入力は許さず（`studyAutoScrollSpeedValue` と `studyReadPrefs` の両方で検証）、**実行中の変更は次のコマからすぐ効く**（frame が毎回 prefs を読むため。止めて始め直す必要なし）。**停止のトリガー**：もう一度 `A`／⏩ ボタン、**pointerdown（タップ）**＝タッチのドラッグスクロールは必ず pointerdown が先に立つのでこれ一段で指操作を全部拾える、**wheel**（先に止めてから素のスクロールへゆずる。Ctrl+ホイールの拡大は停止後もそのまま続く）、**移動キー**（↑↓・Space・Enter・NumpadEnter・PageUp/PageDown・Home/End＋割り当ての次へ/前へ＝`STUDY_AUTO_SCROLL_STOP_CODES`）。**移動キーは「停止だけ」で元の動作をしない**＝縦読み中の Space 一発で1画面ぶん飛ぶのを防ぐ意図した仕様（ROADMAP の「タップ/キーで停止」の解釈をここに記録）。`B`（栞）・`M`・`T`・`F`・`?`・Ctrl+F などは止めずにそのまま動く。**静かな停止**（通知なし）＝並べ方を縦読み以外へ切り替え（`studySyncAutoScrollBtn` が対象外なら `studyAutoScrollHalt`・冪等）、別の本を開く（`studyRenderCurrentBook`）、本棚へ戻る（`studyBackToShelf`）、部屋のクローズ。手動停止でも通知しない＝スクロールが止まること自体が目印で、通知は開始／下端到達／縦読み以外での開始試行の3種だけ。**`KeyA` を `STUDY_RESERVED_KEYS` に追加**（次へ/前へに割り当て不可。`tools/check-study-room.mjs` のキー検査も KeyA を予約側へ更新済み）。ボタンは `aria-pressed` と `dataset.i18n`/`textContent` のラベル切替（⏩ 自動スクロール／⏸ 自動スクロール停止）、実行中はアンバー表示（`.study-auto-scroll-btn[aria-pressed="true"]`）。全画面（⛶）でも対象は変わらないので走り続ける。**表示だけの機能**＝栞・スクロール位置の復元・IndexedDB の本/設定（速度の保存を除く）に一切触れない。IntersectionObserver による見えているページだけの遅延読み込みとページ番号の追従は、自動スクロール中もそのまま働く（scroll イベント経由の `studyVerticalScroll` は passive のまま無変更）。
- **🌗 読書用フィルタ（trk176・明るさ/コントラスト/反転系）**：**読書面だけに CSS filter**＝`studyApplyReadFilter` が `#studyRoom` に CSS 変数 `--study-read-filter` を入れ、`.study-image-stage,.study-text-stage` だけが `filter:var(--study-read-filter,none)` で受ける。**本棚・ツールバー・メニュー・TVペイン・プレーヤーは変わらない**（意図＝操作系の見た目を変えず、読書面だけ調整する）。**全画面フィット（trk135）・拡大率とは独立**＝filter はステージ全体、拡大は中の寸法/transform なのでどの組み合わせでも干渉しない（ROADMAP #13 の要件どおり）。明るさ・コントラストは **50〜150%・刻み5のスライダー**（`studyReadFilterPercent` がクランプ、数値以外は100へ）、特殊フィルタは **なし／反転 `invert(1)`／グレースケール `grayscale(1)`／セピア `sepia(.8)`** の4候補（`STUDY_READ_SPECIALS`・セピアは強すぎない .8）。**初期値（100%/100%/なし）では "none" を入れる**＝フィルタ自体がかからず合成コストゼロ（`studyReadFilterCss` が最初に判定）。スライダーは **input＝見た目だけ（保存しない）／change＝保存** の2段＝ドラッグ中に毎コマ IndexedDB へ書かないため（意図）。% 値のラベル（`studyReadBrightnessValue`/`studyReadContrastValue`）は適用のたびに同期。テキストのスキン（和紙・古書・作文用紙など）や検索マークの色も読書面の一部なのでフィルタ込みで変わる＝意図どおり。選択は studyPrefs（書斎専用 IndexedDB の `settings/ui`）に残りリロード後も続く。壊れた保存値はクランプ／候補検証で既定へ戻る。
- **共通の意図**：どちらも**純粋に表示層**＝栞・位置・本・プレイ記録などの保存データを変えない（自動スクロールは check-repo 見張り＋テストで状態機を実動検証、フィルタは css 構築とクランプを vm で実動検証）。新しい UI 文言は4言語（TEXT 13＋8キー×4）。実機での確認は §4-27／§4-28 に登録済み。

### 🎥 基地・退出・全画面ジェスチャー（trk186〜189）

- 曲リストの📚書斎の隣の **🎥基地**をタップすると既存プレーヤーを開く（PC／スマホ共通、4言語）。TV電源の長押しも残す。
- 上部の **← 曲リストに戻る**で再生を止め、位置を保存して退出。ヘッダーはスクロール面の外に残す。Esc等は既存の退出確認設定を維持し、明示ボタンは従来どおり即退出。
- 全画面の映像エリアの左右長押しで加速シーク（左＝戻す、右＝進む）。再生倍率は変更せず、短タップは従来どおり。指離し・中断・曲切替・closeで止める。閾値・掃除の詳細は§7。
- **HEVC**：今回は対応を見送り。スマホで再生できたとの利用者報告あり。ただし端末／OS／ブラウザ差があるため一般化しない。形式検出・未復号フラグ・案内UI・ソフトデコーダー・変換は追加していない。

### ▶ メディアプレーヤー強化（trk164〜174・PLAYER-ROADMAP #1〜#11・#14〜#16）

台帳は [`PLAYER-ROADMAP.md`](PLAYER-ROADMAP.md)（#1〜#16 の状態と実装メモ）。**共通の意図**：「ふつうの視聴」の機能を、**外部送信なし・元ファイルへの書き込みなし・保存データの書き換えなし**（プライバシー方針：曲/データは端末から出ない、ファイルは読み取り専用）でそろえる。実機確認は §4-17〜§4-29。

- **trk164（#1〜#4）**：📌 PiP（対応実在チェックだけ・closeMedia で閉じる）、🔆 Wake Lock（**動画の再生中だけ**＝音声だけは消灯を妨げない・250ms監視＋visibilitychange復帰）、⏪ スマート巻き戻し（「続きから再生」の入口だけ N 秒戻す・一時停止からの再開では戻さない）、💤 スリープ強化（「この曲の終わり」＋分数モードは停止15秒前からフェードアウト）。
- **trk165（#5）**：📥 共有受け取り（share_target／file_handlers）。**必ず既存の検証経路へ合流**（曲→addSongFiles・動画→addVideoFiles・CBZ/ZIP→study.importArchives・パック→custom.installAndUse）＝新しい入口を作らない。ファイルのみ・URL/テキスト共有は取り込まない・外部送信なし。trk177で `share_target` inbox からの受信にはファイル名・件数を示す事前確認を追加（他サイトからもフォームで送れるため）。拒否時も一時 inbox は消して取り込まず、OSの `launchQueue`（明示的な「このアプリで開く」）は二重確認しない。受信名は制御文字・双方向制御文字を除去し80文字に制限。iOS は Capacitor ビルド側の別対応（docs に注記）。
- **trk166（#6）**：🎤 歌詞（USLT/SYLT/©lyr/Vorbis＋.lrc・拡張LRC・offset）。優先順＝手動選択→フォルダの同名.lrc→埋め込み。読み取り専用。
- **trk167（#7）**：🏷 埋め込みタグの**表示**（ID3v2.2/2.3/2.4・MP4・FLAC/Ogg/Opus）。表示名の優先順「ユーザー設定名→タグ→カタログ曲名→ファイル名」。**カタログ照合はファイル名のまま＝タグは照合に関与しない**。書き戻し経路なし（タグ編集は範囲外）。
- **trk168（#8）**：🔊 音量の平準化（材料は REPLAYGAIN タグ→解析のゲート付きRMS loudness の優先順・−18〜+9dB クランプ＋ピークガード・通り道に常設の G.norm）。初期オフ・端末内計算のみ。
- **trk177レビュー補修（trk168）**：`applyNorm()` は `window.Trk.core` をローカルな `core` に束縛し、core が無い場合は安全に戻るようにした。以前は未束縛の `core` を参照して `ReferenceError` になり、平準化更新時に止まる可能性があった。core を使うJSファイル全体の束縛を回帰テストで見張る。
- **trk169（#9）**：💬 字幕（SRT/VTT 外部ファイル・遅延調整）。**表示は DOM オーバーレイ**＝映像を canvas に描くため `<track>` は画面に出ない。📌 PiP だけは WebVTT 変換の `<track>` を併設（遅延を焼き込み）。逆再生中は非表示。
- **trk170（#10）**：🔖 M4B チャプター（Nero `chpl` を自前パース・100ns 時刻・moov/udta 再帰）。一覧ジャンプ・⏮/⏭・💤「チャプターの終わりで止める」。iTunes 方式（tx3g＋stbl）は非対応＝需要が確認できたら別建て。
- **trk171（#16）**：💿 アルバム／🎤 アーティスト棚（sticky グループ見出し・トラック番号順・タグなしの棚・300曲までの先読み）。表示だけ。
- **trk172（#11）**：⚡ スマート棚（🕒最近再生／🔥よく再生／➕最近追加・各50曲）。メディアプレーヤー再生は PLAYED.media に別建て計数（30秒/半分ルール）。証明（plProof）は auto/manual のまま不変。
- **trk173（#14）**：🌊 波形シークバー（解析キャッシュの rms 包絡を pointer-events:none の canvas で range の上に重ねる・再生済みアンバー/未再生水色・ホバーで時刻の吹き出し）。**ホバーサムネイル（動画フレーム）は見送り**＝別デコード経路が必要（ROADMAP に注記）。
- **trk174（#15）**：📈 進捗フィルター（すべて／未聴／継続中／完了・`settings.libProgress`）。継続＝位置記憶（曲キー or `songPrefs.keyFp` の指紋）。**完了は再生回数で判定**＝位置記憶は最後まで聴くと消える設計のため（PLAYED manual/auto/media・records plays。当初メモ「位置記憶＋duration で算出」からの**意図した変更**）。**表示層だけ**＝library.js が位置記憶へ setItem したら check-repo が失敗する見張り付き。
- **残りは安定版プレーヤー完成後の gapless＋crossfade（利用者判断 2026-10-15）と、範囲外項目の記録のみ**（CBR/RAR・PDF/EPUB・scrobble・cloud・タグ編集・Android Auto）。

### 維持中の既存機能

- **🎼 譜面生成方式の既定は Bタイプ（方式4）（trk216）**：`settings.chartGen` の既定を `"3"`（Aタイプ）から **`"4"`（Bタイプ）** へ。1.1.4 までは、どの設定を保存しても `chartGen: "3"` がまとめて保存されるため、**既定を変えるだけでは既存の利用者が B にならない**。そこで **`settings.chartGenChosen`**（設定のセレクトで選んだら true）を足し、**印がある人だけその値を尊重**する（インポート・バックアップにも載る）。工場出荷（`resetAllPrefs`）は B＋印なし。Aタイプ（方式3）・旧方式1／2は今までどおり選べる。
- **🎓 trk's OST Vol.1（`trk-ost-v1`）**：🐔 trk's playlist の Game Vol.1 直下。**trk185 から音源5曲（SUNRISE DASH・POPCORN SMILE・MOONLIT LULLABY・CRIMSON BLAZE・ボーナス NEON DIVE）は同梱をやめ、別リポジトリ music-library の `.stpack`（CC BY 4.0）で別配布**。FIRST SPARK のデモは同梱のまま残す。プレイリストには別配布の案内（`plGuideTrkOst`・4言語・music-library Releases へのリンク）を持ち、公式パック（名前 `trk's OST Vol.1`／作者 `TRMTKB` から算出するパックID）を入れた利用者には `syncTrkOstPackSongs` が曲キー `pack:<ID>/s01〜s05` を未見だけ足す（`trkOstSeenKeys` 共用・利用者が外した曲は戻さない・外部通信なし）。trk189で旧同梱キーだけを一回掃除（`trkOstLegacyClean1`）、見た曲の印は起動時にも読み戻します。同梱経路は `TRK_OST_MANIFEST_INCLUDED=false` の印で manifest を取りに行かない（同梱ビルドだけ true）。手続き生成曲は別の **trk Agent's OST Vol.1（`trk-agent-ost-v1`）** にmanifest経由で接続済み（下記）。trk112が最上位に作った本棚だけを一度trkフォルダへ移し（印は `cat: "trk:ost"`）、以後は利用者が動かした場所を守ります。
- **🎼 手続き作曲ツール／任意のAgent OST（trk113・trk149〜151）**：`node tools/make-trk-ost.mjs` で5ルール×2曲＝10曲のWAVスケッチと `assets/trk-ost/manifest.json` を生成（外部ライブラリなし・決定的）。アプリ側にはmanifest読込み・専用リスト作成・選択時の音源読込みを実装済みです。ただし音源とmanifestは `.gitignore` 対象で、公開リポジトリには入っていません。既定コードの `AGENT_OST_MANIFEST_INCLUDED=false` は任意資産をfetchしない印です。音源を意図的に含める配布／試験ビルドだけ true にし、生成したmanifest・WAVと一緒に配布します。10曲の実聴取・品質評価は未確認（§4-6）。
- **🎵 OSTオリジナル曲の作曲パイプライン（trk179〜）**：`tools/ost-scores/<key>.json` に作曲（テンポ・形式・コード・全メロディ・編曲）→ `node tools/make-trk-song.mjs` で決定論的チップシンセ描画（WAVはGit外）＋ABC譜を生成 → `node tools/encode-ost-mp3.mjs` でMP3化 → **trk185 からは同梱せず music-library の `.stpack` で配布**（スコアは本Repo `tools/ost-scores/` と music-library `scores/` の両方に残す。全スコアが描画できることが check-repo／ost-render の検査条件）。1曲目は SUNRISE DASH（150 BPM・32小節・intro-A-B-サビ-outro＋終止・約53秒・823 KiB）。2曲目は POPCORN SMILE（128 BPM・Gメジャー・三角波リード・約61秒・960 KiB）。調は C/G/F 長調（ABC の臨時記号と下方3度は調に従う）、リード音色は pulse/tri/square/saw から選べる（trk180）。3曲目は MOONLIT LULLABY（92 BPM・Fメジャー・約84秒・1.29 MiB）。静かな曲用に `leadVib`・`bassStyle`（soft）・`bassWave`・`arpRate`（8）・`padWave`・ドラム `soft`／`lullaby`・リード `sine` を追加（trk181）。4曲目は CRIMSON BLAZE（160 BPM・Aマイナー響き・約49秒・770 KiB）。ドラム `blaze`（16分ハット＋強フィル）を追加（trk182）。短調は調号Cのまま Am 中心進行＋終止 A で書く（ハモリ適用のサビはダイアトニック限定）。ボーナスは NEON DIVE（240 BPM・Dメジャー・56小節2番形式・約57秒・892 KiB）。BPM上限260・Dメジャー・ドラム `vocaloid`（ハーフタイム＋16分ハット）・メロディ16分 grid・最終スタブのテンポ追従を追加（trk183）。YuE2 本体はこの環境で動かない（GPU＋HuggingFace要）ため自前パイプラインとし、ABC は将来 YuE2 の `abc=` へ渡せる形。
- **消した自動リストは作り直さない（trk114）**：trk!が自動で作るリスト（IDが `trk-` で始まる Game Vol.1・Classic Vol.1・trk's OST Vol.1・Agent's OST Vol.1・カタログの各リスト）を消すと、`settings.trkRemoved` に印が残り、次の起動で作り直しません。設定「🐔 trk's playlist」の **♻ 消したtrkのリストを戻す（n件）**で印を外して作り直します（Game Vol.1／Classic Vol.1の「開く」ボタンもその1件の印を外す）。印は `trk-` で始まるIDだけ・200件までに検証し、全リセットで空に戻ります。
- **入手先ガイドは表示言語で出す（trk114）**：公式カタログ由来のガイドは辞書キー（`plGuide…`）と日本語の控えを保存し、表示時に今の言語で引きます（LoL・Endfield・ブルアカ・学マス・Game／Classic Vol.1など21キー×4言語）。既存の保存データは起動時に自動で鍵が付きます。カタログ本体の各シリーズ説明文（`js/catalog.js` の `note`）はまだ日本語だけです。
- **小さなアクセント文字の色（trk114）**：`--ui-accent-ink`（`js/data.js` の `accentInk`、`applySkin` が毎回設定）。設定画面の入れ子の欄（カード＋パネル＋小欄の重なり）でも4.5:1になるまで、アクセントを本文の色へ5%ずつ寄せます。足りているスキンは元の色のまま。44スキン中16スキンで色が少し変わりました（スキンの棚の見出し、リンク、記録表の選択行など13ルール＋fx.jsのリンク1箇所）。
- **曲名バナーの操作（trk73・trk126）**：バナーの**右端に [◀][🎲][▶]**（前後の曲・おまかせ。🎲 は既定で長押し650ms、設定で「タップだけ」「非表示」を選べる）、**右下に [⏯][🔊]**（同じ大きさのアイコンだけのボタンを並べた `.bannerMediaBar`）。🔊 は短押しでスライダー・長押しでミュート／復元。**⏯ は選曲中にプレビューの音を止める／鳴らす**（止めたところから鳴り直す）、曲の再生中・一時停止中はゲームの一時停止／再開（プレイ中は選曲画面ごと隠れるので、ふだん見えるのは選曲中）。**曲名に触れて曲を選び直すと一時停止は解除されて鳴り直す**（止まったままにならない）。設定などへ行って選曲画面に戻ったときも、プレビューは開始位置から鳴り直します（`library.js` の `screen` → `startPreview`）。**これは意図どおり**（2026-10-12のレビューで確認）：一時停止は「いまだけ止める」もので、次に曲を選ぶのは音を鳴らしたいという判断のため。止めた状態を保つ仕様ではありません（「ユーザーが止めた」フラグは持たせない）。止める音がないとき（曲未選択・プレビューオフ）は押せない状態で、ボタンの説明（ホバー・読み上げ）が理由を出します（trk127：曲を選ぶ／プレビューをオンにする／その他。`bannerPlayTipKey`）。設定「右上の曲名をタップで一時停止／再生」（初期オフ）はバナー全体のタップとして別に残ります。
- **タブの挙動（trk112）**：チュートリアルのデモ曲は独立タブ（🎓デモ曲）をやめ、上記 trk's OST Vol.1 にまとめました。開いたタブは libOpenTabs で残り、削除はタブの ⚙（長押し）設定から（曲はライブラリに残る）。**フォルダ内のプレイリストを開いたタブは閉じるまで残る**のが既定になり、フォルダ内タブの中クリックは「タブを閉じる」（本体は残す）に変更しました。
- **📁 プレイリストフォルダの上限は40（trk129）**：`PL_FOLDER_MAX`（`js/library.js`）と `js/core.js` の読み込み上限（`slice(0, 40)`）が対です。trk の固定棚（🐔・Classic・BA・LoL・東方・Touhou関連・Arknights・学マス・Endfield・🎭）で10個使うので、利用者のぶんを十分に残します。**作るときに上限を確かめ**、いっぱいならトースト（`plFolderLimit`・4言語・`{n}`）で知らせて作りません（カタログ取り込みでは入りきらないリストをフォルダなし＝トップへ置きます）。上限を超えた配列は `plFolderTrim` が trk の固定棚を先に残して利用者のフォルダを後ろから落とします（trk128 の上限13では、利用者のフォルダが4個以上あると 🎭棚が起動のたびに切り捨てられ、キャラクターテーマ4リストがトップへ落ちていました）。
- **記録とゴーストのキーは MOD に依存しない（trk129）**：`chartKeyOf` は MIRROR／RANDOM を掛ける**前**のレーン（`resetRun` が残す `origLane`）で作ります。掛けた後で作っていたため、同じ譜面でも MOD の有無で記録の行が分かれ、ゴースト（`beforePlay` でキーを引くので `resetRun` の前）は MOD を変えた直後に出ませんでした。MOD 無しの既存の記録のキーは変わりません（MIRROR を掛けた古い記録は行が分かれたまま残ります＝戻しません。レビュー第4弾に「左右反転したキーも引けばMIRRORの分だけ救える」との提案がありましたが、RANDOMの分は救えず数も少ないため、**2026-10-13 利用者の判断で救わない**）。MOD ごとにベストを分けたくなったら速度別（`slot.rates[rateKey()]`）と同じように入れ物側で分けます（**2026-10-13 利用者確認済み：この方針で確定**）。**譜面の書き出しも同じ考え方（trk132）**：`chartToData`（`js/media.js`）は `n.origLane ?? n.lane` を書き、一時停止画面・結果画面からの書き出し（`exportChart`）と曲パック（`custom.js` の `buildSongPack`）に MOD 後の譜面が入りません。
- **↕（並べ替え）は「いま見えている並び」で動く（trk130）**：`trkMovePlaylist(id, dir, peers)` は `peers`（その画面で隣に並ぶプレイリストのID＝表示順）の中だけで隣と入れ替え、`playlistOrder` は trk の表示順を全部書き出した形に組み直します。**消えたプレイリストのIDはここで落とします**（旧版は `playlistOrder` に残った削除済みIDと入れ替えて、押しても画面が変わらないことがありました）。端と🔤ABC順では `trkMoveButtonsState` が↑↓を押せなくします（3つの一覧＝🐔の階層メニュー・フォルダ設定・🐔の設定画面すべてが `peers` を渡し、フォルダ設定は並べ替え後に開き直します）。
- **📥共有プレイリストの取り込みは読み込み前の4MiB上限（trk130・F-34）**：`PLAYLIST_IMPORT_MAX`（`js/library.js`）を `f.text()` の前に判定し、超えていれば4言語の `plImportTooBig` で案内して読まない（曲数1000などの上限は解析の後にしか効かないため）。
- **共有プレイリストの曲名照合は「一意なゆるい一致」だけを採る（trk130）**：`plMatchByTitle` は①曲名の完全一致（大きさ優先）→②表記ゆれ（`plTitleKeys`／`plSongMatchKeys`。区切り・拡張子・先頭のトラック番号まで外す）の順で探しますが、②は**候補が1曲に絞れて、共有側に大きさがあれば大きさも合うときだけ**採ります（「01 intro」と「03 intro」を同じ曲にしないため。索引 `plMatchIndex` は曲リストごとに1回だけ作り、捨てられれば消える `WeakMap`）。
- **📦パックを外したら、パックが変えた設定を戻す（trk130）**：パックが変える項目（スキン・ノーツの色/形・エフェクトの強さ・SEのオン）は、当てる前に `settings.packPrev`（**設定として保存**。`prev`＝当てる前の値、`applied`＝パックが当てた値）へ退避し、**外したときに、利用者がその間に自分で変えていない項目だけ**戻します（変更していればその値が正）。パックを当てたまま再起動してから外しても戻り、A→Bの切り替えでは最初の退避を保ちます（**2026-10-13 利用者確認済み：この実装で確定**）。ただし**Aを使っている間に自分で変えた項目は、切り替えの直前に `packRebase` が「戻る先」（`prev`）へ取り込み、`applied` から外します**（触っていない項目は最初の退避のまま。trk132）。**スキンを持つパックAから、スキンを持たないパックBへ切り替えたとき**は、Aのスキンを消すときに退避したスキン（`prev.skin`。無ければ `shadow`）へ移り、`applied.skin` を外します（旧版は `shadow` へ移るため、Bを外しても元へ戻りませんでした。trk132）。古い版で当てたままのパックには `applied` だけ控えます（無い場合はスキンを既定へ戻す従来の控え）。
- **パック切り替え中のSEは上書きしない（trk130）**：`deactivatePack` は自分のSE（`seFiles`）を読み直しません（`persist=true`＝本当に外すときだけ戻し、パックが読み込んだ音との競合を避けます）。音を持つパックから音を持たないパックへ切り替えたときは、新しいパックの読み込み後に自分のSEへ戻します。
- MMD内蔵モーションは**65種をすべて選択可能**。日常・休憩／ダンス・ステージ／ミク曲テンポ／ミク定番ポーズ／表情・演技／🎤 歌・口パクの6グループ。Latの表情モーフを含み、新規・リセット時の既定は `faceSing`。VMDはコードで生成し、第三者の振付データは同梱しません。

## 3. 維持するデータ・安全条件

- ローカル曲、画像、文章、元ファイルは読み取り専用。入力フォルダの作成・移動・削除・上書き、音源のアップロードや永続保存はしません。音声変換や解析は端末内で行います。
- 公式リンク、購入、サブスクリプション、カタログ掲載だけを再配布・二次利用許諾の根拠にしません。許諾が未確認のものは未確認と表示します。
- Touhouのタイトル索引・MIDI演奏機能と、Touhouゲームの音源・実サンプル・抽出データを混同しないこと。実サンプルを追加する場合は、ファイル単位の権利根拠と再頒布許諾を確認するまで同梱しません。
- Import時は既知キー・型・enumを代入前に検証し、拒否した設定と理由を表示します。MIDIプロフィールIDも実在一覧に対して検証します。
- 新規UI文言は日本語・英語・中国語・韓国語をそろえます。中国語・韓国語を母語話者が確認したとは限りません。

## 4. 未完了の確認

一覧（状態は 2026-10-27 時点）。詳細は下の「4.1 詳細」にあります。既存項目の番号は維持しています。

| # | 項目 | 状態 | 次の一手 |
|---|---|---|---|
| 1 | MIDI／MIXの実ブラウザ・実音声確認（PC・Android） | 自動テスト済み・実音声は未確認 | 実音声で聴く。trk114 の処理量の上限を実際のMIDIで確かめる |
| 2 | カタログ名表示（優先順と元ファイル名の保存） | 未確認 | 実ライブラリで確認 |
| 3 | 音源ジャケット（trk101〜106） | 一覧のサムネイルは利用者確認済み（2026-10-09）。ほかは未確認 | 選択中バナー・TV・書斎・譜面中の配置を実曲で確認 |
| 4 | LoL外部ページ（Season 4〜9 の SoundCloud セット、人気曲リンク） | 未確認 | 実ブラウザで再確認、LoL台帳を更新 |
| 5 | Endfield配信リンク（Spotify個別曲・ffm.to・網易云） | 一部未確認（バッチ2の残り75曲のIDなど） | 実ブラウザで確認、エンドフィールド台帳を更新 |
| 6 | 🎼 手続き生成10曲の聴取（trk113） | manifest経由のアプリ連携は実装済み。10曲の実聴取・品質評価は未確認 | `assets/trk-ost/index.html` で聴く。任意音源ビルドでは専用リスト・選曲再生も確認 |
| 7 | Android Chrome／PCの Service Worker、MMD／VRM、IndexedDB | オフライン動作は利用者確認済み（2026-10-14）。safe・MMD／VRM・IndexedDBは未確認 | 残る項目を実機で確認 |
| 8 | trk114 の画面（自動リストの復元、入手先ガイド、16スキンの色） | ヘッドレスで一部確認 | 実機で確認 |
| 9 | 書斎の設定と画像キー（trk133〜135） | ヘッドレスで確認、実機は未確認 | 全画面フィット、上部の設定入口、拡大の送り幅を実機で |
| 10 | Riot系カタログ（trk116〜118） | ヘッドレスで取り込みとガイドを確認、実機は未確認 | 実機で確認、Spotify リンクを数件開く |
| 11 | 入口まわり（📚書斎ボタン・⏯再生ボタン、trk125・126） | **2026-10-12 に実機で動作確認済み** | 押しやすさ（大きさ・位置）だけ引き続き見る。再発時は端末・押し方を聞く |
| 12 | trk129〜132 の確認（↕並べ替え、パック外し、共有プレイリスト、MIRROR、Endfield、フォルダ上限40、🎭棚の戻し、パックとスキン、MOD後の書き出し） | 実機未確認（自動検査のみ。⑧⑨はヘッドレス17項目で確認） | 見てほしい順（①〜⑨）で実機確認 |
| 13 | trk136（全画面フィットの PageDown 長押し、💾端末の保存） | 実機未確認 | PC・Android で確認 |
| 14 | 曲名照合・ミカ音源／映像（trk155〜159） | Node/VM・合成WAVのヘッドレス検査済み。実曲・実動画・実機は未確認 | 実ファイルで照合・再生、配信ページの地域差を確認（購入・抽出を自動実行しない） |
| 15 | ZIP作り手の互換性（trk163：Info-ZIP標準入力出力の受理、`flags`完全一致） | 実Info-ZIP 3.0出力（store・deflate・パイプ）とレビューでのPython zipfileはNode検査済み。Windowsのエクスプローラー／macOSの圧縮／スマホアプリのCBZは実機未確認 | 各で作ったCBZを実機で一度ずつ書斎に取り込んでみる。読めないCBZが出たら `flags` の食い違いを疑い、緩めるなら暗号化ビット（bit0）＋圧縮方式だけの比較にする（現時点では緩めていない） |
| 16 | ▶ メディアプレーヤーの新機能（trk164：📌画中画・🔆Wake Lock・⏪スマート巻き戻し・💤スリープのフェードアウト＋この曲の終わり） | 純関数の決定（巻き戻しの計算・フェード計画・endedMediaの優先順・タイマーの掃除）はNode/VM検査済み。実機挙動は未確認 | Android Chrome／PCで📌画中画の継続と復帰、🔆動画再生中に画面が消えないこと（音声だけ・タブ裏では消えること）、⏪続き再生の戻し幅が実際的な不快感にならないか、💤フェード後に音量が戻った状態で次の再生が始まるかを確認。iOSはPiP／Wake Lockの対応差（SafariのPiPはvideo要素のみ可など）を見て非対応時のボタン無効＋案内が出ればよい |
| 17 | 📥 OSの共有／「このアプリで開く」（trk165／trk177レビュー：share_target＋file_handlers） | 振り分け・SWの一時保存・manifest・事前確認／拒否時の削除はNode/VM検査済み。**インストール済みPWAが前提**なので実機は未確認 | Android Chromeで共有シート→trk!（曲・動画・CBZ/ZIP・.stpack・pack.json入りZIP）を確認し、ファイル名・件数の確認が出ること、キャンセルすると何も取り込まず一時 inbox から消えることを確認。デスクトップの「このアプリで開く」は確認が重ならないこと。非対応形式の案内、複数ファイル、容量超過時の案内（?shared=partial/error）、アプリ更新をまたいで受け取りが残ること（inboxはactivateの掃除から除外）も。iOS Safariは非対応＝何も出ないのが仕様 |
| 18 | 🎤 歌詞（trk166：LRC同期歌詞＋埋め込み歌詞 USLT/SYLT/©lyr/LYRICS） | LRCパーサ・合成バイナリからの埋め込み歌詞読取・優先順（手動→フォルダ.lrc→埋め込み）はNode/VM検査済み。実音源での確認は未了 | 手持ちの実ファイルで: ①歌詞タグ入り mp3/m4a/flac/ogg で 🎤 パネルに出典「埋め込みタグ」と出るか（USLT と SYLT、UTF-16 タグ含む）②フォルダ共有で同名 .lrc を置いた曲が同期するか ③「📄 歌詞ファイルを選ぶ」で選んだ .lrc/.txt が曲ごとに保存され、再起動後も残るか ④行クリックのシーク、ハイライト追従、スクロールの見た目 ⑤時刻なし歌詞の素の表示 |
| 19 | 🏷 埋め込みテキストタグの表示（trk167：TIT2/TPE1/TALB/TPE2/TRCK/TCON・©nam/©ART/©alb/aART/trkn/©gen・Vorbis TITLE/ARTIST/ALBUM/…） | 合成バイナリからの読取・表示名の優先順（ユーザー設定名→タグ→カタログ曲名→ファイル名）・照合の分離はNode/VM検査済み。実音源での確認は未了 | タグ付きの mp3/m4a/flac/ogg で: 曲リストの曲名・サブ行（アーティスト・アルバム）、検索、名前順ソート、選曲バナー、メディアプレーヤー（キュー・ヘッダ・ロック画面表示）にタグが出ること。🎶 プロフィールの設定名がタグより優先、タグなしは従来のファイル名のまま。**カタログ照合（灰色行→黒行）はファイル名側のまま**＝タグとファイル名が食い違うファイルでも自動追加が壊れないことの確認も |
| 20 | 🔊 音量の平準化（trk168：ReplayGainタグ優先→解析 loudness、G.norm ゲインで適用） | 合成音声での loudness/peak 計算・normPlan のクランプ／ピークガード・タグ読み取り（TXXX/Vorbis/MP4 freeform）はNode/VM検査済み。実音源・実機での確認は未了 | 音量差のある手持ちの曲で: ①設定「🎛 サウンドエフェクト」→「曲ごとの音量をそろえる」をオンにして、曲を変えたときに音量の体感差が縮まるか ②ReplayGain タグ付きファイルで状態行に「タグ」と出るか（無ければ「解析」）③大きい曲で音割れしないか（ピークガード）④エフェクトがオフでも効くか ⑤解析なしの巨大ファイル・動画は素通しか ⑥ロック画面やバックグラウンド再生でも音量が安定しているか |
| 21 | 💬 字幕（trk169：SRT/VTT・フォルダ相乗り＋手動選択・遅延調整・オーバーレイ表示＋PiP用トラック） | SRT/VTT パース（CRLF・NOTE/STYLE・短縮時刻・装飾掃除）・保存/追い出し・優先順・PiPトラックの付け外しはNode/VM検査済み。実動画・実機での確認は未了 | 手持ちの動画＋同名 .srt/.vtt で: ①フォルダ共有（📤）で動画を拾ったとき、メディアプレーヤーの映像に字幕が出るか ②「📄 字幕ファイルを選ぶ」で選んだ字幕が曲ごとに保存され、リロード後も残るか ③「遅延」の −/＋/↺ が効き、PiP の字幕も同じだけずれるか ④🖥 動画の全画面表示でも字幕が出るか ⑤「字幕を表示する」をオフにすると消えるか ⑥音声だけの曲ではパネル自体が出ないか ⑦文字化け（UTF-8 以外の SRT）を見たら符号化を控えておいてほしい |
| 22 | 🔖 M4Bチャプター（trk170：chpl(Nero) 読み・一覧ジャンプ・⏮/⏭・💤「チャプターの終わりで止める」） | chpl パース（version 0/1・100ns時刻・空名・255個/24h上限・moov/udta 再帰）・MEDIA_EXT の m4b・プレーヤー配線はNode/VM検査済み。実 M4B ファイル・実機での確認は未了 | 手持ちの M4B（オーディオブック）で: ①「🔖 チャプター」パネルが出て、章名・時刻が実際のチャプターと一致するか ②クリックで正しく飛ぶか ③再生中の章のハイライトが付いてくるか ④⏮/⏭ の操作感（⏮ は今の章の3秒超なら先頭へ）は想定通りか ⑤💤「チャプターの終わりで止める」が次の章の境界で止まるか ⑥QuickTime でチャプターが見える M4B で「チャプターがありません」になるものがあれば、それは iTunes 方式チャプタートラック（既知の非対応）なのでファイル名を控えておいてほしい |
| 23 | 💿🎤 アルバム／アーティストのグループ表示＋トラック番号順（trk171：棚の追加・見出し行・タグ先読みとデバウンス並べ直し） | 並び替え部品（グループ順・トラック番号順・fallback）とタグ先読み／デバウンスはNode/VM検査済み。実ライブラリ・実機での確認は未了 | 手持ちのタグつき音源で: ①💿／🎤 の棚はアルバム名／アーティスト名を持つ曲があるときだけ出るか ②アルバム内はトラック番号順（10 が 2 の後）で、番号なしは後ろか ③「タグなし」グループは最後か ④棚を開くと「🏷 タグを読み込み中…」の後、自動で並べ直されるか（手動リロード不要） ⑤見出しはスクロール中に上端に張りつくか ⑥検索・並べ替えチップ（曲名順/再生数…）と組み合わせてもおかしくないか |
| 24 | ⚡ スマート棚（trk172：🕒最近再生／🔥よく再生／➕最近追加・メディアプレーヤー再生の別建て計数 PLAYED.media） | セクションの並び（新しい順・回数順・追加順）、30秒/半分ルール、1曲1回だけ計数、リピート/開き直しで数え直し、証明（plProof）が media を知らないこと、addedAt の引き回しはNode/VM検査済み。実機での確認は未了 | ①再生履歴か追加日時があれば ⚡ タブが出て、材料が無ければ出ないか ②メディアプレーヤーで30秒（短い曲は半分）超えたら 🕒/🔥 に入るか（すぐのスキップは入らないか） ③🎮 ゲームのプレイも従来どおり 🕒/🔥 に載るか ④プレーヤー再生だけの曲に、共有プレイリストの ▶AUTO 印が**付かない**か ⑤📄追加した曲／💾端末に残した共有の曲が ➕最近追加 に新しい順で並び、再起動後も残るか（フォルダの曲は日時を持たないので対象外） ⑥同じ曲が2セクションに出たとき、TV ◀▶ は1曲ずつ進むか |
| 25 | 🌊 波形シークバー（trk173：解析 rms 包絡の重ね描き・ホバー時刻吹き出し・設定トグル） | 包絡計算（列ごとの最大・正規化・ガンマ）・描画の分岐（解析なし/準備前/設定オフは隠す）・再生位置の塗り分けはNode/VM検査済み。実機での見た目の確認は未了 | ①ふつうの曲でシークバーに波形が出て、再生済み部分がアンバー色に塗り分けられるか ②ホバー（スマホはドラッグ）で時刻の吹き出しが出るか ③長い曲・🪶軽量化・大きなファイル（解析スキップ）ではふつうのバーのままでエラーにならないか ④設定「🌊 波形シークバー」オフで消え、リロード後もオフのままか ⑤ダイアログの幅変え・端末回転で波形がついてくるか ⑥波形がネイティブのつまみ・トラックの見やすさを妨げていないか（濃すぎたら教えてください） |
| 26 | 📈 進捗フィルター（trk174：すべて／未聴／継続中／完了・表示層だけ） | 判定（位置記憶→曲キー/指紋・PLAYED の manual/auto/media・records の plays）・壊れた保存でも投げないこと・配線はNode/VM検査済み。実機での確認は未了 | ①曲を途中まで聴いて「継続中」にだけ出るか ②最後まで聴いた曲が「完了」に出るか（位置記憶は終わると消えるので回数で判定する設計） ③何もしていない曲が「未聴」か ④検索・タブ・💿🎤⚡ 棚と組み合わせても絞られるか ⑤🎮 ゲームのプレイだけ／🎧 プレーヤーだけの曲も「完了」になるか ⑥選択がリロード後も残るか |
| 27 | 📜 書斎の自動スクロール（trk175：縦読みモード・等速・ハンズフリー） | 状態機（開始条件・等速＋端数・下端停止・停止/トグル・速度の生きた変更）と配線（Aキー・タップ・ホイール・ボタン・設定・4言語）はNode/VM検査済み。実機での確認は未了 | ①縦読み漫画モードだけ ⏩ ボタンが出て、ボタン/A で等速で下へ進むか ②タップ・ホイール・移動キー（↑↓/Space/PageUp・PageDown/Home・End/割り当ての次へ・前へ）で一回で止まるか ③下端で自動停止して案内が出るか ④速度5段階（20/45/75/120/180 px/秒）が実行中でもすぐ効き、選択が残るか ⑤全画面で続き、モード変更・本を閉じる・書斎を閉じるで静かに止まるか ⑥スクロール中もページの遅延読み込みとページ数の追従が正常か |
| 28 | 🌗 読書用フィルタ（trk176：明るさ/コントラスト/反転系・読書面だけ） | css 構築（初期値は "none"）・クランプ（50〜150）・読み込み検証・配線はNode/VM検査済み。実機での確認は未了 | ①⚙ 設定のスライダー2本と特殊フィルタ（なし/反転/グレースケール/セピア）が出るか ②ドラッグ中にすぐ見た目に効き、離すと保存されるか ③画像と文章の読書面だけ変わり、本棚・メニュー・TVペインは変わらないか ④全画面フィットや拡大率と独立して併用できるか ⑤初期値に戻すと "none"（フィルタなし）になるか ⑥選択がリロード後も続くか |
| 29 | trk177レビュー回帰（core束縛・音量平準化・バックアップのアドオン・受信確認） | 関連Node/VMテストとSecurity検査で確認済み。実ブラウザ・実機は未確認 | ①ReplayGainタグ付き曲で平準化オン、タグ由来の補正が効き例外が出ないこと（PC・Android） ②タグ無しの曲で端末内解析由来の補正が効き例外が出ないこと ③アドオン入りバックアップの確認で件数・名前・無効化の説明が見え、復元後は全部オフで手動有効化まで動かないこと ④手動歌詞・字幕・字幕遅延を含むバックアップの復元 ⑤インストール済みPWAの共有を承認し、名前・件数を確かめた後に既存経路へ入ること ⑥共有を拒否した場合は何も取り込まずinboxから消え、デスクトップの明示的な「このアプリで開く」は確認が重ならないこと（詳細は #17） |
| 30 | trk186〜189：🎥基地・退出・左右長押し・旧OSTキー移行 | Node/VM＋共通smoke2件は成功。今回の実機操作は未確認 | PC／スマホ縦横・4言語で基地入口、戻るボタンの常時表示、下部スクロール、左右長押しと離した後の停止・短タップ・中断を確認。旧版データからの移行と、外したパック曲が再起動後も戻らないことも確認 |
| 31 | trk195：🎞 `.mkv`/`.mpg` の取込と「再生できない理由」 | 合成した先頭バイトでのVM検査と `npm run check`（565 pass）は成功。実ファイルでの確認は未了 | ①H.264＋AAC の MKV が Chrome で選曲→メディアプレーヤーまで通ること ②MPEG-2/AC3 の MKV で理由（コーデック名）が出ること ③`.mpg` で「MPEG-PS は再生できない＋MP4 に変換」が出ること ④フォルダー取込に `.mkv`/`.mpg` が 🎬 付きで並ぶこと（PC・Android） |
| 32 | trk196：🎞 形式まわりの仕上げ（理由の表示・拡張子・⚠・説明） | Node/VM と `npm run check` は成功。実ファイル・実機は未了 | ①`.m2ts`/`.avi` が一覧に出て ⚠ が付くこと ②メディアプレーヤーを開いたときにも理由が出ること ③設定「📖 再生できる形式」が4言語で読めること（PC・Android） |
| 33 | trk197・trk198：🔓 拒否時の案内／🔍 設定の検索 | Node/VM（偽のDOM）で確認済み。実機は未了 | ①サイト設定で許可を切って起動→設定に理由が出るか ②検索で欄が絞られ、空にすると元の開閉に戻るか ③スマホの狭い画面で検索欄と件数が崩れないか |
| 34 | trk199：1.0.7 レビューの修正版（一覧が空になる不具合・選び直し・タッチの許可確認） | Node/VM（偽のDOM・偽の navigator）で確認済み。**タッチの `requestPermission` は実機で未確認** | ①曲を1つも選ばずにリロードして一覧が出るか（以前は真っ白） ②📄 参照の行を押すと選び直しが開くか ③動画の参照を選び直すと 🎬（動画）のままか ④選び直したあとリロードしても 📄 参照が残る（消えない）か ⑤スマホで最初のタップ→「許可」の確認が出て曲が出るか（「拒否」と誤表示しないか） ⑥PC のマウス・キーでも従来どおりか |
| 35 | trk200：🔊 `.mkv` の音が出ない理由（AC3/DTS/TrueHD） | 合成 MKV の CodecID で Node/VM 検査済み。実ファイル・実機は未了 | ①AC3 の MKV を選曲→状態行とトーストに「この音声は鳴りません＋MP4 に変換」が出るか ②H.264＋AAC の MKV では出ないこと ③再生中に「読み込めません」と出ない（停止中だけ理由を出す）こと ④4言語で読めること |
| 36 | trk201：🗂 フォルダー参照の保存停止と一度だけの掃除 | VM の偽 IndexedDB で確認済み。実機は未了 | ①3000曲のフォルダーで起動が軽くなったか ②追加した曲・動画の 📄 参照はこれまでどおり残るか ③1.0.7 から上げたとき、フォルダー曲の古い 📄 行が1回だけ消えるか（`trkFolderRefsPrune1`） |
| 37 | trk202：🛟 セーフモードの設定を持ち越さない | `?safe=1` の保存内容を VM で確認済み。実機は未了 | ①`?safe=1` で自動読み取りなどを変えて保存→URLから `?safe=1` を消して開き直すと元の設定か ②セーフモード中の見た目（videoStyle 等）は安全側で保存されること ③緊急パネル・リセット（safe）から戻るときも案内どおりか |
| 38 | trk203：🎬 ドロップした動画を 🎬 と同じ道へ | VM（偽の window）で確認済み。実ブラウザは未了 | ①`.mkv` をウィンドウにドロップすると 🎬 として一覧に入り、全画面ビューアが開かないこと ②音源のドロップは従来どおり ③`.json`（譜面）のドロップは取り込みのまま |
| 39 | trk204：📦 配布ZIPの形（`index.html`＋`README.txt`＋`trk-files/`）と Drive への追加 | **利用者が起動（ゲーム開始）を確認（2026-10-27）**。レビューでも ①`?safe=1` が入口を通っても消えない ②`file://` で `trk-files/` へ進み FIRST SPARK が出る ③時刻を新しくすれば古い画面が残らずデータも引き継がれる を確認済み | — |
| 40 | trk205：🕒 配布ZIPの時刻（同じ時刻だと 304 で旧版が残る） | **済（trk205 で修正。1.0.8 を 14:00、1.0.9 を 15:00 で組み直し、`--newer-than` の拒否もテストで固定）**。1.0.7 と 1.0.8 が同じ `2026-10-27 12:00` で、同じポートの `python -m http.server` が 304 を返して 1.0.7 の `index.html`（旧アプリ）が使われた（2026-10-27 レビュー・必須）。**1.0.8 を `2026-10-27 13:00`（UTC）で組み直し**、`If-Modified-Since: 12:00` → **200**／`13:00` → 304 をローカルで確認 | 実際のブラウザーで 1.0.7 のキャッシュを持ったまま開き直し、`GET / 200` で入口が出ることを実機で見る（実測はレビュー側で確認済み） |
| 41 | trk206：🚪 メディアプレイヤーを抜けたあとも曲が続く（既定）／❓謎設定で昔の動き | 純粋関数 `mediaExitPlan`（VM）・`previewContinue` が位置を動かさないこと・4言語の文言・配線は自動検査済み。**実機の音は未確認** | ①🎥基地で曲を流し、← で戻ると**途切れずに続く**こと（音量が少し下がる） ②曲リスト側でエフェクト・設定を触っても音が消えないこと ③⚙設定 → ❓謎設定 の **「🚪 メディアプレイヤーを抜けた時に曲を再読込する」** をオンにすると、閉じたときに止まってプレビュー位置から鳴り直す（不具合の再現）こと ④プレイヤーで一時停止してから閉じると、タイトルでも止まったままであること ⑤プレビューがオフの設定では閉じると止まること |
| 42 | trk208：📂 フォルダー共有の拡張（動画フォルダ・複数登録・書斎の「フォルダのまま読む本」） | 純関数（`plan`／`uniqueLabel`／`mergeScans`／`walk`／`readFileAt`／`folderBookGroups`）と配線は Node/VM で確認済み（`tests/trk208-shared-folders.test.mjs` の22件）。**実ブラウザのフォルダー選択・許可・実画像は未確認** | PC の Chrome／Edge で: ①📤 共有でミュージックと動画フォルダを**両方**追加し、一覧に2本出て曲が混ざらずに並ぶか ②リロードして許可が生きていれば自動で読めるか（切れていれば最初のタップで1本ずつ確認が出るか） ③× で1本だけ外せるか ④書斎の 📂 で画像が大量にあるフォルダーを選び、**保存容量が増えない**こと（`navigator.storage.estimate()`） ⑤本を開いてページが読めるか、フォルダー内で画像を消すと「読み込めません」の理由が出るか ⑥Android Chrome で同じ操作（`startIn` は無視されるが、フォルダー選択と許可は同じ） ⑦バックアップを取って別の端末で復元し、リンク本が「フォルダーが見つかりません」と出て、📂 で同じ名前のフォルダーを選び直すと読めるか |
| 43 | trk210：📤 共有フォルダーの × と 🔓（レビュー反映）・📚 同名フォルダー | `tests/trk210-review.test.mjs` の6件で確認済み（最後の1本で `"share"` も消える・許可が生きているフォルダーを先に読む・🔓 は1タップ1本・同名の別フォルダーは `Manga (2)`・リンク本が無くなったフォルダーの後始末）。**実機の許可ダイアログは未確認** | PC の Chrome／Edge で: ①1.0.x から上げた状態で共有フォルダーを1本だけ × で外し、**再読み込みしても戻らない**こと ②フォルダーを2本登録し、片方だけ許可を切って起動→**許可が生きている側の曲はすぐ出る**こと、🔓 が残りの1本の名前で出ること ③🔓 を1回押して**1本だけ**確認が出ること（2本目は次のタップ） ④書斎で `Manga` を選んだあと、**別の場所の同名フォルダー**を選ぶと `Manga (2)` として増えること（前の本としおりが消えない） ⑤リンク本を全部消すと、フォルダーの記録も消えること |
| 44 | 1.1.1 の配布ZIP（trk210 入り・2026-10-27） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻・`--check`・再検証（304）は確認済み（§6）。**利用者の実機での起動と、📂 共有の許可ダイアログは未確認** | ①1.1.0 のZIPを置き換える形で 1.1.1 を展開し、`index.html` から起動できること ②開いたあと `sw.js` の cache が `trk-v2026.10.27-trk210` になり、旧 `trk208` のキャッシュが残らないこと ③#43 の5点（× で外したフォルダーが戻らない・許可が生きている側は先に読める・🔓 は1タップ1本・同名フォルダーは `Manga (2)`・リンク本が無くなったフォルダーの後始末） |
| 45 | trk211：🔓 の文面（断ったあとに「次に聞く1本」の名前を出す） | `tests/trk211-review.test.mjs` の6件で確認済み（純関数・4か所の経路・cache）。**実機の許可ダイアログは未確認** | PC の Chrome／Edge で: ①フォルダーを2本共有し、片方だけ許可を切って起動 ②最初のタップで出た 🔓 を押して**断る** ③🔓 の文面が**さっき断った1本ではなく、次に聞く1本**の名前になっていること ④もう一度押すと2本目だけ確認が出ること ⑤全部を拒否にしても 🔓 の文面が空にならず、フォルダー名が出ていること |
| 46 | trk212：🖥 全画面の動画をホイール／ドラッグ／ピンチで拡大・縮小（100〜500%・ポインター中心・1回 2/5/10%） | `tests/trk212-video-zoom.test.mjs` の11件で確認済み（純関数・`paint()` の矩形・FI の `setTransform`・4言語・cache）。**実機のホイール・トラックパッド・ピンチの感触は未確認** | PC の Chrome で全画面を開き、①ホイール上／下で拡大・縮小し、指した場所が動かないか ②⚙ 設定 → 🎨 見た目で 2%／5%／10% を切り替えて1ノッチの量が変わるか ③拡大中にドラッグで端まで動かせるか ④100% では左右長押しシークが今までどおりか ⑤スマホで2本指のピンチ |
| 47 | trk213：⏱ 「ここをプレビュー開始位置にする」を設定で出し入れ（初期オフ） | `tests/trk213-preview-set-toggle.test.mjs` の6件で確認済み（設定の初期値と初期化・純関数・バナー2経路・バーを閉じる・スペクトラムのチェック・4言語・cache）。**実機の見え方は未確認** | ①初期状態で曲名タブの右上にボタンが無いこと ②⚙ 設定 → 📊 スペクトラム のチェックを入れると、曲を選んだときボタンが出ること ③外すと消えること ④ボタンを隠したままでも 🎵 サウンドの「常に最初から再生する」が使えること |
| 48 | 1.1.3 の配布ZIP（trk212・trk213 入り・2026-10-27） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻・`--check`・再検証（304）・ローカル配信（`/` 200）は確認済み（§6・§7）。**利用者の実機での起動と、🖥 のホイール／ドラッグ／ピンチ・⏱ のチェックの見え方は未確認** | ①1.1.2 のフォルダーに重ねず、新しいフォルダーへ展開して `index.html` から起動 ②全画面でホイール・ドラッグ・ピンチ ③⚙ 設定 → 📊 スペクトラム の「⏱ 「ここをプレビュー開始位置にする」を表示」のオン／オフ |
| 49 | trk214：🔍 ドラッグ中に外へ出てもずらせる（ポインターを掴む）・ピンチのあと残った1本指で動かせる | VM の偽 stage（`setPointerCapture`／`releasePointerCapture`）で確認済み（`tests/trk212-video-zoom.test.mjs` の trk214 4件）。捕まえるのはドラッグ開始と2本目の指からで、押しただけでは捕まえないことも確認 | ①全画面で拡大し、動画の外（ウィンドウの外）までドラッグしても止まらない ②スマホでピンチのあと1本離し、そのまま動かせる ③押しただけ（長押しシーク）は従来どおり外で止まる |
| 50 | trk214：📄 配布物の文書のリンク切れ検査（`checkDocLinks`） | 1.1.3 のZIPに当てて8件を検出（`CONTRIBUTING.md`・`README*.md`・`docs/guide/{en,files,mods}.md`）・`tests/release-layout.test.mjs` の3件は確認済み | 1.1.4 を組むときに8件を直す（§9）。直したあとは `--check` が緑になる |
| 51 | 1.1.4 の配布ZIP（trk214 入り・2026-10-27） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻・`--check`（`checkDocLinks` **0件**）・再検証（304）・ローカル配信は確認済み（§6）。**利用者の実機での起動と、外へ出るドラッグ・ピンチ→1本指の感触は未確認** | ①1.1.3 のフォルダーに重ねず新しいフォルダーへ展開して `index.html` から起動 ②全画面で拡大し、映像の外までドラッグ／ピンチのあと1本指 ③同梱の `docs/guide/`・`README-1.1.4.md` に「1.0.4」が残っていないこと |
| 52 | trk215：⭐ お気に入りの4フォルダ（2軍／🧊フリーズ／📤元お気に入り・📌ピン・🔒凍結・選んでいたフォルダの保存、⭐タブの出し入れ、3秒長押しでの解除） | `tests/trk215-favs.test.mjs` の17件で確認済み（謎設定の既定オフ／`settings.favs` の形／凍結は最初からオフ／1軍→2軍→リロード／5つの状態のリロード／1軍の配列を差し替えない／凍結中の追加・削除を止める／🎲のピン／3秒長押しと1タップ／⭐タブ／空表示／行の☆／4言語／cache）。**実機の見た目と3秒長押しの感触は未確認** | ①⭐タブで 2軍／🧊フリーズ／📤元お気に入り を選んでもお気に入りが消えないこと ②2軍へ入れて再読み込みしても残ること ③🔒 と 🧊 を3秒長押しで解除できること ④❓謎設定のチェックで1タップになること |
| 53 | trk216：🎼 譜面生成方式の既定を Bタイプ（方式4）へ | `tests/trk216-chartgen-default.test.mjs` の7件＋`npm run check` 704 pass で確認済み（既定の決まり方・印がある人の尊重・工場出荷・4言語・cache）。**実機での譜面の感触（Bが既定として良いか）は利用者の判断を仰ぐ** | ①新規（または設定を触っていない）状態で B になっていること ②一度 A を選ぶと、再読み込みしても A のままであること ③工場出荷で B に戻ること |
| 54 | 1.1.5 の配布ZIP（trk215・trk216 入り・2026-10-29） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻（`2026-10-29 10:00` UTC）・`--check`（`checkDocLinks` 0件）・ローカル配信・落とし直してのバイト一致は確認済み（§6・§9）。**利用者の実機での起動と、Bタイプの譜面の感触は未確認** | ①1.1.4 のフォルダーに重ねず新しいフォルダーへ展開して `index.html` から起動 ②⚙ 設定 → 🎼 譜面生成方式 が **Bタイプ（標準・方式4）** になっていること ③曲を選んで譜面ができること ④⭐ のお気に入り（2軍／🧊／📤）が再読み込みで残ること |
| 55 | trk217：🐔 trk's playlist のリスト選択（起動時に作らない・カタログから追加・♻ を出さない） | `tests/trk217-playlist-catalog.test.mjs` の11件＋`npm run check` 715 pass で確認済み（1.1.6 の配布ZIPに同梱）（ID の24文字・Vol 分割・追加済み判定・要る棚だけ作る・上限・表示フラグの戻し・起動の `create:false`・4言語）。**実ブラウザでの操作感は未確認** | ⚙ → 🐔 trk's playlist を開き、①リストを1本追加して 🐔 の階層に入るか ②同じものを選ぶと「追加済み」になるか ③🗑 で消したリストを選び直すと戻るか ④必要な棚だけが増えるか ⑤言語を切り替えても選択肢の名前が変わるか |
| 56 | 1.1.6 の配布ZIP（trk217 入り・2026-10-29） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻（`2026-10-29 12:00` UTC）・`--check`（`checkDocLinks` 0件）・ローカル配信・落とし直してのバイト一致は確認済み（§6・§9）。**実ブラウザでのピッカーの操作感は未確認** | ①1.1.5 のフォルダーに上書きせず、1.1.6 のZIPを別の場所へ展開する ②⚙ → 🐔 trk's playlist →「プレイリストを選択」で1本追加し、🐔 の階層（タブ長押し）に入るか ③同じリストが「追加済み」になって選べないか ④🗑 で消したリストを選び直すと戻るか |
| 57 | trk218：🐔 trk のリストを曲画面に出さない（👁／🗑／📋） | `tests/trk218-trk-list-visibility.test.mjs` の14件＋`npm run check` 729 pass で確認済み（1.1.7 の配布ZIPに同梱）（初期は出さない・`trkListed` の検証・リストは消えない・📋 の `cat:""` と24文字・上限200本・案内は1回だけ）。**実ブラウザでの 👁／🗑／📋 の操作感は未確認** |
| 58 | 1.1.7 の配布ZIP（trk218 入り・2026-10-29） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻（`2026-10-29 13:00` UTC）・`--check`・ローカル配信は確認済み（§6）。**実ブラウザで 👁／🗑／📋 を触っての確認は未了**（§4-57） |
| 59 | trk219：🔈 出力デバイスの切り替えで再生を止めない | `tests/trk219-audio-output-keep.test.mjs` の17件＋`npm run check` 746 pass で確認済み（偽の再生要素・時計・AudioContext で実動）。**実機で出力デバイスを切り替えての確認は未了**（§4-59 の手順で確認する） |
| 60 | 1.1.8 の配布ZIP（trk219 入り・2026-10-29） | ZIP の形・`unzip -t`・sha256・全エントリ同時刻（`2026-10-29 14:00` UTC）・`--check`・ローカル配信・差分を当てて完全一致は確認済み（§6）。**実機で出力デバイスを切り替えての確認は未了**（§4-59） |

#### 実ブラウザsmoke／CIの容量（trk162調査）

- **実行環境**：`npm run check` は実ブラウザsmokeを実行しません。GitHub ActionsはGitHub Pagesの静的コピー／公開のみです。`package.json`／lockfileにPuppeteerはなく、smokeスクリプトは `SMOKE_CHROME`／`SMOKE_PUPPETEER` で外部インストール済みブラウザを指定するため、自動ダウンロードはしません。trk189の最終確認ではRepo外にChromiumを用意し、smoke2件を実行済み（§6）。実機確認とは区別する。
- **既知のサイズ**：npm registryの `puppeteer-core@25.13.0` は単体の展開後6,010,962 bytes（約5.73 MiB、927 files）。リポジトリ依存には含まれず、推移依存はこの値に含みません。Chrome／Chromium本体、CIキャッシュ、一時ディスク、実転送量は未計測です。
- **ソース差分**：HEAD比でHTML／JS／SWが非圧縮約17.7 kB増、テスト・ガイド等を含む全ファイルは約64.7 kB増。Pages workflowはリポジトリ一式をartifactへコピーしますが、圧縮後サイズは未計測です。
- **上限設計のNode目安**：10万項目・約9.08 MBの合成ZIPを作成・読込すると約2.44秒、強制GC後のJS heapは処理前比約10.7 MiB増でした。ピークRSSやChrome／モバイルのメモリ測定ではありません。この目安から、ZIP64の65,535件境界を十分に超える250,000項目・64 MiBの上限にしています。

### 4.1 詳細

1. **MIDI／MIXの実ブラウザ・実音声確認**（PC・Android）：有効なSMF 0/1の読込、24音色の違い、プロフィール選択が次の読込に反映されること、形式・サイズ・長さ制限を確認。MP3/WAVでMIX初期オフ／オン／プロファイル切替を確認し、セーフモード・Audioリセットで停止することも確認する。現時点では自動テスト済み・実音声未確認。
   - trk114：**実際の東方MIDIで処理量の上限（2億）を確かめる**。手元のファイルで `node tools/midi-budget.mjs *.mid --render` を実行し、各曲の処理量・PCでの変換時間を記録する（ファイルはリポジトリに入れない）。Androidでは変換時間と進み具合（%）の表示、変換中に別の曲を選んだときに止まること、余韻を打ち切った曲の終わり方（不自然な切れ目がないか）を聴いて確認する。合成ループの高速化は出力差1 LSB以内をNodeで確認しただけで、実機の音は未確認。
2. **カタログ名表示**：ユーザー設定名 → カタログ名 → 元ファイル名の優先順と、元ファイル名・保存名が変わらないことを実際のライブラリで確認する。
3. **音源ジャケット**（trk101〜106）：曲一覧のサムネイル表示は利用者確認済み（2026-10-09）。選択中バナー・TV・書斎、譜面中の右上配置、フィルター、画像なし、表示設定の優先順はPC／Androidの実曲で確認する。詳細は旧記録と [`QUALITY-CHECKS.md`](QUALITY-CHECKS.md) を参照。
4. **LoL外部ページ**：Season 4〜9 のSoundCloudセット表示と、地域制限曲を含む人気曲リンクを実ブラウザで再確認する（Warsongsのセットはtrk115で確認済み）。曲別調査はLoL台帳を更新する。
5. **Endfield配信リンク**：Zeroth Directive OST 60曲＋バッチ2の6作81曲のSpotify個別曲ページ、各巻のffm.toスマートリンクと网易云音乐アルバムの表示・地域差を実ブラウザで再確認する。バッチ2は個別曲IDの抜取確認が6曲のみで、残り75曲のIDは未個別確認。バッチ2の中国語公式曲名・ffm.to告知リンク（Homecoming 以外）・VGMdb照合・他ストアの曲別URLは未確認のまま。Zeroth Vol.1 は 2026-10-11 に Apple Music 掲載を確認済み（Vol.2 のアルバム別URLは未照合）。未収録の公式リリース（Yi／Old Deep Water Dies／Sketches of Lost Heirlooms／A Promise Makes a Home 等）は台帳の「調査中の他の公式リリース」表に確認状況を記録済み。曲別調査はエンドフィールド台帳を更新する。trk128 の並び・棚・改名はヘッドレスChromiumのe2e（20項目）で確認済みだが、**実端末でのEndfieldタブの見た目（並び・「Endfield Character Theme」棚）は未確認**。
6. **🎼 手続き生成10曲の聴取確認**（trk113）：自動検査は「無音でもクリップでもない」こと（peak 0.62〜0.72・RMS 0.08〜0.29）と決定的生成を確認しただけで、音楽としての良否は未確認。`assets/trk-ost/index.html` で曲として聴けるか、耳障りなノイズや音量バランスを確認する。アプリ連携先は別棚 `trk-agent-ost-v1` として実装済みだが、公開リポジトリにWAV／manifestは同梱しない。任意音源を含める検証ビルドでは `AGENT_OST_MANIFEST_INCLUDED=true` にして専用リストと選曲時の読込みを確認する。品質評価・公開配布への同梱判断は別。
7. Android Chrome／PCでService Workerのsafe・オフライン、MMD／VRM、IndexedDBを確認する。Node・shim検査は実機確認の代用ではありません。
   - **2026-10-14 更新**：オフラインで動くことは利用者が実機で確認済み（「インターネットに繋がなくても遊べる」の文言の根拠）。MMD／VRM、IndexedDB、safe の実機確認は未了。
8. **trk114の画面確認**：①自動リスト（例：LoLのSeason 3）を消して再起動しても戻らないこと、♻ボタンの件数表示と復元、trk's OST Vol.1を別フォルダへ動かして再起動しても戻らないこと。②英・中・韓のUIで入手先ガイド（タブの長押し）が各言語で出ること。③色が変わった16スキン（shadow・daylight・sakura・snowfield・garden・strawberry・melonberry・dawn・midnightsun・pastelloop・wagara・showacafe・cbLight・shojiLight・morningKitchen・mikuClassic）で、スキンの棚の見出しやリンクの色が見やすく、スキンの雰囲気を壊していないこと。ヘッドレスChromiumでは①②とcbLight・shojiLight・morningKitchenのaxe（4.61〜4.62:1）を確認済み。
9. **書斎の設定と画像キー（trk133〜135で実機確認してほしいこと）**：trk135の全画面フィット（実機のピンチ・画面回転・全画面終了で元の倍率に戻ること）。trk134の上部設定入口（未選択・本棚非表示）と「最後のページ時PageDownで本を閉じる」の切り替え。trk133の操作感と最後で閉じる動作は利用者から好評（端末・ブラウザの詳細は未確認）。以下は従来の確認項目：読書見出しの設定ボタンの押しやすさ、本棚を隠したままの設定、等倍の大きな画像で PageDown／PageUp → 端で押し直してページ送り → 本の端で閉じる動作、新設定オンで直接ページ送りになること。ヘッドレスChromiumでは確認済みですが、実際のPC／Androidの手ざわりは未確認。**以下はtrk119〜127の経緯（倍率制限はtrk133で解除）**：拡大した画像を `↑`／`↓` で送る動きは、ヘッドレスChromium（PCの画面比・全画面モード）で確認済み。PC・Androidの実機で、トラックパッドやノートPCのキーボード、日本語配列、`←`／`→`のページ送りと混ぜて使ったときの体感、および長い本（縦読み）での手ざわりは未確認。実際に読みながら「1回押しの送り幅（画面の84%）」が多すぎ／少なすぎないかも見てほしい。拡大の送り幅の設定（trk120、初期値5%・1／2／5／10／25%）も、実機で「気持ちよく拡大縮小できるか」を試してほしい（ホイール・＋／−ボタン・ピンチで同じ幅を使う）。trk121〜123の `PageDown`／`PageUp`（初期オン。拡大中は下端／上端へ、端でさらに押すと次の／前のページを続きの端から開き、**本の端では閉じる動作**＝画像の全画面を終了して本棚へ）と、trk124の**PCのマウス操作**（**左右クリックでページ送り**＝左＝次へ・右＝前へ、**左右の反転**つき。**中クリック**は「何もしない／次のページへ／閉じて本棚へ（全画面を終了）」の3択。初期値はオフ／何もしない）は、PCの実機で試してほしい。マウスは**右クリックでブラウザのメニューが出ないこと**（画像の上では前から出ません）、中ボタンの押し心地、ブラウザの自動スクロールが出ないこと、トラックパッドの中クリック、トラックボールや左利きでの左右の反転、指のタップ（これまでどおり左右の半分で送る）と混ぜて使ったときの手ざわりを確かめてほしい。実際に読みながら「端でさらに押すと次の／前のページへ」「本の端で閉じる」が好みか、読んでいる途中で意図せず閉じてしまわないか（押しすぎ）も見てほしい。中クリックの設定はtrk124で選択式に変わったので、trk121から中クリック＝次のページを使っていた人は選び直しが必要かどうかも。 **trk127の押しっぱなし停止**：ヘッドレスChromiumで、単発・押しっぱなし（同じキーのrepeat）を再現し、端で止まること・本を閉じないことを確認（修正前の版では次のページへ進み、本が閉じることも再現）。実際のキーボードの連打・OSのキーリピート設定での体感は未確認。
10. **Riot系カタログの画面確認**（trk116〜118）：🛒公式カタログに「🛡️ Riot Games — LoL関連ゲーム」と「VALORANT Creator-Safe」が出て取り込めること、LoLフォルダに4リスト（Pentakill など）が増えたこと、各リストの入手先ガイド（全曲／一部／見当たらない）が4言語で出ることを実機で確認する。新しい539曲のSpotifyリンクは、トラックIDの抜き取り確認が3件（VALORANTの36件は別の一覧と照合）なので、数件開いて確かめると確実。ヘッドレスChromiumでは取り込みとガイド表示を確認済み。
11. **入口まわりは実機で確認済み（trk125・trk126）**：曲リスト右の **📚 書斎** ボタン（常時表示）と、曲名バナーの右下の **⏯ 再生／一時停止**（音量ボタンの左）は、**2026-10-12に実機で動作確認済み**（空さん。選曲中のプレビュー停止／再開と、曲名に触れて選び直したときの鳴り直しを含む）。配置も「いい配置」とのこと。「長押しで書斎に行かない」という報告は、ヘッドレスChromiumの自動化では再現せず（タイトル・再生中・一時停止中・開いて閉じた後・ライトモードのオン／オフ・マウス／タッチのいずれでも開く）、その後の実機でも問題なく開いている。**もし再発したら**、端末とブラウザ、押し方（指かマウスか）を教えてほしい。アイコンだけの小さなボタンなので、押しやすさ（大きさ・位置）は引き続き見てほしい。
12. **trk129〜132の確認（実機で見てほしいこと）**：この4回は自動検査（`npm run check`・`git diff --check`）までで、**実機での確認は未実施**です（trk132の①②③はアーカイブの検証記録のとおりヘッドレスChromiumでも確認しましたが、ほかは自動検査のみ）。見てほしい順に：①**↕の並べ替え**（🐔の階層メニュー＝タブ長押しで、同じフォルダ〈Volの並び〉の中の↑↓を押すとその場で1つ動くこと。押しても画面が変わらない・別のフォルダの曲と入れ替わる、が直っているか。並びの端ではボタンが押せない〈薄い〉こと、🔤ABC順がオンなら4つのボタンすべてが押せないこと。フォルダ設定⚙で並べ替えると画面が開き直って新しい並びが見えること）。②**📦パックを外したとき**（パックが変えたスキン・ノーツの色/形・エフェクトの強さ・SEのオンが、当てる前の値に戻ること。パックを当てたまま再起動してから外しても戻ること。パックを使っている間に自分で変えた項目は元に戻らないこと。音を持つパックAから音を持たないパックBへ切り替えると、自分の読み込んだSEが消えたままにならず戻ること＝素早く切り替えても取り違えない）。③**📥共有プレイリスト**（4MiBを超えるファイルを選ぶと読み込まずに「ファイルが大きすぎます」と出ること〈4言語の文言は自動検査のみ〉。曲名が `08 sometimes`／`08_sometimes` のような表記ゆれで、手元の同じ曲にだけ✅が付き、別のアルバムの「01 intro」と「03 intro」のような曖昧な名前は✅にならないこと）。④**MIRROR**（掛けて遊んだとき、記録の行がMOD無しと同じ行に入り、ゴーストが前回どのMODで遊んでいても出ること）。⑤**Endfieldタブ**（上下の名前が「初号指令 (上) ZD OST Vol.1」「初号指令 (下) ZD OST Vol.2」と切れずに表示されること＝旧名の利用者も改名されること）。⑥**フォルダ上限40**（40個目までは作れて41個目は作られず、トースト「📁 フォルダは40個までです。使っていないフォルダを消すと作れます」が出ること〈4言語の文言は自動検査のみ。実際の表示は ja で確認してほしい〉）。⑦**🎭棚の戻し**（trk128をすでに4個以上のフォルダで起動していた環境＝🎭棚が消えてキャラクターテーマ4リストがトップへ落ちた状態で、新しい版の初回起動にだけ4リストが🎭棚へ戻り、2回目以降は利用者が動かした配置が守られること）。⑧**📦パックの切り替えとスキン**（スキンを持つパックAから、スキンを持たないパックBへ切り替えてBを外すと、Aのスキンではなく、Aを当てる前の自分のスキンに戻ること。Aを使っている間に自分でスキンを選び直したときは、その選んだスキンに戻ること）。⑨**MOD付きで遊んだ後の書き出し**（ミラー／RANDOMを掛けて遊んだ後に、一時停止画面・結果画面の「Export」や曲パックの「今の譜面を含める」で書き出しても、MOD後の譜面ではなく元の譜面が出ること）。※⑥⑦はヘッドレスChromiumでも未実施（自動検査のみ）。**⑧⑨はヘッドレスChromiumのe2e（17項目）で確認済み**（アーカイブ・trk132）だが、実機では未確認。
13. **trk136の確認（実機で見てほしいこと）**：①全画面フィットをオンにして **PageDown を長押し** すると、ページが連続して進むこと（描画が追いつかないときは止まり、追いついたら続く）。はみ出す画像では、長押しが端で止まること（従来どおり）。②設定の **💾 端末の保存** が、PC・Android Chromeで「固定されています」と出るか（Androidでは利用の状況により固定されないことがあり得ます。その場合は表示どおり書き出しで控える）。

14. **曲名照合とミカの案内**：Musopen等の実ダウンロード音源、ミカの実音源・実動画、PC／Androidの実際のフォルダ選択・聴取・再生は未確認。リンクの公開メタデータ取得を、全地域・全アカウントでの再生可否やローカルファイルの入手許諾と扱わない。範囲・未収録候補はミカ索引と `TITLE-MATCH.md` に残し、確認できた根拠だけを個別に更新する。

15. **ZIP作り手の互換性（trk163・レビュー【情報】）**：Info-ZIP 3.0 の標準入力メンバー出力（`printf abc | zip - -` のstore版・deflate版）、パイプ出力（アーカイブ自体を標準出力へ）、通常の一時ファイル出力は、実物のバイト列をNode fixtureにして受理・展開（CRC込み）を確認済み。2026-10-15 のレビューでは Info-ZIP（通常）・Python zipfile（deflate・UTF-8フラグ・ストリーム書き）もOKと確認されている。**未確認（実機で一度ずつ試してほしい）**：Windowsのエクスプローラー「圧縮フォルダー」、macOS「圧縮」、スマホアプリで作ったCBZを書斎に取り込めるか。注意点：**ローカルヘッダと中央目録の `flags` が完全一致すること**を求めており、試した作り手では問題なかったが、一部の作り手では両者がずれることが知られている。実機で読めないCBZが出たら、まず `flags` の食い違いを疑うこと。緩める場合は `flags` 全体ではなく**暗号化ビット（bit0）と圧縮方式だけの比較**にするのが安全（`js/zip-io.js` の `zipDataStart`。現時点では緩めていない）。

16. **▶ メディアプレーヤーの新機能（trk164で実機で見てほしいこと）**（2026-10-15、空さんの依頼を記録）：Node/VM検査は純関数の決定（巻き戻しの計算・フェード計画・タイマーの掃除・endedMediaの優先順）までで、以下は**すべて実機未確認**。
   - **📌 画中画（PiP）の継続と復帰（Android Chrome／PC）**：小窓に出して再生が続くこと、プレーヤーへ戻ると表示が復帰すること、プレーヤーを閉じたら浮き窓も一緒に消えること。
   - **🔆 動画再生中に画面が消えないこと**：動画の再生中は画面が暗くならない／消灯しない。**音声だけの再生と、タブ裏では消えること**（省電力を尊重する側。Wake Lockは「動画の再生中」だけ取得する設計）。設定「🔆 画面を消灯させない」のオン／オフがすぐ効くことも。
   - **⏪ 巻き戻し幅の実際的な不快感**：3〜30秒を設定して「続きから再生」したとき、戻り幅が実際に使って不快感にならないか（戻りすぎ／足りなすぎ）。一時停止からの再開では戻らないことも。
   - **💤 フェード後に音量が戻った状態で次の再生が始まるか**：分数スリープのフェードアウトで停止したあと、次に再生したときに音量が絞られたままになっていないこと。「この曲の終わり」で、リピート／シャッフルより優先して停止することも。
   - **iOS**：PiP／Wake Lockは**非対応時にボタンが無効＋案内（タイトル）が出ればOK**（動作の確認までは求めない。SafariのPiPは対応していれば動く、くらいで見る）。

17. **📥 OSの共有／「このアプリで開く」（trk165／trk177レビューで実機確認してほしいこと）**：**インストール済みPWA**（「ホーム画面に追加」／デスクトップの「インストール」）が前提のため、ヘッドレスでは一切確認できない。見てほしいこと：①Android Chromeの共有シートから曲・動画・CBZ／ZIP・.stpack・pack.json入りZIPを共有し、それぞれ既存の取り込みと同じ案内・検証で入ること。共有受け口はほかのWebサイトのフォームからも送れるため、取り込み前にファイル名・件数と注意を示す確認が出ること。②**キャンセル**すると何もルーティングされず、受信ファイルは一時 inbox から削除されること（次回起動で再処理されない）。③デスクトップ（Chrome／Edge）でファイルを右クリック→「このアプリで開く」に trk! が出て、明示操作に重ねて確認ダイアログを出さず取り込むこと。④受け取れない形式（.txt 等）の案内、複数ファイル、空き容量不足（?shared=partial／error の案内）。⑤アプリ更新（SWのactivate）をまたいで一時置き場（trk-share-inbox-v1）が消えず、承認したものが次の起動で取り込まれること。⑥起動中に共有されたとき（single-client の launchQueue 経路）。**iOS Safari は share_target／file_handlers 非対応＝共有シートに trk! が出ないのが仕様**（Capacitor ビルドで必要になったら別対応。PLAYER-ROADMAP #5 の記録どおり）。

18. **🎤 歌詞（trk166で実機で見てほしいこと）**：合成バイナリのテストは緑だが、**世の中の本物のタグは癖が強い**ので実ファイルで見てほしい。①手持ちの歌詞タグ入り mp3（USLT・SYLT の両方、UTF-16 エンコードのタグ）／m4a（©lyr）／flac・ogg（LYRICS / UNSYNCEDLYRICS）を再生して、メディアプレーヤーの 🎤 パネルに「出典：埋め込みタグ」と歌詞が出ること。②フォルダ共有（📤）で曲と同じ名前の .lrc を同じフォルダに置くと「出典：フォルダの .lrc（名前）」になること（優先順：手で選んだ歌詞 → フォルダの .lrc → 埋め込みタグ）。③「📄 歌詞ファイルを選ぶ」で .lrc/.txt を選ぶと曲ごとに保存され、**ページをリロードしても残る**こと（localStorage trk_lyrics_v1・1曲256KB/合計512KBで古い順に追い出し）。「✖ 選んだ歌詞を消す」で消えること。④同期歌詞のハイライトが再生位置に追随し、行のクリックでその位置へシークすること（逆再生中はハイライトを止めてある）。⑤時刻タグのない歌詞は「※ 時刻のない歌詞なので、そのまま表示します」と出てスクロールなしの素の表示になること。⑥歌詞は**読むだけ**：元ファイルは書き換わらない（書き戻し経路そのものが無い）。文字化けを見つけたら符号化（Latin-1/UTF-16/UTF-8）のどれだったか控えておいてほしい。

19. **🏷 埋め込みテキストタグの表示（trk167で実機で見てほしいこと）**：合成バイナリのテストは緑だが、実ファイルのタグは文字化け・非標準エンコード・巨大タグなど癖があるので実音源で見てほしい。①タグ付き mp3（TIT2/TPE1/TALB/TPE2/TRCK「3/12」形式、UTF-16 タグ）／m4a（©nam/©ART/©alb/aART/trkn）／flac・ogg（TITLE/ARTIST/ALBUM/TRACKNUMBER/TRACKTOTAL）で、曲リストの曲名とサブ行（アーティスト・アルバム）がタグから表示されること。②表示名の優先順：🎶 曲のプロフィールで名前を設定した曲は**それが勝ち続ける**こと、タグなしの曲は従来のファイル名のままなこと、東方 MIDI（th06_15.mid 等）はタグが無いのでカタログ曲名のままなこと。③選曲バナー・メディアプレーヤー（ヘッダ・キュー・Media Session＝ロック画面／通知）にも同じ名前が出ること。④検索（🔍）と名前順ソートがタグ込みの表示名で動くこと。⑤**照合の分離**：🛒 公式カタログの灰色行が黒くなる自動追加が、タグとファイル名が食い違うファイル（例：ファイル名 `08_sometimes.fla`・タグ「別名」）でも**ファイル名側で従来どおり**動くこと。⑥読み込みタイミング：長いリストをスクロールしたときに行が見えてからタグに変わること（サムネイルと同じタイミング）・もたつかないこと。⑦文字化けを見たら符号化（Latin-1/UTF-16/UTF-8）を控えておいてほしい。タグの**編集はできません**（読み取り専用＝設計）。
20. **🔊 音量の平準化（trk168で実機で見てほしいこと）**：合成音声のテストは緑だが、実際の曲での効き方は実機で見てほしい。①音量差のある2〜3曲（録音レベルが違うもの）を続けて再生し、設定「🎛 サウンドエフェクト」→「🔊 音量の平準化」→「曲ごとの音量をそろえる」をオンにしたときに体感差が縮まるか。②ReplayGain タグ付きのファイル（foobar2000 等でスキャンしたもの）ではパネルの状態行に「いま：x.x dB（タグ）」と出ること。タグが無い曲は「（解析）」、巨大ファイルや動画など解析を飛ばした曲は「素通し」の行になること。③もともと大きい曲で音割れ・こもりが起きないか（ピークガード＝最大サンプルがフルスケールを超えない制限）。④エフェクト本体がオフでも平準化だけ効くか（通り道は WebAudio になる）。⑤曲の途中でタグが到着した場合（リストの行が見えてから）に音量が追従して変わるか。⑥メディアプレーヤーのバックグラウンド再生・ロック画面でも音量が安定しているか。⑦オフに戻したときにすぐ元の音量（素通し）に戻るか。ファイルへの書き込みは一切行わない（読み取り専用＝設計）。

21. **💬 字幕（trk169で実機で見てほしいこと）**：合成テキストのテストは緑だが、実世界の字幕ファイルはエンコード・改行・装飾の癖が強いので実動画で見てほしい。①フォルダ共有（📤）か📁開くで、動画（mp4/webm/mkv 等）と同じ名前の .srt か .vtt を同じフォルダに置くと、メディアプレーヤーでその動画を選んだとき映像の下側に字幕が出ること（優先順：手で選んだファイル → フォルダの同名 .srt/.vtt。両方あるときは .vtt 優先で拾う）。②「💬 字幕」パネルは**動画の曲だけ**に出ること（音声だけの曲では隠れる）。③「📄 字幕ファイルを選ぶ」で .srt/.vtt を選ぶと曲ごとに保存され、**リロード後も残る**こと（localStorage trk_subs_v1・1曲512KB/合計1MBで古い順に追い出し）。「✖ 選んだ字幕を消す」でフォルダ字幕に戻ること。④「遅延」の −早く/＋遅く（±0.25秒刻み）と ↺ 0 が効き、**PiP の字幕も同じだけずれる**こと（PiP 用は WebVTT に変換して <track> で付けている）。⑤🖥 動画の全画面表示（video-max）でも同じ字幕が出ること。⑥「字幕を表示する」オフで画面からも PiP からも消えること。⑦逆再生中は字幕が隠れること（時計が違うため＝歌詞のハイライトと同じ扱い）。⑧文字化けを見たら符号化（UTF-8 / Latin-1 等）を控えておいてほしい（読みは UTF-8 前提）。字幕は**読むだけ**：元ファイルは書き換わらず、外部へも送らない。埋め込み字幕トラック（MKV 内蔵等）はブラウザ制約で対象外＝外部ファイル優先の方針。
22. **🔖 M4Bチャプター（trk170で実機で見てほしいこと）**：合成 chpl バイナリのテストは緑だが、実オーディオブックでの確認をお願いしたい。①チャプター入りの M4B（m4a/mp4/mov も可）をメディアプレーヤーで選ぶと「🔖 チャプター」パネル（字幕パネルの直後・アンバー色）が出ること。mp3/flac など音声のみでは出ない。②一覧は「時刻＋章名」で、クリックするとそこへ飛ぶこと（逆再生中なら逆再生を止めてから飛ぶ）。③再生中の章がハイライトされ「▶ いまの章名」が 250ms 周期で付いてくること（逆再生中は更新しない＝歌詞・字幕と同じ扱い）。④⏮ はいまの章に入って3秒以上なら章の先頭へ、3秒以内なら前の章へ。⏭ は次の章へ（最後の章では動かない）。⑤💤 スリープの「チャプターの終わりで止める」が次の章の境界（最終章なら曲の終わり）で停止し、トーストに止まる予定の時刻（mm:ss）が出ること。手で別の曲を選ぶと解除される（「この曲の終わり」と同じ）。⑥m4b がフォルダ取込（📁開く／📤共有・相乗り収集）の対象になったこと＝以前は .m4b が丸ごとスキップされていた。チャプターは**読むだけ**：元ファイルは書き換わらず、外部へも送らない。読みは chpl(Nero) ボックスのみ（moov→udta 直下と moov 直下の両方を再帰で探す。FFmpeg mov.c と同じ並び）。**既知の非対応**：iTunes 方式のチャプタートラック（text/tx3g サンプル＋stbl サンプルテーブル）は解析しない＝その方式だけのファイルは「チャプターがありません」になる。
23. **💿🎤 アルバム／アーティストのグループ表示（trk171で実機で見てほしいこと）**：並び替えの部品テストは緑だが、実際のライブラリ（数百曲・混在タグ）で見てほしい。①💿アルバム／🎤アーティストの棚は、アルバム名／アーティスト名を持つ曲（🏷タグか🎶曲プロフィール由来）が1つでもあるときだけタブ帯に出ること（無ければ出ない。消えたタブは既定の「すべて」表示に戻る＝既存の棚と同じ扱い）。②棚の中はグループ見出し（💿 アルバム名 — アーティスト名・曲数／🎤 アーティスト名・曲数）ごとにまとまり、見出しはスクロール中にリストの上端に張りつくこと。③アルバムのなかはトラック番号順（TRCK 由来・10 は 2 の後）、番号の無い曲は番号つきより後ろ、その中で選んでいる並び順（曲名/再生数/最近/ベスト）が効くこと。④🎤アーティストの中はアルバム順→トラック番号順。⑤グループの無い曲は「タグなし」グループに集まって最後に来ること。⑥棚を開くと表示行数ぶん（最大300曲）のタグを先読みし、「🏷 タグを読み込み中…」の案内が出て、読み終わると自動で並べ直すこと（250ms デバウンス＝タグが届くたびの描き直し storm にならない）。⑦検索（libSearch）はグループ棚でも効き、ヒットだけのグループ表示になること。グループ化は**表示だけ**：曲の保存データ・プレイリスト・タグは触らない（タグは trk167 と同じ読み取り専用経路）。
24. **⚡ スマート棚（trk172で実機で見てほしいこと）**：セクション部品のテストは緑だが、実際の履歴での確認をお願いしたい。①⚡スマートのタブは、再生履歴（🎮 リザルト／🎧 プレーヤー）か追加日時の材料が1件でもあれば ⭐お気に入りの右に出て、無ければ出ないこと（消えたタブは「すべて」に戻る＝既存の棚と同じ）。②棚の中は3セクション＝**🕒 最近再生**（新しい順・最大50曲）・**🔥 よく再生**（回数順・最大50曲）・**➕ 最近追加**（新しい順・最大50曲）。見出しは 💿🎤 と同じ sticky 見出しで曲数つき。同じ曲が2つのセクションに出ることがある（ただのビュー＝プレイリストは増えない）。③**🎧 プレーヤー再生の計数**：メディアプレーヤーで1曲が30秒（曲の長さが60秒未満なら半分）を超えて再生されたら1回＝「ちゃんと聴いた」として数える。すぐのスキップ・逆再生中・読み込み前は数えない。最後まで再生（曲の終わり）は短い曲でも数える。リピートや開き直しは周ごとに新しく数える。④🎮 ゲーム側の記録（records の plays/lastPlayed）は従来どおり材料に入る。🔥 の回数は「records と PLAYED(manual+auto) の大きい方＋media」＝同じプレイの二重計上を避ける近似。⑤**証明は不変**：共有プレイリストの条件（クリア/視聴）と ▶AUTO 印は auto/manual だけのまま＝プレーヤーで聴いただけでは証明にならない（意図した分離）。⑥➕最近追加の対象は 📄追加した曲（songDB）と 💾端末に残した共有の曲（addedAt を it に載せて再起動後も復元）。フォルダスキャンの曲は追加日時を持たないので対象外（既知の制限）。⑦TV ◀ ▶ はセクションをまたいで1曲ずつ進む（同じ曲が2セクションにあっても libView は1回だけ）。材料はぜんぶ端末内＝外部への送信なし、保存への書き込みは PLAYED（shadow_taiko_played_v1）への media/last 追記だけ。
25. **🌊 波形シークバー（trk173で実機で見てほしいこと）**：包絡の計算と描画分岐のテストは緑だが、見た目は実機でしか確かめられない。①ふつうの長さの曲をメディアプレーヤーで再生すると、シークバーに**音量の包絡（波形）**が出ること。材料は既存の解析キャッシュ（core.analysis＝trk_analysis_cache_v1・端末内）の rms だけで、新しい解析やファイル読みはしない。②再生済み部分がアンバー（#ffd166 系）、未再生部分が水色に塗り分けられ、250ms 周期でついてくること。③シークバーにポインターを乗せる（スマホはドラッグ）と**その位置の時刻の吹き出し**が出ること。**ホバーサムネ（動画フレームの縮小画）は今回見送り**＝別のデコード経路（オフスクリーンでのシーク＋描画）が要るので、需要が確認できたら別建て（ROADMAP #14 に注記済み）。④解析が無い曲＝長い曲・大きなファイル・🪶軽量化の「解析しない」では**ふつうのバーのまま**（canvas は隠れる・エラーにならない）こと。⑤設定の「🌊 波形シークバー」（🔆 画面を消灯させない の隣）オフで消え、リロード後も残ること（settings.mediaWave・初期オン）。⑥ダイアログの幅変え・端末回転で ResizeObserver が包絡を計算し直すこと。⑦波形は range の上の pointer-events:none の重ね描き＝ドラッグ・クリック・キー操作は native の range のまま（aria-hidden）。見た目の濃さ（半透明の加減）は好みが分かれるので、違和感があれば調整したい。
26. **📈 進捗フィルター（trk174で実機で見てほしいこと）**：判定のテストは緑だが、実際の聴き方で確認してほしい。①曲リストのツール列（検索・並べ替えの隣）に **📈 進捗** のセレクト（すべて／未聴／継続中／完了）が出ること。選択は settings.libProgress に残ってリロード後も続く。②**継続中**＝位置記憶（trk_media_positions_v1）が残っている曲。位置はふつう指紋（size:duration）で保存されるので、選曲時に覚えた keyFp の対応を引く＝**一度も選曲していない曲の位置記憶は引けない**（実用上は再生した曲だけなので問題にならない想定）。③**完了**＝位置が消えていて、かつ一度通して聴いた回数がある曲（🎮 クリア/視聴の PLAYED manual/auto・🎧 プレーヤー計数の media（trk172）・records の plays のいずれか）。**位置記憶は最後まで聴くと消える設計**なので、完了を位置だけでは判定できない＝回数で見る（ROADMAP の「位置記憶＋duration で算出」からの意図した変更・ここに記録）。④**未聴**＝どちらもない曲。⑤絞り込みは**表示層だけ**：行を絞るだけで、位置記憶・PLAYED・records・プレイリストは何も書き換えない（library.js が位置記憶へ setItem したら check-repo が失敗する見張り付き）。⑥検索・タブ（💿🎤⚡ の棚やグループ見出しを含む）と組み合わせて効くこと。絞り込み後に曲が無ければ「見つかりません」の案内。
27. **📜 自動スクロール（trk175で実機で見てほしいこと）**：状態機のテストは緑だが、実際の縦読み漫画で確認してほしい。①**縦読み漫画モード**のときだけツールバー（拡大 −／＋・フィットのあと）に **「⏩ 自動スクロール」** ボタンが出ること。一枚ずつ・見開き・テキストの本では隠れる。②ボタンまたは **`A` キー**で開始＝速度設定（既定は1秒75ピクセル）の等速で下へスクロールする。実行中はボタンがアンバー色で **「⏸ 自動スクロール停止」**（aria-pressed=true）。③**停止**：もう一度 `A`・**画面タップ**（pointerdown）・**ホイール**・**移動キー**（`↑` `↓`、`Space`、`Enter`、`PageUp` / `PageDown`、`Home` / `End`、次へ/前へに割り当てたキー）のいずれも一回で止まる。移動キーは**元の動作をせず停止だけ**する（一回で1画面ぶん飛ぶのを防ぐ意図した仕様）。`B`（栞）・`T`・`F`・`?` などは止めずにそのまま動く。④下端＝最後のページに着くと**自動で止まり**「最後のページに着きました」と案内する。栞やスクロール位置の復元には一切触れない（表示だけ）。⑤⚙ 設定の**「自動スクロールの速度」**は5段階＝いちばん遅い20／遅い45／普通75／速い120／いちばん速い180（px/秒）。**実行中の変更は次のコマからすぐ効く**（止まらない）。選択は IndexedDB の settings に残りリロード後も続く。壊れた保存値は既定75に戻る。⑥**全画面（⛶）でも走り続ける**。一枚ずつ/見開きへの切り替え・本を閉じる・本棚へ戻る・書斎を閉じるでは**静かに止まる**（rAF キャンセル・通知なし）。スクロール中も IntersectionObserver によるページ番号の表示と見えているページだけの遅延読み込みが普通に働くこと。⑦`A` は**予約キー**になった（次へ/前へに割り当てできない）。`tools/check-study-room.mjs` のキー検査も KeyA を予約側へ更新済み。⑧裏タブでは rAF が止まる＝スクロールも止まり、復帰時の大きな時間差は1コマ100msまでに丸めるので一気に飛ぶことはない（これも意図した仕様）。
28. **🌗 読書用フィルタ（trk176で実機で見てほしいこと）**：css 構築とクランプのテストは緑だが、実際の見た目を確認してほしい。①⚙ 設定（自動スクロールの速度の直後）に **「明るさ（読書）」「コントラスト（読書）」のスライダー**（50〜150%・刻み5・横に今の値の % 表示）と **「特殊フィルタ（読書）」セレクト**（なし／反転／グレースケール／セピア）が出ること。②**ドラッグ中にすぐ効く**（input で見た目だけ更新・保存しない）＝離したとき（change）に保存。③効くのは**読書面だけ**＝`.study-image-stage` と `.study-text-stage`（画像・テキストページ・メモ編集欄）。本棚・ツールバー・メニュー・TVペイン・プレーヤーは変わらないこと。④**全画面フィット（trk134系）・拡大率とは独立**＝どの組み合わせでも filter はそのまま（拡大は stage 内の transform/寸法、filter は stage 全体なので干渉しない設計）。⑤初期値（100%/100%/なし）に戻すと `--study-read-filter` に **"none"** が入る＝フィルタなし（合成コストもゼロ）。⑥選択は studyPrefs（IndexedDB settings）に残りリロード後も続く。壊れた保存値はクランプ（50〜150）／候補外は "none" に戻る。⑦テキストのスキン（和紙・古書・作文用紙など）や検索マークの色も filter 込みで変わって見える＝読書面の一部なので意図どおり。⑧セピアは `sepia(.8)`（かけすぎない強さ）。

29. **trk177レビュー回帰の実機確認**：Node/VMテストと静的Security guardで、fx.jsの `applyNorm()` がcoreを束縛すること、バックアップのアドオン一覧・無効化、share_targetの事前確認・拒否時のinbox削除・launchQueueの二重確認なしを確認。以下6項目は**未実施**：①PC／AndroidのReplayGainタグ付き曲で平準化をオンにし、タグ由来の補正が効き、コンソールにReferenceErrorが出ないこと。②タグ無し曲で、端末内解析に基づく補正が効き、同じく例外が出ないこと。③アドオンを含むバックアップの確認に件数・名前・「すべてオフ」の説明が出ること、復元後は有効アドオンが0件で、手動有効化までコードが動かないこと。④手動選択した歌詞・字幕と字幕遅延を含むバックアップを復元できること。⑤Androidのインストール済みPWAでOS共有を承認し、確認後に既存経路へ入ること。⑥共有を拒否すると取り込まずInboxから消え、デスクトップの明示的な「このアプリで開く」は確認を重ねないこと（共有の詳細は§4-17）。

### 4.2 一回限りの移行・印（削除予定）

一覧と削除予定日は **[`docs/MIGRATIONS.md`](MIGRATIONS.md)** にあります（trk143 で登録簿にした）。
- 新しい一回限りの印・旧名の表を作ったら、登録簿に1行足す（`tools/check-repo.mjs` が表とコードのずれを失敗にし、期限切れを警告にする）。
- 期限は 2027-01-14（3か月後）。`trkRemoved` は保存データなので消さない。

## 5. 主なファイル

| 内容 | ファイル |
|---|---|
| Touhou固定タイトルデータ・曲カタログ | `js/touhou-theme-data.js`、`js/catalog.js` |
| 曲名照合・表示名 | `js/title-match.js`、`js/library.js`、`tests/title-match.test.mjs` |
| ミカの楽曲・出典・検査 | `docs/BLUEARCHIVE-MIKA-INDEX.md`、`docs/BLUEARCHIVE-MIKA-MUSIC.md`、`docs/BLUEARCHIVE-MIKA-ARIA.md`、`tools/bluearchive-mika*-tracklist.json`、`tests/bluearchive-mika.test.mjs` |
| 曲名照合の方針・ブラウザE2E | `docs/TITLE-MATCH.md`、`tools/e2e-title-match.mjs`（合成WAV・実曲未使用） |
| MIDI音色プロフィール・レンダラー・UI | `js/midi-profiles.js`、`js/midi-player.js`、`js/midi-settings.js`、`js/media.js` |
| 通常音声MIX DSP・左下パネル | `js/fx.js`、`js/fx-dock.js`、`css/style.css` |
| 設定・Import検証 | `js/core.js`、`tools/check-security.mjs` |
| 共有プレイリスト（📥）の取り込み・曲名照合 | `js/library.js`（`plImportPick`・`PLAYLIST_IMPORT_MAX`・`plMatchIndex`・`plMatchByTitle`）、`js/title-match.js`、`tests/playlist-import.test.mjs` |
| 🐔の並べ替え（↕） | `js/library.js`（`trkMovePlaylist`・`trkMoveButtonsState`・`trkOrderedPlaylists`）、`tests/trk-move-order.test.mjs` |
| 📥 OSの共有／「このアプリで開く」の受け口 | `js/share-inbox.js`（振り分け・確認・ファイル名の無害化）、`sw.js`（`handleShareTarget`・inboxキャッシュ）、`manifest.webmanifest`（share_target／file_handlers）、`tests/trk165-share-inbox.test.mjs`、`tools/check-security.mjs` |
| 🎤 歌詞（LRC・埋め込み歌詞） | `js/lyrics.js`（パーサ・保存・解決）、`js/audio-art.js`（`extractLyrics`）、`js/media-player-mode.js`（パネル）、`css/style.css`（`.mediaLyricsBox`）、`tests/trk166-lyrics.test.mjs` |
| 🏷 埋め込みテキストタグの表示 | `js/audio-art.js`（`extractTags`）、`js/library.js`（`songTags`・`songDisplayTitle`・`songDisplayMeta`・`loadSongTags`）、`js/media-player-mode.js`（`trackDisplayMeta`）、`tests/trk167-audio-tags.test.mjs`、方針＝`docs/TITLE-MATCH.md` |
| 🔊 音量の平準化（ReplayGain方式） | `js/fx.js`（`normPlan`・`applyNorm`・`G.norm`・設定「曲ごとの音量をそろえる」）、`js/media.js`（`analyzeAudio` の loudness/peak・`loudnessDb`・解析キャッシュ）、`js/audio-art.js`（`rgTrackGain`：`parseRgDb`・`parseMp4FreeformRg`）、`tests/trk168-loudness.test.mjs` |
| 💬 字幕（SRT/VTT） | `js/subtitles.js`（パーサ・保存 trk_subs_v1・`resolveSubs`・PiP用 `attachTrack`）、`js/library.js`（`.srt/.vtt` 相乗り→`it.subsFile`）、`js/media-player-mode.js`（💬 パネル・オーバーレイ・遅延調整）、`js/video-max.js`（全画面オーバーレイ）、`css/style.css`（`.mediaSubs`・`.videoMaxSubs`）、`tests/trk169-subtitles.test.mjs` |
| 🔖 M4Bチャプター | `js/audio-art.js`（`parseChplBox`・`findChpl`・`extractChapters`＝chpl(Nero) の読み取りだけ）、`js/library.js`（`MEDIA_EXT` に `m4b`）、`js/media-player-mode.js`（🔖 パネル・chapCache・💤「チャプターの終わりで止める」）、`css/style.css`（`.mediaChapBox`・`.chapLine`）、`tests/trk170-chapters.test.mjs` |
| 💿🎤 アルバム／アーティストの棚 | `js/library.js`（`libGroupCmp`・`libGroupKeyOf`・`libTrackNoOf`・`libEnsureGroupTags`／`libGroupRerenderSoon`・renderLib の見出し行）、`css/style.css`（`.libGroupHead`＝sticky）、`tests/trk171-album-groups.test.mjs` |
| ⚡ スマート棚（最近再生・よく再生・最近追加） | `js/library.js`（`libSmartSections`／`libSmartLast`／`libSmartPlays`・`noteMediaPlayed`（PLAYED.media）・`libSectionHead`・`addedItem`/`sharedItem` の addedAt）、`js/media-player-mode.js`（`noteMediaPlay`＝30秒/半分ルール・ended/曲変わり/開き直しのフック）、`tests/trk172-smart-shelf.test.mjs` |
| 🌊 波形シークバー | `js/media-player-mode.js`（`waveColumns`＝rms 包絡・`drawWave`＝塗り分け描画・ホバー時刻吹き出し・ResizeObserver）、`js/core.js`（`mediaWave` 既定オン）、`css/style.css`（`.mediaProgressWrap`・`.mediaWave`・`.mediaWaveTip`）、`tests/trk173-waveform.test.mjs` |
| 📈 進捗フィルター（未聴/継続/完了） | `index.html`（`#libProgress` セレクト）、`js/library.js`（`libPositions`・`libProgressOf`・renderLib の絞り込み）、`js/i18n.js`（5キー×4言語）、`js/core.js`（`libProgress` 既定 "all"）、`tests/trk174-progress-filter.test.mjs` |
| 📜 書斎の自動スクロール（縦読み・ハンズフリー） | `js/study-room.js`（自動スクロール状態機・Aキー/タップ/ホイール停止・TEXT 13キー×4言語）、`index.html`（⏩ ボタン・速度セレクト・ヘルプのA行）、`css/study-room.css`（実行中スタイル）、`tests/trk175-auto-scroll.test.mjs` |
| 🌗 読書用フィルタ（明るさ/コントラスト/反転系） | `js/study-room.js`（`studyReadFilterCss`・`studyApplyReadFilter`・クランプと候補検証・TEXT 8キー×4言語）、`index.html`（スライダー2本＋特殊フィルタのセレクト）、`css/study-room.css`（読書面の filter ルール）、`tests/trk176-read-filter.test.mjs` |
| 📦パックを外したときの復元 | `js/custom.js`（`packSnapshot`・`packRebase`・`packApplied`・`packRestoreSettings`・`restoreOwnSounds`）、`js/core.js`（`cleanPackPrev`・`settings.packPrev`）、`tests/pack-unapply.test.mjs` |
| MIDI/MIXとカタログの検査 | `tests/midi-player.test.mjs`、`tests/media-midi-integration.test.mjs`、`tests/midi-mix.test.mjs`、`tests/trk177-core-binding.test.mjs`、`tests/touhou-catalog.test.mjs` |
| MIDIの処理量の測定（手元のファイル用） | `tools/midi-budget.mjs`（`estimateRender` を使う。読むだけ） |
| 自動リストの削除の印・ガイドの言語 | `js/library.js`（`trkRemoved`・`trkRestoreRemoved`・`trkCatalogGuide`・`plGuideText`）、`js/core.js`（`cleanTrkRemoved`）、`tests/trk-playlists.test.mjs` |
| Riot系カタログ（LoL・VALORANT・LoL関連ゲーム）のCreator-Safe照合状態 | `js/catalog.js`（`LOL_CREATOR_SAFE`・`VAL_CREATOR_SAFE`・`RIOT_GAMES_CREATOR_SAFE`）、`js/library.js`（`RIOT_GUIDE_KEYS`）、`tools/leagueoflegends-*-tracklist.json`（各リストの `creatorSafe`）、`tools/riot-games-creator-safe-playlist.json`（Riot Games Creator-Safe Playlistの記録）、`tools/valorant-creator-safe.json`、`docs/LEAGUE-OF-LEGENDS-MUSIC.md`、`docs/VALORANT-MUSIC.md` |
| 利用者向けMIDI・権利案内 | `docs/guide/touhou-midi.md`、`docs/guide/sound.md`、`docs/guide/en.md` |
| 🎼 Agent OSTの任意連携／生成 | `js/library.js`（`AGENT_OST_MANIFEST_INCLUDED`・`initAgentOstTracks`）、`tools/make-trk-ost.mjs`（10曲＋manifestを `assets/trk-ost/`・Git外へ生成）、`tools/e2e-trk149.mjs`、`tests/agent-ost.test.mjs` |
| 🎵 trk's OST Vol.1 オリジナル曲 | `js/library.js`（`TRK_OST_MANIFEST_INCLUDED=false`・`initTrkOstSongs`・`syncTrkOstPackSongs`・`appendTrkOstSongs`・`trkOstSeenKeys`・案内 `plGuideTrkOst`）、音源は music-library の `.stpack`（CC BY 4.0）、`tools/ost-scores/`（JSON作曲＋ABC）、`tools/make-trk-song.mjs`（描画）、`tools/encode-ost-mp3.mjs`（MP3化・lamejsはRepo外）、`tests/trk-ost-songs.test.mjs`・`tests/ost-render.test.mjs` |
| 📦 まるごとバックアップ・ZIP CRC・復元 | `js/backup.js`（歌詞・字幕キーの許可、アドオン概要の確認、復元アドオンの無効化）、`js/zip-io.js`、`js/custom.js`（.stpackのストリーム読書き・`packIdentityFromManifest`）、`tests/backup-codec.test.mjs`、`tests/backup-restore.test.mjs`、`tests/pack-identity.test.mjs`、`tests/pack-zip-stream.test.mjs`、`tests/zip-io.test.mjs`、`tools/check-security.mjs` |
| CBZ／ZIP書斎のページ展開上限 | `js/study-room.js`（`studyAlbumLimits`・`studyImportArchiveBook`）、`tests/storage-limits.test.mjs` |
| Endfield楽曲台帳・曲名fixture・検査 | `docs/ARKNIGHTS-ENDFIELD-MUSIC.md`、`tools/endfield-zeroth-directive-tracklist.json`、`tools/endfield-msr-albums-tracklist.json`、`tools/check-repo.mjs` |
| Service Worker | `sw.js`（現行cache名：`trk-v2026.10.29-trk219`＝trk219。**配布ZIP（1.1.7）は `trk218`**、配布済みの 1.1.6 は `trk217`、1.1.5 は `trk216`、1.1.4 は `trk214`。1.1.2 は `trk211`、1.1.1 は `trk210`、1.1.0 は `trk208`、1.0.9 は `trk207`。アプリ本体が変わらない版では cache 名を上げない） |
| 🚪 メディアプレイヤーの抜け方（trk206） | `js/media-player-mode.js`（`mediaExitPlan`・`closeMedia`）、`js/library.js`（`previewContinue`）、`js/core.js`（`mediaReloadOnExit`）、`js/i18n-options.js`＋`index.html`（❓謎設定）、`tests/trk206-media-exit.test.mjs` |
| 📦 配布ZIPの組み立て（1.0.8〜・現在 1.1.7） | `tools/prepare-release.mjs`（`npm run release`。`index.html`＋`README.txt`＋`trk-files/` に組み、形を検査してZIPにする）、`release/README.txt`（配布用のかんたん起動。`--readme` を省くとこれが入る。**版と `README-1.x.y.md` の名前は `--version` とそろえる**）、`tests/release-layout.test.mjs`（形・時刻・README の版） |
| 📂 フォルダー共有の共通部品（trk208） | `js/shared-folders.js`（`window.TrkSharedFolders`＝`plan`／`uniqueLabel`／`mergeScans`／`walk`／`pathParts`／`readFileAt`。DOM・IndexedDB・書き込みなし）、`js/library.js`（登録簿 `"folders"`・`addSharedFolder`／`readSharedFolders`／`restoreSharedFolders`／`folderAutoKickShared`／`removeSharedFolder`／`renderSharedFolderList`）、`index.html`（`#libShareVideoBtn`・`#libSharedFolderList`）、`tests/trk208-shared-folders.test.mjs` |
| 📂 書斎の「フォルダーのまま読む本」（trk208） | `js/study-room.js`（`studyShareImageFolder`／`studyImportSharedFolder`／`studySharedPageBlob`／`studySharedFolderEnsure`・`studyBookClean` の `linked`／`sharedFolder`）、`js/study-room-utils.js`（`folderBookGroups`・`bookSize` の linked 扱い）、`js/backup.js`（`skip` と `checkStudyLimits`）、`index.html`（`#studyShareFolderBtn`） |
| 🖥 全画面の動画の拡大・縮小（trk212） | `js/video-max.js`（`zoomStepPercent`・`containSize`・`panLimit`／`clampPan`・`accumulateWheel`・`zoomAround`・`zoomFrame`・`paint` の `drawImage`）、`js/core.js`（`videoMaxWheelStep`）、`js/main.js`（`#videoMaxWheelStep`）、`index.html`、`css/style.css`（`.videoMaxZoom`・`.zoomed` のカーソル）、`tests/trk212-video-zoom.test.mjs` |
| 🎼 譜面生成方式の既定（trk216） | `js/core.js`（`chartGen` の既定 `"4"`・`chartGenChosen`・`resetAllPrefs`）、`js/main.js`（`#chartGen` の change で印を付ける・想定外値の寄せ先 `"4"`）、`js/i18n.js`（`chartGen3`／`chartGen4`／`chartGenHint` の4言語）、`index.html`（セレクトのラベル）、`tests/trk216-chartgen-default.test.mjs` |
| ⭐ お気に入りの4フォルダ（trk215） | `js/favs.js`（`stored`／`snapshot`／`save`＝`settings.favs`・`quickUnfreeze`／`holdButton`／`chips`）、`js/core.js`（`favs`・`favQuickUnfreeze`・`resetAllPrefs`）、`js/library.js`（`libFavKeys`・`libFavTab`・`libTabMatch`・行の ☆／📌／🧊）、`js/i18n-options.js`＋`index.html`（❓謎設定）、`css/style.css`（`.holding`・`.favPinN`）、`tests/trk215-favs.test.mjs` |
| 🐔 カタログのリスト選択（trk217・未配布） | `js/library.js`（`trkPickEntries`／`trkPickHas`／`trkPickAdd`／`trkPickRender`・`TRK_SHELVES`／`TRK_SERIES_FOLDER`・`trkSelectedFoldersOnly`・`ensureTrkDistributionPlaylists({ create:false })`）、`index.html`（`#trkPickSelect`／`#trkPickAdd`／`#trkPickHint`／`#trkPickStatus`）、`sw.js`（`trk217`）、`tests/trk217-playlist-catalog.test.mjs`、`docs/PLAYLIST-CATALOG-REVIEW.md`（trk-apk との突き合わせ） |
| 🔈 出力デバイスの切り替えで止まらない（trk219） | `js/audio-keep.js`（`keepPlan`・`recover`・1秒の見張り・`#video` の `play()`／`pause()` を包む）、`js/fx.js`（`wakeAudioHard(force)`・`TrkFX.context()`／`TrkFX.wake(force)`）、`index.html`（`media.js` の次の1行）、`tests/trk219-audio-output-keep.test.mjs`、`docs/guide/sound.md`・`docs/guide/en.md` |
| ⏱ 曲名タブの開始位置ボタン（trk213） | `js/core.js`（`previewStartShow`・`resetVideoPrefs`）、`js/library.js`（`previewSetShown`・`syncPreviewSetBtn`・`renderBanner`／`updateSpBuilder`）、`js/spectrum.js`（`buildBox` の `specPreviewSet`・TEXT 8キー）、`tests/trk213-preview-set-toggle.test.mjs` |
| 全体・安全検査 | `tools/check-repo.mjs`、`tools/check-security.mjs`、`tools/check-a11y.mjs`、`tools/check-lite.mjs` |

## 6. 直近の検証

**trk219（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **746 pass / 0 fail** | 745→+17（`tests/trk219-audio-output-keep.test.mjs`）。Static 0 failure・0 warning |
| 止まったら続きから再開（VM） | **OK** | 偽の再生要素・時計・タイマーで、アプリ外の `pause` → 250ms 後に `play()`（`currentTime` はそのまま）を実測 |
| 誤爆しないこと（VM） | **OK** | アプリの `pause()`（利用者の停止・Media Session）／`document.hidden`／`ended` では再開しない |
| 予算と休み（VM） | **OK** | 60秒に6回で打ち切り／`play()` が3回続けて失敗したら30秒休む |
| 詰まった再生（VM） | **OK** | `paused=false` のまま `currentTime` が 2.6 秒進まないと `play()` をやり直す。`readyState < 3`（読み込み待ち）では動かない |
| Web Audio の出口（VM） | **OK** | `AudioContext.state` が `suspended` なら `resume()`。`devicechange` では `TrkFX.wake(true)`（出口のつなぎ直し）を呼ぶ |
| 実機で出力デバイスを切り替える | **未確認** | サンドボックスに音声デバイスもブラウザーも無い。§4-59 の手順（曲を再生 → Windows の「サウンド」で出力先を変える → 止まらず続くこと、⏯ で止めたときは止まったままなこと）で確認する |

**1.1.8 の配布ZIP（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **747 pass / 0 fail** | Static・Security・a11y・lite も緑。`git diff --check` OK |
| 土台 | **1.1.7 の配布ZIP（Drive `trk-1.1.7`）** | `sha256 482a27ad…c184a` を確かめて展開した `trk-files/`（224ファイル）に、変わった**コード4ファイル**（`index.html`・`js/audio-keep.js`＝新規・`js/fx.js`・`sw.js`）と**配布版のガイド2本**（`docs/guide/sound.md`・`docs/guide/en.md`）だけを載せ替え＝ほかの差分は混ぜていない |
| `tools/prepare-release.mjs` | **OK** | `--version=1.1.8 --date=2026-10-29T14:00:00Z --newer-than=2026-10-29T13:00:00Z`。`--check` で `index.html`・`README.txt`・`trk-files/` の形を確認（`checkDocLinks` の指摘なし） |
| 配布ZIP（1.1.8） | **227エントリ・3,933,293 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-29 14:00`（UTC）**（1.1.7 の `13:00` より新しい）。**`sha256 8075ce5bc3a15af65273455b5f29ed9be9657283ecf9b61dedda9d80274be9c2`** |
| 1.1.7 のZIPとの差分 | **コード4ファイル＋配布版の文書6本** | `index.html`・`js/audio-keep.js`（新規）・`js/fx.js`・`sw.js`、`README-1.1.7.md`→`README-1.1.8.md`（改名＋追記）・`README.md`・`README-SLIM.md`・`docs/guide/sound.md`・`docs/guide/en.md`・ルートの `README.txt`（＋`release-manifest.json`） |
| 差分の当てやすさ | **OK** | 1.1.7 の展開物（README を `README-1.1.8.md` に改名）へコード／文書の2本を当てると、**配布物と完全一致**（`diff -rq`） |
| ローカルサーバーで配信 | **OK** | `/`・`trk-1.1.8/`・`trk-1.1.8/index.html`・`trk-1.1.8/trk-files/{index.html,js/audio-keep.js,js/fx.js,sw.js,README-1.1.8.md,release-manifest.json}`・`README.txt` がすべて 200 |
| 実機で出力デバイスを切り替える | **未確認** | サンドボックスに音声デバイスもブラウザーも無い。§4-59 の手順で確認する |
| Drive への追加（1.1.8） | **OK（2026-10-29）** | `trk-1.1.8` フォルダー（`1z8rwhgcVJerFRYBCmKEjt49IEsC1AGM2`）に ZIP・`SHA256SUMS-1.1.8.txt`・コード差分・文書差分・説明の5ファイル。**落とし直して `cmp` バイト一致**（sha256 `8075ce5b…be9c2`）|

**1.1.7 の配布ZIP（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **729 pass / 0 fail** | Static・Security・a11y・lite も緑。`git diff --check` OK |
| 土台 | **1.1.6 の配布ZIP（Drive `trk-1.1.6`）** | `sha256 7f856d9f…47f5f9` を確かめて展開した `trk-files/`（224ファイル）に、変わった**4ファイル**（`js/core.js`・`js/library.js`・`sw.js`・`css/style.css`）を載せ替え＝ほかの差分は混ぜていない |
| `tools/prepare-release.mjs` | **OK** | `--version=1.1.7 --date=2026-10-29T13:00:00Z --newer-than=2026-10-29T12:00:00Z`。`--check` で `index.html`・`README.txt`・`trk-files/` の形を確認（`checkDocLinks` の指摘なし） |
| 配布ZIP（1.1.7） | **226エントリ・3,926,426 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-29 13:00`（UTC）**（1.1.6 の `12:00` より新しい）。**`sha256 482a27adb35eda2f63abca08c2684e583460b441c0ac7a31658d7e35380c184a`** |
| 1.1.6 のZIPとの差分 | **コード4ファイル＋配布版の文書4本** | `css/style.css`・`js/core.js`・`js/library.js`・`sw.js`、`README-1.1.6.md`→`README-1.1.7.md`（改名＋追記）・`README.md`・`README-SLIM.md`・ルートの `README.txt`（＋`release-manifest.json`） |
| 差分の当てやすさ | **OK** | 1.1.6 の `trk-files/` に `patch -p1 --dry-run` でコード／文書の2本とも「checking file」だけ（失敗なし） |
| ローカルサーバーで配信 | **OK** | `/`・`trk-1.1.7/`・`trk-1.1.7/index.html`・`trk-1.1.7/trk-files/{index.html,js/library.js,js/core.js,sw.js,README-1.1.7.md,release-manifest.json}`・`README.txt` がすべて 200 |
| 実ブラウザで 👁／🗑／📋 | **未確認** | サンドボックスにブラウザーが無い。§4-57 の手順で確認する |
| Drive への追加（1.1.7） | **OK（2026-10-29）** | `trk-1.1.7` フォルダー（`1dRkTvLFzV_q3eqaFY5UD6bbze8IkErjW`）に ZIP・`SHA256SUMS-1.1.7.txt`・コード差分・文書差分・説明の5ファイル。**落とし直して `cmp` バイト一致**（sha256 `482a27ad…c184a`）|

**trk218（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **729 pass / 0 fail** | 715→+14（`tests/trk218-trk-list-visibility.test.mjs`）。Static 0 failure・0 warning（`docs/MIGRATIONS.md` とコードの一致も緑）・`git diff --check` OK |
| 初期状態で出さない（VM） | **OK** | `trkListShown(trk-…)`＝false／`pl…`＝true。`songProfile` は `filter(trkListShown)` で並べ、隠した件数を `plInListsHidden` で案内する |
| 👁／🗑 の出し入れ（VM） | **OK** | `trkListSetShown` で `settings.trkListed` に出し入れ・`saveUserPrefs()` 1回・**リストは消えない**。設定Importの `cleanTrkRemoved` は `trk-…` だけ残し、重複を落とし、200件で切る |
| 📋 のコピー（VM） | **OK** | `pl…` の ID・名前「（コピー）」付き24文字以内・同じ棚・`songs`／`wish`／`guide`／`tags` を引き継ぐ・`cat:""`・`frozen/locked:false`・元のリストは残る。200本に達していたら作らず `null` |
| 固定の案内 | **OK** | trk のリストが無ければ出さず印も立てない／あれば1回だけトーストし `trkFixedNotice=1`、2回目は出さない |
| 実ブラウザで 👁／🗑／📋 | **未確認** | サンドボックスにブラウザーが無い。§4 の手順で確認する |

**1.1.6 の配布ZIP（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **715 pass / 0 fail** | 704→+11（`tests/trk217-playlist-catalog.test.mjs`）。Static・Security・a11y・lite も緑 |
| `tools/prepare-release.mjs --check` | **OK（`checkDocLinks` 0件）** | 形は `index.html`・`README.txt`・`trk-files/` の3つだけ。`service_worker_cache` は `trk-v2026.10.29-trk217` |
| 配布ZIP（1.1.6） | **226エントリ・3,922,091 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-29 12:00`（UTC）**（1.1.5 の `10:00` より新しい）。`sha256 7f856d9f4f9d1a507047fcfd223de966e904a711a1f87c2f66aeed87bc47f5f9` |
| 1.1.5 のZIPとの差分 | **コード3ファイル＋配布版の文書3本** | `index.html`・`sw.js`・`js/library.js`、`README-1.1.5.md`→`README-1.1.6.md`（改名）・`README.md`・`README-SLIM.md`。棚の追加リストは `docs/PLAYLIST-CATALOG-REVIEW.md`（リポジトリのみ）|
| コードの同一性 | **OK** | 3ファイルがリポジトリの HEAD と `cmp` でバイト同一 |
| ローカルサーバーで配信 | **OK** | `/`・`index.html`・`trk-files/index.html`・`trk-files/js/library.js`・`trk-files/sw.js`・`trk-files/README-1.1.6.md`・`trk-files/release-manifest.json`・`README.txt` が 200 |
| Drive への追加（1.1.6） | **OK（2026-10-29）** | `trk-1.1.6` フォルダー（`1S01wbrKXkGBqGPgQ7wx9PvQaHXugAada`）に ZIP・`SHA256SUMS-1.1.6.txt`・コード差分・文書差分・説明の5ファイル。**落とし直して `cmp` バイト一致**（sha256 `7f856d9f…47f5f9`）|

**1.1.5 の配布ZIP（2026-10-29）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **704 pass / 0 fail** | 697→+7（`tests/trk216-chartgen-default.test.mjs`）。Static・Security・a11y・lite も緑 |
| `tools/prepare-release.mjs --check` | **OK（`checkDocLinks` 0件）** | 形は `index.html`・`README.txt`・`trk-files/` の3つだけ。`service_worker_cache` と `sw.js` の `CACHE` が一致（`trk-v2026.10.29-trk216`）・`layout:"wrapper"`・入口に `location.replace` |
| 配布ZIP（1.1.5） | **226エントリ・3,916,257 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-29 10:00`（UTC）**（1.1.4 の `2026-10-27 22:00` より新しい）・`sha256 0b12ae8c35062910aa5c66e2c027c7a85670bd5204e5ee9abc6a2fbd4c8f8599`・`trk-files/` は224ファイル |
| 1.1.4 のZIPとの差分 | **コード11ファイル＋配布版の文書4本** | `index.html`・`css/style.css`・`sw.js`・`js/{chart-gen,core,favs,i18n-options,i18n,library,main,media}.js`（trk215＋trk216）。文書は `README-1.1.5.md`（改名）・`README.md`・`README-SLIM.md`・`docs/guide/files.md` |
| コードの同一性 | **OK** | 11ファイルがリポジトリの HEAD と `cmp` でバイト同一 |
| 落とし直しての確認 | **OK** | Drive から `trk-1.1.5.zip` を取り直して `cmp` バイト一致・`sha256sum -c` OK |
| Drive への追加（1.1.5） | **OK（2026-10-29）** | `trk-1.1.5` フォルダー（`1j9mIFWIW5m7ZQSwXiy2OaqviT7JiXghw`）に ZIP・`SHA256SUMS-1.1.5.txt`・**`trk216-chartgen-default.diff`**・**`trk-1.1.4-to-1.1.5-code.diff`**・`README-1.1.5-drive.txt`。**APK（1.0.4 ベース）向けに diff を同梱**（利用者の指定） |

**1.1.4 の配布ZIP（2026-10-27）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `tools/prepare-release.mjs --check` | **OK（`checkDocLinks` も0件）** | 形は `index.html`・`README.txt`・`trk-files/` の3つだけ。`service_worker_cache` と `sw.js` の `CACHE` が一致（`trk-v2026.10.27-trk214`）・`layout:"wrapper"`・入口に `location.replace` |
| `checkDocLinks()` | **0件**（1.1.3 は8件） | 配布版の文書から「1.0.4 ポータブルZIP」等の表記と `README-1.0.x.md` への参照が消えた |
| 配布ZIP（1.1.4） | **226エントリ・3,910,309 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-27 22:00`（UTC）**（1.1.3 の `21:00` より新しい）・`sha256 b8050bc55fa499472079be2ebea3ea190bdd5d1bd408780c4804506a638501b2`・`trk-files/` は224ファイル・展開後 10,602,135 bytes |
| 1.1.3 のZIPとの差分 | **16行（うち改名1）** | `README.txt`・`CONTRIBUTING.md`・`NOTICE.md`・`README-SLIM.md`・`README.md`・`README-1.1.3.md`→`README-1.1.4.md`・`docs/SECURITY.md`・`docs/guide/{appearance,en,files,mods,start}.md`・`js/video-max.js`・`privacy.html`・`release-manifest.json`・`sw.js`。**アプリのコードは2ファイルだけ**（`js/video-max.js`・`sw.js`）で、ほかの7本（`index.html`・`css/style.css`・`js/{core,i18n,library,main,spectrum}.js`）は 1.1.3 とバイト同一 |
| コードの同一性 | **OK** | 9ファイル（`index.html`・`css/style.css`・`js/{core,i18n,library,main,spectrum,video-max}.js`・`sw.js`）がリポジトリの HEAD と `cmp` でバイト同一 |
| ローカルサーバーで配信 | **OK** | `/`・`trk-files/index.html`・`trk-files/js/spectrum.js`・`trk-files/sw.js`・`trk-files/release-manifest.json`・`trk-files/README-1.1.4.md` がすべて 200 |
| 再検証（304）の切り分け | **OK** | `If-Modified-Since: Tue, 27 Oct 2026 21:00:00 GMT`（1.1.3）→ **200**、`22:00:00 GMT`（1.1.4）→ **304**。`Last-Modified: Tue, 27 Oct 2026 22:00:00 GMT` |
| Drive への追加（1.1.4） | **OK（2026-10-27）** | 順序は「HANDOFF → merge → Drive」。`trk-1.1.4` フォルダー（`1GEciYn0igWmXUgXYJxnfO6lSaifIHQxe`）に `trk-1.1.4.zip`（`1Y46GP06hFj7go2NYxO895Z6kHoTX6IN7`・3,910,309 bytes）と `SHA256SUMS-1.1.4.txt`（`1NfDZTvB4-d1wZ058UOgzgLsMGHSagId-`）。Drive の `sha256Checksum` が手元の `sha256`（`b8050bc55fa499472079be2ebea3ea190bdd5d1bd408780c4804506a638501b2`）と一致 |
| 実機（外へ出るドラッグ・ピンチ→1本指） | **未確認** | ヘッドレスでは触れない。§4-51 の手順で確認する |

**trk214（2026-10-27）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **680 pass / 0 fail** | Static 0・Security 64・a11y 8・lite 123。内訳 +7＝`tests/trk212-video-zoom.test.mjs` の trk214 4件（ピンチのあと1本指・100%では切り替えない・捕まえる/返す・blur で全部返す）と `tests/release-layout.test.mjs` の3件（リンク切れ・見逃す種類・cache） |
| `checkDocLinks()` を 1.1.3 のZIPに当てる | **8件を検出** | `CONTRIBUTING.md`・`README-1.1.3.md`／`README.md`（`trk-files/README-1.0.8.md`・`trk-files/README-1.1.1.md`）・`docs/guide/en.md`・`files.md`・`mods.md`。**1.1.4 を組むときに直す**（§9） |
| 実機のドラッグ（外へ出る）・ピンチのあとの1本指 | **未確認** | ヘッドレスでは触れない。VM の偽 stage で `setPointerCapture`／`releasePointerCapture` の呼び出しまで確認済み（§4-49） |

**1.1.3 の配布ZIP（2026-10-27）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `tools/prepare-release.mjs --check` | **OK** | 1.1.3 の組み上がりが `index.html`・`README.txt`・`trk-files/` の3つだけ。`service_worker_cache` と `sw.js` の `CACHE` が一致（`trk-v2026.10.27-trk213`）・`layout:"wrapper"`・入口に `location.replace` |
| 配布ZIP（1.1.3） | **226エントリ・3,908,257 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-27 21:00`（UTC）**（1.1.2 の `20:00` より新しい）・`sha256 7f4c04a9…1df3f5`・`trk-files/` は224ファイル |
| 1.1.2 のZIPとの差分 | **9ファイル＋ガイド2＋README 4＋manifest** | `index.html`・`css/style.css`・`js/core.js`・`js/i18n.js`・`js/library.js`・`js/main.js`・`js/spectrum.js`・`js/video-max.js`・`sw.js`。`README-1.1.2.md` → `README-1.1.3.md`・`README.md`・`README-SLIM.md`・`README.txt`。`docs/guide/start.md`・`docs/guide/en.md` は trk212／trk213 の段落だけ追加。`credits.html`・`privacy.html`・`assets/mmd/lat-miku/*` などは 1.1.2 と同一（`cmp`） |
| ローカルサーバーで配信 | **OK** | `/`・`trk-files/index.html`・`trk-files/js/spectrum.js`・`trk-files/sw.js`・`trk-files/release-manifest.json` がすべて 200 |
| 再検証（304）の切り分け | **OK** | 1.1.3 のZIPを配信し、`If-Modified-Since: Tue, 27 Oct 2026 20:00:00 GMT`（1.1.2）では **200**、`21:00:00 GMT`（1.1.3）では **304** |
| Drive への追加（1.1.3） | **OK（2026-10-27）** | 順序は「HANDOFF → merge → Drive」。`trk-1.1.3` フォルダー（`1RDDIa7yJcwGx_rbslCqUF33MgE_mdi1K`）に `trk-1.1.3.zip`（`1Bi9FPArUNopM_UDKDVqPDTr0D-mbGN4Q`・3,908,257 bytes）と `SHA256SUMS-1.1.3.txt`（`1GN1LHx1I1orY2YIJDvCqgOM2ADqU1DMr`）。Drive の `sha256Checksum` が手元の `sha256`（`7f4c04a9…1df3f5`）と一致 |
| 利用者による起動確認 | **1.0.9 で確認済み（2026-10-27）** | 1.1.3 は同じ入口・同じ形（`index.html`＋`README.txt`＋`trk-files/`）。1.1.2 からの差し替えは 9ファイル＋ガイド＋README |
| PC／スマホ実機で 1.1.3 のUI（🖥 のズーム・⏱ のチェック） | **未確認** | ヘッドレスsmokeは実機のホイール・タッチを再現しない。§4-46・§4-47・§4-48 の手順で確認する |

**trk213（2026-10-27・1.1.3 で配布）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **673 pass / 0 fail**（trk213 の6件を含む） | 静的 `check-repo` 0 failure・0 warning（`sw.js` の cache は `trk-v2026.10.27-trk213`）・`check-security` 64・`check-a11y` 8・`check-lite` 123 |
| 設定の初期値 | **OK** | `previewStartShow` は `prefs.previewStartShow === true`（未設定・旧版の 1 などは出さない）。`resetVideoPrefs()` で `false` に戻る |
| 出し入れ（VM） | **OK** | オン＋曲＋準備完了で出る／オフ・曲なし・準備前・`1`（真偽値でない）では出ない。オフにすると開いているバーを1回だけ閉じる |
| 置き場所 | **OK** | `buildBox` の1か所（設定画面の 📊 スペクトラムとラックの「くわしい設定」の両方）・4言語・その場で `syncPreviewSetBtn()` |
| 実機でボタンの出方・チェックの位置 | **未確認** | `node_modules` もブラウザーも無いため、見え方は利用者に確認してもらう |

**trk212（2026-10-27・1.1.3 で配布）の確認**

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **667 pass / 0 fail**（trk212 の11件を含む） | 静的 `check-repo` 0 failure・0 warning（`sw.js` の cache は `trk-v2026.10.27-trk212`）・`check-security` 64・`check-a11y` 8・`check-lite` 123・`git diff --check` OK |
| 回帰の確かめ | **OK** | `paint()` の `const w = baseW * z` を `baseW` に戻すと trk212 の描画2件が失敗し、戻すと 11/11 が通る（ズームが実際に描画へ届いていることを確認） |
| ズームの計算 | **OK（vm で単体確認）** | 100%→5%で `1.05`／2%で `1.02`／10%で `1.1`・200段で上限 `5.0`・`zoomAround({1,0,0},2,.25,.5,{1,.5625})`＝`{zoom:2,panX:.25,panY:0}`（ポインター点が動かない）・2倍＋右100px ドラッグ＝`panX 0.0625`・±0.5 で停止・ピンチ 200→400px＝2倍 |
| 壊れた値の扱い | **OK** | `videoMaxWheelStep` が未設定・NaN・範囲外でも `zoomStepPercent` が 5（2/5/10 の最近傍・7→5・9→10）・`panLimit(NaN)`＝0・`accumulateWheel` の `-0` は 0 |
| PC／スマホ実機でホイール・ドラッグ・ピンチ | **未確認** | `node_modules` もブラウザーも無いため、感触は利用者に確認してもらう |

**trk211・1.1.2（2026-10-27）の確認**（trk193〜210 の途中の記録はアーカイブへ移動）

| 検査 | 結果 | 範囲・注意 |
|---|---|---|
| `npm run check` | **656 pass / 0 fail**（trk208 の22件＋trk210 の6件＋trk211 の6件） | 静的 `check-repo` 0 fail（`sw.js` の cache は `trk-v2026.10.27-trk211`・配布READMEの版は 1.1.2）・`check-security` 64 pass / 0 fail・`check-a11y` 8・`check-vendor` 8（100モジュール）・`check-study-room` 314文言・`check-lite` 123・`git diff --check` OK |
| 回帰の確かめ | **OK** | 修正前の `js/library.js` に戻すと trk211 の検査は 5/6 が失敗し、直すと 6/6 が通る（テストが不具合を捕まえていることを確認） |
| `tools/prepare-release.mjs --check` | **OK** | 1.1.2 の組み上がりが `index.html`・`README.txt`・`trk-files/` の3つだけ。`service_worker_cache` と `sw.js` の `CACHE` が一致（`trk-v2026.10.27-trk211`）・`layout:"wrapper"`・入口に `location.replace` |
| 配布ZIP（1.1.2） | **226エントリ・3,899,166 bytes・`unzip -t` 破損なし** | 全エントリ **`2026-10-27 20:00`（UTC）**（1.1.1 の `19:00` より新しい）・`sha256 837086d2…6556c`・`trk-files/` は224ファイル |
| 1.1.1 のZIPとの差分 | **2ファイル＋README 3本だけ** | `js/library.js`（`sharedPendingNameFrom` と4か所の呼び出し）・`sw.js`（cache）。`README-1.1.1.md` → `README-1.1.2.md`・`README.md`・`README-SLIM.md`。ほかのファイルは 1.1.1 と同一（`cmp`） |
| ローカルサーバーで `/` → `trk-files/index.html` | **OK** | `/`・`trk-files/index.html`・`trk-files/js/library.js`・`trk-files/sw.js`・`trk-files/release-manifest.json` がすべて 200 |
| 再検証（304）の切り分け | **OK** | 1.1.2 のZIPを配信し、`If-Modified-Since: 2026-10-27 19:00`（1.1.1）では **200**、`20:00`（1.1.2）では **304** |
| Drive への追加（1.1.2） | **OK** | `trk-1.1.2` フォルダーに `trk-1.1.2.zip`（3,899,166 bytes）と `SHA256SUMS-1.1.2.txt`。Drive の `sha256Checksum`＝手元の `sha256`（`837086d2…6556c`）で一致 |
| 利用者による起動確認 | **1.0.9 で確認済み（2026-10-27）** | 1.1.2 は同じ入口・同じ形（`index.html`＋`README.txt`＋`trk-files/`）。1.1.1 のZIPからの差し替えはレビューで確認済み（`GET /` 200・`?safe=1`・`file://`） |
| PC／スマホ実機で 1.1.2 のUIを操作（📂 の共有・🔓） | **未確認** | ヘッドレスsmokeは実機のタッチ・許可ダイアログを再現しない。#43・#44・#45 の手順で確認する |

## 7. 最近の変更

- **📦 1.1.8：trk219 を配る版（2026-10-29）**：**アプリ本体は trk219**（出力デバイスを切り替えても再生を止めない）。1.1.7 の配布ZIPの `trk-files/` を土台に、**コード4ファイル**（`index.html`・`js/audio-keep.js`＝新規・`js/fx.js`・`sw.js`）と**配布版のガイド2本**（`docs/guide/sound.md`・`docs/guide/en.md`）を差し替え、`README-1.1.7.md` を `README-1.1.8.md` に改名して今回の内容を追記、`README.md`・`README-SLIM.md`・`release/README.txt` を 1.1.8 に（`README-SLIM.md` のファイル数も 225 に）。
  - ZIP は **`2026-10-29 14:00`（UTC）** で組み立て＝**227エントリ・3,933,293 bytes**・`unzip -t` 破損なし・全エントリ同時刻・**`sha256 8075ce5bc3a15af65273455b5f29ed9be9657283ecf9b61dedda9d80274be9c2`**。`--check` OK・ローカル配信 200・差分は 1.1.7 に当てると配布物と完全一致。
  - **1.1.0〜1.1.7 のZIPと Drive の `trk-1.1.0`〜`trk-1.1.7` はそのまま**（同じ名前で作り直さない）。
- **🔈 trk219：出力デバイスを切り替えても再生を止めない（2026-10-29）**：実機で「Windows のサウンドで出力先を切り替えると止まる」との指摘への対応。**`js/audio-keep.js`（新規）**が `#video` の `play()`／`pause()` を包んで「アプリが頼んだ停止」を記録し、**頼まれていない `pause`**（出力デバイスの切り替えでブラウザーが止めた場合など）を見つけたら **250ms 後に続きから鳴らし直す**。`readyState >= 3` なのに `currentTime` が 2.6 秒進まない「詰まり」も `play()` のやり直しで解く。**画面が隠れているとき・終端では再開しない**、**60秒に6回まで**、**3回続けて失敗したら30秒休む**。`js/fx.js` に **`TrkFX.context()`／`TrkFX.wake(force)`**（`wakeAudioHard`）を足し、`AudioContext` の `resume()` と、デバイスの切り替え時の**出口（`G.out`）のつなぎ直し**を行う。`mediaDevices` の `devicechange` と `AudioContext` の `statechange` も見る。設定は増やしていない。文言（`docs/guide/sound.md`・`docs/guide/en.md`）に1節ずつ、`sw.js` の cache は **`trk-v2026.10.29-trk219`**、`tests/trk219-audio-output-keep.test.mjs`（17件）で **746 pass**。**実機での確認は未了**（§4-59）。
- **📦 1.1.7：trk218 を配る版（2026-10-29）**：**アプリ本体は trk218**（🐔 trk のリストを曲画面に出さない・👁／🗑／📋）。1.1.6 の配布ZIPの `trk-files/` を土台に、**コード4ファイル**（`css/style.css`・`js/core.js`・`js/library.js`・`sw.js`）を差し替え、`README-1.1.6.md` を `README-1.1.7.md` に改名して今回の内容を追記、`README.md`・`README-SLIM.md`・`release/README.txt` を 1.1.7 に（`release-manifest.json` は `--version` から作られる）。
  - ZIP は **`2026-10-29 13:00`（UTC）** で組み立て＝**226エントリ・3,926,426 bytes**・`unzip -t` 破損なし・全エントリ同時刻・**`sha256 482a27adb35eda2f63abca08c2684e583460b441c0ac7a31658d7e35380c184a`**。`--check` OK・ローカル配信 200・差分は 1.1.6 に `patch -p1 --dry-run` で通る。
  - **1.1.0〜1.1.6 のZIPと Drive の `trk-1.1.0`〜`trk-1.1.6` はそのまま**（同じ名前で作り直さない）。
- **🐔 trk218：trk のリストを初期は曲画面に出さない／🗑・👁・📋（2026-10-29）**：実機でピッカーを触った利用者の「並ぶと圧迫する」という声への対応。**曲画面の「プレイリストに入れる」には trk のリスト（`trk-…`）を初期状態では出さない**（`settings.trkListed`＝出すIDの一覧・初期 `[]`。隠した件数は `plInListsHidden` で 👁 の場所を案内）。⚙ → 🐔 の一覧に **👁／🗑**（`trkListSetShown`・**リストは消さない**・隠れている 👁 は `.plTrkHidden` で淡く・`aria-pressed`）と **📋**（`trkCopyAsUser`＝`pl…` の通常プレイリスト・`cat:""` で自動更新と切る・24文字以内の「（コピー）」・同じ棚・中身とガイドを引き継ぐ・上限200本）を足した。ボタンは **`trk-…` のリストだけ**に出す。**既に編集していた人には起動時に1回だけ** `trkFixedNotice` で固定の旨を伝える（`trkFixedNoticeOnce`・`resetAllPrefs`／設定Import対応・MIGRATIONS に登録）。`plDelete` は `trkListed` からも ID を消す。文言は4言語、`sw.js` の cache は **`trk-v2026.10.29-trk218`**、`tests/trk218-trk-list-visibility.test.mjs`（14件）で **729 pass**。
- **📦 1.1.6：trk217 を配る版（2026-10-29）**：**アプリ本体は trk217**（🐔 trk's playlist のリスト選択）。1.1.5 の配布ZIPの `trk-files/` を土台に、**コード3ファイル**（`index.html`・`sw.js`・`js/library.js`）を差し替え、`README-1.1.5.md` を `README-1.1.6.md` に改名して今回の内容を追記、`README.md`・`README-SLIM.md`・`release/README.txt` を 1.1.6 に。
  - ZIP は **`2026-10-29 12:00`（UTC）** で組み立て＝**226エントリ・3,922,091 bytes**・`unzip -t` 破損なし・**`sha256 7f856d9f4f9d1a507047fcfd223de966e904a711a1f87c2f66aeed87bc47f5f9`**。ダウンロード欄に残っていた「1.1.4の配布物」「`trk-1.1.4.zip`」も 1.1.6 に直した。
  - **1.1.0〜1.1.5 のZIPと Drive の `trk-1.1.0`〜`trk-1.1.5` はそのまま**（同じ名前で作り直さない）。
- **🐔 trk217：trk's playlist を trk-apk の新基準へ（2026-10-29・1.1.6 で配布）**：起動時の一括作成をやめ（`create:false`＝既存の更新と移行だけ）、設定の 🐔 に**リスト選択**（`trkPick*`）を足した。消したリストはピッカーから1本ずつ戻し（♻ は出さない）、表示チェックは表示だけ。棚は `TRK_SHELVES` に集約し、追加したリストに要る棚だけを作る。`tests/trk217-playlist-catalog.test.mjs`（11件）で **715 pass**。精査は [`PLAYLIST-CATALOG-REVIEW.md`](PLAYLIST-CATALOG-REVIEW.md)。
- **📦 1.1.5：trk215・trk216 を配る版（2026-10-29）**：**アプリ本体は trk216**（お気に入りの4フォルダ＋譜面生成の既定を Bタイプへ）。1.1.4 の配布ZIPの `trk-files/` を土台に、**コード11ファイル**＋`README-1.1.5.md`（改名）・`README.md`・`README-SLIM.md`・`docs/guide/files.md` を差し替え、`release/README.txt` の版と README 名も 1.1.5 へ。
  - ZIP は **`2026-10-29 10:00`（UTC）** で組み立て＝**226エントリ・3,916,257 bytes**・`unzip -t` 破損なし・全エントリ同時刻・**`sha256 0b12ae8c35062910aa5c66e2c027c7a85670bd5204e5ee9abc6a2fbd4c8f8599`**。
  - `--check` **OK**（`checkDocLinks` 0件）・落とし直してバイト一致。Drive は **`trk-1.1.5`**（`1j9mIFWIW5m7ZQSwXiy2OaqviT7JiXghw`）に **ZIP＋SHA256SUMS＋今回の diff 2本＋説明**（APK が 1.0.4 ベースで並行開発中のため）。
  - **1.1.0〜1.1.4 のZIPと Drive の `trk-1.1.0`〜`trk-1.1.4` はそのまま**（同じ名前で作り直さない）。
- **🎼 trk216：譜面生成方式の既定を Bタイプ（方式4）にする（2026-10-29・1.1.5 で配布）**：利用者の感触で B のほうが良い、という判断。
  - `settings.chartGen` の既定を **`"4"`** に（`core.js`）。**`settings.chartGenChosen`** を足し、`#chartGen` を選んだら true にして**その選択を尊重**する。印が無い人の保存値（既定が A だったころの `"3"`）は B へ移る。工場出荷は B＋印なし。
  - ラベルとヒント（4言語）を「**B＝標準・既定／A＝従来**」に入れ替え。`js/chart-gen.js`・`js/media.js` の説明も更新。
  - `sw.js` の cache は **`trk-v2026.10.29-trk216`**、`tests/trk216-chartgen-default.test.mjs`（7件）で **704 pass**。
- **⭐ trk215：お気に入りの4フォルダを、どれも使えるようにする（2026-10-29・1.1.5 で配布）**：1.1.4 の実機レビューで「⭐1軍 以外が正常に動かない」と確認された4点を直した。
  - **保存する場所が無かった**：2軍〜元お気に入り・📌ピン・🔒凍結・選んでいたフォルダを `settings.favs` に保存する（`save()` が `snapshot()` を書いて `saveUserPrefs()`）。1軍は今までどおり `tvFav`／`fxFav`／`songFav`。**`tidy()` は1軍の配列を差し替えない**（`rewrite()` で中身だけ入れ替える＝`syncMain` に戻されない）。
  - **凍結は最初からオンにしない**（`locks` の既定を `["frozen"]` → `[]`）。🧊フリーズへ、そのまま入れられる。
  - **⭐タブは、どのフォルダかに1曲でも入っていれば出す**（`libFavTab`）。⭐ を見ているなら0曲でも出す＝**フォルダを選んだだけでタブごと消えない**。チップで4フォルダを行き来でき、0曲のときは `libFavEmpty` で案内する。
  - **凍結の解除は3秒長押し**（🔒 と、凍結中の 🧊 のチップ）。押している間は3秒ぶんのバーが出る。❓謎設定「🧊 フリーズ（凍結）の解除をワンタップにする」（`favQuickUnfreeze`・**既定オフ**）で1タップにもできる。
  - 曲の行の ☆ は**いま開いているフォルダ**へ入れる（📤を見ているときは1軍へ）。行に 📌／🧊 の印、チップに 📌 の数。
  - `sw.js` の cache は **`trk-v2026.10.27-trk215`**、`tests/trk215-favs.test.mjs`（17件）で **697 pass**。
- **📦 1.1.4：trk214 を配る版（2026-10-27）**：**アプリ本体は trk214**（ドラッグ中に外へ出てもずらせる・ピンチのあと残った1本指で動かせる）＋**配布版の文書を現在の形に**（「1.0.4 ポータブルZIP」等の表記・入っていない `README-1.0.x.md` への参照を削除）。1.1.3 の配布ZIPの `trk-files/` を土台に、**アプリのコードは2ファイル**（`js/video-max.js`・`sw.js`）だけ差し替え、ガイド2本に1文ずつ足し、文書9本を直した。**ZIPの形は 1.1.3 と同じ**。
  - ZIP は **`2026-10-27 22:00`（UTC）** で組み立て＝**226エントリ・3,910,309 bytes**・`unzip -t` 破損なし・全エントリ同時刻・`sha256 b8050bc55fa499472079be2ebea3ea190bdd5d1bd408780c4804506a638501b2`。
  - `prepare-release --check` **OK**（`checkDocLinks` **0件**＝1.1.3 の8件を解消）・配信は 200×6・再検証は `21:00` で **200**／`22:00` で **304**。
  - **1.1.0〜1.1.3 のZIPと Drive の `trk-1.1.0`〜`trk-1.1.3` はそのまま**。
- **🔍 trk214：全画面ズームの仕上げと、配布物の文書のリンク切れ検査（2026-10-27・1.1.4 で配布）**：**配布の妨げにならない軽微2点**を直した。(1) ドラッグ中は `stage.setPointerCapture` でポインターを掴み、**映像の外（ウィンドウの外）へ出てもずらしが続く**（押しただけの長押しシークは従来どおり外で止まる）。(2) **ピンチのあとに1本指を離しても、残った指でそのまま動かせる**（`endZoomGesture` が「2本→1本」で `dragState` を作り直す。100% では切り替えない）。
  - 配布版だけの文書に残っていた**古い版の表記とリンク切れ**（「1.0.4 ポータブルZIP」・`README-1.0.4.md`／`README-1.0.8.md`／`README-1.1.1.md` への参照）を機械で見つけられるように `tools/prepare-release.mjs` に **`checkDocLinks()`** を足し、`--check` と組み立ての両方で走らせた。1.1.3 のZIPでは **8件**（§2・§9）。
  - `sw.js` の cache は **`trk-v2026.10.27-trk214`**。`npm run check` は **680 pass**（+7：`tests/trk212-video-zoom.test.mjs` の trk214 4件・`tests/release-layout.test.mjs` の3件）。**1.1.3 のZIPは trk213 のまま**（配り直さない。次の 1.1.4 が trk214）。
- **📦 1.1.3：trk213 を配る版（2026-10-27）**：**アプリ本体は trk213**（trk212＝全画面のズーム、trk213＝開始位置ボタンの初期オフ）。1.1.2 の配布ZIPの `trk-files/` を土台に、変わった **9ファイル**（`index.html`・`css/style.css`・`js/core.js`・`js/i18n.js`・`js/library.js`・`js/main.js`・`js/spectrum.js`・`js/video-max.js`・`sw.js`）だけを差し替え、配布版ガイドの `docs/guide/start.md`・`docs/guide/en.md` には trk212・trk213 の段落だけを足した。`README-1.1.2.md` → **`README-1.1.3.md`**（`README.md` も同内容）・`README-SLIM.md`・`release/README.txt` の版を 1.1.3 にそろえた。**ZIPの形は 1.1.2 と同じ**（`index.html`＋`README.txt`＋`trk-files/`）。
  - ZIP は **`2026-10-27 21:00`（UTC）** で組み立て（1.1.2 の `20:00` より新しい）＝**226エントリ・3,908,257 bytes**・`unzip -t` 破損なし・全エントリ同時刻・`sha256 7f4c04a964d681ad450eaf90749e4fb624e465fd7e84bbbcb2da50037f1df3f5`。
  - `prepare-release --check` **OK**・ローカル配信で `/`・`trk-files/index.html`・`js/spectrum.js`・`sw.js`・`release-manifest.json` が 200・再検証は `20:00` で **200**／`21:00` で **304**。
  - **1.1.0・1.1.1・1.1.2 のZIPと Drive の `trk-1.1.0`／`trk-1.1.1`／`trk-1.1.2` はそのまま**（同じ名前で作り直さない）。1.1.3 は別ZIP・別フォルダー（`trk-1.1.3`）。
- **⏱ trk213：「ここをプレビュー開始位置にする」を初期は出さない（2026-10-27・1.1.3 で配布）**：使わない人が誤って触り、曲ごとのプレビュー開始位置が変わるリスクを減らす。
  - 設定 `core.settings.previewStartShow`（**初期オフ**）を追加。`resetVideoPrefs()` で `false` に戻す。
  - 📊 スペクトラムの設定（⚙ 設定の「📊 スペクトラム（音の見える化）」とラックの「くわしい設定」）に **「⏱ 「ここをプレビュー開始位置にする」を表示」** のチェックを追加（`specPreviewSet`・説明つき・4言語）。
  - `js/library.js` の `previewSetShown()`／`syncPreviewSetBtn()` が1か所で決め、`renderBanner()`・`updateSpBuilder()` とチェックの変更が通る。**オフにしたら開いている開始位置のバーも閉じる**。
  - 曲ごとの `previewStart` は消さない。「⏮ 常に最初から再生する」は 🎵 サウンドとメディアプレーヤーから今までどおり。
  - `sw.js` の cache は **`trk-v2026.10.27-trk213`**、`tests/trk213-preview-set-toggle.test.mjs`（6件）で **673 pass**。
- **🖥 trk212：全画面の動画をホイールで拡大・縮小（2026-10-27・1.1.3 で配布）**：「全画面中の拡大・縮小が意図どおりに動かない」との指摘を受け、**全画面の中だけ**に効くズームを作り直した。
  - **ホイール上＝拡大／下＝縮小**、**ポインターの位置を中心**、**1回 2%／5%（既定）／10%**（⚙ 設定 → 🎨 見た目）。**100%＝従来の全体表示**で、上限は 500%。
  - **拡大中はドラッグでつまんで移動**（6px から）。**100% では効かせない**（左右の長押しシークと衝突させない）。**2本指のピンチ**も同じ。押すと 100% に戻る **🔍 {n}%** ボタンを上部に足した。
  - 純関数（`zoomStepPercent`／`containSize`／`panLimit`・`clampPan`／`accumulateWheel`／`zoomAround`／`zoomFrame`）と `paint()` の `drawImage` 矩形、FI の `setTransform` を同じ矩形にそろえた。**パック画像は対象外**。
  - 全画面を開くたび・曲が替わるたびに 100%。`panX`／`panY` は画面に対する割合で保持。文言は4言語、`sw.js` の cache は **`trk-v2026.10.27-trk212`**、`tests/trk212-video-zoom.test.mjs`（11件）で **667 pass**。
- **📦 1.1.2：trk211 を配る版（2026-10-27）**：**アプリ本体は trk211**（1.1.1 のレビューで見つかった 🔓 の文面＝下の項目）。1.1.1 の配布ZIPの `trk-files/` を土台に、変わった **2ファイル**（`js/library.js`・`sw.js`）だけを差し替え、`README-1.1.1.md` → **`README-1.1.2.md`**（`README.md` も同内容）・`README-SLIM.md`・`release/README.txt` の版を 1.1.2 にそろえた。**ZIPの形は 1.1.1 と同じ**（`index.html`＋`README.txt`＋`trk-files/`）。
  - ZIP は **`2026-10-27 20:00`（UTC）** で組み立て（1.1.1 の `19:00` より新しい）＝**226エントリ・3,899,166 bytes**・`unzip -t` 破損なし・全エントリ同時刻・`sha256 837086d22d73f6fdea0952dc4293d27871aa3acfb33bd0fa79c5e4781906556c`。
  - `prepare-release --check` **OK**・ローカル配信で `/` 200・再検証は `19:00` で **200**／`20:00` で **304**。
  - **1.1.0・1.1.1 のZIPと Drive の `trk-1.1.0`／`trk-1.1.1` はそのまま**（同じ名前で作り直さない）。1.1.2 は別ZIP・別フォルダー（`trk-1.1.2`）で配る。
- **🔍 trk211：1.1.1 レビューの軽微（🔓 の文面・2026-10-27）**：レビューは「直さなくても配布には支障なし」としたが、🔓 の文面が実際に聞くフォルダーと食い違うのは案内として不親切なので直した。
  - **原因**：`folderAutoKickShared` の拒否の枝が、`sharedPendingName` を更新せずに `showReconnect()`／`syncShareUI()` を呼んでいた（🔓 には前にセットした名前が残る）。
  - **直し方**：`sharedPendingNameFrom(list)` を追加し、🔓 に出す名前を**次に聞く1本**（`prompt` の先頭・全部拒否なら先頭）に決め直す。`readSharedFolders`・`restoreSharedFolders`・`folderAutoKickShared`（拒否の後と読んだ後）・🔓 ボタン（拒否の後と成功後）の経路を通した。
  - `sw.js` の cache を **`trk-v2026.10.27-trk211`** に。`tests/trk211-review.test.mjs`（6件）を追加し **656 pass**。trk208 のサンプルに新しい関数を足し、trk210 の cache 検査は「trk210 以降」に緩めた（版が進むたびに直さないため）。

## 8. 変更時チェックリスト

- [x] 作業前にstatus／diffを確認し、既存変更と利用者指定を保持した。
- [ ] UI・設定は4言語、既定値、リセット、Import/Export、`?safe=1` を確認した。
- [ ] 外部URL・データ・素材の権利条件を確認し、未確認事項を許諾済みと表現していない。
- [x] 関連テスト、`npm run check`、`git diff --check` を通した。
- [x] 実ブラウザのスモーク2件（`tools/smoke-browser.mjs --compare`・`tools/smoke-game-end.mjs`）を通した。取り込みの条件（`npm run check` には含まれない）。
- [x] README／NOTICE／handoff と `sw.js` cache名を確認した。
- [x] 日本語ガイドを変更した場合、英語ガイドの対応箇所も更新した。
- [ ] 配布物を作るときは §9 の手順で `tools/prepare-release.mjs --check` を通し、`index.html`・`README.txt`・`trk-files/` 以外がルートに出ていないことを確かめた。
- [ ] 版を上げたときは §9 の「版を上げるときに直す場所」を全部直し、`release/README.txt`・配布アプリの `README-1.x.y.md`・`sw.js` の `CACHE`・`release-manifest.json` の `version` がそろっていることを確かめた。
- [ ] Drive へ上げたら、**落とし直してバイト一致**を確かめ、`SHA256SUMS` を新しいハッシュで上書きした（§9）。

## 9. 配布物の形（1.0.8〜／現在 **1.1.8**：`index.html`＋`README.txt`＋`trk-files/`）

**決めたこと（2026-10-26／1.0.8〜1.1.8）**：ZIPを開いたときに **`index.html`・`README.txt`・`trk-files/` の3つだけ**が見える形にする（1.0.6 のころの試作 `trk-1.0.6-layout-proto.zip` と同じ見た目。利用者からの指定）。**OS別のZIPは作らない**——Windows・macOS・Linux は同じアプリ本体で動くので、1本で足りる（1.0.7 までの win/linux・mac の2本は廃止）。

```
trk-1.1.8.zip
└ trk-1.1.8/
   ├ index.html   … 入口（meta refresh＋<a>＋location.replace で trk-files/index.html へ）
   ├ README.txt   … かんたん起動・index.html だけでできること・ローカルサーバーの使い方・注意・権利
   └ trk-files/   … アプリ本体（リポジトリのルートと同じ中身。README-1.1.8.md・LICENSE・docs/ を含む）
```

- **配布ZIPに入れないもの**：`.github/`・`tests/`・`tools/*.mjs`・開発用の `docs/HANDOFF.md`／`HANDOFF-ARCHIVE.md`／`MIGRATIONS.md` など（1.0.7 と同じ切り分け。アプリ本体の `docs/guide/`・`SECURITY.md`・`QUALITY-CHECKS.md` などは入る）。
- **リポジトリの形は変えない**：GitHub Pages も開発も今までどおりルート直下の `index.html`。`trk-files/` に移すと相対URLが全部そのまま解決される（`sw.js` の `scope:"./"`・`manifest.webmanifest`・`assets/vendor` の importmap はすべて相対）。
- **`file://` で開いたとき**：入口が `location.replace` で `trk-files/index.html` へ進む（Service Worker は `file:` では触らない）。`index.html` をダブルクリックするだけでゲーム・譜面・プレーヤー・書斎・保存が動く。**📂 のフォルダー共有は `file://` でも動く**（`showDirectoryPicker` は安全なコンテキストを要求しない）が、許可の記憶はブラウザー次第。
- **`http://127.0.0.1:8000/` で開いたとき**：入口がルート直下に残った **1.0.7 以前の worker だけ**を `unregister()` してから進む（`trk-files/sw.js` は残す）。アプリの worker のスコープは `/trk-files/` になる。
- **保存データは「開き方」ごとに別**（`file://` と `http://127.0.0.1:8000/` は別のオリジン）。これは 1.0.6 試作の README.txt と同じ注意書きを残している。
- **`00_START_HERE.html` と `01_README_WIN_LINUX.txt`／`01_README_MAC.txt` は廃止**。起動案内は `README.txt` に集約（`--check` がアプリ側に残っていると fail にする。`README-1.1.4.md` などアプリ自身の README は残す）。
- **`release-manifest.json`**（`trk-files/` の中）に `version`・`archive:"trk-1.1.8.zip"`・`layout:"wrapper"`・`wrapper{launcher:"index.html", readme:"README.txt", app:"trk-files", platforms:["win","linux","mac"]}`・`service_worker_cache`（`sw.js` の `CACHE` を書き写す）・`built_at` を記録。`platform` は持たない。**このファイルは `--version` から作る（手で書かない）**。

**版を上げるときに直す場所（1.1.8 で実施した順）**

1. `release/README.txt` — 1行目の版と、末尾の `README-1.x.y.md` の参照（`tests/release-layout.test.mjs` が「版が書いてあること」「アプリ内READMEの名前」を見る）。
2. 配布アプリの `README-1.x.y.md` — 前の版から改名し、先頭に「今回」の更新点を足して、前回の見出しを「前回」へ。`README.md` も同じ内容にする。`README-SLIM.md` の版・cache・archive 名・ファイル数も直す。
3. `sw.js` の `CACHE` — `trk-v<日付>-trk<番号>`（**1.1.8 は trk219 の `trk-v2026.10.29-trk219`**、1.1.7 は trk218 の `trk-v2026.10.29-trk218`、1.1.5 は trk216 の `trk-v2026.10.29-trk216`、1.1.4 は trk214 の `trk-v2026.10.27-trk214`、1.1.3 は trk213 の `trk-v2026.10.27-trk213`。アプリ本体が変わらない版では上げない＝1.1.0 は trk208、1.1.1 は trk210 のまま）。`release-manifest.json` は `--version` から作られる。
4. 本書 — ヘッダ・§2（版の説明）・§4（新しい版の #）・§5（cache 名）・§6・§7・§9。
5. **配布版だけの文書** — 下の「配布版だけの文書（毎版そろえる）」を読む。`--check` がリンク切れ（`README-1.x.y.md` の名前違い）を止める。

**配布版だけの文書（毎版そろえる・1.1.4 で全部直した／1.1.5 は「版と README 名」だけ）**

配布ZIPの `trk-files/` には、リポジトリと同じ名前でも**中身が配布向けに書き換えられた文書**がある（GitHub の URL や開発用の `docs/HANDOFF.md` を出さないため）。前の版の `trk-files/` を土台に差分だけを載せ替える作り方なので、ここは**放っておくと古い版のまま残る**（1.1.3 のレビューで指摘。1.1.1 にもあった）。

- `docs/guide/files.md` — 1行目の見出し（`📁 ファイル構成（1.0.4 ポータブルZIP）`）・`README 1.0.4` のリンク・`README-1.0.4.md` の行。**さらに 1.0.7 までの `00_START_HERE.html` / `01_README_*.txt` の行が残っている**（1.0.8 で廃止。ルートの `README.txt` に集約）。
- `docs/guide/appearance.md`（5行目 `1.0.4ポータブルZIPはslim版で`）・`docs/guide/en.md`（3行目と454行目の `1.0.4`）・`docs/guide/mods.md`（17行目）・`docs/guide/start.md`（11行目）
- `CONTRIBUTING.md`（26行目の `[README 1.0.4](README-1.0.4.md)`）・`docs/SECURITY.md`（20行目の `1.0.4デスクトップ版`）
- `README-1.x.y.md` と `README.md`（35行目の `trk-files/README-1.0.8.md`・64行目の `trk-files/README-1.1.1.md`）・`privacy.html`（111行目の `The 1.0.4 portable ZIP`）・`NOTICE.md`（138・140行目の `The 1.0.3 slim desktop ZIP`）
- **直し方**：版の名前は**書かない**（`README.md` のように、版が変わらない名前へ）。「1.0.4 ポータブルZIP」のような**版入りの言い方もやめて**「このZIP」「配布ZIP」にする。リンクは `[README](../../README.md)` のように**入っているファイル**を指す。
- **確かめ方**：`node tools/prepare-release.mjs --check=<組み上がったフォルダー>`。`checkDocLinks()` が、実在しない相対リンクと、入っていない `README-x.y.z.md` の名前を列挙する（1.1.3 のZIPでは8件 → **1.1.4 で全部直して0件**）。
- **1.1.4 で直したもの**：`files.md`（見出し・リンク・`README-1.1.4.md` の行に整理、廃止した `00_START_HERE.html`／`01_README_*.txt` の行を削除）・`appearance.md`（5行目と48行目）・`en.md`（3・34・215・399・454・551行目）・`mods.md`・`start.md`（11行目）・`CONTRIBUTING.md`・`SECURITY.md`・`privacy.html`・`NOTICE.md`（138・140行目）・`README-1.1.4.md`／`README.md`（35・64行目）。**版の名前は書かず**、「このZIP」「このポータブルZIP」と言い、リンクは `README.md`・`../../README.md` のように**入っているファイル**へ向けた。

**作り方**

```sh
# 1. アプリ本体を用意する（直前の配布ZIPの trk-files/ を土台にする。ほかの差分を混ぜない）
#    例：/home/user/work/rel114/app114 に 1.1.3 のZIPの trk-files/ を展開し、
#        変えたファイル（1.1.4 なら2ファイル＝js/video-max.js・sw.js）・README-1.1.4.md・
#        配布版ガイドの該当行だけを載せ替える
# 2. かんたん起動の README はリポジトリの release/README.txt（版と README-1.x.y.md の名前を直す）
# 3. 組み立て＋検査＋ZIP（出力は dist/ で Git 管理外）
#    --date は前の版の built_at より新しくする（--newer-than で機械的に確かめる）
npm run release -- --app=/home/user/work/rel114/app114 --version=1.1.4 \
  --out=/home/user/work/rel114/dist --zip \
  --date=2026-10-27T22:00:00Z --newer-than=2026-10-27T21:00:00Z
# 4. 形だけを検査（手で組み上げたときも同じ検査）
node tools/prepare-release.mjs --check=/home/user/work/rel114/dist/trk-1.1.4
# 5. 破損・ハッシュ（Drive の SHA256SUMS 用）
unzip -t /home/user/work/rel114/dist/trk-1.1.4.zip && sha256sum /home/user/work/rel114/dist/trk-1.1.4.zip
```

- 組み立ては **`js/zip-io.js` の `zipWrite` をそのまま使う**（新しいZIP実装を増やさない）。全エントリ同じ mtime（`--date`）で、並びは名前順＝決定的。
- **🕒 時刻は前の版より新しくする（必須・trk205）**：`--date` を省くと**組み立てた時刻（分まで）**になる。同じ時刻のZIPを配ると、同じポートの `python -m http.server` が `If-Modified-Since` に **304** を返し、ブラウザーは HTTP キャッシュにある**前の版の `index.html`（入口ではなく旧アプリ）**を使い続ける（`/js/…` が無いので一覧が空の壊れた画面になり、入口の Service Worker 解除も走らない。`file://` と別ポートは影響なし）。1.0.7 と 1.0.8 がどちらも `2026-10-27 12:00` で組まれていたため実際に起きた（2026-10-27 レビュー・必須）。`--newer-than=<前の版の built_at>` を渡すと、それ以前の時刻では組み立てを止める。`release-manifest.json` の **`built_at`** が次の版の基準になる。
- `.gitignore` に `dist/` を入れてある（ZIPは Git に入れない）。
- **1.1.8 の実績**：**227エントリ・3,933,293 bytes**・`unzip -t` 破損なし・全エントリ **`2026-10-29 14:00`（UTC）**（1.1.7 の `13:00` より新しい）・`--check` OK・`sha256 8075ce5bc3a15af65273455b5f29ed9be9657283ecf9b61dedda9d80274be9c2`。**コード4ファイル**（`index.html`・`js/audio-keep.js`＝新規・`js/fx.js`・`sw.js`）＋配布版の文書6本（`README-1.1.7.md`→`README-1.1.8.md`・`README.md`・`README-SLIM.md`・`docs/guide/{sound,en}.md`・`README.txt`）。
- **1.1.7 の実績**：**226エントリ・3,926,426 bytes**・`unzip -t` 破損なし・全エントリ **`2026-10-29 13:00`（UTC）**（1.1.6 の `12:00` より新しい）・`--check` OK・`sha256 482a27adb35eda2f63abca08c2684e583460b441c0ac7a31658d7e35380c184a`。**コード4ファイル**（`css/style.css`・`js/core.js`・`js/library.js`・`sw.js`）＋配布版の文書4本（`README-1.1.6.md`→`README-1.1.7.md`・`README.md`・`README-SLIM.md`・`README.txt`）。
- **1.1.6 の実績**：**226エントリ・3,922,091 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-29 12:00`（UTC）**（1.1.5 の `10:00` より新しい）・`--check` OK（`checkDocLinks` 0件）・`sha256 7f856d9f4f9d1a507047fcfd223de966e904a711a1f87c2f66aeed87bc47f5f9`。**コード3ファイル**（`index.html`・`sw.js`・`js/library.js`）＋配布版の文書3本（`README-1.1.5.md`→`README-1.1.6.md`・`README.md`・`README-SLIM.md`）。
- **1.1.5 の実績**：**226エントリ・3,916,257 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-29 10:00`（UTC）**（1.1.4 の `2026-10-27 22:00` より新しい）。`sha256 0b12ae8c35062910aa5c66e2c027c7a85670bd5204e5ee9abc6a2fbd4c8f8599`。1.1.4 のZIPの `trk-files/` を土台に、**コード11ファイル**（trk215＋trk216）＋`README-1.1.5.md`（改名）・`README.md`・`README-SLIM.md`・`docs/guide/files.md`。`checkDocLinks()` は **0件**。
- **1.1.4 の実績**：**226エントリ・3,910,309 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-27 22:00`（UTC）**（1.1.3 の `21:00` より新しい）。`sha256 b8050bc55fa499472079be2ebea3ea190bdd5d1bd408780c4804506a638501b2`。1.1.3 のZIPの `trk-files/` を土台に、**コード2ファイル**（`js/video-max.js`・`sw.js`）＋ガイド2本の1文＋**配布版の文書9本**＋README を差し替え。`checkDocLinks()` は **0件**。
- **1.1.3 の実績**：**226エントリ・3,908,257 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-27 21:00`（UTC）**（1.1.2 の `20:00` より新しい）。`sha256 7f4c04a964d681ad450eaf90749e4fb624e465fd7e84bbbcb2da50037f1df3f5`。1.1.2 のZIPの `trk-files/` を土台に9ファイル＋ガイドの段落＋README を差し替え。
- **1.1.2 の実績**：**226エントリ・3,899,166 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-27 20:00`（UTC）**（1.1.1 の `19:00` より新しい）。`sha256 837086d22d73f6fdea0952dc4293d27871aa3acfb33bd0fa79c5e4781906556c`（完全な値は Drive の `SHA256SUMS-1.1.2.txt` を正とする）。素材＝`/home/user/work/rel112/app`（**1.1.1 のZIPの `trk-files/` を土台**に、trk211 の2ファイルと `README-1.1.2.md`・`README.md`・`README-SLIM.md` だけを載せ替え＝ほかの差分は混ぜていない）。
- **1.1.1 の実績**：**226エントリ・3,898,214 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-27 19:00`（UTC）**（1.1.0 の `18:00` より新しい）。`sha256 1a6f8a800886aa1da9436c8d046e3ed390a3e0a5018c12d57f17f71a0514ef43`（完全な値は Drive の `SHA256SUMS-1.1.1.txt` を正とする）。素材＝`/home/user/work/rel111/app`（**1.1.0 のZIPの `trk-files/` を土台**に、trk210 の4ファイルと `README-1.1.1.md`・`README.md`・`README-SLIM.md` だけを載せ替え＝ほかの差分は混ぜていない）。
- **1.1.0 の実績**：**226ファイル・3,895,300 bytes・`unzip -t` 破損なし**・全エントリ **`2026-10-27 18:00`（UTC）**（1.0.9 の `15:00` より新しい）。`sha256 0bf813eec5137ad14cea6dd36f4f807ad84b8d447e96206c4dd8356b12693eec`（完全な値は Drive の `SHA256SUMS-1.1.0.txt` を正とする）。素材＝`/home/user/work/build110/app`（1.0.9 のZIPの `trk-files/` に trk208 の9ファイル＋README＋配布版ガイドの追記）と `release/README.txt`。
- **Drive（古い版）**：`trk-1.0.8`（`1vSUJ_acZ3QR7ekIVOTG13KvqmHS8DtvD`）／`trk-1.0.9`（`1sOqj7fcMPNlCcSV77YCklSCEkt7jqmaM`）、親は `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu`。**中身を直したら同じ名前で差し替え、SHA256SUMS も取り直す**（1.0.7 の原本は `old-1.0.7-original`、1.0.8 の同時刻版は `old-1.0.8-same-mtime（配らないでください）` へ退避）。
- **Drive（1.0.9）**：`trk-1.0.9.zip`（`1nE51uWzl6W53nWlTH1U5jEvDnHP9y-eo`・3,878,131 bytes・`sha256 39153c95…83fb6`・`built_at 2026-10-27T15:00:00Z`）と `SHA256SUMS-1.0.9.txt`（`1-Y65YPg1-WMu1EGCRqYxHhCQlUkkfYeZ`）。落とし直してバイト一致・`sha256sum -c` OK・`unzip -t` 破損なしを確認済み。
- **Drive（1.1.0）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.0` フォルダー**（`1w4gOka3GSKmBJMpbcNWz2ET6CbQAtRK4`）を作り、**`trk-1.1.0.zip`（`1pilYb6W84XlePkmECBERpD4coZIGEV_K`・3,895,300 bytes・`sha256 0bf813eec5137ad14cea6dd36f4f807ad84b8d447e96206c4dd8356b12693eec`・`built_at 2026-10-27T18:00:00Z`）** と **`SHA256SUMS-1.1.0.txt`（`1XB-yCD4TlLEv2Rroa7bqYUMKlaa0cvF5`・80 bytes・新しいハッシュ1行）** を置いた。**落とし直してローカルとバイト一致（ZIP・SHA256SUMS とも）・`sha256sum -c` OK・`unzip -t` 破損なし（226エントリ）**を確認済み。
- **Drive（1.1.1）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.1` フォルダー**（`17XhNIUAqrQK33Mi-8X6ByeztpNFm-HQO`）を作り、**`trk-1.1.1.zip`（`17pDUAR7xp4pxW6RZTWSV6Up0ZCs6XTD6`・3,898,214 bytes・`sha256 1a6f8a800886aa1da9436c8d046e3ed390a3e0a5018c12d57f17f71a0514ef43`・`built_at 2026-10-27T19:00:00Z`）** と **`SHA256SUMS-1.1.1.txt`（`1U6EbFCrOpTC4x4SVmF9a5iYvweJFH13o`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み（再ダウンロードはしていない）。**1.1.0 のフォルダーとZIPはそのまま**（同じ名前で差し替えない）。
- **Drive（1.1.2）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.2` フォルダー**（`1JTdv1S0tMb7dlxV93E-ywgUjmcTLy1-x`）を作り、**`trk-1.1.2.zip`（`1KuN9vGcQq40dU5mTKnm3K0cCc4RD-X6w`・3,899,166 bytes・`sha256 837086d22d73f6fdea0952dc4293d27871aa3acfb33bd0fa79c5e4781906556c`・`built_at 2026-10-27T20:00:00Z`）** と **`SHA256SUMS-1.1.2.txt`（`14TmPwEblMf4QUkm5VWrWm0Vz5nfFZKz_`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み。**1.1.0・1.1.1 のフォルダーとZIPはそのまま**。- **Drive（1.1.2）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.2` フォルダー**（`1JTdv1S0tMb7dlxV93E-ywgUjmcTLy1-x`）を作り、**`trk-1.1.2.zip`（`1KuN9vGcQq40dU5mTKnm3K0cCc4RD-X6w`・3,899,166 bytes・`sha256 837086d22d73f6fdea0952dc4293d27871aa3acfb33bd0fa79c5e4781906556c`・`built_at 2026-10-27T20:00:00Z`）** と **`SHA256SUMS-1.1.2.txt`（`14TmPwEblMf4QUkm5VWrWm0Vz5nfFZKz_`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み。**1.1.0・1.1.1 のフォルダーとZIPはそのまま**。
- **Drive（1.1.3）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.3` フォルダー**（`1RDDIa7yJcwGx_rbslCqUF33MgE_mdi1K`）を作り、**`trk-1.1.3.zip`（`1Bi9FPArUNopM_UDKDVqPDTr0D-mbGN4Q`・3,908,257 bytes・`sha256 7f4c04a964d681ad450eaf90749e4fb624e465fd7e84bbbcb2da50037f1df3f5`・`built_at 2026-10-27T21:00:00Z`）** と **`SHA256SUMS-1.1.3.txt`（`1GN1LHx1I1orY2YIJDvCqgOM2ADqU1DMr`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み。**1.1.0〜1.1.2 のフォルダーとZIPはそのまま**。- **Drive（1.1.3）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.3` フォルダー**（`1RDDIa7yJcwGx_rbslCqUF33MgE_mdi1K`）を作り、**`trk-1.1.3.zip`（`1Bi9FPArUNopM_UDKDVqPDTr0D-mbGN4Q`・3,908,257 bytes・`sha256 7f4c04a964d681ad450eaf90749e4fb624e465fd7e84bbbcb2da50037f1df3f5`・`built_at 2026-10-27T21:00:00Z`）** と **`SHA256SUMS-1.1.3.txt`（`1GN1LHx1I1orY2YIJDvCqgOM2ADqU1DMr`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み。**1.1.0〜1.1.2 のフォルダーとZIPはそのまま**。
- **Drive（1.1.8）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.8` フォルダー**（`1z8rwhgcVJerFRYBCmKEjt49IEsC1AGM2`）を作り、**`trk-1.1.8.zip`**（`1oUv_0uArl9DXmDsOBNZv1jhIcgCefwye`・3,933,293 bytes）・`SHA256SUMS-1.1.8.txt`（`1lfl06hPxPSNeR2mpXRF3egKF538op2fr`）・`trk-1.1.8-code.diff`（`15qqpJAdTA52saDI02vkuCsH9RUYNvInI`）・`trk-1.1.8-docs.diff`（`1wmo_k5wBXomKst620fwreQ3psmPYJ_ss`）・`README-1.1.8-drive.txt`（`1qkhAjrWgUBWM0nsYIsmiuB3o7pyDUWSG`）を置いた（diff も `content_mime_type` は `text/plain`）。**落とし直して `cmp` バイト一致**（sha256 `8075ce5b…be9c2`）。**1.1.0〜1.1.7 のフォルダーはそのまま**。
- **Drive（1.1.7）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.7` フォルダー**（`1dRkTvLFzV_q3eqaFY5UD6bbze8IkErjW`）を作り、**`trk-1.1.7.zip`**（`17qaO2nzy7MsAJDckrcnQxz14V4R2Rp-Z`・3,926,426 bytes）・`SHA256SUMS-1.1.7.txt`（`1Uw7k85QcGw9Qei39r218E2QIEQrFvM3o`）・`trk-1.1.7-code.diff`（`1NoBPHCswTgiPXKbtfg-R-rvdNulfiZAi`）・`trk-1.1.7-docs.diff`（`1CLb45OO0332kFgLvaTyIWRG6LLm8jcD1`）・`README-1.1.7-drive.txt`（`1rLfRDFNBNrshalgwPSbp3iw2VRsMADNy`）を置いた（diff も `content_mime_type` は `text/plain`）。**落とし直して `cmp` バイト一致**（sha256 `482a27ad…c184a`）。**1.1.0〜1.1.6 のフォルダーはそのまま**。
- **Drive（1.1.6）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.6` フォルダー**（`1S01wbrKXkGBqGPgQ7wx9PvQaHXugAada`）を作り、**`trk-1.1.6.zip`**（`1zNF57JiNddl1m0XCXEk-Di84iBJ-7msx`・3,922,091 bytes）・`SHA256SUMS-1.1.6.txt`（`1UprImq17P-BlSaRnAmWDtzasiXpK-BWI`）・`trk217-playlist-picker-code.diff`（`1_pu8OZik4YeIkY51ySx0thU7J5DERoMW`）・`trk-1.1.5-to-1.1.6-docs.diff`（`1pzNPPhEs3ID-Pge25LOWagBa9hqGmxDG`）・`README-1.1.6-drive.txt`（`13B89sRGYx9WGDxl5lq0KoQZ_h6ydnXXM`）を置いた（`content_mime_type` は diff も `text/plain` で上げる）。**1.1.0〜1.1.5 のフォルダーはそのまま**。
- **Drive（1.1.5）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.5` フォルダー**（`1j9mIFWIW5m7ZQSwXiy2OaqviT7JiXghw`）を作り、**`trk-1.1.5.zip`（`1TQMGHBdI0xMX2m9S1DfBLtYZX07EAiIG`・3,916,257 bytes・`sha256 0b12ae8c35062910aa5c66e2c027c7a85670bd5204e5ee9abc6a2fbd4c8f8599`・`built_at 2026-10-29T10:00:00Z`）**・**`SHA256SUMS-1.1.5.txt`（`1606Js3p3VzMsIp_WyeL3DAoBdHIFnnFd`）**・**`trk216-chartgen-default.diff`（`1iFMhE9l4oVWLfPV_u2yGQp40sekNVAVC`）**・**`trk-1.1.4-to-1.1.5-code.diff`（`19VcEV5YfCwDf2m_b4xF57aSCa0TfsIi0`）**・**`README-1.1.5-drive.txt`（`1I-9m7tKHZk-PXVl_P_K88Dlx06K32ZlRy`）** を置いた。落とし直してバイト一致・`sha256sum -c` OK。**diff を同梱した理由**：`trk-apk`（`TonbokiriRaikiriMuramasa-Taikoubou/trk-apk`）が 1.0.4 をベースに並行開発中で、今回の変更を手で当てるため（利用者の指定）。
- **Drive（1.1.4）**：親 `10fUiT4Q1POdmpoZOF_2ecFCZFXeOeMIu` の下に **`trk-1.1.4` フォルダー**（`1GEciYn0igWmXUgXYJxnfO6lSaifIHQxe`）を作り、**`trk-1.1.4.zip`（`1Y46GP06hFj7go2NYxO895Z6kHoTX6IN7`・3,910,309 bytes・`sha256 b8050bc55fa499472079be2ebea3ea190bdd5d1bd408780c4804506a638501b2`・`built_at 2026-10-27T22:00:00Z`）** と **`SHA256SUMS-1.1.4.txt`（`1NfDZTvB4-d1wZ058UOgzgLsMGHSagId-`）** を置いた。Drive 側の `sha256Checksum` が手元の値と一致することを確認済み。**1.1.0〜1.1.3 のフォルダーとZIPはそのまま**。

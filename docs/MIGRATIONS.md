# 一回限りの移行・印・旧名の登録簿

起動時に毎回通る分岐や、一回だけ動く移行を、ここで一覧にして **削除予定日** を決めます。
増えるだけで消えない状態を防ぐためのものです（HANDOFF §4.2 からもここを参照）。

- 新しい「一回限りの印」や「旧名の表」を作ったら、**必ずこの表に1行足す**（`tools/check-repo.mjs` が、表とコードのずれを検査します）。
- 削除予定日を過ぎても、コードに残っている項目は、検査で **警告** になります（失敗にはしません）。消すか、理由を書いて日付を延ばしてください。
- 利用者の操作を覚えるための保存データ（例：`trkRemoved`）は、移行ではないので **消しません**。

## 一覧

| 名前 | 種類 | 入った版 | 削除予定日 | 削除の条件 | 場所 |
|---|---|---|---|---|---|
| `trkOstLegacyClean1` | 一回限りの印 | trk189 | 2027-01-16 | 期限後、作業者が削除を提案し、利用者の確認を得てから消す | js/library.js `trkOstLegacyCleanOnce`、js/core.js |
| `trkFolderRefsPrune1` | 一回限りの印 | trk201 | 2027-01-27 | 期限後、作業者が削除を提案し、利用者の確認を得てから消す（旧版が保存したフォルダー曲の 📄 参照を1回だけ消す） | js/library.js `pruneFolderRefsOnce`、js/core.js |
| `trkEndfieldTidy1` | 一回限りの印 | trk128 | 2027-01-14 | 期限後、作業者が削除を提案し、利用者の確認を得てから消す | js/library.js `trkEndfieldTidyOnce` |
| `trkEndfieldTidy2` | 一回限りの印 | trk129 | 2027-01-14 | 同上 | js/library.js `trkEndfieldShelfRestoreOnce` |
| `trkFixedNotice` | 一回限りの印 | trk218 | 2027-02-28 | 期限後、作業者が削除を提案し、利用者の確認を得てから消す（trk のリストが曲画面の「プレイリストに入れる」に出ない既定へ変わったことを、1回だけ案内する） | js/library.js `trkFixedNoticeOnce`、js/core.js |
| `ENDFIELD_FIRSTORDER_OLD_NAMES` | 旧名の表（毎回照合） | trk129 | 2027-01-14 | 同上（旧既定名は、更新で一度直れば不要になる） | js/library.js |
| `BA_MIKA_LEGACY_PL` | 旧名の表（毎回照合） | trk159 | 2027-01-14 | 同上（trk157〜158の旧3リストを「聖園ミカ」1つへ統合） | js/library.js |
| `trkRemoved` | 保存データ（消さない） | — | なし | 利用者が消したリストを覚える。移行ではない | js/core.js、js/library.js |
| `trk-ba-v1` | 毎回の補完（対象外） | — | なし | 既存の4リストが無いときに作る。一回限りではない | js/library.js（legacy） |
| `tutorialStampsFrom` | 読み替え（対象外） | trk140 | なし | 旧スタンプ `song` を `play` へ読み替える。保存値を読むために残す | js/core.js |

## 削除の手順（期限後）

1. 対象の項目を使っている場所を検索し、消しても困らないことを確かめる（`npm run check` も通す）。
2. 利用者へ、削除してよいか確認する（HANDOFF の確認事項として記録）。
3. 削除するコードと、この表の行を一緒に消す。`sw.js` の cache 名も上げる。

## 期限の決め方

- 初回の期限は、**3か月後（2027-01-14）** とした（trk142 の提案。変える場合は表の日付を直す）。
- 日付は `YYYY-MM-DD` で書く。

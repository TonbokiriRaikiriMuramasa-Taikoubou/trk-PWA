# trk223 レビュー（F1・F2）への対応 ― trk224

対象：`trk223-F1-fix-2026-10-31.zip` で届いたレビュー（2026-10-31）。指摘は2件でした。
対応した版：**trk224**（`sw.js` の cache は `trk-v2026.10.31-trk224@<スコープ>`）。
作業ブランチ `arena/01baad78-trk-pwa` → `main` へ PR。

前回（trk222 レビュー）の対応は [`REVIEW-RESPONSE-2026-10-31.md`](REVIEW-RESPONSE-2026-10-31.md)、
実機で見る手順は [`REVIEW-REQUEST-TRK223-2026-10-31.md`](REVIEW-REQUEST-TRK223-2026-10-31.md)。

---

## 1. 指摘と対応

| # | 指摘 | こちらで確かめたこと | 対応 | 状態 |
| --- | --- | --- | --- | --- |
| **F1** | `js/zip-io.js` の `zipDosDateTime()` がローカル時刻の getter を使うため、ZIP のエントリ時刻がタイムゾーン依存。`tests/release-layout.test.mjs`（trk204）が UTC 以外で落ちる（CI は UTC なので緑に見える） | `TZ=Asia/Tokyo node --test tests/release-layout.test.mjs` → **1 fail**（期待 `20261027.120000`・実測 `20261027.210000`）。TZ を UTC／Asia/Tokyo／America/Los_Angeles／Europe/Berlin／Asia/Kolkata／Pacific/Kiritimati にすると、**UTC 以外はすべて同じ1件が落ちる**（原因は1つ） | `getUTC*` に変更（パッチと同じ。コメントだけ日本語で理由を追記） | 実装・検査済み |
| **F2** | 実機チェック依頼書に、古いZIPの `sha256` が残っている | `docs/REVIEW-REQUEST-TRK223-2026-10-31.md` に `a6134a0c…`（1回目のZIP）、`docs/HANDOFF.md` の §6 にも同じ値。実際に配ったZIPは `32c28545…`（2回目）で、**食い違いを確認** | 文書からZIP自身のハッシュを外し、**外側の `README-まず読む-*.txt` にだけ書く**運用に変更（§3）。再発防止のテストを追加 | 実装・検査済み |

F1 は「レビューの提案どおり」に直しましたが、**採る前に副作用を確かめました**（§2）。

---

## 2. F1 を採るときに確かめたこと（副作用の検討）

`zipDosDateTime()` は、ZIP の DOS 時刻欄（タイムゾーンを持たない2バイト×2）を作る関数です。
UTC の getter に変えると「**展開したときに見える時刻が UTC になる**」ので、その影響範囲を確かめました。

| 呼び出し元 | `mtime` を渡すか | 影響 |
| --- | --- | --- |
| `tools/prepare-release.mjs`（配布ZIPの組み立て） | **渡す**（`--date`。UTC の ISO 文字列） | ここが直したかったところ。どの環境でも同じバイトになる |
| `js/backup.js`（バックアップの書き出し） | 渡さない | **影響なし**（1980-01-01 固定のまま＝決定的） |
| `js/custom.js`（`.stpack` の書き出し） | 渡さない | **影響なし**（同上） |

つまり **利用者のバックアップやパックの時刻は変わりません**。変わるのは配布ZIPだけで、
配布ZIPは全エントリの時刻をそろえるのが目的（`built_at` も UTC の ISO で記録しています）なので、
「組み立て時刻は UTC で書く」と決めるのが筋が通ります。

**採らなかった案**：Extended Timestamp extra field（`0x5455`）に UTC の Unix 時刻を追加して、
DOS 欄はローカル時刻のままにする案。展開する道具がローカル時刻で表示でき、より「正しい」のですが、
(1) ZIP のレイアウト（余分なフィールド）が増え、既存の `zip-io` の読み書きとテストに手が入る、
(2) いまの配布ZIPは全エントリ同時刻で、表示の正確さより**再現性**が要る、
(3) レビューの範囲を超える、の3点から今回は採りませんでした。
必要になったら（例：利用者のバックアップにも実時刻を入れたい）別の版で扱います。

---

## 3. F2 の直し方（同じ失敗を繰り返さない形に）

ZIP の中に入る文書に「そのZIP自身のハッシュ」を書くと、**固めた瞬間に必ず古くなります**（書いた時点のバイトと、
固めたあとのバイトは別物）。そこで役割を分けました。

| 置き場所 | 書くこと |
| --- | --- |
| **ZIPの中**（`docs/HANDOFF.md`・依頼書・`README-standalone.txt`） | ファイル数・検査の結果・「ハッシュは外側の README を見てください」 |
| **ZIPの外**（Drive の `README-まず読む-*.txt`） | ファイル名・サイズ・`sha256`・照合のしかた |

再発防止として、**ZIPに入る文書が「配布ZIPの名前＋64桁の16進」を同じ行に書いていないこと**をテストで見ます
（`tests/trk223-review.test.mjs` の「配布物の中の文書は、ZIP自身のハッシュを書かない」）。

---

## 4. 変更したファイル

| ファイル | 変更 |
| --- | --- |
| `js/zip-io.js` | F1：`zipDosDateTime()` を UTC の getter に（+コメントで理由。コードはレビューのパッチと同一） |
| `sw.js` | cache を `trk-v2026.10.31-trk224` に（アプリ本体が変わったため） |
| `tests/trk224-timezone.test.mjs`（新規） | F1：5つのタイムゾーンの子プロセスで実際にZIPを組み、バイトと DOS 欄が同じことを確認。日付をまたぐ時刻・`mtime` 無し（1980固定）・`prepare-release` の組み立ても確認（5件） |
| `tests/trk223-review.test.mjs` | 版を `sw.js` から読む形に（テストに書き写さない）＋F2 の再発防止（8件＝配布物の文書6つ・置き場所の案内・検査自身の点検） |
| `docs/REVIEW-REQUEST-TRK223-2026-10-31.md` | F2：古いハッシュを削除（外側の README を指す）。trk224 のZIP名に |
| `docs/HANDOFF.md` | F2：§6 の ZIP の行から自分のハッシュを削除。trk224 の検証行・版の表・cache 名 |
| `.github/workflows/check.yml` | **`TZ=Asia/Tokyo` でもテストを流す**（UTC だけで緑に見える状態をやめる） |
| `docs/PWA.md`・`docs/REVIEW-RESPONSE-2026-10-31.md` | 版と cache 名、この文書への導線 |

---

## 5. 確かめたこと（数値）

- `TZ=Asia/Tokyo node --test tests/release-layout.test.mjs` → **12 pass / 0 fail**（修正前は 11/1）
- `npm run check` → **874 pass / 0 fail**、`node tools/check-repo.mjs` → 0 failure / 0 warning
- `node tools/run-tests.mjs` を TZ=UTC／Asia/Tokyo／America/Los_Angeles で流して **いずれも 874 pass / 0 fail**。ZIPの時刻そのものは +14（Pacific/Kiritimati）・+5:30（Asia/Kolkata）も含む5つのタイムゾーンで照合
- `tests/trk224-timezone.test.mjs`：日本で組んだZIPと UTC で組んだZIPの `sha256` が一致。DOS 時刻欄は `12:00Z` → 12:00（修正前は日本で 21:00）
- 手渡し用ZIPを作り直し、`unzip -t` 破損なし・`vendor-lock.json` 全 100 件と `index.html` の参照を照合（`node tools/pack-standalone.mjs --check-only`）

## 6. 確かめていないこと

- 実機・実ブラウザでの見た目と操作感（前回からの持ち越し。手順は [`REVIEW-REQUEST-TRK223-2026-10-31.md`](REVIEW-REQUEST-TRK223-2026-10-31.md)）
- Windows／macOS の `unzip` 以外の道具（Explorer の「圧縮フォルダー」など）での時刻表示の見え方。
  DOS 欄を UTC で書くので、**日本で展開すると9時間前の時刻で表示されます**（中身と動作には影響しません）。

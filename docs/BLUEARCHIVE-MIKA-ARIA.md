# ミカ — Aria to the Star

調査・実装：2026-10-14、trk158。音源・動画・歌詞は同梱しません。以下は公開ページの掲載情報を確認した記録であり、聴取・購入・全地域での再生確認ではありません。

## 利用者指定の「2曲＋MV」

ブルアカ棚の `ba-mika`（自動作成ID `trk-ba-mika`）「🪽 聖園ミカ」（色 `pink`。trk158の `ba-mika-aria` からtrk159で1リストへ統合）の8〜10番目に、歌入り音源2曲とグローバル公式のミニミュージカル本編1本を登録。会話3トラック・伴奏2トラック・曲別MV・ティザーはこのリストに追加しません。削除されたリストは自動復活させません。

| 区分 | 登録名・案内先 | ページ上の時間 |
|---|---|---|
| 音源 | [Prismatic Diary](https://music.apple.com/gb/song/prismatic-diary/1872315029) | 2:49 |
| 音源 | [The Incandescent Blue and the Comet](https://music.apple.com/gb/song/the-incandescent-blue-and-the-comet/1872315037) | 4:19 |
| 本編映像 | [[Blue Archive] Aria to the Star \| Memories in Melody「Mika」](https://www.youtube.com/watch?v=wsq-I61IvwE) | 11:53 |

音源のアーティスト名は **Mika (CV. Kang Eunae)**。Apple Music英国ストアの曲別ページと[アルバム](https://music.apple.com/gb/album/aria-to-the-star-memories-in-melody-mika-blue-archive/1872315023)で確認。アルバムは2026-01-29、7トラック、℗ 2026 Quarter Music。本編映像は2025-12-25、投稿元 `@bluearchive_Global`。[Nexon公式のクリスマス告知](https://forum.nexon.com/bluearchive-en/board_view?board=3218&thread=3303925)から同じ映像へリンクされていることを確認しました。動画公開日とストア発売日を混同しません。

## 英語の案内と韓国語歌唱を区別する

利用者のいう「英語のPV」は、ここでは**英語題名で公開されたグローバル公式本編**へ案内します。英語タイトルを理由に英語歌唱版とは登録しません。英語吹替の存在・字幕の全言語や品質は今回確認していません。

韓国公式チャンネル `@bluearchive_kr` の掲載名と韓国語字幕テキストも参照しました（実音声の聴取ではありません）。

- [本編：별에게 보내는 아리아](https://www.youtube.com/watch?v=z4BFyjLWK90) — 2025-12-25、11:53。
- [무지개빛 다이어리 (Album Ver.) MV](https://www.youtube.com/watch?v=O36ynEi9TDw) — 2025-12-31、2:53。
- [따뜻한 푸름과 꼬리별 (Album Ver.) MV](https://www.youtube.com/watch?v=8ZKft8XR3Ik) — 2025-12-31、4:23。
- グローバル公式の曲別動画：[Prismatic Diary](https://www.youtube.com/watch?v=BcLlbbnWV80)、[The Incandescent Blue and the Comet](https://www.youtube.com/watch?v=yLPnv3QS-0Q) — 同じ公開日・表示時間。韓国側とグローバル側の投稿数を新しい曲数に加算しません。映像・字幕が完全に同一かは比較していません。

音源2曲には韓国公式の曲名 `무지개빛 다이어리`／`따뜻한 푸름과 꼬리별` を照合別名として登録。英語曲名と韓国語曲名を別楽曲にはしません。Album Ver.の曲別MVと11:53の本編は別項目なので、本編の別名にはしません。

## アルバムの残りのトラック（登録対象外）

英国ストアで確認した曲順：

1. Sensei, at this hour… — 1:13
2. Prismatic Diary — 2:49（登録）
3. I'm happy… that Sensei liked it. — 1:34
4. The Incandescent Blue and the Comet — 4:19（登録）
5. I want to be like you, Sensei. — 1:30
6. Prismatic Diary (Instrumental) — 2:49
7. The Incandescent Blue and the Comet (Instrumental) — 4:19

7トラックを「ミカの新曲7曲」とは数えません。

## 地域・権利・照合

- 音源の案内は本文取得を確認できた英国ストア。対応する日本ストアURLではアルバム本文を取得できませんでした。日本での利用不可と断定せず、地域・アカウント条件により利用可否が異なると案内します。
- 配信・動画の視聴ページは、trkに取り込めるローカルファイルの提供を保証しません。サブスクのオフライン保存もそのまま読込可能なファイルとは限りません。
- 公開・購入・サブスクは二次利用・再配布の許諾ではありません。各公開元の条件を確認してください。
- 音源は `matchMedia: audio`、本編は `video`。形式の判定は動画取込flag→実FileのMIME→拡張子であり、内容を聴いて版を鑑定する機能ではありません。
- 出典固定記録：`tools/bluearchive-mika-aria-tracklist.json`。案内文は日本語・英語・中国語・韓国語。
- Node/VM検査はタイトル・リンク・3項目の媒体・保存・韓国語別名・伴奏/Short/英語版/ティザーの誤一致防止を対象とします。ブラウザ検査の最新結果は `HANDOFF.md` §6を参照。

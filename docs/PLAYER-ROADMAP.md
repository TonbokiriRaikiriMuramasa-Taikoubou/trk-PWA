# 🎧 万能プレイヤーへの道（PLAYER-ROADMAP）

> **作成：2026-10-15（trk163時点の調査）**。「安定版の万能プレイヤー」を名乗るために足りない機能を、Web調査（音楽・動画・オーディオブック・PWA OS連携・コミックリーダー・ライブラリ整理の定番機能8検索）とローカル実装監査で洗い出した台帳です。**実装したら状態を更新する**こと（§8の運用ルール）。
>
> 調査のきっかけと経緯は `docs/HANDOFF.md` §7（trk163以降）を参照。

## 1. すでに持っているもの（調査で確認済み・追加不要）

- **OS/ブラウザ連携**：Media Session API（ロック画面・通知・メディアキー）、バックグラウンド再生（アンテナ）、キャスト（Remote Playback API）
- **再生の基本**：キュー＋検索、シャッフル／リピート（なし・1曲・全曲）、速度変更、±10秒スキップ、音量・ミュート、再生位置の記憶（`trk_media_positions_v1`）
- **音質**：5バンドEQ＋FXラック全体（TRKアンプ）、左右バランス（StereoPanner）、MIDI音色プロフィール24種、MIDI MIX
- **見た目の楽しさ**：スペクトラムビジュアライザ、フレーム補間、壁紙／スクリーンセーバー
- **他プレイヤーに無い強み**：A-Bループ＋ループ・ラボ（保存・ランダム区間）、逆再生、区間の映像クリップ書き出し、MIDI合成、 rhythm game 連携そのもの
- **形式**：mp3/m4a/m4b/aac/flac/ogg/oga/opus/wav/webm ＋ mid/midi（合成）、動画 mp4/m4v/mov/webm/mkv/avi/ogv/3gp/mpg/mpeg（実際の再生はブラウザのコーデック依存）
  - trk195：`.mkv`・`.mpg` を一覧・フォルダー取込に加えた。取り込めたかどうかと再生できるかどうかは別で、再生できないときは先頭 2MB を見て理由（MPEG-PS・MPEG-2/AC3 など）を出す（`js/media.js` の `probeContainer`／`explainProbe`）
- **書斎（コミックリーダー）**：見開き（右綴じ）／縦読み（webtoon）／1枚表示、しおり・読書位置、全画面フィット、拡大縮小・ページ送りキー、サムネイル一覧、埋め込みジャケット読取（ID3 APIC／MP4 covr／FLAC picture／Ogg）
- **スリープタイマー**：15/30/60分（→ trk164 で強化予定：下表#2）

## 2. 実装リスト（優先度順）

状態：`[ ]` 未着手・`[~]` 進行中・`[x]` 完了（trk番号を添える）・`[-]` 見送り

| # | 機能 | 優先 | コスト | 状態 | 実装メモ（既存インフラへの接続点） |
|---|---|---|---|---|---|
| 1 | **Picture-in-Picture**（動画の小窓再生） | 🥇 | 極小 | [x] trk164 | 実装済み：コントロール列（全画面の右）に📌ボタン。`document.pictureInPictureEnabled`＋`requestPictureInPicture` 実在チェック、非対応では無効＋タイトルで案内。enter/leaveイベント追従、closeMediaで浮き窓も終える。`documentPictureInPicture` は追っていない（通常PiPで十分） |
| 2 | **Wake Lock**（動画再生中の画面消灯防止） | 🥇 | 極小 | [x] trk164 | 実装済み：`navigator.wakeLock.request("screen")`。**動画の再生中だけ**取得（`hasVideoFrames()`・再生中・タブが表・設定オン）。renderMedia 250ms周期＋visibilitychange復帰で監視、releaseイベント追従、closeMediaで即解放。設定「🔆 画面を消灯させない」は 🎬動画キー／壁紙パネルの隣（既定オン）。音声だけは消灯を妨げない |
| 3 | **スマート巻き戻し**（再開時に数秒戻る） | 🥇 | 小 | [x] trk164 | 実装済み：`mediaResumeRewind`（0/3/5/10/15/30秒、既定オフ）。「続きから再生」の入口（openMedia・playSong）だけ `savedMediaPosition({resume:true})` でN秒戻す。一時停止からの再開では戻さない。openMediaのシークは停止中／終了後のみ（再生中の飛び防止） |
| 4 | **スリープタイマー強化**（フェードアウト＋「今の曲の終わりまで」） | 🥇 | 小 | [x] trk164 | 実装済み：off/15/30/60に「💤 この曲の終わり」を追加（endedMediaでリピート／シャッフルより優先し、続き位置を消して停止。手動選曲で解除）。分数モードは停止15秒前からフェードアウト（逆再生中は音量に触れない。停止・解除時は設定音量へ戻す） |
| 5 | **share_target / file_handlers**（OSの共有シート・「このアプリで開く」からCBZ/曲/パックを受け取る） | 🥈 | 中〜低 | [x] trk165 | 実装済み（Web側）：manifest 宣言＋`sw.js` の `handleShareTarget`（POST→CacheStorage `trk-share-inbox-v1` に一時保存→303でアプリへ。activate の掃除から除外）＋`launchQueue`（file_handlers・デスクトップ、single-client）。`js/share-inbox.js` が**既存の検証経路だけ**へ合流（曲→addSongFiles／動画→addVideoFiles／CBZ・ZIP→study.importArchives／.stpack・pack.json入りZIP→custom.installAndUse）＝新しい入口は作っていない。受け取れない形式は4言語で案内。**trk177レビュー補強**：share_target は他サイトのフォームからも届きうるため、ルーティング前にファイル名・件数を表示して確認。拒否時はルーティングせずinboxを削除し、明示的な `launchQueue` は二重確認しない。**残るは実機確認（インストール済みPWA前提・HANDOFF §4-17）と、iOS で必要になった場合の Capacitor ビルド側対応（先行事例：quire#143）** |
| 6 | **歌詞表示**（ID3埋め込み歌詞＋`.lrc` 同期歌詞） | 🥈 | 低〜中 | [x] trk166 | 実装済み：`audio-art.js` に `extractLyrics`（USLT/ULT・SYLT/SLT＝ミリ秒形式・`©lyr`・Vorbis LYRICS/UNSYNCEDLYRICS。ジャケット経路は無変更）＋`js/lyrics.js`（LRCパーサ：複数時刻・offset・拡張LRC・IDタグ。優先順＝手動選択→フォルダの同名.lrc→埋め込み）＋メディアプレーヤーの 🎤 パネル（250ms周期でハイライト追従・行クリックでシーク・選んだ歌詞は trk_lyrics_v1 に曲単位保存）。**読み取り専用**（書き戻しなし）。**残るは実ファイルでの確認（HANDOFF §4-18）** |
| 7 | **埋め込みテキストタグの表示**（ID3 TIT2/TPE1/TALB/TRCK 等）→ アーティスト／アルバム视图の土台 | 🥈 | 中 | [x] trk167 | 実装済み：`audio-art.js` に `extractTags`（ID3 TIT2/TPE1/TALB/TPE2/TRCK/TCON＋v2.2、MP4 ©nam/©ART/©alb/aART/trkn（バイナリ分解）/©gen、FLAC/Ogg/Opus の TITLE/ARTIST/ALBUM/ALBUMARTIST/TRACKNUMBER/TRACKTOTAL/GENRE）＝**読み取りだけ**（書き戻し経路なし）。表示名の優先順「🎶 ユーザー設定名 → 🏷 タグ → カタログ曲名 → 元ファイル名」を `songDisplayTitle` に挿入（`TITLE-MATCH.md` に方針記録済み）。アーティスト／アルバムはリストのサブ行・選曲バナー・メディアプレーヤー・Media Session へ。**カタログ照合はファイル名側のまま＝タグは照合に関与しない**。読み込みは行の可視化（サムネイルと同じ observer）と選曲時、行の更新はその場で行うだけ。グルーピング表示・トラック番号順は #16 へ。残るは実音源確認（HANDOFF §4-19） |
| 8 | **ReplayGain／音量正規化** | 🥉 | 中 | [x] trk168 | 実装済み：`analyzeAudio` に loudness（ゲート付きRMSのdB）と peak を追加し、`trk_analysis_cache_v1` に一緒に保存（検証は据え置き＝古い記録も読める・バージョン据え置き）。通り道に常設の G.norm ゲイン（音量 → **平準化** → リミッター/出口）で適用。材料は「タグの REPLAYGAIN_TRACK_GAIN（trk167 の extractTags に rgTrackGain 追加：ID3 TXXX・Vorbis・MP4 freeform ----）→ 解析の loudness」の優先順。補正は −18〜+9 dB クランプ＋ピークガード（最大サンプルがフルスケールを超えない）。設定「🔊 音量の平準化」は初期オフ・エフェクトのオン/オフと独立。ファイルへの書き込みなし＝端末内計算のみ。trk177レビューで見つかった `applyNorm()` の未束縛 `core` を修正（未取得時return＋束縛回帰テスト）。残るは実機確認（HANDOFF §4-20） |
| 9 | **字幕（SRT/VTT）** | 🥉 | 中 | [x] trk169 | 実装済み：`js/subtitles.js`（SRT/VTT 兼用パーサ・遅延調整・trk_subs_v1 保存）＋フォルダ共有に相乗り（同名 .srt/.vtt → `it.subsFile`）＋手動選択。**表示は DOM オーバーレイ**（映像を canvas に描くため `<track>` は画面に出ない）＝メディアプレーヤーと 🖥 全画面の両方。📌 画中画だけは WebVTT に変換した `<track>` を付ける（遅延を焼き込み）。埋め込み字幕トラックはブラウザ制約で対象外＝外部ファイル優先（当初方針どおり）。逆再生中は非表示。残るは実動画確認（HANDOFF §4-21） |
| 10 | **M4Bチャプター**（一覧・ジャンプ） | 🥉 | 中〜高 | [x] trk170 | HTMLMediaElement はチャプターを露出しないので MP4 の `chpl`/`©chm` ボックスを自前パース。`audio-art.js` の MP4 ボックス解析が足場になる。チャプター境界はスリープタイマー「曲の終わりまで」とも接続 → **trk170 実装**：chpl(Nero) のみ対応（version 0/1・100ns時刻・moov/udta 再帰）。一覧ジャンプ・⏮/⏭・いまの章ハイライト・💤「チャプターの終わりで止める」。MEDIA_EXT に m4b 追加。**iTunes 方式チャプタートラック（text/tx3g＋stbl）は非対応**（実ファイルで需要が確認できたら別建て） |
| 11 | スマートプレイリスト的なもの（「最近追加」「よく再生」） | 🥉 | 中 | [x] trk172 | `shadow_taiko_played_v1`（プレイ履歴）と favs で材料はそろう。#7のタグ表示の後が自然 → **trk172 実装**：⚡スマート棚（🕒最近再生／🔥よく再生／➕最近追加・各50曲・trk171 の sticky 見出しを再利用）。メディアプレーヤー再生は PLAYED.media に別建て計数（30秒/半分ルール・1曲1回・リピートは周ごと）。証明（plProof＝共有の ▶AUTO 印）は auto/manual のまま不変。➕最近追加は 📄追加曲／💾共有曲（addedAt・フォルダ曲は対象外）。favs は既存の ⭐ タブのまま |
| 12 | 書斎：自動スクロール（ハンズフリー縦読み） | 🥉 | 小〜中 | [x] | trk175：縦読み漫画モードだけ。⏩ ボタン/Aキーで等速スクロール（速度5段階＝20/45/75/120/180 px/秒・既定75・実行中の変更不要すぐ反映）。タップ・ホイール・移動キーで停止（移動キーは停止だけ）。下端で自動停止。表示だけ＝栞・位置の保存には触れない。A は予約キー化 |
| 13 | 書斎：明るさ/コントラスト調整（読書用フィルタ） | 🥉 | 小 | [x] | trk176：⚙ 設定に明るさ/コントラストのスライダー（50〜150%）＋特殊フィルタ（なし/反転/グレースケール/セピア）。読書面（.study-image-stage / .study-text-stage）だけに CSS filter＝本棚やメニューは変わらない。全画面フィット・拡大率とは独立。初期値は "none" |
| 14 | 波形シークバー／ホバーサムネイル | 🥉 | 中 | [x] trk173 | 解析キャッシュの rms データをそのまま描画に使える → **trk173 実装**：🌊 波形シークバー（core.analysis の rms 包絡を range の上に pointer-events:none の canvas で重ねる。再生済み＝アンバー／未再生＝水色の塗り分け・250ms tick・ResizeObserver で再計算。設定 mediaWave 初期オン。解析なし＝ふつうのバーのまま）。**ホバーサムネイル（動画フレーム）は見送り**＝別デコード経路（オフスクリーンでのシーク＋描画）が必要。代わりにホバー位置の**時刻の吹き出し**を実装。需要が確認できたら別建て |
| 15 | 進捗フィルター（未聴/継続/完了） | 🥉 | 小 | [x] trk174 | 位置記憶＋duration で算出。表示層だけ → **trk174 実装**：曲リストのツール列に 📈 セレクト（すべて／未聴／継続中／完了・settings.libProgress）。継続＝位置記憶（曲キー or keyFp の指紋）。**完了は回数で判定**（位置記憶は最後まで聴くと消える設計のため＝PLAYED manual/auto/media・records plays。当初メモ「位置記憶＋duration」からの意図した変更）。表示層だけ＝library.js が位置記憶へ書き込んだら check-repo が失敗 |
| 16 | **アルバム別／アーティスト別のグルーピング表示＋トラック番号順**（#7 の次段） | 🥉 | 中 | [x] trk171 | 土台は trk167 で済み（`extractTags` の album/albumArtist/track/trackTotal ＋ `songDisplayMeta`）。曲リストのタブに「アルバム」「アーティスト」の棚を増やし、アルバム内はトラック番号順で並べる。タグの無い曲は「タグなし」の棚へ → **trk171 実装**：💿／🎤 棚（情報を持つ曲があれば出る）＋sticky グループ見出し＋「グループ名→（アーティスト内はアルバム順）→トラック番号→libSort」の並び。タグは棚を開いたとき先読み（300曲まで・250ms デバウンスで並べ直し）。表示だけ＝保存データ不変 |

## 3. 安定版の後へ見送り（記録だけ）

| 機能 | 理由 |
|---|---|
| **ギャップレス再生＋クロスフェード** | Web Audio のスケジュール再生が必要で、iOS に癖（バックグラウンド・レイテンシ）がある。PWA 先行事例でも「今後の改善」扱い。**安定版（今回のプレイヤー一式）が完成した後に追加開発する**（2026-10-15 空さんの判断）。クロスフェードはギャップレスと同じ基盤で相乗り可能なので同時に |

## 4. 意図的に非対応（範囲外宣言の候補）

trk! の方針（外部通信ゼロ・完全オフライン・元ファイル読み取り専用・Webアプリ）と衝突するか、Webでは原理的に不可能なもの。**「足りない」ではなく「やらない」**として README 等に明記する候補（文言の最終判断は空さん）：

| 非対応 | 理由 |
|---|---|
| CBR/RAR（書斎） | RAR は専有形式。ブラウザ内解凍は現実的でなく、外部バイナリ依存は配布方針に反する |
| PDF/EPUB（書斎） | 別プロダクト級の追加（pdf.js 等の vendor 同梱と検証網が必要）。テキスト（.txt/.md 等）は既存の書斎が担当 |
| Scrobbling（Last.fm/ListenBrainz） | 外部通信ゼロ方針（SECURITY.md §1）と両立しない |
| クラウド/NAS/UPnP/DLNA/ネットラジオ | 同上。端末内のファイルだけを読む |
| タグ編集 | 「元ファイルは読み取り専用」原則（HANDOFF §3）。表示のための読み取り（#7）は行う |
| Android Auto / CarPlay | Web アプリからは到達できない（Capacitor ビルドでもネイティブ実装が別途必要） |
| ビットパーフェクト／排他出力・DSD/APE 等の特殊形式 | ブラウザの音声経路・コーデック制約。FLAC/Opus/AAC/WAV までが現実的な対応範囲 |

## 5. 調査の出典（2026-10-15）

- 音楽プレイヤー定番（ギャップレス・ReplayGain・EQ・歌詞・クロスフェード・スリープタイマー等）：Pulsar（Google Play）、Navidrome系クライアント一覧、iPhone向け15選（VOX/Cs Music/foobar2000/jetAudio）、HowToGeek オフライン4選、MP3プレイヤー5選（AIMP/foobar2000/jetAudio/MediaMonkey）
- 日本語圏（Musicolet/Poweramp/Pulsar）：アプリブ Musicolet紹介、dvdfab「Android音楽プレーヤーおすすめ7選 2026」、androidguias 12選、octoba Poweramp レビュー
- 動画プレイヤー（字幕・チャプター・PiP）：free-codecs「Best Player for Subtitles 2026」、mpv.rocks 比較、VLC Complete Guide、mpv vs VLC 2026
- PWA/Web（Media Session・PiP・Wake Lock・file handling）：developer.chrome.com File Handling API / Web Share Target、androxus Android背景再生ガイド、player.html（単一ファイルWebプレイヤー）、web.dev PWAオフラインストリーミング、Music-PWA（iOS制約の記録）、quire#143（file_handlers＋share_target の先行実装例）
- オーディオブック（チャプター・スマート巻き戻し・フェード）：audiobook-converter 比較表、Voice Audiobook Player（Google Play）、Audiobook Player（Google Play）、Audely ガイド、epubor 7選
- コミックリーダー（RTL/webtoon/自動スクロール/輝度調整）：Unstore デスクトップ7選、ComicX（Google Play）、Icecream CBZガイド、thedroidguy Android 9選
- ライブラリ整理（アーティスト/アルバム/ジャンル・スマートPL・検索）：Musiqly 整理ガイド、Volumio ライブラリマネージャ7選、zic（GitHub）、Albums（App Store）

## 8. 運用ルール

- 実装が完了したら §2 の状態を `[x]`＋trk番号に更新し、`docs/HANDOFF.md` §7 にも通常どおり記録する。
- 新しい定番機能の期待値が見つかったら §2 に行を足す（優先度は空さんの判断）。
- 見送り・非対応を動かすときは §3/§4 の理由欄に判断日と判断者を残す。
- この台帳は「調査の結論」であり、実装の仕様書ではない。実装時の詳細は各ファイルのコメントと HANDOFF を正とする。

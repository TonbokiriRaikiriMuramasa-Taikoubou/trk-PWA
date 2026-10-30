# VALORANT 楽曲カタログ調査台帳

> 最終更新：2026-10-12（trk118）。trk! の 🛒 公式カタログ「🎯 VALORANT」の収録範囲・出典・Creator-Safe の照合状態の記録です。音源は同梱しません。LoL の記録は [LoL楽曲カタログ調査台帳](LEAGUE-OF-LEGENDS-MUSIC.md) にあります。

## 収録範囲

| リスト（`js/catalog.js`） | 収録内容 | リンク先 |
|---|---|---|
| VALORANT Champions Anthems（`val-themes`） | Champions 2021〜2026 のアンセム6曲：Die For You（Grabbitz）、Fire Again（Ashnikko）、Ticking Away（Grabbitz, bbno$）、SUPERPOWER（KISS OF LIFE, Mark Tuan）、Last Shot（templuv, 347aidan）、If The Sun Burns Out Tonight（Grabbitz, Oli Sykes, Courtney LaPlante） | 公式YouTube動画 |
| VALORANT Agent Themes（`val-agent-themes`） | エージェント関連曲3曲：Entertain Me（Neon。Ylona Garcia）、On My Level（Phoenix。Ashley Warren, Bjorn Nilsson）、greater than one（Gekko。ericdoa, VALORANT） | 公式YouTube動画／公式Spotify個別曲 |
| VALORANT Creator-Safe（`val-cs`・trk118） | VALORANT 公式 Creator-Safe Playlist の39曲（全40曲。「Míranos」は2つの版が入っているので1曲）。プレイリストの順 | 公式Spotify個別曲（そのプレイリストにあるトラックID） |

これは VALORANT の全楽曲ではありません。

## Creator-Safe の照合状態（trk117・2026-10-12）

Riot の [Creator-Safe ガイドライン](https://www.riotgames.com/en/riot-music-creator-safe-guidelines)が案内する VALORANT の公式プレイリストと、曲名（大文字小文字・アポストロフィの違いは無視）とアーティストを照合した。

- [VALORANT Creator-Safe Playlist（Spotify）](https://open.spotify.com/playlist/4tyTLcBxJnf7DcQcHjwt0W)：説明文は「Welcome to the collection of all VALORANT Music that is 100% owned by Riot Games. It can be used in streams and content creation as long as it follows the "Legal Jibber Jabber" rules at riotgames.com/legal」。2026-10-12 時点で40曲。公式の埋め込み表示は100曲まで出るので、**40曲すべてを公式の表示で確認した**（第三者サイトは使っていない）。曲名とアーティストは `tools/valorant-creator-safe.json` の `creatorSafe.entries` に記録した。
- [Riot Games Creator-Safe Playlist（Spotify）](https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N)：LoL の照合で読んだ977行（101曲目以降は第三者サイト songdata.io の一覧）に VALORANT の曲が36行あり、曲名はすべて上の VALORANT プレイリストにもある。
- [VALORANT Creator-Safe Playlist（SoundCloud）](https://soundcloud.com/valorant/sets/valorant-creator-safe-playlist)：38曲・約1年前の更新。JavaScript なしでは先頭15曲しか出ず、15曲とも Spotify 版にある。全件は読んでいない。

| リスト | 状態（`VAL_CREATOR_SAFE`） | 結果 |
|---|---|---|
| Champions Anthems（6曲） | **見当たらない**（links-absent・0/6） | 6曲ともどちらのプレイリストにも無い。6曲とも外部アーティストとの共同制作曲 |
| Agent Themes（3曲） | **見当たらない**（links-absent・0/3） | 3曲ともどちらのプレイリストにも無い |
| VALORANT Creator-Safe（39曲・trk118） | **全曲あり**（links-verified・39/39） | プレイリストの曲から作ったリスト。トラックIDは `creatorSafe.entries` の3つ目の値（songdata.io の一覧から写し、うち36件は Riot Games プレイリストの行と一致） |

プレイリストに入っているのは、Shyloom 名義のゲーム内曲（MIND THE DROP、TRANQUIL など）、VCT 関連曲（Karanlığın、RAJA、VISIONS、REFLECTIONS、Villain (Take the Shot) など）、Casa de Vidro、Savior、Les rêves d’hier などで、本カタログの9曲とは別の曲。

照合状態は `js/catalog.js` の `VAL_CREATOR_SAFE` に持たせ、入手先ガイドの文言は LoL と共通の `js/library.js` の `RIOT_GUIDE_KEYS` から選ぶ（links-absent＝「Riot公式のCreator-Safeプレイリストに見当たらない曲です（Creator-Safe対象外・要確認）」）。`tools/check-repo.mjs` は、記録した40曲から各リストの見つかった曲数と見当たらない曲を計算し直して、状態と照らし合わせる。

## 権利・利用条件

- 公式 YouTube／Spotify で聴けることは、配信・動画での利用や音源の再配布の許可ではない。
- Creator-Safe プレイリストに無い曲（本カタログの9曲すべて）は、利用前に権利者の条件を確かめる。Riot の説明でも、外部アーティスト等との共同制作曲は権利関係が複雑で、Creator-Safe プレイリスト外の曲は一般に権利者の許諾が必要とされている。
- Creator-Safe の曲でも、Riot の法務表記（Legal Jibber Jabber）に従うことが条件で、音源の同梱・再配布・販売や企業広告での利用は別条件。trk! はリンクの索引にとどめ、音源を同梱しない。

## 次の確認

1. プレイリストに曲が増えたら、`creatorSafe.entries` と「VALORANT Creator-Safe」リストを同時に更新する（`check-repo` が、リストの各曲が記録したトラックIDの曲名・アーティストと一致することを確かめる）。
2. 新しいアンセムやエージェント曲を足すときは、同じプレイリストと照合して `tools/valorant-creator-safe.json` と `VAL_CREATOR_SAFE` を同時に更新する（`check-repo` が一致を見る）。

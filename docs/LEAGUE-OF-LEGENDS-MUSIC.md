# League of Legends 公式楽曲カタログ — 調査・実装台帳

最終確認：**2026-10-11（日本時間）**（Creator-Safe の照合状態。曲目は2026-10-09）

## 方針

「全公式楽曲」はチャンピオン約180体のテーマだけでなく、旧ログインテーマ、スキン／イベント曲、競技アンセム、ゲーム内OST、仮想アーティストや Arcane の関連楽曲まで含む大きな範囲です。単一の一覧へ急いで混ぜず、**公式の個別配信先・分類・確認状況を分けて段階収録**します。存在を確認できないチャンピオン曲は作りません。未検索・未確認を「存在しない」とは扱いません。

アプリへ入れるのは曲名・アーティスト・アルバム名と**公式配信／公開へのリンクだけ**です。音源ファイルは同梱しません。カタログのリンクや購入・サブスクリプションは、二次利用許諾の代わりになりません。

## 収録済みの範囲（Phase 1＋段階追加）

| 分類 | 収録内容 | 状態 |
|---|---|---|
| Sessions | Vi 36曲、Diana 43曲、Star Guardian Taliyah 29曲。計108曲 | Riotの公式Creator-Safe Sessions三作。公式SoundCloudアルバムと公式Spotify個別曲ページへリンク。既存収録・安全な更新は維持。Creator-Safe Playlistでは Vi・Taliyah が全曲、Diana は43曲中42曲（trk116） |
| Champion Themes | 公式単曲テーマ41曲（2019–2026年、2020年代中心。Lockeまで） | Riot公式Champion Theme記事とLeague of Legends公式YouTube個別投稿を照合。**全チャンピオンを網羅する一覧ではない**。Creator-Safe Playlistには41曲中39曲（trk116） |
| Worlds / WCS | 2014–2026年の公式アンセム13曲 | 公式League of Legends YouTube動画を個別確認。2026年は公式MVと公式Spotify個別曲リンクを照合して収録。Creator-Safe Playlistには「Worlds Collide」（2015）だけ（trk116） |
| MSI | 2019、2021、2022、2023年の確認済みアンセム4曲 | Riot／League of Legends公式公開先へリンク。未確認年にアンセムが存在しないとは結論しない。Creator-Safe Playlistには見当たらない（trk116） |
| K/DA | 「POP/STARS」＋「ALL OUT」EPの5曲。計6曲 | 公式Spotify個別曲ページとLeague of Legends公式YouTubeの曲別動画を照合。Champion Themeとは別の仮想アーティスト枠。Creator-Safe Playlistには見当たらない（trk116） |
| ゲームOST（Season 1〜9） | 公式SoundCloudアルバム「The Music of League of Legends: Season 1〜9 (Original Game Soundtrack)」をシーズン別の9プレイリストに。計243曲（9／30／23／22／25／27／48／39／20） | プレイリストは公式SoundCloudアルバムへ、各曲は公式Spotify個別曲へリンク。曲順・曲数・曲名・アーティストは公式Spotifyアルバムページで確認。Creator-Safe Playlistに全曲（trk115） |
| Warsongs | 公式リミックスアルバム「Warsongs」（2016年）11曲 | 公式SoundCloudアルバムと公式Spotifyアルバム／個別曲を照合。Creator-Safe Playlistには11曲中10曲（Silver Scrapesは見当たらない） |
| 人気曲 | 公式SoundCloud「Popular tracks」ページの30曲（2026-10-09時点のスナップショット） | 表示順のまま収録し、各曲は公式SoundCloudの個別曲ページへリンク。ページの内容・順序は時間で変わる。Creator-Safe Playlistには30曲中7曲（trk116） |
| Creator-Safe Playlistから（trk118） | Creator-Safe Playlistにあってカタログに無かった曲から4リスト・158曲：Pentakill 29曲、ログイン／イベント／スキンのテーマ 53曲（DJ Sona・Spirit Blossom Springs Lofi Remixを含む）、eスポーツのテーマ 17曲、2025〜26年のサウンドトラック 59曲 | 全曲 links-verified。各曲はそのプレイリストにある公式Spotify個別曲へ（IDは `tools/riot-games-creator-safe-playlist.json` に記録）。下の「Creator-Safe Playlist から作ったリスト」 |

2026 Worlds「Know My Name」は、**2026-10-08 18:00 PDT（2026-10-09 10:00 JST）**に公開された。公式League of Legends YouTubeの[公式ミュージックビデオ](https://www.youtube.com/watch?v=mlFxxNsExJc)と、動画説明欄から案内されるRiot Games名義の[公式Listen Now](https://truedamage.ffm.to/knowmyname)を照合。Listen Nowから開く[Spotify個別曲ページ](https://open.spotify.com/track/3s2YCL5LHLzXWbw7ezQru3)で曲名・2026年リリース・アーティスト欄を確認し、カタログのリンクを個別曲ページへ更新した。クレジット欄にはTrue Damage、League of Legends、Sofía Reyes、VIC MENSA、Coco Jones、SOYEON、i-dleが表示される。

### Phase 2 追加：K/DA

公式[K/DA Spotifyアーティストページ](https://open.spotify.com/artist/4gOc8TsQed9eqnqJct2c5v)にある個別曲ページと[「ALL OUT」EP](https://open.spotify.com/album/3wX4yrxMuHapSLvadxQkVV)を確認し、「POP/STARS」とEP全5曲を別リスト `lol-kda-songs` に収録した。Spotifyページ上の曲名・アルバム・表示アーティストに合わせ、各 wish は個別Spotify曲リンクにしている。各曲に対応するRiot公開動画（League of Legends公式チャンネル投稿）はfixtureの `officialVideoUrl` に記録した。うち3曲の動画はOfficial Concept Videoであり、MVと一括りにはしていない。

対象曲は「POP/STARS」「THE BADDEST」「MORE」「VILLAIN」「DRUM GO DUM」「I'LL SHOW YOU」。Spotify個別曲ページと、出典にした公式YouTube投稿は次のとおりです。

| 曲 | Spotify個別曲ページ | Riot公式YouTube投稿 |
|---|---|---|
| POP/STARS | [Spotify](https://open.spotify.com/track/3em2uN4cCWHcCXhjMzJ8ps) | [Official Music Video](https://www.youtube.com/watch?v=UOxkGD8qRB4) |
| THE BADDEST | [Spotify](https://open.spotify.com/track/6y3EPT8iw6HmuMpX05gyvt) | [Official Music Video](https://www.youtube.com/watch?v=RkID8_gnTxw) |
| MORE | [Spotify](https://open.spotify.com/track/65pHtEdxGt4e3Fv1ncPi6V) | [Official Music Video](https://www.youtube.com/watch?v=3VTkBuxU4yk) |
| VILLAIN | [Spotify](https://open.spotify.com/track/33CZravFcGBOwRw5dCOCel) | [Official Concept Video](https://www.youtube.com/watch?v=xoWxv2yZXLQ) |
| DRUM GO DUM | [Spotify](https://open.spotify.com/track/3CEW3iffD2QvNZMK20sMqW) | [Official Concept Video](https://www.youtube.com/watch?v=E_PbH5y70Tc) |
| I'LL SHOW YOU | [Spotify](https://open.spotify.com/track/497qmwcUsCv5hmMU0K8Hik) | [Official Concept Video](https://www.youtube.com/watch?v=WW1BpABbzHs) |

K/DAの全関連コンテンツを網羅したという意味ではない。Riot公式Creator-Safe Playlistには6曲とも見当たらない（trk116。Riotは2020年の説明でK/DAは許諾できないとしている）。公式Spotify／YouTube掲載は二次利用や音源再配布の許可ではない。

### Phase 3 追加：公式SoundCloudアルバム（Season 1〜9・Warsongs）と人気曲30曲

目的は「**どの曲が入っていて、どの曲が入っていないのか**」を見えるようにすること。公式SoundCloudの[アルバム一覧](https://soundcloud.com/leagueoflegends/albums)から、シーズン別OST「The Music of League of Legends: Season 1〜9 (Original Game Soundtrack)」を**1アルバム＝1プレイリスト**の9本に分け、公式リミックスアルバム「Warsongs」を1本、公式[Popular tracks](https://soundcloud.com/leagueoflegends/popular-tracks)ページの30曲を1本にした。LoLシリーズは計18プレイリスト・456曲。既存のSessions 3作／Champion Themes／Worlds／MSI／K/DAの各リストの内容と並び順は変えず、後ろに追加した。

| プレイリスト（ID・表示名） | 公式SoundCloudアルバム | 曲数 | 曲別リンク先の公式Spotifyアルバム |
|---|---|---|---|
| `lol-season-1`「Music of LoL: Season 1」 | [Season 1](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-2) | 9 | [Spotify](https://open.spotify.com/album/6GXIGoirm6W8EnwYytVj1j) |
| `lol-season-2`「Music of LoL: Season 2」 | [Season 2](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-9) | 30 | [Spotify](https://open.spotify.com/album/5tbKnlrYfWLOS2oDNVRG1I) |
| `lol-season-3`「Music of LoL: Season 3」 | [Season 3](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-1) | 23 | [Spotify](https://open.spotify.com/album/12Wkzjt1vkH0F5TLChsscq) |
| `lol-season-4`「Music of LoL: Season 4」 | [Season 4](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-4) | 22 | [Spotify](https://open.spotify.com/album/5yJhZ0IbtdXn8PatnYG8qf) |
| `lol-season-5`「Music of LoL: Season 5」 | [Season 5](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-3) | 25 | [Spotify](https://open.spotify.com/album/7KZ6m6G3EyNxahSR2HZ8h9) |
| `lol-season-6`「Music of LoL: Season 6」 | [Season 6](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-7) | 27 | [Spotify](https://open.spotify.com/album/6DK95stzKIJ8QFuN4rsc92) |
| `lol-season-7`「Music of LoL: Season 7」 | [Season 7](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-6) | 48 | [Spotify](https://open.spotify.com/album/4ejVwiIVblKgKMspuxAAQ8) |
| `lol-season-8`「Music of LoL: Season 8」 | [Season 8](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-473008103) | 39 | [Spotify](https://open.spotify.com/album/5Qoly8Zj0HhJl8sc5rmplS) |
| `lol-season-9`「Music of LoL: Season 9」 | [Season 9](https://soundcloud.com/leagueoflegends/sets/the-music-of-league-of-5) | 20 | [Spotify](https://open.spotify.com/album/3cYnSSnBe1akJwxv64PHOg) |
| `lol-warsongs`「LoL Warsongs (2016)」 | [Warsongs](https://soundcloud.com/leagueoflegends/sets/warsongs-7) | 11 | [Spotify](https://open.spotify.com/album/1KHalUH2ZfT38gIdT8MJdn) |
| `lol-popular-tracks`「LoL Popular Tracks」 | [Popular tracks](https://soundcloud.com/leagueoflegends/popular-tracks)（アルバムではない） | 30 | —（各曲が公式SoundCloudの個別曲） |

**曲別リンクの方式**：プレイリスト（と取り込み後の設定ガイド）は公式SoundCloudのアルバムページへ、各曲は Sessions と同じ方式で公式Spotifyの個別曲ページへリンクする。理由は、SoundCloudのセットページがJavaScriptなしだと**先頭15曲**しか返さず、全曲の個別パーマリンクを確かな形でたどれないため。曲順・曲数・曲名・アーティストは公式Spotifyアルバムページを正とした。

**確認できたこと／できていないこと**：

- 公式SoundCloudのセットページを直接開いて確認したのは **Season 1（9曲）** と **Season 2（30曲）**。どちらも曲数・曲名・曲順がSpotifyアルバムと一致した（Season 2は先頭15曲を1曲ずつ突き合わせ）。Season 3 のURL（`…/the-music-of-league-of-1`）はSoundCloud自身のページ見出しで確認。
- SoundCloudのURLスラッグ末尾の数字はシーズン番号と**一致しない**（Season 1 → `…-of-2`、Season 9 → `…-of-5`）。アルバムの見出し（Season 表記）を正とし、スラッグから季節を推測しない。
- **Season 4〜9 のSoundCloudセットページはこの作業では開けていない**（SoundCloudが自動アクセスに対して断続的に「非対応ブラウザ」エラーを返した）。URLは2026-10-09に公式アルバム一覧から取得したもので、曲順・曲数は同名・同アーティスト・同リリース年の公式Spotifyアルバムに依る。実ブラウザでの再確認は下記「次の確認」に残す。Warsongs のセット（`…/sets/warsongs-7`）は trk115（2026-10-12）に開けた：11曲・曲名と曲順はSpotifyと同じ「(feat. …)」表記（11曲目のSoundCloud表記は「Silver Scrapes (feat. Protoshredanoid)」）、アルバム公開日 2016-01-14。
- Warsongs の11曲は Riot 公式の発表ページ（nexus.leagueoflegends.com）のトラックリストと一致。Spotifyの曲名は「Piercing Light (feat. Mako)」形式、Riot発表は「Piercing Light (Mako Remix)」形式で、**表記が違うだけ**の同一曲。カタログはリンク先のSpotify表記を採用した。
- SoundCloud側の総再生時間はSpotifyより短い（Season 2 で 40:10 に対し Spotify は 69:42）。曲数・曲名・曲順は一致しているので、SoundCloud掲載音源の長さが違う可能性がある。この差は未確認。
- Spotifyには**同一アルバムの別版（別のアルバムID）**がある。Season 9 では、アルバムURLに採用した `3cYnSSnBe1akJwxv64PHOg` とは別版（`2mW3TZ7nddsMIAYpw3Rbat`）のトラックIDを曲別リンクに採用した形になっている。曲名・アーティスト・曲順・再生時間は同一で、トラックID側のリンクは実際に開いて確認した（「Arcade 2019: ULTRACOMBO」、2026-10-10）。どちらも正規リンクなので差し替えない。

**Creator-Safe の照合状態（2026-10-11 訂正・2026-10-12 追記）**：Riot公式の [Creator-Safe Playlist](https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N)（trk108時点で979曲・説明文は「This is a collection of music that is 100% owned by Riot Games. It can be used in streams or content creation as long as it follows the “Legal Jibber Jabber” rules on our website.」）と、曲名・アーティスト・曲順を突き合わせた。公式の埋め込み表示に出るのは先頭100件だけで、並びは Season 9 → 8 → 7 の順だった。101番目以降は、プレイリスト全体を表示する第三者サイト [songdata.io](https://songdata.io/playlist/5hDYD44imzFZEqTfAoco1N) で照合した（2026-10-12・方法と注意は表の下）。

| アルバム | 状態（`js/catalog.js` の `LOL_CREATOR_SAFE`） | 根拠（プレイリスト内の位置） |
|---|---|---|
| Season 9（20曲） | **照合済み**（verified） | 1〜20番目と全曲一致（公式埋め込み）。2026-10-09に再生時間まで確認し、2026-10-11に再確認 |
| Season 8（39曲） | **照合済み**（verified） | 21〜59番目と全曲一致（公式埋め込み・2026-10-11） |
| Season 7（48曲） | **照合済み**（verified・trk115） | 60〜100番目＝先頭41曲（公式埋め込み・2026-10-11）、101〜107番目＝残り7曲（songdata.io・2026-10-12） |
| Season 6（27曲） | **照合済み**（verified・trk115） | 108〜134番目（songdata.io） |
| Season 5（25曲） | **照合済み**（verified・trk115） | 135〜159番目（songdata.io。150番目の区切りで先頭16曲／残り9曲に分かれる位置も予測どおり） |
| Season 4（22曲） | **照合済み**（verified・trk115） | 160〜181番目（songdata.io） |
| Season 3（23曲） | **照合済み**（verified・trk115） | 182〜204番目（songdata.io。200番目の区切りで先頭19曲／残り4曲） |
| Season 2（30曲） | **照合済み**（verified・trk115） | 205〜234番目（songdata.io） |
| Season 1（9曲） | **照合済み**（verified・trk115） | 235〜243番目（songdata.io） |
| Warsongs（11曲） | **一部のみ照合済み**（partial・10/11・trk115） | 1〜10曲目が251〜300番目の区画にある（曲名は「Piercing Light」のように「(feat. …)」なし、アーティストは「League of Legends, Mako」など同じ）。**「Silver Scrapes」は見当たらない**（trk115 で1〜300番目、trk116 で表示される全977行を確認）。公式SoundCloudのCreator-Safe Playlist Pt. I でも11〜15番目が1〜5曲目（Remix版のアップロード） |

**101番目以降の照合方法と注意（trk115・2026-10-12）**：

- songdata.io はRiot・Spotifyの運営ではない第三者サイト。公開プレイリストの全曲を一覧にするが、**50件ごとの区画に分け、区画の中はSpotifyのトラックID順に並べ替えて表示する**ため、区画内の正確な順番は見えない。読んだのは51〜300番目。
- 確かめたこと：①51〜100番目の区画は、公式埋め込みが同じ位置に表示する50曲（Season 8の最後の9曲＋Season 7の先頭41曲）と完全に一致した（第三者サイトの表示が公式と食い違わないことの確認）。②101〜150・151〜200・201〜250番目の各区画は、アルバム順に続けた場合の予測（Season 7の42〜48曲目、Season 6、Season 5、Season 4、Season 3、Season 2、Season 1）と過不足なく一致し、201〜250番目の区画の残り7件は単曲（Quinn and Valor、Tidecaller、Tales of the Rift、Braum、Demacia Rising、Tiny Masterpiece of Evil、The Curse of the Sad Mummy）だった。曲名は1文字単位で一致。表の位置はこの結果からアルバム順で書いたもの。
- プレイリストに入っているのはSpotify上の**同じアルバムの別版**（トラックIDが本カタログの曲別リンクと違う）。曲名・アーティストで照合した。曲別リンクは公式アルバム側のまま差し替えない。
- 251〜300番目の区画には Warsongs 10曲のほか、Pentakill、DJ Sona（Kinetic・Concussive・Ethereal）、Sett・Aphelios・Senna 等のChampion Themeも入っていた。これらを含む残りのリストは trk116 で照合した（下の「残りのリストの照合」）。
- 利用前に確実にするなら、Spotifyアプリでプレイリストを開き、プレイリスト内検索で曲名を確かめる。
- 公式SoundCloudの [Creator-Safe Playlist Pt. I](https://soundcloud.com/leagueoflegends/sets/riot-games-creator-safe)（499曲）と [Pt. II](https://soundcloud.com/leagueoflegends/sets/riot-games-creator-safe-pt2)（230曲）は今もRiotのガイドラインからリンクされているが、更新は約4年前で、シーズン別アルバム版ではなく旧単曲・Remixのアップロードが入っている。JavaScriptなしでは先頭15曲しか出ないため全件は読んでいない（照合の主な根拠にはしていない）。

**残りのリストの照合（trk116・2026-10-12）**：songdata.io が表示する全行（51〜977行目）を読み、LoLの残りのリストも1曲ずつ照合した。曲名は大文字小文字・アポストロフィ・末尾の「 - Champion Theme」の違いを無視して比べ、アーティストも確かめた。2XKO の「… - X Champion Theme」（格闘ゲームの曲）と「Spirit Blossom Springs Lofi Remix」などのリミックスは別曲として数えていない。

| リスト | 状態（`LOL_CREATOR_SAFE`） | 結果 |
|---|---|---|
| Sessions: Vi（36曲） | **全曲あり**（verified） | 36/36。「Swing」「Abovve」（SwuM）はアーティストが League of Legends だけの表記 |
| Sessions: Star Guardian Taliyah（29曲） | **全曲あり**（verified） | 29/29 |
| Sessions: Diana（43曲） | **一部**（partial・42/43） | 「Oh Baby」（Engelwood）が見当たらない |
| Champion Themes（41曲） | **一部**（links-partial・39/41） | 「Smolder, the Fiery Fledgling」（2024）と「Yunara, the Unbroken Faith」（Lofi Remix だけがある）が見当たらない。「Locke, the Ashen Exorcist」はクレジットが League of Legends, Pressure Cooker, Elben Schutte で、本カタログ（YouTube の表記）と違う |
| Worlds / WCS（13曲） | **一部**（links-partial・1/13） | 「Worlds Collide」（2015、League of Legends, Nicki Taylor）だけ。器楽の「YYYY World Championship Theme」は別曲 |
| MSI（4曲） | **見当たらない**（links-absent・0/4） | 器楽の「2016〜2018 Mid-Season Invitational Theme」はあるが、収録したアンセムは無い |
| K/DA（6曲） | **見当たらない**（links-absent・0/6） | TFT のリミックス（「Out of Your League (K/DA)」等）だけで、K/DA の曲は無い |
| 人気曲（30曲） | **一部**（mixed・7/30） | Get Jinxed（2件）、Piercing Light (Mako Remix)（＝Warsongs）、Still Here、Here, Tomorrow、Worlds Collide 2015、Lightbringer（2014年の Pentakill 曲。SoundCloud のページがアルバム「Pentakill - Smite and Ignite」に入っている） |
| Warsongs（11曲） | **一部**（partial・10/11） | 「Silver Scrapes」は表示される全977行のどこにも無い |

- **songdata.io に出ない2曲**：公式の曲数979に対して songdata.io の表示は977行。50件ごとの区画は700番目まで揃っていて、701〜750番目の区画だけ48行なので、出ない2曲は701〜750番目（Skarner・Lee Sin などがある2024年ごろの区画）にある。したがって「見当たらない」は「表示される977行に無い」という意味で、2024年の Smolder はこの2曲に含まれる可能性がある。
- このプレイリストには、本カタログに入れていない Pentakill の3作、DJ Sona、Riot Forge の各作品のサウンドトラック、Wild Rift、Teamfight Tactics、2XKO、VALORANT の曲なども入っている（Wild Rift・TFT の一部は同じ曲が2回）。

照合状態はプレイリストのデータ（`js/catalog.js` の `LOL_CREATOR_SAFE`）に持たせ、設定ガイドの文言（`js/library.js` の `trkCatalogGuide`）はそこから選ぶ。根拠の詳細は `tools/leagueoflegends-soundcloud-albums-tracklist.json` の `creatorSafe`（`tools/check-repo.mjs` が両者の一致と照合曲数を検査）。trk108〜113 では「Season 1〜9・Warsongs は対象」と書いていたが、実際に照合したのは Season 9 だけだったため trk114 で訂正した。trk115 で101番目以降を照合して Season 1〜7 を照合済み、Warsongs を一部照合済み（10/11）にし、照合せず「可能性が高い」とした likely 状態は廃止した。Sessions 3作は、Riot が公開時に「Creator-Safe Collection」と説明したシリーズで、trk116 でこのプレイリストとも照合した。根拠は3つの fixture（`tools/leagueoflegends-soundcloud-albums-tracklist.json`・`-music-tracklist.json`・`-sessions-tracklist.json`）の各リストの `creatorSafe` にあり、`tools/check-repo.mjs` が18リストすべての一致・曲数・根拠を検査する。

対象であっても条件は残る。Riotの法務表記（Legal Jibber Jabber）に従うことが前提で、**音源の同梱・再配布・販売、企業広告での利用は別条件**。trk! はリンクの索引にとどめる。

一方、人気曲30曲はスナップショットで、Worlds／MSIアンセム・K/DA・True Damage・HEARTSTEEL などの**外部アーティストとの共同制作曲は Creator-Safe 対象外・要確認**のまま（次節と「権利・利用条件」を参照）。

**人気曲30曲（`lol-popular-tracks`）**：公式[Popular tracks](https://soundcloud.com/leagueoflegends/popular-tracks)ページの**2026-10-09時点の表示順そのまま**を、表示タイトル・アーティスト表記・個別曲URLつきで収録した。アルバムではないので `al`（アルバム名）は空。注意点は次のとおり。

- ページの内容と順序は再生数で変わる。30曲は**スナップショット**であり、公式の人気曲ランキングそのものとは限らない。
- `Know My Name (feat. Coco Jones, SOYEON & i-dle)`（URLは `know-my-name-instrumental-teaser`）・`Live My Life (feat. Anderson .Paak & Nic D)`・`Legends Never Die`（URLは `legends-never-die-1`）はページ上で「**日本では利用できません**」と表示されていた。リンク先で再生できないことがある。
- `Get Jinxed` と `Legends Never Die` は**別URLの公式投稿が2件ずつ**ある（例：`get-jinxed` と `get-jinxed-1`）。重複排除はせず、ページに出ている2件をそのまま入れている。
- Worlds アンセム・K/DA・True Damage など、ほかのリストと同じ曲も人気曲側にも入る。プレイリスト間で曲が重複するのは意図したとおり。

**曲名照合の別名（matchAliases）**：OST曲の公式タイトルは「Jhin, the Virtuoso **(From League of Legends: Season 6)**」のように接尾辞が長く、そのままでは利用者のファイル名（例 `Jhin, the Virtuoso.mp3`）と照合しない。そこで**公式タイトルの前方一致になる切り詰めだけ**を別名として1件ずつ付けた（括弧 `(From …／ft. …／feat. …)`・` | Worlds 20XX …` を落とす）。新しい別名や通称は作っていない。検査で「別名は公式タイトルの先頭部分であること」を強制している。

### Creator-Safe Playlist から作ったリスト（trk118・2026-10-12）

照合で読んだ Creator-Safe Playlist の行（songdata.io の51〜977行目）のうち、カタログに無かった曲をリストにした。どの曲も「Riotが100%権利を持つ曲」のプレイリストにあるので、リストの状態は **links-verified**（全曲あり）で、入手先ガイドは「全曲がCreator-Safe対象（Riot公式のCreator-Safeプレイリストと照合済み）」になる。

| リスト（`js/catalog.js`） | 曲数 | 中身 |
|---|---|---|
| Pentakill (Creator-Safe)（`lol-cs-pentakill`） | 29 | 『Smite and Ignite』8曲（Lightbringer を含む）、『Grasp of the Undying』10曲、『Lost Chapter』11曲。アルバム順、アルバム内は曲名順 |
| LoL Login & Event Themes（`lol-cs-themes`） | 53 | 旧ログインテーマと単曲（Tidecaller、Welcome to Planet Urf の原曲、Bit Rush、Freljord など20曲）、2020〜2025年のイベント・スキンのテーマ（Sentinels of Light の3話、Space Groove、Porcelain、Everything Goes On など23曲）、DJ Sona の3曲、Spirit Blossom Springs Lofi Remix 7曲 |
| LoL Esports Themes（`lol-cs-esports`） | 17 | World Championship Theme 2016〜2025（器楽。アンセムとは別曲）、Mid-Season Invitational Theme 2016〜2018、2018 Rift Rivals Theme、LTA／LTA North／LTA Sul Theme |
| LoL Soundtracks 2025–26（`lol-cs-ost-2025`） | 59 | 2025年のノクサス関連（Welcome to Noxus、Grand Reckoning、Origins of Noxus など19曲）、Trials of Twilight 8曲、Summoner's Snowdrift 4曲、For Demacia 20曲、Pandemonium 8曲 |

- **LoLの関連ゲーム**（Riot Forge の3作・Teamfight Tactics・2XKO・Wild Rift・Legends of Runeterra）の曲は、新しいシリーズ「🛡️ Riot Games — LoL関連ゲーム」（`riot-games`）の7リスト・342曲にした：Ruined King 60曲、The Mageseeker 57曲（「Lightbringer - The Mageseeker」を含む）、Hextech Mayhem 30曲、Teamfight Tactics Vol.1／Vol.2 各68曲（プレイリスト内の位置で古い半分／新しい半分）、2XKO 45曲、Wild Rift & Runeterra 14曲。LoLのリストと違って自動では作らず、🛒公式カタログから取り込む。
- VALORANT 公式 Creator-Safe Playlist の39曲は VALORANT のシリーズの「VALORANT Creator-Safe」リストにした（[VALORANT楽曲台帳](VALORANT-MUSIC.md)）。
- **入れていない行**：Warsongs の9行（`lol-warsongs` に「(feat. …)」の曲名で入っている）、「Salvation」の単曲版（For Demacia の版を入れた）、「Back from the Brink」の単曲版（Pandemonium の版を入れた）。Wild Rift・TFT の一部はプレイリストに同じ曲が2回あるので1回だけ。
- **曲別リンク**：各曲はそのプレイリストにある Spotify のトラックID（`tools/riot-games-creator-safe-playlist.json` の `rows`）へリンクする。IDは songdata.io の表示から写したもので、VALORANT の36行は VALORANT プレイリストの一覧と1件ずつ一致、3件（Deathfire Grasp、Leilani、For Demacia!）は公式の Spotify 埋め込み表示で曲名・アーティスト・ジャケットが一致した。
- **アルバム名**：Pentakill の3作と、For Demacia・Pandemonium・Summoner's Snowdrift・Trials of Twilight の各OST（公式SoundCloudのアルバム名）だけ入れた。ほかは確かめられていないので空欄。
- **検査**：`tools/check-repo.mjs` が、新しい12リストの全曲が記録したトラックIDの曲名・アーティストと一致すること、記録した927行のすべてが LoL・VALORANT・Riot Games のどれかのリストにあること（IDか、アルバム側のリストは曲名で）を確かめる。

### 次の確認（Phase 3 の残作業）

1. 実ブラウザで Season 4〜9 の公式SoundCloudセットページを開き、アルバム見出しの Season 表記と曲数を確認する（Spotifyとの差があれば台帳とfixtureを直す）。
2. SoundCloud掲載音源の長さがSpotifyと違う件（Season 2 で確認）が他作でもあるか確認する。
3. 人気曲ページのスナップショットは時期を見て更新する（更新時は取得日をfixtureの `asOf` に残す）。
4. **見当たらなかった曲**（Warsongs「Silver Scrapes」、Champion Theme「Smolder, the Fiery Fledgling」「Yunara, the Unbroken Faith」、Sessions: Diana「Oh Baby」）の Spotify アプリでの追加確認は、管理者の判断で行わない（2026-10-12）。「見当たらない」のまま扱う（songdata.io に出ない2曲は701〜750番目にあり、2024年の Smolder が含まれる可能性は台帳に記録済み）。将来プレイリストに見つかったら、その fixture の `creatorSafe`（`matchedTracks`・`notFound`）と `LOL_CREATOR_SAFE` を同時に直す（`check-repo` が一致を見る）。
5. 101番目以降は第三者サイト（songdata.io）の一覧で照合した。Spotifyアプリで全979曲を表示できる環境があれば、1度だけ見直す（任意）。

### データと検査

- 実装：`js/catalog.js` の `lol-champion-themes`、`lol-worlds-anthems`、`lol-msi-anthems`、`lol-kda-songs`、`lol-season-1`〜`lol-season-9`、`lol-warsongs`、`lol-popular-tracks`、`lol-cs-pentakill`・`lol-cs-themes`・`lol-cs-esports`・`lol-cs-ost-2025`（trk118）。LoL関連ゲームはシリーズ `riot-games`。
- Creator-Safe Playlist の記録：`tools/riot-games-creator-safe-playlist.json`（51〜977行目の曲名・アーティスト・トラックIDと、そこから作ったリストの照合状態）。
- 検査データ：`tools/leagueoflegends-music-tracklist.json`。
- Phase 3 の検査データ：`tools/leagueoflegends-soundcloud-albums-tracklist.json`（アルバムごとの公式SoundCloud URL・公式SpotifyアルバムURL・曲順つきの全曲、人気曲30件、取得方法と地域制限の記録）。
- Sessions の既存データ：`tools/leagueoflegends-sessions-tracklist.json`。
- 回帰検査：`tools/check-repo.mjs`。カタログ順・曲名／アーティスト／アルバム／URL、公式ホスト形式、収録数、Worlds 2026のMV／Spotifyリンク、K/DA各曲のSpotify／公式動画リンク、権利注意書き、安全なwish更新を検査します。
- Phase 3 の回帰検査（同ファイルの別ブロック）：Season 1〜9＋Warsongs＋人気曲の**11プレイリストが既存7リストの後ろにこの順で並ぶこと**、アルバムごとに曲数（9／30／23／22／25／27／48／39／20／11）と曲順・曲名・アーティスト・アルバム名、公式SoundCloudアルバムURL（`/sets/` 形式・クエリなし）と公式Spotify個別曲URL（22文字ID・クエリなし）、人気曲30件の公式SoundCloud個別曲URL、Spotify ID とSoundCloud URL の重複なし、別名が公式タイトルの前方一致だけであること、プレイリスト名24文字以内（保存時に切られるため）、1プレイリスト100曲以内・自動作成プレイリスト总数100以内（`js/library.js` の保存上限）、シリーズ注記の権利文言、そして既存の所持曲・改名・アイコン・タグを保ったまま wish とガイドだけが更新されることを検査します。
- `js/library.js` は LoL 公式リストの wish とガイドだけを更新し、既存の所持曲・利用者が変更した名前／アイコン／タグは保持します。Sessions以外の新規リストにも「配信・購入は二次利用許諾ではない」旨のガイドを付けます。

## 未収録・次段階

1. **旧Champion Theme／旧ログインテーマ**：Creator-Safe Playlistにある旧ログインテーマは trk118 で `lol-cs-themes` に入れた。それ以外は、2010年代の公開先・地域版・アルバム収録を照合し、個別の曲名と公式配信先が確認できたものから追加。曲が存在しないチャンピオンへテーマを割り当てない。
2. **その他のチャンピオン関連曲／バーチャルアーティスト**：K/DAは「POP/STARS」と「ALL OUT」収録5曲を別リストに追加済み。その他のK/DA作品、True Damageの他作品（Worlds 2026「Know My Name」はWorlds枠で収録済み）、HEARTSTEEL、PentakillなどはChampion Themeと混ぜず、プロジェクト／イベント別に調査・収録する。
3. **Skin Theme／イベント曲**：Riot公式Musicタグの「Skin Theme」「Event Theme」や、季節イベント・ゲームモードの公式公開曲を別リストにする。現時点で候補を見つけても、分類・公式個別リンクを確認するまでは未収録。
4. **ゲームOST／映像OST**：シーズン別OST「The Music of League of Legends: Season 1〜9」と「Warsongs」はアルバム別プレイリストとして収録済み（Phase 3）。残るは公式SoundCloudアルバム一覧に出ている他のOSTと Arcane 系の映像OSTで、収録順・重複・ゲーム内曲／映像曲の区別とともにアルバム別に照合する。手がかりとして確認済みの公式SpotifyアルバムID：`Pandemonium`（2026）`78RpNOe76RHMhCRZbJS68n`、`For Demacia`（2026）`4UPfbzGfDeKVC8wiMEwrJA`、`Trials of Twilight`（2025）`7mpX4l9M8bFRZOQb73qEbd`、`Spirit Blossom Beyond`（2025）`0mNCXeb7azjErkTqoaR4BA`、`Welcome to Noxus`（2025）`7oCUh77MwNd0x12QjA7F5K`、`Arcane`（2021）`0jV32pIk8l3vTaU3thTaW2`、`Arcane Season 2`（2024）`18r1yGUJUNHXYj1DQU0qIE`。
5. **競技テーマ／イベント用オーケストラ曲**：Worlds／MSIの歌唱アンセムと分け、年ごとの公式投稿が特定できたものだけ収録。
6. **MSIの未確定年・その他イベント**：候補曲を調査継続。検索で見つからなかった年を「曲なし」と断定しない。

公式MusicタグにはChampion Theme以外にも Skin Theme、イベント／ゲームOSTや仮想アーティストの曲が掲載されています。したがって、Phase 1 の41曲やWorlds/MSIのリストを「LoL全楽曲」と呼びません。

## 権利・利用条件（重要）

- Riotの[Creator-Safeガイドライン](https://www.riotgames.com/en/riot-music-creator-safe-guidelines)は、RiotがCreator-Safeとして指定する**特定のプレイリスト内の曲**と利用条件を基準にしています。Riot自身の説明でも、外部アーティスト／出版社／レーベル等との共同制作曲には複雑な権利関係があり、Creator-Safeプレイリスト外の曲は一般に権利者のライセンスが必要で、配信・動画での利用が安全とは保証されないとされています。
- Worlds／MSIアンセムは外部アーティストとの共同制作を含むため、公式YouTube／Spotify／SoundCloudで聴けることを**再利用の許可**と見なしません。創作動画・配信等に使う場合は、曲が現在のCreator-Safeリストに含まれるか、必要な権利者の許諾があるかを曲ごとに確認してください。企業広告・販売・音源再配布などは別条件です。
- 「Know My Name」はRiotのCreator-Safeプレイリストに見当たりません（trk116で表示される全977行を照合）。よってカタログではCreator-Safeと表示せず、対象外・要確認として扱います。公式MV／配信先があることだけでは、動画・配信への利用や音源の再配布は許諾されません。
- **Phase 3 のうち Creator-Safe 対象と照合できたのは Season 1〜9 の全243曲と Warsongs の10曲**です（根拠は上の「Creator-Safe の照合状態」。101番目以降は第三者サイトsongdata.ioの一覧で照合）。Warsongs の「Silver Scrapes」は見当たりません。Phase 1／2 のリスト（Sessions・Champion Theme・Worlds・MSI・K/DA）と人気曲の結果は上の「残りのリストの照合」の表のとおりです。照合済みでも、Riotの法務表記に従うことが条件で、音源の同梱・再配布・販売や企業広告での利用は別条件です。Creator-Safe は trk! が音源を配布してよい意味にはなりません。
- 人気曲30曲は**曲ごとに扱いが違います**。trk116 で1曲ずつ照合し、Creator-Safe Playlistにあったのは7曲（Get Jinxed×2、Piercing Light (Mako Remix)、Still Here、Here, Tomorrow、Worlds Collide 2015、Lightbringer）。残る23曲（Worlds／MSIアンセム・K/DA・True Damage・HEARTSTEEL など外部アーティストとの共同制作曲やリミックス）は見当たらず、対象外・要確認です。人気曲ページには「日本では利用できません」と表示される曲もあり、リンク先の再生可否は地域と時期で変わります。
- 収録したK/DA 6曲は、RiotのCreator-Safe Playlistに見当たりません（trk116）。Spotify個別曲ページとRiot公式動画を確認したことは、二次利用や音源同梱／再配布の許可を意味しません。
- SessionsはCreator-Safe Sessionsとして提供された範囲で案内し、Riotの現行ガイドラインとクレジット／利用条件に従う前提です。Creator-Safe Playlistでは Vi・Star Guardian Taliyah が全曲、Diana は「Oh Baby」以外の42曲を確認しました（trk116）。Creator-Safeであることも、音源そのものの再配布を許す意味ではありません。
- 本アプリは公式リンクを開くための索引です。音源をダウンロード・同梱・再配布せず、リンク先の内容・地域利用可否・権利状態も保証しません。利用直前に公式ガイドと該当曲の権利情報を確認してください。

## 参照先

- [Riot Games — 法務表記（日本語）](https://www.riotgames.com/ja/legal)（一般的な法務案内。個別曲の利用条件はCreator-Safeガイド／権利者の条件で別途確認）
- [Riot Games — Creator-Safe Guidelines](https://www.riotgames.com/en/riot-music-creator-safe-guidelines)
- [Riot Games — Creator-Safe Playlist（Spotify）](https://open.spotify.com/playlist/5hDYD44imzFZEqTfAoco1N)（979曲・「100% Riot Games が権利を持つ曲」。埋め込み表示の先頭100件で Season 9・8 の全曲と Season 7 の41曲を照合（2026-10-11）。Know My Name・K/DAは見当たらない（trk116）。101番目以降は下の songdata.io で照合）
- [songdata.io — Riot Games Creator-Safe Playlist の一覧](https://songdata.io/playlist/5hDYD44imzFZEqTfAoco1N)（第三者サイト。trk115 で101〜300番目、trk116 で表示される全行（51〜977行目）を読み、LoLの全リストを照合（2026-10-12）。979曲中977曲を表示し、出ない2曲は701〜750番目。50件ごとの区画内はトラックID順）
- [Riot Games Creator-Safe Playlist Pt. I](https://soundcloud.com/leagueoflegends/sets/riot-games-creator-safe)／[Pt. II](https://soundcloud.com/leagueoflegends/sets/riot-games-creator-safe-pt2)（公式SoundCloud。499曲／230曲・約4年前の更新。先頭15曲のみ確認）
- [League of Legends — Champion Theme の公式記事一覧](https://www.leagueoflegends.com/en-us/news/tags/champion-theme/)
- [League of Legends — Music の公式記事一覧](https://www.leagueoflegends.com/en-us/news/tags/music/)
- [League of Legends — 公式YouTubeチャンネル](https://www.youtube.com/@leagueoflegends)（Champion Theme個別投稿を確認。例：[Locke, the Ashen Exorcist](https://www.youtube.com/watch?v=nakzw9Y_CLI)、2026-06-26公開）
- [League of Legends — 公式Spotifyアーティスト](https://open.spotify.com/artist/47mIJdHORyRerp4os813jD)
- [League of Legends — 公式SoundCloudプロフィール](https://soundcloud.com/leagueoflegends)
- [League of Legends — 公式SoundCloudアルバム一覧](https://soundcloud.com/leagueoflegends/albums)（Season 1〜9・Warsongs の各アルバムページへ。セットページはJavaScriptなしだと先頭15曲しか出ない）
- [League of Legends — 公式SoundCloud「Popular tracks」](https://soundcloud.com/leagueoflegends/popular-tracks)（人気曲30曲スナップショットの出典。順序は時間で変わる）
- [Riot Games — Warsongs 公式発表（トラックリスト11曲）](https://nexus.leagueoflegends.com/en-us/2016/01/warsongs/)
- [LoL Esports — Worlds 2026 Anthem Presented by True Damage（発表記事）](https://lolesports.com/en-US/news/worlds-anthem-presented-by-true-damage)
- [League of Legends — Worlds 2026「Know My Name」公式MV](https://www.youtube.com/watch?v=mlFxxNsExJc)
- [Riot Games — Know My Name公式Listen Now](https://truedamage.ffm.to/knowmyname)（MV説明欄から案内）
- [True Damage — Know My Name（Spotify個別曲）](https://open.spotify.com/track/3s2YCL5LHLzXWbw7ezQru3)

Spotifyのユーザー作成プレイリストや第三者の動画は発見用の手がかりに限り、公式公開元の根拠にはしません。収録時は公式アーティスト／公式チャンネル／公式記事への個別リンクを優先します。

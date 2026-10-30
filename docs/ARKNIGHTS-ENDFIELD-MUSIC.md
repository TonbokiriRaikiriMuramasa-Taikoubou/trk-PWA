# アークナイツ：エンドフィールド 公式楽曲カタログ — 調査・実装台帳

最終確認：**2026-10-12（UTC）**（trk128：初号指令OST 上下を最上へ・リリース順並び替え・キャラクターテーマ4リストを「Endfield Character Theme」棚へまとめ）

## 方針

アプリへ入れるのは曲名・アーティスト・アルバム名（事実情報）と**公式配信／公開へのリンクだけ**です。音源ファイルは同梱しません。カタログのリンクや購入・サブスクリプションは、二次利用許諾の代わりになりません。曲順・曲数・曲名・アーティスト表記は公式Spotifyアルバムページを正とし、中国語公式曲名と作曲クレジットはVGMdbアルバムページ（出典表記はMETAL SCAR RADIO／上海鹰角网络科技有限公司）と公式ffm.toスマートリンクで照合しました。確認できない曲は作りません。未検索・未確認を「存在しない」とは扱いません。

## 権利者と公式レーベル

- 楽曲の著作権・原盤権は **©/℗ 2026 GRYPHLINE**（公式Spotifyアルバムページの表示）。VGMdbでは Publisher / Phonographic Copyright を **Hypergryph（上海鹰角网络科技有限公司 / Shanghai Hypergryph Network Technology Co., Ltd.）** と表記。日本の窓口は GRYPH FRONTIER PTE. LTD.（二次創作ガイドライン制定者）。
- レーベル名義は **Metal Scar Radio（鐵痕電台 / 铁痕电台）**。無印アークナイツの Monster-Siren Records（塞壬唱片）と同じ Hypergryph 運営の Arknights: Endfield 公式音楽レーベルです。Monster-Siren には実在の公式サイト（monster-siren.hypergryph.com）がありますが、Metal Scar Radio は作中世界の「非合法ラジオ局」という設定で、**曲単位の公式サイトは存在しません**。そのため公式の入手先は各種サブスク配信（Spotify等）と公式YouTubeになります。
- Spotifyアーティストページ： https://open.spotify.com/artist/63CsKCn2OazatczRm1tk9c
- 作曲クレジット（両巻）：Gareth Coker、Hybrid（Mike Truman / Lottie Truman）、Kirara Magic、VISION SOUND、Salty Salt、原田萌喜、Alec Justice、Cody Matthew Johnson、MeLo_绿萝组、Robert Wolf、SKa2or、MSR Studio、BLACK 0、Aurora Sky（歌唱）。マスタリングは Abbey Road（Christian Wright）ほか。

## 初号指令OST（Zeroth Directive）の公式配信先

公式告知（アークナイツ：エンドフィールド日本公式X、2026-02-03）： https://x.com/AKEndfieldJP/status/2022928866638205084
**2026-02-15 から Spotify、YouTube、Amazon Music 等で配信開始**。告知内の ffm.to スマートリンクが公式の「配信一覧」です。

| 巻 | 公式告知の配信一覧（ffm.to） | Spotifyアルバム | YouTube Music | Amazon Music | 网易云音乐 | その他 |
|---|---|---|---|---|---|---|
| Vol.1（初号指令OST 上 / 零号委托OST（上））37曲・113:54 | https://ffm.to/ro6qjnl | [5qK87ACnKVHYKUWozTtXOA](https://open.spotify.com/album/5qK87ACnKVHYKUWozTtXOA) | [OLAK5uy_ksgKvvAzjasGo9AHgxKpEOtPPAuqFP0R4](https://music.youtube.com/playlist?list=OLAK5uy_ksgKvvAzjasGo9AHgxKpEOtPPAuqFP0R4) | [B0GN36WMS8](https://music.amazon.com/albums/B0GN36WMS8) | [361952900](https://music.163.com/#/album?id=361952900) | — |
| Vol.2（初号指令OST 下 / 零号委托OST（下））23曲・70:52 | https://ffm.to/eq8xpy7 | [4msN2gQVhoyeSNxH5fp6RW](https://open.spotify.com/album/4msN2gQVhoyeSNxH5fp6RW) | [OLAK5uy_lTVj4U8HrYsSidSEgzrTsC7AHCIoao3mE](https://music.youtube.com/playlist?list=OLAK5uy_lTVj4U8HrYsSidSEgzrTsC7AHCIoao3mE) | [B0GN36HRI9](https://music.amazon.com/albums/B0GN36HRI9) | [361958075](https://music.163.com/#/album?id=361958075) | [Deezer](https://www.deezer.com/album/917391741)・[Qobuz](https://play.qobuz.com/album/okt4htf3bnn16) |

- 資料用ページ（公式ではない）：VGMdb [Vol.1](https://vgmdb.net/album/157312) / [Vol.2](https://vgmdb.net/album/157313)
- **Apple Music 掲載**：2026-10-10 時点では確認できませんでしたが、**2026-10-11 にレーベルの Apple Music アーティストページ（[1870752601](https://music.apple.com/us/artist/metal-scar-radio/1870752601)）で Vol.1 の掲載を確認しました**（[Zeroth Directive (Original Soundtrack), Vol. 1 — 1879684533](https://music.apple.com/us/album/zeroth-directive-original-soundtrack-vol-1/1879684533)）。Vol.2 のアルバム別URL・曲別URLの照合は未実施です。

## 収録したプレイリスト（js/catalog.js・シリーズ `endfield`）

表の順序＝ `js/catalog.js` の `series.playlists` 順（＝Endfieldタブに表示される順。正： [`tools/endfield-zeroth-directive-tracklist.json`](../tools/endfield-zeroth-directive-tracklist.json) の `seriesPlaylistOrder`）。trk128 で**初号指令OST 上下を最上**（ゲームのオープニングBGMがここにある）にし、公式アルバム6作を**リリース順**で並べ、**キャラクターテーマ4リストをネスト棚「Endfield Character Theme」（`trk-endfield-character`）**にまとめ、紹介リストを最後にしました。

| プレイリスト（ID・表示名） | 内容 | 曲数 | 曲別リンク | 巻のリンク（sourceUrl） |
|---|---|---|---|---|
| `ef-firstorder`「初号指令 (上) ZD OST Vol.1」（ZD＝Zeroth Directive。trk129で24文字に収めた表示名。フル名はタグ） | 初号指令OST（上）＝Zeroth Directive Vol.1 全曲を公式収録順で（2026-02-15） | 37 | 公式Spotify個別曲 | 公式ffm.to配信一覧 |
| `ef-firstorder2`「初号指令 (下) ZD OST Vol.2」（同上） | 初号指令OST（下）＝Zeroth Directive Vol.2 全曲を公式収録順で（2026-02-15） | 23 | 公式Spotify個別曲 | 公式ffm.to配信一覧 |
| `ef-eve`「Endfield — Eve of Departure」 | EP全曲を公式収録順で（2026-04-11） | 5 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-thunder`「Endfield — Thunder's Legacy」 | アルバム全曲を公式収録順で（2026-04-22） | 9 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-wake`「Endfield — At the Wake of Spring OST」 | OST全曲を公式収録順で（2026-04-30） | 17 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-ccr`「Endfield — Contingency Contract Re-Ignition OST」 | EP全曲を公式収録順で（2026-06-20） | 4 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-homecoming`「Endfield — Homecoming OST」 | OST全曲を公式収録順で（2026-07-31） | 30 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-dreamscape`「Endfield — Dreamscape of Wind and Snow OST」 | OST全曲を公式収録順で（2026-09-10） | 16 | 公式Spotify個別曲 | 公式Spotifyアルバム |
| `ef-blurring`「Endfield — Blurring」 | 紹介版（Laevateinのキャラクターテーマ。Talos Wikiでは2026-01-22のOperator EP） | 2 | 公式YouTube／公式サイト | — |
| `ef-ashen`「Endfield — ASHEN REMAINS」 | 紹介版（Laevateinのキャラクターテーマ） | 2 | 公式X告知 | — |
| `ef-floaty`「Endfield — The Floaty Envelope」 | 紹介版（Gilbertaのキャラクターテーマ） | 2 | 公式X告知 | — |
| `ef-makers`「Endfield — MAKER'S LUV」 | 紹介版（Yvonneのキャラクターテーマ） | 1 | 公式X告知 | — |
| `ef-signal`「Endfield — The Signal Is Still Pulsing」 | 紹介版（Metal Scar Radio関連ほか5項目） | 5 | wiki／YouTube／ツールページ | — |

- 旧版の「初号指令 OST」プレイリスト（上・下それぞれ Part 1/2 の4項目紹介版）は、**永続ID `ef-firstorder` を保ったまま Vol.1 全37曲版へ更新**します。trk110 以降の旧既定名（「Endfield — Zeroth Directive OST Vol.1／Vol.2（初号指令・上／下）」＝保存は24文字切り「Endfield — Zeroth Direct」）と、**trk128 の名（「初号指令 (上／下) ― Zeroth Directive Original Soundtrack Vol.1／2」＝保存は「初号指令 (上／下) ― Zeroth Direct」）**は、trk129 で**24文字に収まる新名（「初号指令 (上／下) ZD OST Vol.1／2」）へ既定名だけが更新**され、所持曲・ユーザーが変えた名前／アイコン／タグはそのままです（`js/library.js` のセーフリフレッシュ。旧既定名の一覧は `ENDFIELD_FIRSTORDER_OLD_NAMES`）。
- **trk129 の一回限りの戻し（`trkEndfieldShelfRestoreOnce`・`settings.trkEndfieldTidy2`）**：trk128 のフォルダ上限13は、利用者が自分のフォルダを4個以上持っていると、配列の末尾にあった 🎭棚を起動のたびに切り捨て、キャラクターテーマ4リストをトップへ落としていました。上限を40にして切り捨て自体を止め、**すでに落ちてしまった配置だけ**（棚が空・4リストがどこにも入っていない）を一回限りで棚へ戻します。利用者が自分で置いたリストは触りません。消えてしまった利用者のフォルダ自体は戻せません。
- **trk128 の一回限りの整頓（`trkEndfieldTidyOnce`・`settings.trkEndfieldTidy1`）**：既存の取り込みを上表の順へ並べ直し、キャラクターテーマ4リスト（まだ Endfield フォルダの既定場所にあるものだけ）をネスト棚 `trk-endfield-character`（「Endfield Character Theme」）へ移動します。利用者が別の場所へ動かしたものは守り、印が付いた後は並びも配置も二度と触りません（手動並べ替え `playlistOrder`・`createdAt`・配列順の3系統をすべて新しい順へ揃える）。
- 中国語公式曲名（例：`协议流`＝Protocol Flow）は**照合別名（matchAliases）**として登録。中国語ファイル名の手元音源も曲名照合できます。表示曲名は公式英語名です。
- キャラクターOST等の既存プレイリスト（`ef-blurring`・`ef-ashen`・`ef-floaty`・`ef-makers`・`ef-signal`）の**内容**は変更していません（trk128 で棚へまとめたのは場所だけ）。紹介版の `ef-signal` には「Rekindled」「REAPER」が含まれており、本バッチの `ef-ccr`・`ef-homecoming` と曲が重複しますが、両方とも残しています（紹介版は変更しない方針）。
- **キャラクターテーマの根拠（trk128 調査・2026-10-12）**：Endfield Talos Wiki（コミュニティ運営）では、`Blurring`・`ASHEN REMAINS`＝Laevatein（レヴェテナ）、`The Floaty Envelope`＝Gilberta、`MAKER'S LUV`＝Yvonne の Operator（キャラクター）関連楽曲と分類されています（Blurring は 2026-01-22 発売の Operator EP、Maria Nalyon & Chengcheng Tang 歌唱）。**公式ページでの再確認は次段階**（下の「調査中の他の公式リリース」参照）です。なお、同じ Wiki の分類では `Thunder's Legacy`・`Eve of Departure` もキャラクター関連／その他に載りますが、リリース順のアルバム一覧として本一覧に残しています（利用者指示：リリース順優先）。
- データの正： [`tools/endfield-zeroth-directive-tracklist.json`](../tools/endfield-zeroth-directive-tracklist.json)（Zeroth Directive Vol.1–2）・[`tools/endfield-msr-albums-tracklist.json`](../tools/endfield-msr-albums-tracklist.json)（本バッチの6作81曲）

### Tracklist — Vol.1（初号指令OST 上 / 零号委托OST（上））

| # | 曲名 | 中国語公式曲名 | アーティスト（公式Spotify表記） | Spotify |
|---|---|---|---|---|
| 01 | Protocol Flow | 协议流 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/0NOD8FVBXkLbmrJSYCS3Aq) |
| 02 | Initial Process | 最初进程 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/57d9mK6RV0bizpXK1Qn8Pr) |
| 03 | Shape of the Tower | 塔之形 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/3QAvUY8zexlNtAOls3Cfwk) |
| 04 | Protocolized Resonance | 协议化轰鸣 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/225SxJEm6YYWkhFbqdKKZ0) |
| 05 | Existence | 本有 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/1Sx7W1yEghAW8Oa4Nc2CNT) |
| 06 | Defying Stillness | 否定沉寂 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/0tRjyNRuNZBe4vewMfBbMR) |
| 07 | Cosmic Observer | 寰宇观者 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/44IGAtL6UxB13zhby5jzeE) |
| 08 | Downpour | 降之雨流 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/5HS3n0elShzZKDSC6F8CBq) |
| 09 | Promotion Structure | 进阶构成 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/4AjuUlEkp4BYisV9mTo2z3) |
| 10 | Edge/Mechanics | 锋刃/机械 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/4dNsfN1Hy3GTsGd2RxeQbE) |
| 11 | Nexus Event | 中枢现象 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/34yq954sCweaNmXSjugQ8t) |
| 12 | Soils of Life | 生之泥壤 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/4j47ihnA2y30qt2Laus5gW) |
| 13 | Fort in the Acid Fog | 雾蚀要塞 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/4AFefMOgOfQYfX8edlMSPU) |
| 14 | Guns/Steel | 铳/钢铁 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/2zEEwI0uFuOCofZUTfExyY) |
| 15 | Outpost Shaping I | 据点塑成I | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/07n4CfyBw4SrNhfFycIiAx) |
| 16 | Outpost Shaping II | 据点塑成II | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/2Eokhj679zoVAqywFykWpq) |
| 17 | Outpost Shaping III | 据点塑成III | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/5AwJQcr0cYLPzo3TKPddQH) |
| 18 | Outpost Shaping IV | 据点塑成IV | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/1Xn5iOdiiYIwOuF3PrixJH) |
| 19 | Imprisoned Below | 地牢囚者 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/2WfrnGt27WNGaOpxyOl7VS) |
| 20 | Hazefyre | 雾火 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/3O0GfLIt03pB8ub8sbqx5R) |
| 21 | The Bonekrushing Fist | 碾骨之拳 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/0tsG3JQ064n0TLwRNRXRf6) |
| 22 | Echoes in Ore | 岩石密语 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/7yHbrlVnFiWmdnBbErgNGl) |
| 23 | Evacuation 373 | 373号撤离 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/5whDfg415m9xBRjhRKqY36) |
| 24 | The Planter's Trace | 种植者留痕 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/4WDzT25chfGRaKb5VlKFUS) |
| 25 | Originium Science Park | 源石研究园 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/1oVsPq1xRPr77WDMdWnGqV) |
| 26 | Journey to the Vein | 行向矿脉 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/3VSuE9MC9qyFvbygrtQDUS) |
| 27 | Surviving Mining | 矿业余生 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/0WKf9g8biP06EHSaSoP9cM) |
| 28 | Arts/Blood | 法术/血液 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/7MCy2nFsCJSaXzgK1mhxgy) |
| 29 | Lodespring Corner | 源区一隅 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/2TRQdwBHPAaTnf4zFmXAqZ) |
| 30 | Ankhor! Ankhor! Ankhor! | 锚点！锚点！锚点！ | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/3ENwa03847OrFuy1gaoPmn) |
| 31 | Triaggelos: Remaining | 三位一体：亡骸 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/3PuUBlKn2Z35eVQWDwJ408) |
| 32 | Triaggelos: Being | 三位一体：造物 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/2At7k5s0O9UJWtFAb3Aw8M) |
| 33 | Triaggelos: Obscurity | 三位一体：晦暗 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/7A3DxC1kgjLzfcaa3l6ANr) |
| 34 | Sinking Rays | 光线沉降 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/27F6i9A5wxNBfiP2FK9ZL5) |
| 35 | Marble Aggelomoirai | 白垩界卫 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/6a6L23E4lQGFhqmGJn55gY) |
| 36 | Joyous Now | 庆乐此时 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/1nwA4ElX1TOCCli3Hnornh) |
| 37 | Faith's Imprint | 信念拓印 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/15gTGxr577tNJ2gZZXTfAG) |

### Tracklist — Vol.2（初号指令OST 下 / 零号委托OST（下））

| # | 曲名 | 中国語公式曲名 | アーティスト（公式Spotify表記） | Spotify |
|---|---|---|---|---|
| 01 | Wisdom of the Landscape | 知山水 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/3Rg8XrRfqzePhy3cgoupOu) |
| 02 | To Walk, To Cross | 行渡 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/62nDuLgX0MvZVf2Jrz2cuX) |
| 03 | Misty Grove | 雾篁 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/0DOftQ7ORTVmYq7TdYQALA) |
| 04 | The Settling Gaze | 沉降视线 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/0QPrEnH64GC7JcCYF0rmhV) |
| 05 | Marching Onwards | 武装继进 | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/6P14Kt3awMRXeJ8ZpZ3drF) |
| 06 | Pools in the Ice Cave | 寒窟聚水 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/7BVpNwdNqdjS3p1RkdUGJg) |
| 07 | Jingyu at Daybreak | 景玉朝明 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/0ooLLIYdk5PokE3NvPfGq0) |
| 08 | Jingyu at Eventide | 景玉夕时 | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/1LLqtSJcxZo3H4IG7WDODX) |
| 09 | Blossoms Bring an Old Friend | 春景故人来 | Metal Scar Radio, Kirara Magic | [track](https://open.spotify.com/track/72Mt1lphOXDWakRctULOAW) |
| 10 | The Great Tide | 大潮升 | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/5nYYWzAu9FSRiZfIGAwKmP) |
| 11 | Watching the Ling Waters | 观陵水 | Metal Scar Radio, 原田萌喜, Alec Justice, Cody Matthew Johnson, Aurora Sky | [track](https://open.spotify.com/track/1g3VBk3XzZLny7PXxtHEQY) |
| 12 | Fangxing | 方兴 | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/4oSRLPUPLrHcDooZc2oOdx) |
| 13 | Strings of Hue | 戏彩绳 | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/4JlHjfYQ3S5uYFwVwdHtTw) |
| 14 | A Day for Ourselves | 寻暇日 | Metal Scar Radio, MeLo_绿萝组 | [track](https://open.spotify.com/track/6gOwtSP1ul3w7uN84KWksh) |
| 15 | By the Solemn Glow | 孤案灯青 | Metal Scar Radio, MSR Studio, BLACK 0, Aurora Sky | [track](https://open.spotify.com/track/6yEVLr9xHTeAk3sxPV6l22) |
| 16 | Peace Under a Vast Sky | 万里升平 | Metal Scar Radio, MeLo_绿萝组 | [track](https://open.spotify.com/track/68yAQasLeIi4VaWGz0l0oh) |
| 17 | Charged by Verdant Tubes | 青简注我 | Metal Scar Radio, Kirara Magic | [track](https://open.spotify.com/track/0g7dFkfwlkZ1UhzQqzbGeC) |
| 18 | Crimson in the Crag | 山樆轻 | Metal Scar Radio, MSR Studio | [track](https://open.spotify.com/track/7IU7nfBAqKDYV2u6ZlHT7E) |
| 19 | When the Spring Rite Arrives | 来时新社 | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/2x8rSsHHA6BLMYLLvNCsCJ) |
| 20 | Of Grace and Gentle Might | 穆如清风 | Metal Scar Radio, MeLo_绿萝组 | [track](https://open.spotify.com/track/3nT3EmeiixysEpL1Lnn2LK) |
| 21 | The Wind of Rupture | 不周风 | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/3OZxJyMH1A5HrrpdPTlyph) |
| 22 | New Foundation | 新壤 | Metal Scar Radio, Robert Wolf | [track](https://open.spotify.com/track/54MxCLBrmnKfzS2zYCcNbZ) |
| 23 | Forge | 洪炉 | Metal Scar Radio, SKa2or | [track](https://open.spotify.com/track/3TKJkruK3HMHG25SwptRxi) |

## Metal Scar Radio の他の公式アルバム6作（trk111で追加）

レーベルの公式Spotifyアーティストページ（[Metal Scar Radio](https://open.spotify.com/artist/63CsKCn2OazatczRm1tk9c)）のディスコグラフィから、以下の6作をカタログに追加しました。曲順・曲名・アーティスト表記は **2026-10-11 に公式Spotifyのアルバム埋め込みページ（`open.spotify.com/embed/album/…`）で6作すべてを再確認**し、Homecoming の30曲は公式ffm.toスマートリンク（Data Controller 表示が **Arknights: Endfield**）でも曲順を照合しました（©/℗ 2026 GRYPHLINE）。個別曲IDは6曲（PHEONIX ON THE RISE／Drowned in Depth／Rekindled／Keeper of My Heart／Vermilion／HER Calling）を公式個別曲ページで抜取確認し、残り75曲のIDは同日のアルバムページ取得値のままです。

この6作は Zeroth Directive のような**公式告知のffm.to配信一覧（Homecomingを除く）・VGMdb照合・中国語公式曲名を確認していない**ため、照合別名は未登録で、各アルバムの案内リンクは公式Spotifyアルバムページです。他ストアについては、Apple Music・Amazon Music・TIDAL・Qobuz の Metal Scar Radio アーティスト／アルバムページに本バッチのアルバムの掲載を 2026-10-11 に確認しましたが、**アルバム別・曲別URLの照合は未実施**なので、カタログのリンクはすべて公式Spotifyに統一しています（「他ストアに配信なし」の断定ではありません）。

| アルバム | 配信日 | 曲数 | 公式Spotifyアルバム |
|---|---|---|---|
| Eve of Departure（Eve of Departure（EP）） | 2026-04-11 | 5 | [2zRC0GHUly8RwEZWV8Wnpr](https://open.spotify.com/album/2zRC0GHUly8RwEZWV8Wnpr) |
| Thunder's Legacy（Thunder's Legacy） | 2026-04-22 | 9 | [7oQIngNMaM8CNqfOdV5alW](https://open.spotify.com/album/7oQIngNMaM8CNqfOdV5alW) |
| At the Wake of Spring OST（At the Wake of Spring Original Soundtrack） | 2026-04-30 | 17 | [3wxeHdhX8CWYyn10gAeFEE](https://open.spotify.com/album/3wxeHdhX8CWYyn10gAeFEE) |
| Contingency Contract Re-Ignition OST（Contingency Contract Re-Ignition Experimental Operation Original Soundtrack） | 2026-06-20 | 4 | [1qzlMIr2jwYizwY17Bseaa](https://open.spotify.com/album/1qzlMIr2jwYizwY17Bseaa) |
| Homecoming OST（Homecoming Original Soundtrack） | 2026-07-31 | 30 | [1OUsAGgNlKQWUWQ154UN2v](https://open.spotify.com/album/1OUsAGgNlKQWUWQ154UN2v) |
| Dreamscape of Wind and Snow OST（Dreamscape of Wind and Snow Original Soundtrack） | 2026-09-10 | 16 | [36qyyiGRMbtktVXGptjZL6](https://open.spotify.com/album/36qyyiGRMbtktVXGptjZL6) |

### Tracklist — Eve of Departure（2026-04-11）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | PHEONIX ON THE RISE | Metal Scar Radio, Hero Baldwin, Alexander Rudd | [track](https://open.spotify.com/track/2LMFipAOoaXiyLG5VI0Mg0) |
| 2 | New Frontier | Metal Scar Radio, Jonathan Sookdew Sing, Alec Justice, 10/KNIVES, Gold3n Ord3r | [track](https://open.spotify.com/track/1j1ac6RzycakpP4jWsU3or) |
| 3 | Army of Angels | Metal Scar Radio, Hybrid | [track](https://open.spotify.com/track/7dl9PJdz9QMjZlJUulvaQw) |
| 4 | Rising Horizon | Metal Scar Radio, Michael McCann | [track](https://open.spotify.com/track/2QMyswj0l2QzTEAEVO0mf9) |
| 5 | Echo of Vision | Metal Scar Radio, Gareth Coker | [track](https://open.spotify.com/track/2qixuX48eng4w2gLc2qaKx) |

### Tracklist — Thunder's Legacy（2026-04-22）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | Nightmare Without Veil | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/2xDxF7U8he0i62u7j2u4Kd) |
| 2 | Lingering Glow | Metal Scar Radio, Aurora Sky, Lucien X | [track](https://open.spotify.com/track/2sWun7tcDHwmWSChKYrUdv) |
| 3 | Hour of Blossoms | Metal Scar Radio, BaoUner | [track](https://open.spotify.com/track/15ACa86aWwwLZHjz1jtCXH) |
| 4 | Where We Walked | Metal Scar Radio, 曾怡HeartStrings | [track](https://open.spotify.com/track/0nNQqZFKQ5gXvWqpfZ1s4F) |
| 5 | Through Old Dreams | Metal Scar Radio, 封炫宇 | [track](https://open.spotify.com/track/4KvWGTm792bakBkXOyZbSo) |
| 6 | Just So | Metal Scar Radio, 曾怡HeartStrings, Feryquitous, 王陽 | [track](https://open.spotify.com/track/1yReGHyOSa8LwAFuemxEXF) |
| 7 | Butterfly in Ashes | Metal Scar Radio, Aurora Sky, Lucien X | [track](https://open.spotify.com/track/4ZqySz7IHJyGcsS3Rtv6TS) |
| 8 | Where the Light Is Taken | Metal Scar Radio, Hyunmin Cho, 王陽 | [track](https://open.spotify.com/track/3RVCk4oW6FvzLAwGUM7RYq) |
| 9 | Keeper of My Heart | Metal Scar Radio, MSR Studio | [track](https://open.spotify.com/track/3SBmFiIf302cz9R8jL0qNT) |

### Tracklist — At the Wake of Spring OST（2026-04-30）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | Drowned in Depth | Metal Scar Radio, Bleeding Fingers, Giovanni Rios | [track](https://open.spotify.com/track/7J44kY14TyaFxOLQqKVRpA) |
| 2 | Evil-Sealing Pool | Metal Scar Radio, BLEEDING FINGERS MUSIC, Martí Noguer | [track](https://open.spotify.com/track/5IbZUeHnQd765HoQtcChCU) |
| 3 | Illusions, Begone | Metal Scar Radio, N2V, VISION SOUND | [track](https://open.spotify.com/track/6T5ESNUjQDiEKLEPJXw6iI) |
| 4 | Celestial Axis | Metal Scar Radio, BLEEDING FINGERS MUSIC, Martí Noguer | [track](https://open.spotify.com/track/5sh7aqFWASUn1J0N7CMBXf) |
| 5 | Beneath the Words | Metal Scar Radio, 動點 | [track](https://open.spotify.com/track/2zxgqmNobCCYqnbkmCgCyG) |
| 6 | Blaze and Ruin | Metal Scar Radio, KH | [track](https://open.spotify.com/track/6qSHPMR4yI7O59ltrOzsmK) |
| 7 | Seize the Pass | Metal Scar Radio, Unisonar, Nick Froud | [track](https://open.spotify.com/track/70onCdBvJk7DeVnErRsTi4) |
| 8 | Blazing Hopes | Metal Scar Radio, Unisonar, Nick Froud | [track](https://open.spotify.com/track/1xunSAkv7lZL4GtrqXfNc9) |
| 9 | Array of Fates | Metal Scar Radio, Unisonar, Nick Froud | [track](https://open.spotify.com/track/197Chn4ZrhbXdC6SWfoeal) |
| 10 | Blooming Lanterns | Metal Scar Radio, Unisonar, Nick Froud | [track](https://open.spotify.com/track/4Ya7F9gD9XSs5Ni9xKPAHc) |
| 11 | Rewrite the Prophecy | Metal Scar Radio, VISION SOUND, Salty Salt, Aurora Sky | [track](https://open.spotify.com/track/56FnXoQ7QWtA0q3DBJsSDX) |
| 12 | Whispers of Decay | Metal Scar Radio, Cody Matthew Johnson, Alec Justice, Will Chen | [track](https://open.spotify.com/track/3fPtedaOmPMXP21OhH6a6X) |
| 13 | Shatter the Crown | Metal Scar Radio, Cody Matthew Johnson, Alec Justice, Will Chen | [track](https://open.spotify.com/track/4qfiRQACYtdO6YQEu87d6S) |
| 14 | Annihilation Response | Metal Scar Radio, Cody Matthew Johnson, Alec Justice, Will Chen | [track](https://open.spotify.com/track/2FSLJPqx0JYnvHRynhFqbb) |
| 15 | Wake the Sea | Metal Scar Radio, Cody Matthew Johnson, Alec Justice, Will Chen | [track](https://open.spotify.com/track/2y4P0C6oz3xt4Lffx5f0Cn) |
| 16 | Drawn by Spring | Metal Scar Radio, WS Music, 乃工 Milkman | [track](https://open.spotify.com/track/1BpJUvKBIMKvVBPf6PLKwN) |
| 17 | Skipping Through Light | Metal Scar Radio, 動點 | [track](https://open.spotify.com/track/3xbdArOQXxOMlZpClXBJ1c) |

### Tracklist — Contingency Contract Re-Ignition OST（2026-06-20）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | Rekindled | Metal Scar Radio, Alec Justice, Keep Close, Chapters | [track](https://open.spotify.com/track/5aWMskK7XVKh0SmKBD7h84) |
| 2 | Contract of Order | Metal Scar Radio, Alec Justice | [track](https://open.spotify.com/track/4poeDOugwCenAMDD76w5Vt) |
| 3 | Artificial Ruin | Metal Scar Radio, VISION SOUND, Salty Salt | [track](https://open.spotify.com/track/0xKCSZjYssDeGDXs8ONzHG) |
| 4 | Rekindled (Instrumental Version) | Metal Scar Radio, Alec Justice, Keep Close, Chapters | [track](https://open.spotify.com/track/1nmZG5ln7TOHwzbrTQKT77) |

### Tracklist — Homecoming OST（2026-07-31）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | Questioning the Veil | Metal Scar Radio, INSPION | [track](https://open.spotify.com/track/45k4MS7tTg8s0Obmzt7ihn) |
| 2 | Glorious Mountain Pass | Metal Scar Radio, Ceru_ | [track](https://open.spotify.com/track/60oNwqMHyZOJfTy062Zyt9) |
| 3 | The Day After Tomorrow | Metal Scar Radio, Ceru_ | [track](https://open.spotify.com/track/3WPjEMfpaEo0qiWAazXqnl) |
| 4 | A Life for a Shadow | Metal Scar Radio, Ceru_ | [track](https://open.spotify.com/track/2ELjsQsirLmkc7MFcK8P4b) |
| 5 | The Painted World | Metal Scar Radio, Hyunmin Cho | [track](https://open.spotify.com/track/0HsYy9dq4WDdIHfiD5xGMb) |
| 6 | Inkwash Journey | Metal Scar Radio, Hyunmin Cho | [track](https://open.spotify.com/track/1S6a4fdUYJbZEU5hv56e9Z) |
| 7 | Blunted by Endless Trials | Metal Scar Radio, 李化禹 | [track](https://open.spotify.com/track/2o9tc7CgklORR7RyaXclL5) |
| 8 | Parting the Miasma | Metal Scar Radio, David Murillo, Moroi | [track](https://open.spotify.com/track/77iAGTWQ6KkbHexOGdFoT7) |
| 9 | Guarding the Nexus | Metal Scar Radio, LCwwww, Feryquitous | [track](https://open.spotify.com/track/23plnEDuyTZCdMDB4M3ZtA) |
| 10 | Void Annihilation | Metal Scar Radio, AION, Hahlweg | [track](https://open.spotify.com/track/4a7buJoufnwjYIhjTaTbA9) |
| 11 | Exclusion Zone | Metal Scar Radio, Lukas Knoebl | [track](https://open.spotify.com/track/7ITAo94sRZV9ygWhlmqiS0) |
| 12 | Honed Blade Ascension | Metal Scar Radio, Nick Froud | [track](https://open.spotify.com/track/7uSOYgjCn29hzbquKm1nHm) |
| 13 | Tales of the Sword | Metal Scar Radio, Nick Froud | [track](https://open.spotify.com/track/4PB31GLS6FIugHjwpLjG7D) |
| 14 | Matters Before the Hall | Metal Scar Radio, 湯湯 | [track](https://open.spotify.com/track/5F73p8qhJm4pLycLWUFCx8) |
| 15 | Lost in the Flux | Metal Scar Radio, 明家歆, Jean-Gabriel Raynaud, 原田萌喜 | [track](https://open.spotify.com/track/4SPcnQDo7MBUEJ7HCIk2C2) |
| 16 | Toward the Dreamscape | Metal Scar Radio, Hyunmin Cho | [track](https://open.spotify.com/track/3gtXhoK86da8pv9XvG8La5) |
| 17 | The Heart Crumbles | Metal Scar Radio, Ceru_ | [track](https://open.spotify.com/track/25YiDTbYMaFo3UN3C5Liyl) |
| 18 | My Former Home | Metal Scar Radio, Hyunmin Cho | [track](https://open.spotify.com/track/4B5ktT0DWQ1Ej4WT8CHJPq) |
| 19 | For your name | Metal Scar Radio, Edine | [track](https://open.spotify.com/track/1I02UcCu4i0eRb5GM7WbLU) |
| 20 | As Hope Fades | Metal Scar Radio, 明家歆, Ceru_ | [track](https://open.spotify.com/track/1K61OpMiLPjrqZjRNnuQbp) |
| 21 | Anchor of Solitary Sea | Metal Scar Radio, Runyu Qian, Salty Salt, Sephid | [track](https://open.spotify.com/track/7h0bcXX82WYkrUYwBIycSX) |
| 22 | Eyes Bright Through the Haze | Metal Scar Radio, N2V | [track](https://open.spotify.com/track/2PF6oTrlTjAZWC4XTHTi4H) |
| 23 | ADELPHOCLAST | Metal Scar Radio, Crywolf, YMIR, Tal Richards | [track](https://open.spotify.com/track/3H49F5DYiZ3KlslAe191Nf) |
| 24 | ACHERON | Metal Scar Radio, Crywolf, YMIR | [track](https://open.spotify.com/track/2v1dDhyTRfLEMh9P16KWPx) |
| 25 | ABYSSUS, ABYSSUM, INVOCAT | Metal Scar Radio, Crywolf, YMIR, Tal Richards | [track](https://open.spotify.com/track/4AMLteLKP1pEYZrKTycCev) |
| 26 | REAPER | Metal Scar Radio, Crywolf, YMIR | [track](https://open.spotify.com/track/5RbN3YkMdzBaMKyjyOyAwr) |
| 27 | AMARANTHUS CAUDATUS | Metal Scar Radio, Crywolf, YMIR, Tal Richards | [track](https://open.spotify.com/track/2MiM7YNCCHAPsVJCd0Hdw4) |
| 28 | Echoes of the Deep | Metal Scar Radio | [track](https://open.spotify.com/track/56IsNJwjZu0wKMJfAUX4b3) |
| 29 | Reverberance of Forgotten Lands | Metal Scar Radio, Alan@8:48, Breakfast@A8RECORDS | [track](https://open.spotify.com/track/0pgohm8s5PRc2VBHyPOM1S) |
| 30 | Vermilion | Metal Scar Radio, 明家歆, BLACK 0, Ceru_ | [track](https://open.spotify.com/track/4PAnuVHeI6tUEIsbe1exQe) |

### Tracklist — Dreamscape of Wind and Snow OST（2026-09-10）

| # | 曲名 | アーティスト | 公式リンク |
|---|---|---|---|
| 1 | Snowy Forest | Metal Scar Radio, Adam Gubman | [track](https://open.spotify.com/track/5Vs88v4h48Mq8AxpVhMC27) |
| 2 | Following the Story's Footsteps | Metal Scar Radio, 紅唐 | [track](https://open.spotify.com/track/2gJUHzPc2TyTSko5rHn61a) |
| 3 | Hear the Singing Bowstring | Metal Scar Radio, 封炫宇, Adam Gubman | [track](https://open.spotify.com/track/72Xu0IGcax8Bbql5LxIr9I) |
| 4 | Arrows and Snowflakes | Metal Scar Radio, 原田萌喜 | [track](https://open.spotify.com/track/6T4hXrDU7juJbo3vu2uqlK) |
| 5 | Child of the Snowy Forest | Metal Scar Radio, 原田萌喜 | [track](https://open.spotify.com/track/0Nk3QhIWsZTp22X2CLeqBt) |
| 6 | Frozen Mist | Metal Scar Radio, Robert Wolf | [track](https://open.spotify.com/track/3gKhHXczEy2SCcnBWXyqvn) |
| 7 | Arrow Feathers Become Words | Metal Scar Radio, Enzalla | [track](https://open.spotify.com/track/2dXm66A5akSbV3jSJTUG7G) |
| 8 | The Hunt | Metal Scar Radio, Martí Noguer | [track](https://open.spotify.com/track/1iDVSN9x1CozVHLuWWiJwa) |
| 9 | Along the Traces of Never-Melting Snow | Metal Scar Radio, 原田萌喜 | [track](https://open.spotify.com/track/7odVcoSSbBhks1JhM8RT2Y) |
| 10 | When Illusory Light Fades | Metal Scar Radio, 工藤吉三 | [track](https://open.spotify.com/track/4BfQLjhZVxPr9ukIYYrIHn) |
| 11 | HER Guidance | Metal Scar Radio, Vilma Jää | [track](https://open.spotify.com/track/6NX8KR65bWbiDN3tNs6mzX) |
| 12 | Rage Ignited from Oblivion | Metal Scar Radio, Elliot Hsu, Enzalla | [track](https://open.spotify.com/track/52toP8thZ3zrPvPzL5ivvg) |
| 13 | Forward, My Child | Metal Scar Radio, Elliot Hsu | [track](https://open.spotify.com/track/6PgwjrqWsYlgfDjGvHX2KY) |
| 14 | Amma's Touch | Metal Scar Radio, Elliot Hsu, Enzalla | [track](https://open.spotify.com/track/3K0dFWOR2IxxtihIsTdedR) |
| 15 | Prophecy and Legend | Metal Scar Radio, 原田萌喜 | [track](https://open.spotify.com/track/39gMhBsuqgO6tUIvVuQXxz) |
| 16 | HER Calling | Metal Scar Radio, z1on | [track](https://open.spotify.com/track/5KAfy19XUphrZCdSejQt3n) |

## 権利・利用条件（重要）

- **『アークナイツ：エンドフィールド』二次創作ガイドライン**（GRYPH FRONTIER PTE. LTD.、2026-02-03制定・2026-08-24改訂）： https://endfield.gryphline.com/ja-jp/news/4497
  - 対象は個人または法人格のない団体による**非営利目的**・**日本国内での発表・流通**に限定。範囲を超える利用は事前問い合わせ（endfield_cs@gryphline.com）。
  - プレイ動画・実況配信・関連動画の投稿は、収益化の有無や所属を問わず、**（1）禁止事項に抵触しないこと、（2）作品の内容紹介およびプレイの共有を主目的とすること**を満たせば事前連絡なしで可。
  - 禁止事項に「**当社の公式素材をそのまま複製・抽出するなど、創作性が著しく乏しいもの**」があり、OST音源そのものの複製・抽出・転載は二次創作として認められる範囲に含まれません。2026-08-24改訂で硬質立体造形物（フィギュア・ガレージキット・3Dプリント等）とその製作データも明確に禁止されました。
  - ガイドラインは予告なく変更される場合があります。最新版は公式サイトで確認してください。
- trk! は曲名などの事実情報と公式配信先リンクのみを表示し、**音源を同梱・再配布しません**。配信・購入・サブスクリプションは二次利用許諾ではありません。
- ゲームプレイ動画にゲーム内BGMが含まれる場合の自動コンテンツ識別（クレーム）運用までは個別検証していません。ガイドラインの配信条件を満たす利用と、音源単体の再利用は分けて考えてください。

## 調査中の他の公式リリース（batch 3候補・2026-10-11）

レーベルの Apple Music アーティストページ（[Metal Scar Radio / 1870752601](https://music.apple.com/us/artist/metal-scar-radio/1870752601)）・Amazon Music アーティストページ・Shazam・Spotify の「人気曲」表示から、カタログ未収録の公式リリースを洗い出しました。**まだカタログには入れていません**（Spotify のアルバムID・全曲順・曲別IDがそろったものから追加します）。

| リリース | 種別 | 配信日 | 曲数 | 2026-10-11 時点で確認できたこと | 未取得 |
|---|---|---|---|---|---|
| Yi | EP | 2026-04-21（Spotifyページの日付表示。要再確認） | 4 | Spotifyアルバム [`7wYXh2CxBTVo30xgmS3kAw`](https://open.spotify.com/album/7wYXh2CxBTVo30xgmS3kAw) と公式ffm.toスマートリンク https://ffm.to/yi 。4曲（Yi／Yi (Instrumental Version)／The World Is Waking／The World Is Waking (Instrumental Version)）の曲名・アーティスト・曲順をSpotify埋め込みページで確認済み | 個別曲ID |
| Old Deep Water Dies, by Rising Tide It is Denied（新潮起，故渊离OST） | OST | 2026-03-25 | 14 | Apple Music [1887205933](https://music.apple.com/us/album/old-deep-water-dies-by-rising-tide-it-is-denied-original/1887205933)（14曲・34分・℗ 2026 GRYPHLINE）、VGMdb [158491](https://vgmdb.net/album/158491)、Qobuz掲載。作曲クレジットはVGMdbで確認可 | SpotifyアルバムID・全曲順・曲別ID |
| Sketches of Lost Heirlooms | OST | 未確認 | 未確認 | Apple Music [6781173816](https://music.apple.com/us/album/sketches-of-lost-heirlooms-original-soundtrack/6781173816)、Amazon Music／Qobuz に「Album・2026」表記 | SpotifyアルバムID・曲数・曲順 |
| Ode to the Night Stars | EP（Compilation） | 未確認 | 未確認 | Shazam／Apple のアーティストページに「Compilation Album・2026」表記 | すべて |
| Mirairo Rider | EP | 未確認 | 未確認 | Spotify のレーベル人気曲10位に「Mirairo Rider (Japanese Ver.)」（Metal Scar Radio, 居川純平, 如月結愛, 佐々木李子・3:57） | アルバムID・収録曲 |
| Fragmented Dreams | Single | 未確認 | 未確認 | Apple Music [6806960879](https://music.apple.com/us/album/fragmented-dreams/6806960879)、Spotify人気曲に「Fragmented Dreams」（Metal Scar Radio, ReStudio, Evan, z1on・4:03） | アルバムID |
| Under My Breath | Single | 未確認 | 未確認 | Apple Music [6782831565](https://music.apple.com/us/album/under-my-breath/6782831565) | アルバムID・曲情報 |
| Guided by Echoes | Single | 未確認 | 未確認 | Apple Music [6793472028](https://music.apple.com/us/album/guided-by-echoes/6793472028)（Metal Scar Radio, Runyu Qian, Breakfast@A8RECORDS, Sephid）。既存 `ef-signal` に紹介項目あり | アルバムID |
| Snapshot | Single | 未確認 | 未確認 | Shazam のアーティストページに記載（Metal Scar Radio, Adam Gubman, Sorah Eun） | アルバムID・曲情報 |
| My World (Blood Oath) | EP | 未確認 | 未確認 | Apple Music [1890100176](https://music.apple.com/us/album/my-world-blood-oath-tale-version/1890100176)（「Tale Version」を含む） | アルバムID・曲数 |
| A Promise Makes a Home | Single | 2026-10-07 | 2 | Apple Music [6820048204](https://music.apple.com/us/album/a-promise-makes-a-home-single/6820048204)（2曲・レーベルページの「最新リリース」） | Spotify ID |
| Ashen Remains | Operator OST（Laevatein） | 2026-02-28（Talos Wiki。要再確認） | 5（Talos Wiki） | Talos Wiki：Spotifyアルバム [`6aFenM2edcPyIfzg6ZtQnz`](https://open.spotify.com/album/6aFenM2edcPyIfzg6ZtQnz)、5曲（Sign of the Coming Flame／Frozen Embers／Aureole／Born of Bent Light／Backdraft。曲IDは Wiki 掲載の参考情報）。Apple Music [1880258196](https://music.apple.com/us/album/sign-of-the-coming-flame/1880258196)。既存 `ef-ashen` は紹介版のまま | 公式Spotifyページでの全曲順・曲別IDの再確認 |
| Maker's Luv | Operator OST（Yvonne） | 未確認 | 未確認 | Talos Wiki：Spotifyアルバム [`4ZZOkqQONyAFHzEG31Qss4`](https://open.spotify.com/album/4ZZOkqQONyAFHzEG31Qss4)（2026-10-12 確認）。既存 `ef-makers` は紹介版のまま | 公式Spotifyページでの全曲順・曲別IDの再確認 |
| The Floaty Envelope | Operator OST（Gilberta） | 未確認 | 未確認 | Talos Wiki：Spotifyアルバム [`44qElu191kLQ5fit5fAQ6g`](https://open.spotify.com/album/44qElu191kLQ5fit5fAQ6g)（2026-10-12 確認）。既存 `ef-floaty` は紹介版のまま | 公式Spotifyページでの全曲順・曲別IDの再確認 |
| Blurring | Single／Operator EP（Laevatein） | 2026-01-22（Talos Wiki。要再確認） | 1（＋Instrumental） | Talos Wiki：Maria Nalyon & Chengcheng Tang 歌唱、Spotify曲 [`0QqtGr91Q6JxiUW7sCukIg`](https://open.spotify.com/track/0QqtGr91Q6JxiUW7sCukIg)（参考情報）。Apple Music [1872026534](https://music.apple.com/us/album/blurring/1872026534)。既存 `ef-blurring` は紹介版のまま | 公式Spotifyページでの再確認 |

- Apple Music・Amazon Music のアルバムIDは**参考情報**です。カタログのリンクは公式Spotifyに統一する方針なので、追加前にSpotifyのアルバムIDと曲順を確認します。
- 「未確認」は「存在しない」ではありません。曲数・曲順が公式ページで確認できないリリースはカタログに入れません。

## 未確認・次段階

- **trk129（2026-10-12）**：表示名を24文字に収まる「初号指令 (上) ZD OST Vol.1」／「初号指令 (下) ZD OST Vol.2」（ZD＝Zeroth Directive。フル名はタグ）へ改名。旧既定名（最古の紹介版・trk110のフル名と24文字切り・trk128のフル名と24文字切り）は `js/library.js` の `ENDFIELD_FIRSTORDER_OLD_NAMES` で照合し、既定名のときだけ更新します。フォルダ上限13のときに 🎭棚から落ちた4リストは、一回限りの `trkEndfieldShelfRestoreOnce` がこわれた形のときだけ棚へ戻します。自動検査（`tools/check-repo.mjs` の🛰️ブロック・`npm run check` 222/222）まで。**実ブラウザ・実端末での確認は未実施**（HANDOFF §4-12）。
- **trk128（2026-10-12）**：①既存の取り込みに対する一回限りの整頓（`trkEndfieldTidyOnce`）は**Chromium headless の e2e（20項目・リポジトリ外）で確認済み**——新規取り込みの13リスト新順・キャラクター棚・改名・Endfieldタブのチップ行（🎭棚→初号指令(上)／(下)→リリース順6作→signal）・既存取り込みの移行（24文字切り旧名からの改名・並び直し・利用者の配置と所持曲の保持）・2度目の起動で並びが変わらないこと。実端末での確認は未実施。②Talos Wiki（コミュニティ）由来の情報（キャラクター分類・Blurring 2026-01-22／Ashen Remains 2026-02-28 の発売日・3アルバムのSpotifyID・曲ID）は**公式Spotifyページでの再確認が未実施**（カタログには入れていない）。③新表示名（「初号指令 (上) ― …」）は表示上限24文字で「初号指令 (上) ― Zeroth Direct」に切れる（全表示は🛒カタログ画面・プレイリスト設定で）。④e2eで発見・修正した2点：24文字切り旧名への改名不発（実アプリの保存名は24文字に切られている）・サブフォルダビューが「すべて」へフォールバックする既存欠陥（`libTabsOf` 修正。HANDOFF §7 参照）。
- 60曲のSpotify個別曲URLは 2026-10-10 時点の公式アルバムページHTMLで確認しましたが、実ブラウザでの一括再確認（地域制限・ログイン要求の有無）は未実施です。抜取確認として同日、Vol.1 #37「Faith's Imprint」と Vol.2 #23「Forge」の個別曲ページを開き、曲名・収録アルバム・アーティスト・長さがカタログと一致することを確認しました。
- Apple Music での Zeroth Directive Vol.1–2 のアルバム掲載は未確認（「配信なし」の断定ではありません）。
- バッチ2（trk111）の6作81曲は、曲順・曲名・アーティストを 2026-10-11 に公式Spotifyのアルバム埋め込みページで6作すべて再確認し、Homecoming の30曲は公式ffm.toスマートリンクでも照合しました。個別曲IDの抜取確認は6曲（PHEONIX ON THE RISE／Drowned in Depth／Rekindled／Keeper of My Heart／Vermilion／HER Calling）で、**残り75曲のIDは個別に開いて確認していません**。実ブラウザでの地域制限・ログイン要求の確認も未実施です。
- バッチ2の6作について未確認のまま：中国語公式曲名（＝照合別名を未登録）、公式告知のffm.to配信一覧（Homecoming の https://ffm.to/homecoming-original-soundtrack は確認済み。他5作は未確認）、VGMdb照合（Eve of Departure のページ 158984 の存在は確認しましたが内容は未精読）、他ストアのアルバム別・曲別URL（Apple Music／Amazon Music／TIDAL／Qobuz への掲載自体は確認）。
- Metal Scar Radio の残る公式リリースは**今後の調査対象**です。2026-10-11 に洗い出した候補（Yi、Old Deep Water Dies、Sketches of Lost Heirlooms、Ode to the Night Stars、Mirairo Rider、Fragmented Dreams、Under My Breath、Guided by Echoes、Snapshot、My World (Blood Oath)、A Promise Makes a Home、Ashen Remains、Blurring ほか）と確認状況は上の「調査中の他の公式リリース」の表を参照してください。既存の `ef-blurring`・`ef-ashen` 等は紹介版のままです。
- 中国語版・英語版の二次創作ガイドラインは未精読。この台帳は日本語版ガイドライン（2026-08-24改訂版）を正とします。

## 参照先

- データ（正）： [`tools/endfield-zeroth-directive-tracklist.json`](../tools/endfield-zeroth-directive-tracklist.json)（Zeroth Directive Vol.1–2）／ [`tools/endfield-msr-albums-tracklist.json`](../tools/endfield-msr-albums-tracklist.json)（バッチ2の公式アルバム6作）
- カタログ実装： `js/catalog.js`（シリーズ `endfield`）、取り込み・更新： `js/library.js`
- 検査： `tools/check-repo.mjs`（🛰️ Endfield Zeroth Directive ブロック・🛰️ Endfield MSR albums ブロック）
- 公式告知（日本）： https://x.com/AKEndfieldJP/status/2022928866638205084
- 公式配信一覧： https://ffm.to/ro6qjnl （Vol.1） / https://ffm.to/eq8xpy7 （Vol.2） / https://ffm.to/homecoming-original-soundtrack （Homecoming OST）
- レーベルの公式Spotifyアーティストページ： https://open.spotify.com/artist/63CsKCn2OazatczRm1tk9c
- 資料： VGMdb https://vgmdb.net/album/157312 / https://vgmdb.net/album/157313

trk! — 手渡し用ビルド（trk222＋2026-10-31 レビュー対応）
================================================================

レビューと実機確認のために、そのまま動かせる形にしたZIPです。
公式の配布版ではなく、確認用のビルドです（版の番号は付けていません）。

このZIPは `node tools/pack-standalone.mjs` で作れます（リポジトリの中身から、
git が追跡しているファイルだけを集めます）。


■ 開き方（2通り）

1. いちばん簡単: このフォルダの index.html をダブルクリックする。
   入口が trk-files/index.html へ進みます（ゲーム・譜面・プレーヤー・書斎が動きます）。

2. オフラインも試す: ローカルサーバーで開く（Service Worker は file:// では動きません）。
       cd <このフォルダ>
       python3 -m http.server 8000
   ブラウザで http://127.0.0.1:8000/ を開く → 一度読み込めば、機内モードでも起動します。

   ※ 保存データ（曲・設定・記録）は「開き方」ごとに別です。
      file:// と http://127.0.0.1:8000/ は別のオリジンなので、データは共有されません。
      公開URLとも別です。


■ 中身

    index.html   … 入口（trk-files/index.html へ進むだけ）
    README.txt   … この文書
    trk-files/   … アプリ本体（リポジトリと同じ中身）

    trk-files/ の中: index.html / sw.js / manifest.webmanifest / css/ / js/ /
                     assets/（同梱ライブラリ・MMDのプリセットモデル・チュートリアル曲）/
                     icons/ / docs/guide/（利用者向けの説明）/ LICENSE / NOTICE.md など


■ 入っていないもの（開発用）

    tests/  tools/  .github/  package.json  capacitor.config.ts など、
    それと開発用の文書（HANDOFF 類・MIGRATIONS・レビュー依頼書）。
    ソース一式はリポジトリから:
        https://github.com/TonbokiriRaikiriMuramasa-Taikoubou/trk-PWA


■ 何を見てほしいか

    Drive の「レビューと実機確認のお願い 2026-10-31」を見てください。
    要点:
      ・PC でもスマホ型の画面に切り替えられること（右上の 🖥／📱）
      ・下の再生バー（ジャケット・曲名・⏮▶⏭・シーク・音量）が各スキンで読めること
      ・拡大率 50／75／100／125% で、はみ出さずに文字とボタンが大きくなること
      ・拡大率 125% ＋ PC型で、カードの下端が再生バーの裏に入らないこと（修正済み）
      ・スマホ型の「エフェクト」のタブに ▶ TV も並ぶこと（修正済み）
      ・ゲーム中は拡大率が 100% に戻ること
      ・iPhone のホーム画面から起動して、URL バーが出ないこと（公開URLで）


■ 動く環境

    Chrome / Edge / Safari / Firefox の最近のもの。
    ファイルの取り込み（フォルダー共有・書斎のフォルダ読み）は Chrome 系の
    File System Access API が要ります（Safari・Firefox では出ません）。
    Service Worker（オフライン起動・ホーム画面追加）は https か localhost でだけ動きます。
    再生バーの拡大（CSS の zoom）は Firefox 126 以降・Safari 16 以降で効きます。
    効かないブラウザでは、バーが拡大されないだけで、ほかの機能は変わりません。


■ 確かめたこと・確かめていないこと

    npm run check               861 pass / 0 fail
    node tools/check-repo.mjs   0 failure / 0 warning
    jsdom で実 index.html を通し操作（画面の形・再生バー・拡大率）

    実ブラウザ・実機での見た目と操作感は未確認です
    （作業環境にブラウザも端末もないため）。見つけた点は、端末・OS・
    ブラウザ・拡大率・スキン名を添えて教えてください。


■ ライセンス

    GPL-3.0-or-later。LICENSE と NOTICE.md を見てください。
    クレジットとソースは保持してください（同梱ライブラリの権利は NOTICE.md にまとめています）。

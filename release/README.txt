trk! 1.1.8 — 手持ちの曲で遊べるブラウザ音ゲー＆プレイヤー
制作：trk（TRMTKB） ／ 非営利・無料 ／ Windows・macOS・Linux 共通（ZIPは1つ）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ かんたん起動（これだけで遊べます）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ZIPをすべて展開します（ZIPの中のまま開かないでください）。
2. index.html をダブルクリックします（Chrome / Edge 推奨）。

インストールもアカウントも不要です。曲・動画・記録は端末の中だけで扱い、外部へ送りません。

■ 1.1.8 の変更（要点）
  ・OS の音の出力先（スピーカー／ヘッドホン／HDMI など）を切り替えても、曲が止まらず続くようになりました
    （止まったことを見つけて、続きから鳴らし直します。⏯ で止めたときは止まったまま）。

■ index.html だけでできること（Chrome / Edge で確認）
  ・5つのゲームモードと、手持ちの曲・動画からの自動譜面
  ・デモ曲 FIRST SPARK
  ・メディアプレーヤー「🎥基地」、文章・画像ビューア「📚書斎」（画像はフォルダのまま読めます）、MIDI再生
  ・サウンドエフェクト（下の3つを除く）
  ・記録・設定・プレイリスト・💾保存棚の保存、まるごとバックアップ
  ・ミュージック／動画フォルダーの読み込み（共有は最大8本まで）
  ・パック（.stpack）の読み込み（公認マークの確認を除く）

■ ローカルサーバーで開くと、さらに使えるもの
  ・3Dマスコット（VRM / MMD）
  ・高精度エフェクト（ノイズゲート・ノイズ消し・ダイナミックEQ）
  ・公認パックの確認（✅マーク）
  ・オフライン用キャッシュ、ホーム画面に追加（PWA）、OSの共有から受け取り
  ・アドオンのサンプル読み込み

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ ローカルサーバーで開く方法（任意・Python 3 が必要）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
展開したフォルダー（この README.txt がある場所）でターミナルを開き、次を実行します。
  Windows（PowerShell）： py -m http.server --bind 127.0.0.1 8000
     （うまくいかなければ python -m http.server --bind 127.0.0.1 8000）
  macOS / Linux（Terminal）： python3 -m http.server --bind 127.0.0.1 8000
ブラウザーで http://127.0.0.1:8000/ を開きます（index.html から本体へ進みます）。終了は Ctrl+C。
Python は同梱していません。127.0.0.1 にだけ待ち受けるので、ほかの端末からは見えません。

■ 注意
  ・保存データは「開き方」ごとに別の場所になります。index.html で遊んだ記録は、
    ローカルサーバー（http://127.0.0.1:8000/）では見えません（ポート番号を変えても別になります）。
    移したいときは ⚙設定の「まるごとバックアップ」で書き出して、もう一方で読み込んでください。
  ・追加した曲・動画の本体は保存しません（📄参照として一覧とプレイリストに残り、押すと選び直せます）。
    次回もすぐ使いたい曲だけ 💾 で保存棚へ（既定の上限 1GB）。
  ・.mkv の AC3・DTS などの音声はブラウザーが鳴らせません。読み込むと理由と「MP4 に変換すると
    音が出ます」を表示します（映像だけ流れて無音、を防ぐため）。
  ・Firefox / Safari での index.html 直接起動は未確認です。動かない機能があればローカルサーバーで開いてください。
  ・更新後に古い画面が出たら、trk! のほかのタブを閉じて再読み込み（Ctrl+F5）してください。
    1.0.7 以前のフォルダーに重ねて展開した場合も、index.html から開けば古いキャッシュは外れます。

■ 中身
  index.html  … この入口（ダブルクリックするファイル）
  README.txt  … このファイル
  trk-files/  … アプリ本体（このフォルダーを動かしたり消したりしないでください）

■ 権利・ライセンス
  プログラム：GPL-3.0-or-later（trk-files/LICENSE）。デモ曲 FIRST SPARK はオリジナル。
  3Dモデル本体・第三者の音源は同梱していません。詳しくは trk-files/credits.html、trk-files/NOTICE.md、
  プライバシー方針は trk-files/privacy.html、使い方の詳細は trk-files/README-1.1.8.md と trk-files/docs/guide/ を見てください。
  感想・不具合：フリーゲーム夢現の作品ページのコメント欄、または X（@ttrk143）

────────────────────────────
English (short)
Unzip, then double-click index.html (Chrome/Edge). Games, auto charts, the media player,
reader and saving work this way. 3D mascots, three advanced effects, verified-pack checks,
offline cache/PWA need a local server: run "python3 -m http.server --bind 127.0.0.1 8000"
(Windows: "py -m ...") in this folder and open http://127.0.0.1:8000/.
Saved data is separate between the two ways of opening. The app lives in trk-files/ —
keep it next to this file. Details: trk-files/README-1.1.8.md

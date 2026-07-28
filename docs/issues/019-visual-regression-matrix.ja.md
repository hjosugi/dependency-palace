<!-- i18n: language-switcher -->
[English](019-visual-regression-matrix.md) | [日本語](019-visual-regression-matrix.ja.md)

# ビジュアルリグレッションマトリックス

ラベル: `testing`, `visual-regression`, `viewer`, `priority:P1`, `status:ready`

## 問題点

ビューアには現在、複数のフォーム、表示モード、モバイル/デスクトップレイアウト、例のサイズがあります。単一のスモークスクリーンショットだけでは不十分です。

## 目標

空白キャンバス、壊れたフォーム、レイアウトの重なり、読めないUIを検出するビジュアルリグレッションマトリックスを作成する。

## 範囲

- デスクトップとモバイルをテスト。
- フォーム： Palace、Tree、Blocks、Life、Space、Atomic。
- 表示ビュー： Map、Types、Focus。
- 例： starter、Tiny Haskell、Tiny Java、Medium Haskell、Stress Dense Cycles。
- ピクセルチェックは寛容に行い、最初は壊れやすい正確な画像一致を避ける。
- メトリクスとバックエンドをキャプチャ。

## 受け入れ基準

- `npm run verify:visual` がマトリックスまたは意味のあるサブセットをカバーし、スキップはドキュメント化されている。
- 各スクリーンショットは安定したファイル名を持つ。
- キャンバスの空白と動きのチェックは維持される。
- UIの重なりのチェックは、モバイルのトップコントロールと右パネルをカバーする。
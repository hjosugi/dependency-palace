<!-- i18n: language-switcher -->
[English](006-typescript-javascript-native-adapter.md) | [日本語](006-typescript-javascript-native-adapter.ja.md)

# ネイティブアダプター：TypeScript と JavaScript

ラベル：`adapter`、`typescript`、`javascript`、`priority:P1`、`status:ready`

## 問題点

TS/JSプロジェクトでは、パスエイリアス、型のみのインポート、インターフェース、クラス、オブジェクトパターン、Reactコンポーネント、モノレポパッケージに対して、コンパイラー認識の解決が必要です。

## 候補バックエンド

- TypeScriptコンパイラーAPI。
- `tsserver`プロジェクトサービス。
- `dependency-cruiser`をモジュールグラフ入力として使用。
- JavaScriptの場合はBabelパーサーのフォールバック。

## 必要な抽出内容

- `tsconfig`の検出とパスエイリアス。
- クラス、インターフェース、列挙型、型エイリアス。
- フィールド、メソッド、コンストラクター、アクセス修飾子。
- 継承（extends）と実装（implements）。
- インポート/エクスポートのグラフ。
- シンボル解決を行うメソッド呼び出しとコンストラクター呼び出し。
- Reactコンポーネントノードをオプションのモジュール/型ノードとして扱う。

## 受け入れ基準

- プロジェクトリファレンスを持つTSモノレポで動作。
- 型のみのインポートと実行時のインポートを区別して保持。
- クラス/インターフェースのメンバーに可視性を付与。
- クラスの実装/拡張を正確にリンク。
- 最善を尽くしたBabelフォールバックを備えたJSプロジェクトも対応。
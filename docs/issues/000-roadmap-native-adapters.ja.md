<!-- i18n: language-switcher -->
[English](000-roadmap-native-adapters.md) | [日本語](000-roadmap-native-adapters.ja.md)

# ロードマップ：主要言語向けネイティブソースアダプター

ラベル：`roadmap`、`adapters`、`source-indexing`、`performance`、`priority:P0`、`status:ready`

## 問題点

Dependency Palaceは次のように動作する必要があります：

```bash
npm install
npm run scan -- /path/to/repo --out graph.json
npm run dev
```

ユーザーはリポジトリのルートまたはサブツリーを指すだけでよいです。ツールは主要な言語を自動的に検出し、意味的なコード構造を抽出し、それを正規化し、3Dのメンタルモデルを即座に利用可能にすべきです。

現在の一回目のスキャナーはリポジトリを可視化しますが、コンパイラーの正確さには欠けています。

## 目標

すべての主要エコシステム向けにネイティブアダプターを構築し、1つの正規化されたビューアースキーマを維持します。

## 範囲

- HaskellとJava/JVMはP0。
- Haskell：タイプクラス、インスタンス、レコード、関数、関数型合成。
- Java/JVM：継承、インターフェース実装、フィールド合成、メソッド呼び出しグラフ。
- Rust。
- Go。
- TypeScript/JavaScript。
- Python。
- C#/.NET。
- C/C++。
- Swift。
- Ruby。
- PHP。

## アーキテクチャ要件

- 各アダプターは同じアダプター契約を実装する。
- 各アダプターは独立して動作可能。
- 各アダプターは正規化された`RawGraph`を出力する。
- 各アダプターにはゴールデンフィクスチャを含める。
- 各アダプターは信頼度と抽出の制限を報告する。
- スキャナーは複数のアダプターを一つの多言語リポジトリで結合できる。
- 大規模なリポジトリは段階的にインデックス化可能。

## 受け入れ基準

- `npm run scan -- fixtures/polyglot --out graph.json`が有効なJSONを生成する。
- 実際のリポジトリはルートディレクトリだけを指すことでスキャンできる。
- アダプターの出力にはフィールド、メソッド、継承、インターフェース実装、少なくとも最善努力の型参照が含まれる。
- ネイティブアダプターの問題は個別に対応可能で、順序付けられている。

## 実装順序

1. アダプター契約、フィクスチャ、診断。
2. Haskellネイティブアダプター。
3. Java/JVMネイティブアダプター。
4. Rustアダプター。
5. Goアダプター。
6. TypeScript/JavaScriptアダプター。
7. Pythonアダプター。
8. C#アダプター。
9. C/C++アダプター。
10. Swift/Ruby/PHP/Kotlin/Scalaの完成。
11. 段階的インデックス化とキャッシュ。
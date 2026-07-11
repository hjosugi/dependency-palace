<!-- i18n: language-switcher -->
[English](010-secondary-language-native-adapters.md) | [日本語](010-secondary-language-native-adapters.ja.md)

# ネイティブアダプター：Kotlin、Scala、Swift、Ruby、PHP

ラベル: `adapter`、`kotlin`、`scala`、`swift`、`ruby`、`php`、`priority:P2`、`status:ready`

## 問題点

これらの言語は直接サポートするほど重要ですが、最優先のアダプターと共有契約が安定した後に対応すべきです。

## 範囲

- Kotlin：PSIまたはKotlinコンパイラフロントエンド、Gradleの検出。
- Scala：MetalsまたはSemanticDB、sbtの検出。
- Swift：SourceKit/LSP、Swift Package Managerの検出。
- Ruby：Prism/RipperとオプションのSorbet/RBS型データ。
- PHP：PHP-ParserとComposerの検出。

## 受け入れ基準

- 各言語にゴールデンフィクスチャが存在すること。
- 各アダプターが型/メンバー/関係のグラフを出力すること。
- 各アダプターが制限事項をドキュメント化していること。
- スキャナーがこれらの言語をポリグロットリポジトリで組み合わせられること。
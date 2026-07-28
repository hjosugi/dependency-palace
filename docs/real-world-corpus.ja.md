<!-- i18n: language-switcher -->
[English](real-world-corpus.md) | [日本語](real-world-corpus.ja.md)

# 実世界コーパス

Dependency Palaceはサードパーティのソースをリポジトリの外に保持します。コーパススクリプトはアップストリームのプロジェクトを`.dependency-palace/real-world`にチェックアウトし、選択されたサブツリーをスキャンし、生成されたグラフアーティファクトを`artifacts/real-world`に書き込みます。

実行方法：

```bash
npm run scan:real-world
```

特定のターゲットを実行：

```bash
npm run scan:real-world -- haskell-text
npm run scan:real-world -- apache-commons-lang
```

## ターゲット

| ID | ソース | ライセンス | スキャン対象のサブツリー | 期待されるハイライト |
| --- | --- | --- | --- | --- |
| `haskell-text` | `https://github.com/haskell/text` | BSD-2-Clause | `src` | ハスケルモジュール、インポート、データ型、トップレベル関数、ソース範囲。 |
| `apache-commons-lang` | `https://github.com/apache/commons-lang` | Apache-2.0 | `src/main/java` | Javaパッケージ、クラス、インターフェース、フィールド、メソッド、継承、構成のヒント。 |

Haskellソースのライセンスは`text.cabal`にBSD-2-Clauseとして宣言されています。Apache Commons Langリポジトリは`LICENSE.txt`にApache License 2.0を記載しています。

最新のローカル検証結果：

| ID | ファイル数 | ノード数 | リンク数 |
| --- | ---: | ---: | ---: |
| `haskell-text` | 55 | 857 | 3,190 |
| `apache-commons-lang` | 238 | 564 | 3,090 |

## 出力

各ターゲットは以下を出力します：

- `artifacts/real-world/<id>.graph.json`
- `artifacts/real-world/<id>.graph.dpg`
- `artifacts/real-world/<id>.diagnostics.json`

アプリのファイルボタンからJSONまたは`.dpg`グラフを読み込むか、`public/dependency-palace.graph.json` / `public/dependency-palace.graph.dpg`にコピーして自動的に開発サーバーに読み込ませてください。

## 注意事項

- スクリプトは可能な限りスパースチェックアウトを使用します。
- アーティファクトとチェックアウトはgitによって無視されます。
- このコーパスはスキャナーやビューアの動作確認用であり、アップストリームの正確性を保証するものではありません。
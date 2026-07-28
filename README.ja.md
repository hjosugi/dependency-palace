<!-- i18n: language-switcher -->
[English](README.md) | [日本語](README.ja.md)

# 依存関係の宮殿

依存関係の宮殿は、平坦なUML図では表現しきれない密度の高いコードベースのためのインタラクティブな3Dクラス依存ビューアです。

このアプリは何千ものクラスに対応しています：

- スタートアップは小さなスターターグラフを使用し、大規模なデモや例は選択時にのみ読み込みます。
- パッケージ概要モードではクラスをパッケージノードに折りたたみます。
- クラスモードでは、すべての可視クラスをGPUインスタンス化メッシュとしてレンダリングします。
- フォーカスモードでは、選択された型を状態、振る舞い、契約、継承、呼び出し元、呼び出し先に展開します。
- エッジは共有GPUラインバッファに詰め込まれます。
- レイアウトは決定論的で、モジュール／パッケージごとにクラスタリングされており、レンダーループ内でフォースシミュレーションは行いません。

## 実行方法

```bash
npm install
npm run dev
```

次にローカルのVite URLを開きます。

## ビルド

```bash
npm run build
```

## ソースコードのスキャン

スキャナーをリポジトリまたはサブツリーに向けてください：

```bash
npm run scan -- /path/to/repo
npm run dev
```

デフォルトでは、`public/dependency-palace.graph.json`を書き込み、アプリは起動時に自動的にそれを読み込みます。開発サーバーが開いている間、生成されたグラフと診断サイドカーも更新されます。

スキャンされたリポジトリを編集中はウォッチモードを使用してください：

```bash
npm run scan -- /path/to/repo --watch
```

スキャナーはデフォルトで`.dependency-palace/cache`にファイルごとの抽出結果をキャッシュします。また、プロジェクトマーカーやツールが存在する場合はネイティブコンパイラ／ツールのメタデータを調査し、存在しない場合は決定論的なソース抽出にフォールバックします。`--no-native`を使用するとフォールバックのみのスキャンになります。

また、コンパクトなグラフ形式も出力するには：

```bash
npm run scan -- /path/to/repo --format both
npm run benchmark:graph-format -- public/examples/stress-dense-cycles.json 5
```

明示的なグラフファイルを書き込み、手動でアップロードすることも可能です：

```bash
npm run scan -- /path/to/repo --out dependency-palace.graph.json
```

アダプタフレームワークはJava、Kotlin、Scala、C#、TypeScript、JavaScript、Go、Rust、Python、Ruby、PHP、Swift、C、C++をサポートします。スキャナーの出力には、ノードとリンクのアダプタ由来情報およびファイルごとのアダプタ診断情報が含まれます。詳細は [docs/adapters.md](docs/adapters.md) を参照してください。

HaskellとJavaはP0言語です：

- Haskell：`data`／`newtype`レコード、型クラス、インスタンス、制約、導出、トップレベル関数、FP構成パイプライン。
- Java：クラス、インターフェース、継承、実装、フィールド、メソッド、フィールドベースの構成。

## 例

アプリには小規模からストレス規模までの生成例が含まれており、開発サーバーが稼働していると左側のパネルに表示されます。

```bash
npm run generate:examples
```

[docs/examples.md](docs/examples.md) を参照してください。
実際のソーススキャンについては [docs/real-world-corpus.md](docs/real-world-corpus.md) を参照してください。

## 入力フォーマット

左側のパネルからJSONまたは`.dpg`のコンパクトグラフファイルを読み込みます。最小限のJSONの形は次の通りです：

```json
{
  "nodes": [
    {
      "id": "orders.checkout.PaymentService",
      "label": "PaymentService",
      "module": "orders",
      "package": "orders.checkout",
      "kind": "class",
      "loc": 420,
      "complexity": 12,
      "layer": 2
    }
  ],
  "links": [
    {
      "source": "orders.checkout.PaymentService",
      "target": "billing.invoice.InvoiceRepository",
      "type": "uses",
      "weight": 1
    }
  ],
  "meta": {
    "name": "My service",
    "language": "Java"
  }
}
```

完全なスキーマの詳細については [docs/input-schema.md](docs/input-schema.md) を参照してください。

## 設計ノート

メンタルモデルは [docs/mental-model.md](docs/mental-model.md)、レンダリングアーキテクチャは [docs/rendering-architecture.md](docs/rendering-architecture.md)、例は [docs/examples.md](docs/examples.md)、研究対象リストは [docs/research-targets.md](docs/research-targets.md)、分析ノートは [docs/research.md](docs/research.md) にあります。概要は次の通りです：

- CodeCityからの方向性を借用：モジュール／パッケージは地区のように振る舞います。
- SourcetrailやNDependからのナビゲーションを借用：検索、ハブ、呼び出し元／呼び出し先のフォーカス、折りたたみ／展開。
- 大規模グラフツールからのレンダリング規範を借用：描画呼び出しを最小化し、各ノードのReact／DOM要素を避ける。
- WebGPU優先のレンダリングを採用し、WebGLのフォールバックもサポート。
- メインビューに常時フォースシミュレーションを避け、大規模クラスグラフは安定してナビゲート可能に。
- ハリボール（絡まり）を避ける。フォーカスビューは状態、振る舞い、契約、依存理由を示す必要があります。
- Palace、Tree、Blocks、Life、Space、Atomic、Cityの形態間を切り替え、異なるメンタルモデルを表現します。詳細は [docs/metaphors.md](docs/metaphors.md) を参照。

## 現在の制限

ネイティブツールの調査、由来情報、診断、キャッシュ対応のフォールバック抽出を含むソーススキャナーを備えています。次のステップは、各ネイティブアダプタのための完全なコンパイラ／Tree-sitter／Language Serverによる意味解析抽出です。課題計画は [docs/issues](docs/issues) にあります。

## ライセンス

0BSD。ほぼあらゆる目的でこのプロジェクトを使用、コピー、修正、配布できます。
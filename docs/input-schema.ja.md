<!-- i18n: language-switcher -->
[English](input-schema.md) | [日本語](input-schema.ja.md)

# 入力スキーマ

Dependency Palaceは、`nodes`、`links`または`edges`、およびオプションの`meta`を含むJSONオブジェクトを期待します。

## ノード

```ts
type Node = {
  id: string;
  label?: string;
  name?: string;
  module?: string;
  package?: string;
  namespace?: string;
  kind?: "class" | "interface" | "typeclass" | "datatype" | "function" | "enum" | "external";
  loc?: number;
  complexity?: number;
  layer?: number;
  fields?: CodeMember[];
  methods?: CodeMember[];
  members?: CodeMember[];
  source?: SourceLocation;
  provenance?: Provenance;
};

type CodeMember = {
  name: string;
  kind: "field" | "method" | "constructor" | "property";
  type?: string;
  visibility?: "public" | "protected" | "private" | "package" | "internal";
  static?: boolean;
  abstract?: boolean;
  signature?: string;
  calls?: string[];
  uses?: string[];
  source?: SourceLocation;
};

type SourceLocation = {
  path: string;
  startLine: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
};

type Provenance = {
  adapterId: string;
  adapterVersion: string;
  language: string;
  backendId: string;
  backendKind: "first-pass" | "native" | "lsp" | "compiler-metadata" | "external";
  backendName: string;
  path: string;
  confidence?: "high" | "medium" | "low";
  source?: "native" | "fallback" | "cache";
  notes?: string[];
};
```

注意事項：

- `id`はグローバルに一意でなければなりません。完全修飾クラス名が適しています。
- `module`は大きな放射状セクターを制御します。
- `package`または`namespace`はローカルクラスタリングを制御します。
- `layer`は任意です。コア/ドメインコードには低い番号を、API/UIエッジには高い番号を使用します。
- `fields`、`methods`、または`members`は焦点ビューの意味を持ち、単なる構造ではありません。
- `source`は選択されたパネルやエディタで開くワークフローのために相対ファイルパスと行範囲を持ちます。範囲が不明な場合は省略します。
- `provenance`は手動作成の入力には任意ですが、スキャナー出力にはすべてのエミットされたノードとリンクに含まれ、下流のツールがどのアダプター、バックエンド、信頼度レベル、キャッシュ/フォールバックパスによって生成されたかを確認できます。
- 不明なリンクエンドポイントは`external`ノードとして追加されます。

## リンク

```ts
type Link = {
  source: string | { id: string };
  target: string | { id: string };
  type?:
    | "imports"
    | "inherits"
    | "implements"
    | "instance"
    | "contains"
    | "composes"
    | "constrains"
    | "derives"
    | "uses"
    | "calls"
    | "creates"
    | "tests"
    | "unknown";
  weight?: number;
  via?: string;
  reason?: string;
  provenance?: Provenance;
};
```

方向は`source`が`target`に依存していることを示します。
`via`は依存関係を引き起こすメンバーに使用し、`reason`は短い抽出された説明に使用します。

推奨マッピング：

- `imports`: ファイルまたは名前空間のインポート。
- `contains`: 構造的所有権またはhas-a構成、例としてJavaのフィールドやHaskellのレコードフィールド。
- `composes`: 関数/パイプラインの構成、特にHaskellの`(.)`、`>=>`、`<$>`、`<*>`などのFPチェーン。
- `constrains`: 型クラスやジェネリック制約。
- `derives`: Haskellの`deriving`のような派生/生成された動作。
- `instance`: 型クラス/プロトコル/トレイトのインスタンス関係。
- `uses`: フィールド、パラメータ、アノテーション、またはジェネリック型の参照。
- `calls`: メソッド呼び出しまたはコンストラクター呼び出し。
- `creates`: 直接の構築。
- `inherits`: クラス継承。
- `implements`: インターフェースの実装。
- `tests`: テスト専用の依存関係。

## 実用的なエクスポート戦略

抽出言語に依存させ、後で正規化します。

- Java/Kotlin: コンパイラ/JDT/PSIまたはバイトコード解析ツールを使用し、完全修飾クラス名をエクスポート。
- TypeScript: dependency-cruiserはモジュールレベルのJSONをエクスポート可能。クラスレベルの抽出器はASTデータでそれを拡充できます。
- C#/.NET: RoslynやNDependスタイルのデータは同じ`nodes`と`links`の形に変換可能。

ビューアは意図的にスキーマ優先で設計されており、解析パイプラインはレンダリング層を変更せずに進化できます。
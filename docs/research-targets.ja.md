<!-- i18n: language-switcher -->
[English](research-targets.md) | [日本語](research-targets.ja.md)

# 研究対象

このプロジェクトで深く調査すべき対象を、実装判断に使いやすい形で整理する。

## 評価軸

- 大規模性: 数千から数万ノードで破綻しにくいか。
- 視認性: 2D UMLより全体を俯瞰しやすい構造を持てるか。
- 探索性: 検索、フォーカス、展開/折りたたみ、呼び出し元/呼び出し先探索がしやすいか。
- 安定性: 毎回位置が揺れず、ユーザーが空間記憶を作れるか。
- 実装適性: Webアプリとして組み込みやすく、GPUを活かせるか。
- データ適性: class/package/module/edge type/cycle/metricを扱いやすいか。

## 主要調査対象

| 対象 | 種別 | 調査する理由 | 見るポイント | 採用したい考え方 |
| --- | --- | --- | --- | --- |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | 3Dグラフレンダラー | Three.jsベースの3Dグラフ実装として最重要。 | 大量ノード時の描画方式、インタラクション、カメラ操作、force layoutの限界。 | Three.js/WebGL、orbit操作、raycastピッキング。 |
| [react-force-graph](https://github.com/vasturiano/react-force-graph) | Reactグラフレンダラー | Reactから3D/2D/VR/ARグラフを扱う代表例。 | React統合のAPI、ノード表現、ラベル、更新コスト。 | API設計の参考。描画本体はより低レベルに制御する。 |
| [CodeCity](https://wettel.github.io/codecity.html) | 3Dソフトウェア可視化 | class/packageを街として見せる古典的アプローチ。 | packageを地区、classを建物として扱う空間記憶の作り方。 | module/packageを「地区」として安定配置する。 |
| [CodeCity paper](https://dl.acm.org/doi/10.1145/1370175.1370188) | 論文 | 3Dソフトウェア可視化の設計根拠を確認する。 | metricsを高さ/面積/色に割り当てる方法。 | LOC、複雑さ、次数を視覚属性に使う。 |
| [Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | ソースエクスプローラー | 巨大コードベースをローカルコンテキストで探索する思想が近い。 | search-first、選択されたノード中心、依存関係の近傍。 | フォーカスモードと近傍探索を主要導線にする。 |
| [NDepend dependency graph](https://www.ndepend.com/docs/visual-studio-dependency-graph) | 依存関係解析ツール | 大規模.NETコードの依存可視化で実用機能が多い。 | 展開/折りたたみ、呼び出し元/呼び出し先、リアルタイム検索、サイクル発見。 | パッケージの概要、ハブリスト、サイクル/SCC指標。 |

## 二次調査対象

| 対象 | 種別 | 調査する理由 | 見るポイント | 使いどころ |
| --- | --- | --- | --- | --- |
| [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | JS/TS依存抽出ツール | JS/TSの依存抽出元として有力。 | JSONエクスポート、ルール、モジュール/ファイルグラフ。 | 将来のTypeScript抽出候補。 |
| [Sigma.js](https://www.sigmajs.org/) | WebGL 2Dグラフレンダラー | 大規模グラフ描画のWebGL設計を見る。 | 描画呼び出し削減、ラベル戦略、カメラ/LOD。 | 3Dではなく性能設計の参考。 |
| [Cytoscape.js](https://js.cytoscape.org/) | グラフ解析/可視化ライブラリ | グラフアルゴリズムと可視化APIが豊富。 | レイアウト、フィルタ、スタイル、解析API。 | 一部アルゴリズムや操作モデルの参考。 |
| [Gephi](https://gephi.org/) | デスクトップグラフ解析 | 大規模ネットワーク解析のUIが成熟。 | クラスタリング、フィルタ、メトリクス、レイアウト探索。 | 解析UIとメトリクス設計の参考。 |
| [Graphology](https://graphology.github.io/) | グラフデータ構造 | JSでグラフアルゴリズムを扱う基盤。 | グラフデータモデル、アルゴリズム統合。 | Web Worker側の解析基盤候補。 |
| [Graphviz](https://graphviz.org/) | グラフレイアウトエンジン | 依存グラフレイアウトの基準点。 | 階層レイアウト、エッジルーティング、DOT表現。 | 2D出力/比較用。3D本体には直接使わない。 |
| [AWS Labs Palace](https://awslabs.github.io/palace/stable/) | 3D FEM/HPCシミュレータ | class依存ビューアではないが、大規模3Dデータ処理とGPU/並列設計の参考に。 | メッシュ/フィールド出力、ParaView連携、GPUサポート、プロファイリング。 | 描画対象を前処理で絞る、出力形式を分離、GPU計測を明示。 |

## ソースコード抽出候補

| 言語/環境 | 候補 | 調査する理由 | 出力したい情報 |
| --- | --- | --- | --- |
| Java/Kotlin | JDT、IntelliJ PSI、バイトコード解析 | class/interface/inheritance/call関係を高精度で抽出したい。 | FQCN、パッケージ、インポート、継承、実装、利用、呼び出し。 |
| TypeScript | TypeScript Compiler API、dependency-cruiser | モジュール依存だけでなくclass単位の情報も取りたい。 | class、interface、インポート、extends、implements、コンストラクタ使用。 |
| C#/.NET | Roslyn、NDependエクスポート | 大規模業務コードの対象になりやすい。 | 名前空間、型、メソッド呼び出し、継承、アセンブリ/モジュール。 |
| Python | ast、importlib metadata、pydeps | 動的要素が多いため段階的に扱う必要がある。 | モジュール/クラス、インポート、継承、ベストエフォートの呼び出しエッジ。 |

## 後回しにする対象

| 対象 | 理由 |
| --- | --- |
| 汎用UMLエディタ | 2D UMLの作図体験が中心で、数千クラスの俯瞰には向きにくい。 |
| 完全なforceシミュレーション中心のビューア | 見た目は自然だが、巨大依存グラフでは位置が安定しづらい。 |
| DOM/SVG中心のグラフレンダラー | 数千ノード/エッジで描画コストが高くなりやすい。 |
| VR/ARグラフビューア | 面白いが、まずはデスクトップWebで実用的な探索体験を固める。 |
| Palaceの物理ソルバー部分 | 電磁界FEMのソルバー自体は依存グラフ可視化と目的が異なるため直接採用しない。 |

## 実装に反映する結論

- 3D化の目的は見た目ではなく、module/package/classの階層を空間的に分けること。
- 初期表示はclass全部ではなくpackageの概要にする。
- class全部の描画は可能にするが、基本操作は検索とフォーカスに絞る。
- レイアウトは毎回安定させ、forceシミュレーションは補助的な探索機能に留める。
- WebGPU優先、WebGLフォールバックとする。ノードはインスタンス化、エッジはバッファにまとめる。
- 循環依存はSCCとして検出し、色・サイズ・詳細ペインで目立たせる。
- 抽出器はビューアから分離し、言語別にJSONへ正規化する。
- 宮殿、木、ブロック、生命体、宇宙、原子のような複数の3D比喩を、同じ意味グラフの投影として切り替えられるようにする。
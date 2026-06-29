# Research Targets

このプロジェクトで深く見るべき調査対象を、実装判断に使いやすい形で整理する。

## 評価軸

- 大規模性: 数千から数万ノードで破綻しにくいか。
- 視認性: 2D UMLより全体を俯瞰しやすい構造を持てるか。
- 探索性: 検索、focus、expand/collapse、caller/callee探索がしやすいか。
- 安定性: 毎回位置が揺れず、ユーザーが空間記憶を作れるか。
- 実装適性: Webアプリとして組み込みやすく、GPUを活かせるか。
- データ適性: class/package/module/edge type/cycle/metricを扱いやすいか。

## Primary Targets

| 対象 | 種別 | 調査する理由 | 見るポイント | 採用したい考え方 |
| --- | --- | --- | --- | --- |
| [3d-force-graph](https://github.com/vasturiano/3d-force-graph) | 3D graph renderer | Three.jsベースの3Dグラフ実装として最重要。 | 大量ノード時の描画方式、interaction、camera操作、force layoutの限界。 | Three.js/WebGL、orbit操作、raycast picking。 |
| [react-force-graph](https://github.com/vasturiano/react-force-graph) | React graph renderer | Reactから3D/2D/VR/AR graphを扱う代表例。 | React統合のAPI、ノード表現、ラベル、更新コスト。 | API設計の参考。描画本体はより低レベルに制御する。 |
| [CodeCity](https://wettel.github.io/codecity.html) | 3D software visualization | class/packageを街として見せる古典的アプローチ。 | packageを地区、classを建物として扱う空間記憶の作り方。 | module/packageを「地区」として安定配置する。 |
| [CodeCity paper](https://dl.acm.org/doi/10.1145/1370175.1370188) | 論文 | 3Dソフトウェア可視化の設計根拠を確認する。 | metricsを高さ/面積/色に割り当てる方法。 | LOC、complexity、degreeを視覚属性に使う。 |
| [Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | source explorer | 巨大コードベースをlocal contextで探索する思想が近い。 | search-first、selected node中心、dependency neighborhood。 | focus modeと近傍探索を主要導線にする。 |
| [NDepend dependency graph](https://www.ndepend.com/docs/visual-studio-dependency-graph) | dependency analysis tool | 大規模.NETコードの依存可視化で実用機能が多い。 | expand/collapse、caller/callee、real-time search、cycle発見。 | package overview、hub list、cycle/SCC指標。 |

## Secondary Targets

| 対象 | 種別 | 調査する理由 | 見るポイント | 使いどころ |
| --- | --- | --- | --- | --- |
| [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) | JS/TS dependency extractor | JS/TSの依存抽出元として有力。 | JSON export、ルール、module/file graph。 | 将来のTypeScript extractor候補。 |
| [Sigma.js](https://www.sigmajs.org/) | WebGL 2D graph renderer | 大規模graph描画のWebGL設計を見る。 | draw call削減、label戦略、camera/LOD。 | 3Dではなく性能設計の参考。 |
| [Cytoscape.js](https://js.cytoscape.org/) | graph analysis/view library | graph algorithmと可視化APIが豊富。 | layout、filter、style、analysis API。 | 一部アルゴリズムや操作モデルの参考。 |
| [Gephi](https://gephi.org/) | desktop graph analysis | 大規模ネットワーク分析のUIが成熟している。 | clustering、filter、metrics、layout exploration。 | 分析UIとmetric設計の参考。 |
| [Graphology](https://graphology.github.io/) | graph data structure | JSでgraph algorithmを扱う基盤。 | graph data model、algorithm integration。 | Web Worker側の解析基盤候補。 |
| [Graphviz](https://graphviz.org/) | graph layout engine | dependency graph layoutの基準点。 | 階層layout、edge routing、DOT表現。 | 2D出力/比較用。3D本体には直接使わない。 |
| [AWS Labs Palace](https://awslabs.github.io/palace/stable/) | 3D FEM/HPC simulator | class dependency viewerではないが、大規模3Dデータ処理とGPU/parallel設計の参考になる。 | mesh/field output、ParaView連携、GPU support、profiling discipline。 | 描画対象を前処理で絞る、出力形式を分離する、GPU計測を明示する。 |

## Source Code Extractor Candidates

| 言語/環境 | 候補 | 調査する理由 | 出力したい情報 |
| --- | --- | --- | --- |
| Java/Kotlin | JDT, IntelliJ PSI, bytecode analysis | class/interface/inheritance/call relationを精度よく抽出したい。 | FQCN、package、imports、inherits、implements、uses、calls。 |
| TypeScript | TypeScript Compiler API, dependency-cruiser | module依存だけでなくclass単位の情報を取りたい。 | class、interface、imports、extends、implements、constructor usage。 |
| C#/.NET | Roslyn, NDepend export | 大規模業務コードの対象になりやすい。 | namespace、type、method call、inheritance、assembly/module。 |
| Python | ast, importlib metadata, pydeps | 動的要素が多いため段階的に扱う必要がある。 | module/class、imports、inheritance、best-effort call edges。 |

## 後回しにする対象

| 対象 | 理由 |
| --- | --- |
| 汎用UML editor | 2D UMLの作図体験が中心で、数千classの俯瞰には向きにくい。 |
| 完全なforce simulation中心のviewer | 見た目は自然だが、巨大依存グラフでは位置が安定しづらい。 |
| DOM/SVG中心のgraph renderer | 数千ノード/エッジで描画コストが高くなりやすい。 |
| VR/AR graph viewer | 面白いが、まずはデスクトップWebで実用的な探索体験を固める。 |
| Palaceの物理solver部分 | 電磁界FEMのsolver自体は依存グラフ可視化と目的が違うため直接採用しない。 |

## 実装に反映する結論

- 3D化の目的は見た目ではなく、module/package/classの階層を空間的に分けること。
- 初期表示はclass全部ではなくpackage overviewにする。
- class全部の描画は可能にするが、基本操作はsearchとfocusで絞る。
- layoutは毎回安定させ、force simulationは補助的な探索機能に留める。
- WebGL前提で、ノードはinstancing、エッジはbufferにまとめる。
- 循環依存はSCCとして検出し、色・サイズ・詳細ペインで目立たせる。
- extractorはviewerから分離し、言語別にJSONへ正規化する。

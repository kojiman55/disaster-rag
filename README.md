# 防災AIナビ

住所を入力するだけで、その地点の災害リスクをAIが解説するシステム。洪水・土砂・津波・高潮のリスク評価、最寄り避難場所への徒歩経路、気象庁のリアルタイム警報、地域防災計画に基づくAI回答を一画面にまとめて提供する。

**デモ**: https://disaster-rag.eggsystems.jp

対応エリアは大阪府内。

---

## 何ができるか

住所を入力すると以下が一度に返ってくる。

- **ハザードリスク評価** — 洪水・土砂・津波・高潮の4種を国土交通省の不動産情報ライブラリAPIからリアルタイムで取得。市区町村単位のざっくりした評価ではなく、入力地点のタイル座標（ズームレベル14）を算出して呼び出すため、丁目・番地レベルのピンポイント評価が可能。
- **最寄り避難場所への経路** — 避難場所データから直線距離で最寄りを選び、OpenRouteServiceで徒歩経路を生成。地図上にルートを重ねて表示する。
- **気象警報・注意報** — 気象庁APIから大阪府の現在の警報・注意報をリアルタイム取得。
- **AIによる総合解説** — 上記データを全てプロンプトに渡し、Gemini 2.0 Flashが日本語で回答を生成。地域防災計画のRAGインデックスを参照して、公式計画の根拠も示す。
- **チャット機能** — 検索後、その地域について追加で質問できる。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS |
| バックエンド | AWS Lambda (TypeScript) / API Gateway |
| AI | Gemini 2.0 Flash（回答生成・テキスト埋め込み） |
| ベクトル検索 | Qdrant（地域防災計画PDFのRAGインデックス） |
| 地図 | MapLibre GL JS / 国土地理院タイル |
| インフラ | AWS SAM / S3 / CloudFront (OAC) / EventBridge |
| 外部API | 国土地理院 / 国土交通省 不動産情報ライブラリ / 気象庁 / OpenRouteService |

---

## システム構成

```
住所入力
  ↓
API Gateway → Lambda (disaster-query)
  ├─ 国土地理院 API（住所 → 緯度経度）
  ├─ 国土交通省 不動産情報ライブラリ API（ハザードリスクをタイル座標で並行取得）
  ├─ 気象庁 API（警報・注意報）
  ├─ S3（避難場所・市区町村マスタ）
  ├─ OpenRouteService（最寄り避難場所への徒歩経路）
  ├─ Qdrant（地域防災計画 RAG 検索）
  └─ Gemini 2.0 Flash（回答生成）
  ↓
Next.js UI（リスク表示・地図・AIチャット）
```

ハザード4種・RAG・経路案内の各APIは `Promise.all` で並行実行している。一部APIが失敗しても `try/catch` で吸収し、取得できたデータのみで回答を構成する設計にしているため、外部サービスの障害がシステム全体に波及しない。

---

## 設計上の工夫

### タイルベースのハザード評価

国土交通省の不動産情報ライブラリAPIは `z/x/y` のタイル座標でアクセスする仕様。緯度経度からタイル座標を算出して4種のAPIを並行呼び出し、フィーチャー数をリスクレベルに変換している。市区町村コードをキーにした事前データ取得では得られない、地点ベースの評価を実現している。

### RAGによる地域防災計画の参照

大阪府内10市区の地域防災計画PDFをテキスト抽出・チャンク化し、Geminiの埋め込みモデルでベクトル化してQdrantに格納している。質問に対してベクトル類似検索で関連箇所を取得し、AIが回答の根拠として引用する。単なる知識ベースの回答ではなく、公式計画に裏付けられた情報提供が可能になっている。

### 無料APIの組み合わせ

ジオコーディングは国土地理院のアドレス検索API（無料・キー不要）、地図タイルも国土地理院の淡色地図タイル（無料）を使用。Amazon Location Serviceなど有料サービスへの依存をなくし、ランニングコストを抑えている。

### アクセス制御

API GatewayのスロットリングとLambdaの予約済み同時実行数を組み合わせ、Gemini APIへの過剰リクエストによる意図しないコスト増加を防いでいる。スロットリング時のレスポンスにはCORSヘッダーを付与するGateway Responseも設定済み。

---

## セットアップ

### 必要なもの

- AWS アカウント（SAM CLI セットアップ済み）
- Gemini API キー
- 国土交通省 不動産情報ライブラリ API キー（[登録はこちら](https://www.reinfolib.mlit.go.jp/)）
- Qdrant インスタンス（Cloud の無料プランで動作確認済み）

### Secrets Manager への登録

```bash
aws secretsmanager create-secret \
  --name "disaster-rag/gemini-api-key" \
  --secret-string "YOUR_KEY"

aws secretsmanager create-secret \
  --name "disaster-rag/reinfolib-api-key" \
  --secret-string "YOUR_KEY"

aws secretsmanager create-secret \
  --name "disaster-rag/qdrant-url" \
  --secret-string "https://your-qdrant-instance"

aws secretsmanager create-secret \
  --name "disaster-rag/qdrant-api-key" \
  --secret-string "YOUR_KEY"
```

### バックエンドのデプロイ

```bash
cd backend && npm install && npm run build
cd ..
sam build && sam deploy
```

### データの初期投入

```bash
cd scripts && npm install

# 市区町村コードマスタ
BUCKET_NAME=your-bucket npx ts-node convert-municipality-codes.ts

# 避難場所データ（国土地理院の避難場所一覧CSVを使用）
BUCKET_NAME=your-bucket CSV_PATH=./27000_2.csv npx ts-node convert-shelters.ts

# 気象情報の初回取得
aws lambda invoke --function-name disaster-rag-weather-update /dev/null
```

### フロントエンドのローカル起動

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE にデプロイ済みの API Gateway URL を設定
npm install && npm run dev
```

---

## コスト（デモ運用時）

| サービス | 費用 |
|---|---|
| Lambda + API Gateway | $0（無料枠内） |
| S3 × 2 バケット | $0（無料枠内） |
| CloudFront | $0（無料枠内） |
| Gemini API | $0（無料枠内） |
| Qdrant Cloud | $0（無料プラン） |
| EventBridge | $0（無料枠内） |
| Route 53 | $0.50（既存ホストゾーン） |
| **合計** | **約 $0.50 / 月** |

国土地理院・気象庁・OpenRouteService はいずれも無償API。

---

## データソース

- [国土地理院 住所検索API](https://msearch.gsi.go.jp/)
- [国土交通省 不動産情報ライブラリ](https://www.reinfolib.mlit.go.jp/)（洪水・土砂・津波・高潮ハザードタイル）
- [気象庁 防災情報API](https://www.jma.go.jp/bosai/)
- [OpenRouteService](https://openrouteservice.org/)（徒歩経路）
- 大阪府・各市区町村 地域防災計画（PDF）

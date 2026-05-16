# 防災AIナビ

住所を入力するだけで、その地点の災害リスクをAIが解説するシステム。洪水・土砂・津波・高潮のリスク評価、最寄り避難場所への徒歩経路、気象庁の警報情報、地域防災計画に基づくAI回答を一括で提供する。

**デモ**: https://disaster-rag.eggsystems.jp

対応エリアは大阪府内。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS |
| バックエンド | AWS Lambda (TypeScript) / API Gateway |
| AI | Gemini 2.0 Flash（回答生成・テキスト埋め込み） |
| ベクトル検索 | Qdrant（地域防災計画PDFのRAGインデックス） |
| 地図 | MapLibre GL JS / 国土地理院タイル |
| インフラ | AWS SAM / S3 / CloudFront (OAC) / EventBridge |
| 外部API | 国土地理院（ジオコーディング）/ 国土交通省 不動産情報ライブラリ（ハザードタイル）/ 気象庁 / OpenRouteService（徒歩経路） |

## システム構成

```
住所入力
  ↓
API Gateway → Lambda (disaster-query)
  ├─ 国土地理院 API（住所 → 緯度経度）
  ├─ 国土交通省 不動産情報ライブラリ API（ハザードリスクをタイル座標で取得）
  ├─ 気象庁 API（警報・注意報）
  ├─ S3（避難場所・市区町村マスタ）
  ├─ OpenRouteService（最寄り避難場所への徒歩経路）
  ├─ Qdrant（地域防災計画 RAG 検索）
  └─ Gemini 2.0 Flash（回答生成）
  ↓
Next.js UI（リスク表示・地図・AIチャット）
```

ハザードリスクはズームレベル14のタイル座標を算出してリアルタイムに取得する。事前の市区町村単位データに依存しないため、ピンポイントの評価が可能。

## セットアップ

### 必要なもの

- AWS アカウント（SAM CLI セットアップ済み）
- Gemini API キー
- 国土交通省 不動産情報ライブラリ API キー（[登録](https://www.reinfolib.mlit.go.jp/)）
- Qdrant インスタンス（Cloud または self-hosted）

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

## コスト（デモ運用時）

| サービス | 費用 |
|---|---|
| Lambda + API Gateway | $0（無料枠内） |
| S3 × 2 バケット | $0（無料枠内） |
| CloudFront | $0（無料枠内） |
| Gemini API | $0（無料枠内） |
| EventBridge | $0（無料枠内） |
| Route 53 | $0.50（既存ホストゾーン） |
| **合計** | **約 $0.50 / 月** |

Qdrant は Cloud の無料プランを使用。国土地理院・気象庁・OpenRouteService はいずれも無償API。

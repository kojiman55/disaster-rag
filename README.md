# DisasterRAG — 防災情報AIシステム

住所を入力するだけで、その場所の災害リスクをAIが総合的に解説するシステム。
気象庁・国土交通省の公的APIとGemini Long Context Groundingを組み合わせた防災情報Q&Aツール。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS |
| バックエンド | AWS Lambda (TypeScript) / API Gateway |
| AI | Gemini 2.0 Flash (Long Context Grounding) |
| 地図 | MapLibre GL JS / 国土地理院タイル |
| インフラ | AWS CDK / S3 / CloudFront / EventBridge |
| 住所変換 | Amazon Location Service |
| データソース | 気象庁防災情報XML / 国土交通省 不動産情報ライブラリAPI / 国土地理院 避難場所データ |

## システム構成

```
住所入力
  ↓
API Gateway → Lambda (disaster-query)
  ├─ Amazon Location Service（住所→緯度経度）
  ├─ S3 hazard/{code}.json（ハザードデータ）
  ├─ S3 master/shelters/{code}.json（避難場所）
  ├─ S3 weather/latest.json（気象情報）
  └─ Gemini 2.0 Flash（Long Context Grounding）
  ↓
React UI（リスク表示・地図・AIチャット）
```

## ローカル起動

```bash
# フロントエンド
cd frontend
cp .env.example .env.local
# .env.local に NEXT_PUBLIC_API_BASE を設定
npm install
npm run dev
```

## デプロイ

```bash
# バックエンド（SAM）
cd backend && npm install && npm run build
cd ..
sam build && sam deploy  # samconfig.toml の設定を使用

# フロントエンド（GitHub Actions自動デプロイ）
# mainブランチにpushすると自動デプロイ
```

## 必要なSecrets Manager登録

```bash
aws secretsmanager create-secret \
  --name "disaster-rag/gemini-api-key" \
  --secret-string "YOUR_GEMINI_API_KEY" \
  --profile eggsystems

aws secretsmanager create-secret \
  --name "disaster-rag/reinfolib-api-key" \
  --secret-string "YOUR_REINFOLIB_API_KEY" \
  --profile eggsystems
```

## データ初期セットアップ

```bash
# 1. 市区町村コードをS3にアップロード
cd scripts && npm install
BUCKET_NAME=disaster-rag-data-xxx npx ts-node convert-municipality-codes.ts

# 2. 避難場所データをS3にアップロード
# CSV_PATH=~/Developer/disaster-rag-data/27000_2.csv
BUCKET_NAME=disaster-rag-data-xxx CSV_PATH=.../27000_2.csv npx ts-node convert-shelters.ts

# 3. 気象情報を初回取得
aws lambda invoke --function-name disaster-rag-weather-update /dev/null --profile eggsystems

# 4. ハザードデータを取得（国土交通省APIキー取得後）
aws lambda invoke --function-name disaster-rag-hazard-update /dev/null --profile eggsystems
```

## アピールポイント

- 複数の公的API（気象庁・国土交通省）をリアルタイムで組み合わせ
- Gemini Long Context Groundingによる低コストRAG実装（ベクトルDB不要）
- Amazon Location Serviceを使った住所→緯度経度変換
- EventBridgeによる気象情報の自動定期更新
- MapLibre GL JS + 国土地理院タイルで完全無料の地図表示
- AWS CDKによるインフラのコード管理
- S3 + CloudFront + OACによるセキュアな静的ホスティング

## 月額コスト（デモ時）

| サービス | 費用 |
|---|---|
| Lambda + API Gateway | $0（無料枠内） |
| S3 × 2バケット | $0（無料枠内） |
| CloudFront | $0（無料枠内） |
| Amazon Location Service | $0（月10万req無料） |
| EventBridge | $0（無料枠内） |
| Gemini API | $0（無料枠内） |
| Route 53 | $0.50（既存ゾーン） |
| **合計** | **約$0.50/月** |

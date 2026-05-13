#!/bin/bash
set -e

BUCKET="disaster-rag.eggsystems.jp"
DISTRIBUTION_ID="EOV1E71YQCNRB"
API_BASE="https://jc2v9yezh6.execute-api.ap-northeast-1.amazonaws.com/prod"

cd "$(dirname "$0")/../frontend"

echo "Building..."
NEXT_PUBLIC_API_BASE="$API_BASE" npm run build

echo "Uploading static assets (immutable)..."
aws s3 sync out/ "s3://$BUCKET/" --profile eggsystems --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "*.txt"

echo "Uploading HTML/text (no-cache)..."
aws s3 sync out/ "s3://$BUCKET/" --profile eggsystems \
  --cache-control "no-cache" \
  --include "*.html" --include "*.txt"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --profile eggsystems

echo "Done: https://disaster-rag.eggsystems.jp"

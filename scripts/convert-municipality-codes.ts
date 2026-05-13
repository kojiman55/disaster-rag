/**
 * 大阪府の市区町村コードJSONをS3にアップロード
 *
 * 出力: s3://BUCKET/master/municipality_codes.json
 *
 * 実行方法:
 *   BUCKET_NAME=xxx npx ts-node convert-municipality-codes.ts
 */

import * as fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.BUCKET_NAME!;
const JSON_PATH = process.env.JSON_PATH ?? `${process.env.HOME}/Developer/disaster-rag-data/osaka_municipality_codes.json`;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!BUCKET && !DRY_RUN) {
  console.error("BUCKET_NAME 環境変数が必要です");
  process.exit(1);
}

async function run() {
  const s3 = new S3Client({ region: "ap-northeast-1" });

  const codes = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  console.log(`市区町村コード: ${Object.keys(codes).length}件`);

  const key = "master/municipality_codes.json";
  const body = JSON.stringify(codes);

  if (DRY_RUN) {
    console.log(`[DRY_RUN] s3://${BUCKET}/${key}`);
  } else {
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "application/json" }));
    console.log(`Uploaded: ${key}`);
  }
  console.log("完了");
}

run().catch(console.error);

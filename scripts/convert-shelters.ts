/**
 * 国土地理院 指定緊急避難場所CSVを市区町村コード別JSONに変換してS3にアップロード
 *
 * 入力: 大阪府CSVファイル (27000_2.csv)
 * 出力: s3://BUCKET/master/shelters/{municipalityCode}.json
 *
 * 実行方法:
 *   BUCKET_NAME=xxx CSV_PATH=/path/to/27000_2.csv npx ts-node convert-shelters.ts
 */

import * as fs from "fs";
import * as readline from "readline";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface Shelter {
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

const DISASTER_COLS = ["洪水", "崖崩れ・土石流・地滑り", "高潮", "地震", "津波", "大規模な火事", "内水氾濫", "火山現象"];
const DISASTER_IDX = [4, 5, 6, 7, 8, 9, 10, 11]; // 0-indexed column positions

const BUCKET = process.env.BUCKET_NAME!;
const CSV_PATH = process.env.CSV_PATH ?? `${process.env.HOME}/Developer/disaster-rag-data/27000_2.csv`;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!BUCKET && !DRY_RUN) {
  console.error("BUCKET_NAME 環境変数が必要です");
  process.exit(1);
}

async function run() {
  const s3 = new S3Client({ region: "ap-northeast-1" });

  // Parse CSV
  const sheltersByCode: Record<string, Shelter[]> = {};

  const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH, "utf-8") });
  let isHeader = true;

  for await (const rawLine of rl) {
    // Strip BOM
    const line = rawLine.replace(/^﻿/, "");
    if (isHeader) { isHeader = false; continue; }

    const cols = line.split(",");
    if (cols.length < 13) continue;

    const commonId = cols[1]?.trim();  // 共通ID: E27211xxxxx
    const name    = cols[2]?.trim();
    const address = cols[3]?.trim();
    const lat     = parseFloat(cols[10]);
    const lng     = parseFloat(cols[11]);

    if (!commonId || !name || isNaN(lat) || isNaN(lng)) continue;

    // Municipality code from common ID: E + 5-digit code + rest
    const codeMatch = commonId.match(/^E(\d{5})/);
    if (!codeMatch) continue;
    const municipalityCode = codeMatch[1];

    // Applicable disaster types (column value "1" = applicable)
    const types: string[] = [];
    DISASTER_IDX.forEach((idx, i) => {
      if (cols[idx]?.trim() === "1") types.push(DISASTER_COLS[i]);
    });

    if (!sheltersByCode[municipalityCode]) sheltersByCode[municipalityCode] = [];
    sheltersByCode[municipalityCode].push({ name, address, lat, lng, types });
  }

  const codes = Object.keys(sheltersByCode);
  console.log(`市区町村数: ${codes.length}, 合計避難場所: ${codes.reduce((s, c) => s + sheltersByCode[c].length, 0)}`);

  for (const code of codes) {
    const key = `master/shelters/${code}.json`;
    const body = JSON.stringify(sheltersByCode[code]);
    if (DRY_RUN) {
      console.log(`[DRY_RUN] s3://${BUCKET}/${key} (${sheltersByCode[code].length}件)`);
    } else {
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "application/json" }));
      console.log(`Uploaded: ${key} (${sheltersByCode[code].length}件)`);
    }
  }
  console.log("完了");
}

run().catch(console.error);

/**
 * 国土地理院 指定緊急避難場所CSVを市区町村コード別JSONに変換してS3にアップロード
 *
 * 実行方法:
 *   BUCKET_NAME=xxx CSV_PATH=/path/to/27000_2.csv npx ts-node convert-shelters.ts
 */

import * as fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

interface Shelter {
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

// CSV列インデックス（0始まり）
// NO,共通ID,施設名,住所,洪水,崖崩れ,高潮,地震,津波,大規模火事,内水氾濫,火山,指定避難所同一,緯度,経度,備考
const COL = { id: 1, name: 2, address: 3, lat: 13, lng: 14 };
const DISASTER_COLS = ["洪水", "崖崩れ・土石流・地滑り", "高潮", "地震", "津波", "大規模な火事", "内水氾濫", "火山現象"];
const DISASTER_IDX = [4, 5, 6, 7, 8, 9, 10, 11];

const BUCKET = process.env.BUCKET_NAME!;
const CSV_PATH = process.env.CSV_PATH ?? `${process.env.HOME}/Developer/disaster-rag-data/27000_2.csv`;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!BUCKET && !DRY_RUN) {
  console.error("BUCKET_NAME 環境変数が必要です");
  process.exit(1);
}

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    // 簡易CSVパース（フィールド内カンマ非対応だが本データは問題なし）
    rows.push(line.split(","));
  }
  return rows;
}

async function run() {
  const s3 = new S3Client({ region: "ap-northeast-1" });

  // UTF-8 BOM対応で読み込み
  const raw = fs.readFileSync(CSV_PATH);
  const content = raw.toString("utf-8").replace(/^﻿/, ""); // BOM除去

  const rows = parseCSV(content);
  console.log(`読み込み行数: ${rows.length}`);

  const sheltersByCode: Record<string, Shelter[]> = {};
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) { // ヘッダーをスキップ
    const cols = rows[i];
    if (cols.length < 15) { skipped++; continue; }

    const commonId = cols[COL.id]?.trim();
    const name     = cols[COL.name]?.trim();
    const address  = cols[COL.address]?.trim();
    const lat      = parseFloat(cols[COL.lat]);
    const lng      = parseFloat(cols[COL.lng]);

    if (!commonId || !name || isNaN(lat) || isNaN(lng)) { skipped++; continue; }

    // 共通ID: E + 5桁市区町村コード + 連番
    const match = commonId.match(/^E(\d{5})/);
    if (!match) { skipped++; continue; }
    const municipalityCode = match[1];

    const types: string[] = [];
    DISASTER_IDX.forEach((idx, i) => {
      if (cols[idx]?.trim() === "1") types.push(DISASTER_COLS[i]);
    });

    if (!sheltersByCode[municipalityCode]) sheltersByCode[municipalityCode] = [];
    sheltersByCode[municipalityCode].push({ name, address, lat, lng, types });
  }

  const codes = Object.keys(sheltersByCode);
  const total = codes.reduce((s, c) => s + sheltersByCode[c].length, 0);
  console.log(`市区町村数: ${codes.length}, 合計避難場所: ${total}, スキップ: ${skipped}`);

  for (const code of codes) {
    const key = `master/shelters/${code}.json`;
    const body = JSON.stringify(sheltersByCode[code]);
    if (DRY_RUN) {
      console.log(`[DRY_RUN] ${key} (${sheltersByCode[code].length}件)`);
    } else {
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: "application/json" }));
      console.log(`Uploaded: ${key} (${sheltersByCode[code].length}件)`);
    }
  }
  console.log("完了");
}

run().catch(console.error);

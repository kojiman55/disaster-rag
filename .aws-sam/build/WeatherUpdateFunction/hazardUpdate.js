"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/hazardUpdate.ts
var hazardUpdate_exports = {};
__export(hazardUpdate_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(hazardUpdate_exports);

// src/shared/s3.ts
var import_client_s3 = require("@aws-sdk/client-s3");
var s3 = new import_client_s3.S3Client({ region: "ap-northeast-1" });
var BUCKET = process.env.BUCKET_NAME;
async function getJson(key) {
  try {
    const res = await s3.send(new import_client_s3.GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body.transformToString("utf-8");
    return JSON.parse(body);
  } catch (e) {
    if (e.name === "NoSuchKey") return null;
    throw e;
  }
}
async function putJson(key, data) {
  await s3.send(
    new import_client_s3.PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json"
    })
  );
}

// src/shared/secrets.ts
var import_client_secrets_manager = require("@aws-sdk/client-secrets-manager");
var client = new import_client_secrets_manager.SecretsManagerClient({ region: "ap-northeast-1" });
var cache = /* @__PURE__ */ new Map();
async function getSecret(secretName) {
  if (cache.has(secretName)) return cache.get(secretName);
  const res = await client.send(new import_client_secrets_manager.GetSecretValueCommand({ SecretId: secretName }));
  const val = res.SecretString;
  cache.set(secretName, val);
  return val;
}

// src/hazardUpdate.ts
var REINFOLIB_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";
var HAZARD_APIS = {
  flood: "XKT026",
  stormSurge: "XKT027",
  tsunami: "XKT028",
  landslide: "XKT029"
};
async function fetchHazardApi(apiId, municipalityCode, apiKey) {
  const url = `${REINFOLIB_BASE}/${apiId}?response_format=geojson&municipality_code=${municipalityCode}`;
  const res = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.features ?? [];
}
function assessRisk(features) {
  if (features.length === 0) return { risk: "low", description: "\u8A72\u5F53\u533A\u57DF\u306A\u3057" };
  const count = features.length;
  let risk = "low";
  if (count > 100) risk = "high";
  else if (count > 20) risk = "medium";
  return { risk, description: `${count}\u4EF6\u306E\u533A\u57DF\u304C\u78BA\u8A8D\u3055\u308C\u3066\u3044\u307E\u3059` };
}
async function getShelters(municipalityCode) {
  const shelters = await getJson(`master/shelters/${municipalityCode}.json`);
  return shelters ?? [];
}
var handler = async (event) => {
  const apiKey = await getSecret("disaster-rag/reinfolib-api-key");
  const allCodes = await getJson("master/municipality_codes.json");
  if (!allCodes) {
    throw new Error("master/municipality_codes.json \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  }
  const targetEntries = event.municipalityCodes ? Object.entries(allCodes).filter(([, v]) => event.municipalityCodes.includes(v)) : Object.entries(allCodes);
  console.log(`\u51E6\u7406\u5BFE\u8C61: ${targetEntries.length}\u5E02\u533A\u753A\u6751`);
  let processed = 0;
  for (const [areaName, areaCode] of targetEntries) {
    const [floodFeatures, stormFeatures, tsunamiFeatures, landslideFeatures] = await Promise.all([
      fetchHazardApi(HAZARD_APIS.flood, areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.stormSurge, areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.tsunami, areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.landslide, areaCode, apiKey)
    ]);
    const shelters = await getShelters(areaCode);
    const hazard = {
      areaCode,
      areaName,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      flood: assessRisk(floodFeatures),
      stormSurge: assessRisk(stormFeatures),
      tsunami: assessRisk(tsunamiFeatures),
      landslide: assessRisk(landslideFeatures),
      shelters
    };
    await putJson(`hazard/${areaCode}.json`, hazard);
    processed++;
    console.log(`Saved: ${areaName} (${areaCode}) \u6D2A\u6C34:${hazard.flood.risk} \u571F\u7802:${hazard.landslide.risk}`);
  }
  console.log(`Hazard update complete: ${processed}/${targetEntries.length} municipalities`);
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});

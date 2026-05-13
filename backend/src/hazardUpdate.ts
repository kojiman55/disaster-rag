import { getJson, putJson } from "./shared/s3";
import { getSecret } from "./shared/secrets";
import { HazardData, HazardRisk, RiskLevel, Shelter } from "./shared/types";

const REINFOLIB_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";

const HAZARD_APIS = {
  flood:      "XKT026",
  stormSurge: "XKT027",
  tsunami:    "XKT028",
  landslide:  "XKT029",
} as const;

interface ReinfilibFeature {
  properties?: Record<string, unknown>;
}

async function fetchHazardApi(
  apiId: string,
  municipalityCode: string,
  apiKey: string
): Promise<ReinfilibFeature[]> {
  const url = `${REINFOLIB_BASE}/${apiId}?response_format=geojson&municipality_code=${municipalityCode}`;
  const res = await fetch(url, {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []) as ReinfilibFeature[];
}

function assessRisk(features: ReinfilibFeature[]): HazardRisk {
  if (features.length === 0) return { risk: "low", description: "該当区域なし" };
  const count = features.length;
  let risk: RiskLevel = "low";
  if (count > 100) risk = "high";
  else if (count > 20) risk = "medium";
  return { risk, description: `${count}件の区域が確認されています` };
}

async function getShelters(municipalityCode: string): Promise<Shelter[]> {
  let shelters = await getJson<Shelter[]>(`master/shelters/${municipalityCode}.json`);
  if (!shelters || shelters.length === 0) {
    // 政令指定都市の区コードの場合、市全体のデータにフォールバック（例: 27127→27100）
    const cityCode = `${municipalityCode.slice(0, 3)}00`;
    shelters = await getJson<Shelter[]>(`master/shelters/${cityCode}.json`);
  }
  return shelters ?? [];
}

export const handler = async (event: { municipalityCodes?: string[] }): Promise<void> => {
  const apiKey = await getSecret("disaster-rag/reinfolib-api-key");

  // S3からマスターデータを読み込む（ハードコードなし）
  const allCodes = await getJson<Record<string, string>>("master/municipality_codes.json");
  if (!allCodes) {
    throw new Error("master/municipality_codes.json が見つかりません");
  }

  // 指定コードのみ or 全市区町村
  const targetEntries = event.municipalityCodes
    ? Object.entries(allCodes).filter(([, v]) => event.municipalityCodes!.includes(v))
    : Object.entries(allCodes);

  console.log(`処理対象: ${targetEntries.length}市区町村`);

  let processed = 0;
  for (const [areaName, areaCode] of targetEntries) {
    const [floodFeatures, stormFeatures, tsunamiFeatures, landslideFeatures] = await Promise.all([
      fetchHazardApi(HAZARD_APIS.flood,      areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.stormSurge, areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.tsunami,    areaCode, apiKey),
      fetchHazardApi(HAZARD_APIS.landslide,  areaCode, apiKey),
    ]);

    const shelters = await getShelters(areaCode);

    const hazard: HazardData = {
      areaCode,
      areaName,
      updatedAt: new Date().toISOString(),
      flood:      assessRisk(floodFeatures),
      stormSurge: assessRisk(stormFeatures),
      tsunami:    assessRisk(tsunamiFeatures),
      landslide:  assessRisk(landslideFeatures),
      shelters,
    };

    await putJson(`hazard/${areaCode}.json`, hazard);
    processed++;
    console.log(`Saved: ${areaName} (${areaCode}) 洪水:${hazard.flood.risk} 土砂:${hazard.landslide.risk}`);
  }

  console.log(`Hazard update complete: ${processed}/${targetEntries.length} municipalities`);
};

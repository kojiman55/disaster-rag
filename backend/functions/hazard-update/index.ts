import { getJson, putJson } from "../../shared/s3";
import { getSecret } from "../../shared/secrets";
import { HazardData, HazardRisk, RiskLevel, Shelter } from "../../shared/types";

const REINFOLIB_BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";

// 不動産情報ライブラリ API IDs
const HAZARD_APIS = {
  flood:      "XKT026",  // 洪水浸水想定区域（想定最大規模）
  stormSurge: "XKT027",  // 高潮浸水想定区域
  tsunami:    "XKT028",  // 津波浸水想定
  landslide:  "XKT029",  // 土砂災害警戒区域
} as const;

// Osaka municipality codes (27xxx)
const OSAKA_MUNICIPALITIES: Record<string, string> = {
  "大阪市":     "27100",
  "堺市":       "27140",
  "岸和田市":   "27202",
  "豊中市":     "27203",
  "池田市":     "27204",
  "吹田市":     "27205",
  "泉大津市":   "27206",
  "高槻市":     "27207",
  "貝塚市":     "27208",
  "守口市":     "27209",
  "枚方市":     "27210",
  "茨木市":     "27211",
  "八尾市":     "27212",
  "泉佐野市":   "27213",
  "富田林市":   "27214",
  "寝屋川市":   "27215",
  "河内長野市": "27216",
  "松原市":     "27217",
  "大東市":     "27218",
  "和泉市":     "27219",
  "箕面市":     "27220",
  "柏原市":     "27221",
  "羽曳野市":   "27222",
  "門真市":     "27223",
  "摂津市":     "27224",
  "高石市":     "27225",
  "藤井寺市":   "27226",
  "東大阪市":   "27227",
  "泉南市":     "27228",
  "四條畷市":   "27229",
  "交野市":     "27230",
  "大阪狭山市": "27231",
  "阪南市":     "27232",
};

interface ReinfilibFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
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
  else risk = "low";
  return { risk, description: `${count}件の区域が確認されています` };
}

async function getShelters(municipalityCode: string): Promise<Shelter[]> {
  const shelters = await getJson<Shelter[]>(`master/shelters/${municipalityCode}.json`);
  return shelters ?? [];
}

export const handler = async (event: { municipalityCodes?: string[] }): Promise<void> => {
  const apiKey = await getSecret("disaster-rag/reinfolib-api-key");

  // Process specified municipalities or all Osaka ones
  const targetCodes = event.municipalityCodes
    ? Object.fromEntries(
        Object.entries(OSAKA_MUNICIPALITIES).filter(([, v]) => event.municipalityCodes!.includes(v))
      )
    : OSAKA_MUNICIPALITIES;

  let processed = 0;
  for (const [areaName, areaCode] of Object.entries(targetCodes)) {
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
    console.log(`Saved: ${areaName} (${areaCode})`);
  }

  console.log(`Hazard update complete: ${processed} municipalities`);
};

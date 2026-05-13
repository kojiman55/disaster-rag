import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { geocode } from "../../shared/location";
import { getJson } from "../../shared/s3";
import { generateAnswer } from "../../shared/gemini";
import { HazardData, WeatherData } from "../../shared/types";

type MunicipalityCodes = Record<string, string>;

const CORS = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function ok(body: unknown): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}
function err(status: number, msg: string): APIGatewayProxyResult {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ error: msg }) };
}

function findMunicipalityCode(
  codes: MunicipalityCodes,
  label: string
): { name: string; code: string } | null {
  // Try longest match first (e.g., "大阪市北区" before "大阪市")
  const sorted = Object.entries(codes).sort((a, b) => b[0].length - a[0].length);
  for (const [name, code] of sorted) {
    if (label.includes(name)) return { name, code };
  }
  return null;
}

function buildPrompt(
  address: string,
  areaName: string,
  hazard: HazardData | null,
  weather: WeatherData | null,
  question: string
): string {
  return `あなたは防災情報の専門家AIです。
以下の公式データをもとに、質問に日本語で回答してください。
データにない情報は「データなし」と伝え、推測での回答は避けてください。

【対象地域】${address}（${areaName}）

【ハザードマップデータ（国土交通省 不動産情報ライブラリ）】
${hazard ? JSON.stringify(hazard, null, 2) : "データ取得中（国土交通省APIキー審査待ち）"}

【現在の気象情報（気象庁）】
${weather ? JSON.stringify(weather, null, 2) : "データなし"}

【質問】${question}

以下の形式で回答してください：
- リスク評価：（高・中・低とその理由）
- 具体的な説明：（わかりやすく）
- 推奨アクション：（具体的な行動指針）
`;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") return ok({});

  const { address, question } = JSON.parse(event.body ?? "{}");
  if (!address || !question) return err(400, "address と question は必須です");

  // 1. 住所 → 緯度経度
  const { lat, lng, label } = await geocode(address);

  // 2. 市区町村コードを特定
  const codes = await getJson<MunicipalityCodes>("master/municipality_codes.json");
  const municipality = codes ? findMunicipalityCode(codes, label) : null;

  // 3. S3からデータ取得
  const [hazard, weather] = await Promise.all([
    municipality ? getJson<HazardData>(`hazard/${municipality.code}.json`) : null,
    getJson<WeatherData>("weather/latest.json"),
  ]);

  // 4. Gemini で回答生成
  const areaName = municipality?.name ?? label;
  const prompt = buildPrompt(address, areaName, hazard, weather, question);
  const answer = await generateAnswer(prompt);

  return ok({ answer, hazardData: hazard, weatherData: weather, lat, lng, areaName });
};

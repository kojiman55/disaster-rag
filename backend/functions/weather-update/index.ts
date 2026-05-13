import { XMLParser } from "fast-xml-parser";
import { putJson } from "../../shared/s3";
import { WeatherWarning, WeatherData } from "../../shared/types";

const FEED_URL = "https://www.data.jma.go.jp/developer/xml/feed/extra.xml";

interface FeedEntry {
  title: string;
  id: string;
  updated: string;
  content?: string;
  link?: { "@_href": string };
}

interface ParsedFeed {
  feed?: {
    entry?: FeedEntry | FeedEntry[];
  };
}

async function fetchWarningsFromFeed(): Promise<WeatherWarning[]> {
  const feedRes = await fetch(FEED_URL);
  const feedXml = await feedRes.text();

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const feed = parser.parse(feedXml) as ParsedFeed;

  const entries = feed.feed?.entry ?? [];
  const entryList = Array.isArray(entries) ? entries : [entries];

  const warnings: WeatherWarning[] = [];

  // Process latest warning/advisory entries (title contains 警報 or 注意報)
  const warningEntries = entryList
    .filter((e) => e.title && (e.title.includes("警報") || e.title.includes("注意報")))
    .slice(0, 20);

  for (const entry of warningEntries) {
    // Parse entry title: "大阪府 大雨警報（土砂災害）" etc.
    const title = entry.title ?? "";
    const updated = entry.updated ?? new Date().toISOString();

    // Determine level
    const level = title.includes("警報") ? "警報" : title.includes("注意報") ? "注意報" : "情報";

    // Extract area from title (first part before space)
    const parts = title.split(/\s+/);
    const areaName = parts[0] ?? "不明";

    warnings.push({
      areaCode: "270000",
      areaName,
      type: title,
      level,
      issuedAt: updated,
    });
  }

  return warnings;
}

export const handler = async (): Promise<void> => {
  const warnings = await fetchWarningsFromFeed();
  const data: WeatherData = {
    updatedAt: new Date().toISOString(),
    warnings,
  };
  await putJson("weather/latest.json", data);
  console.log(`Weather updated: ${warnings.length} entries`);
};

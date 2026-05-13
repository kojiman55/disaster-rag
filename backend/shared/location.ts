import { LocationClient, SearchPlaceIndexForTextCommand } from "@aws-sdk/client-location";

const client = new LocationClient({ region: "ap-northeast-1" });

export async function geocode(address: string): Promise<{ lat: number; lng: number; label: string }> {
  const res = await client.send(
    new SearchPlaceIndexForTextCommand({
      IndexName: process.env.LOCATION_INDEX_NAME ?? "disaster-rag-index",
      Text: address,
      Language: "ja",
      MaxResults: 1,
    })
  );
  const place = res.Results?.[0];
  if (!place?.Place?.Geometry?.Point) {
    throw new Error(`住所を解決できませんでした: ${address}`);
  }
  const [lng, lat] = place.Place.Geometry.Point;
  const label = place.Place.Label ?? address;
  return { lat, lng, label };
}

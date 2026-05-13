import { WeatherData } from "@/lib/types";

interface Props {
  weatherData: WeatherData;
  areaName: string;
}

const LEVEL_STYLE: Record<string, string> = {
  警報:   "bg-red-50 border-red-300 text-red-800",
  注意報: "bg-yellow-50 border-yellow-300 text-yellow-800",
  情報:   "bg-blue-50 border-blue-300 text-blue-800",
};

export default function WeatherAlert({ weatherData, areaName }: Props) {
  const relevant = weatherData.warnings.filter(
    (w) => w.areaName.includes("大阪") || w.areaCode.startsWith("27")
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">🚨 現在の警報・注意報</h2>
      <p className="text-xs text-gray-400 mb-4">
        出典：気象庁 / 更新: {weatherData.updatedAt?.slice(0, 16).replace("T", " ") ?? "—"}
      </p>
      {relevant.length === 0 ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          ✅ {areaName}周辺に現在発令中の警報・注意報はありません
        </p>
      ) : (
        <div className="space-y-2">
          {relevant.map((w, i) => {
            const style = LEVEL_STYLE[w.level] ?? "bg-gray-50 border-gray-200 text-gray-700";
            return (
              <div key={i} className={`border rounded-lg px-4 py-2.5 flex items-center gap-3 ${style}`}>
                <span className="font-semibold text-sm">{w.type}</span>
                <span className="text-xs opacity-75">({w.areaName})</span>
                <span className="ml-auto text-xs opacity-60">
                  {w.issuedAt?.slice(0, 16).replace("T", " ") ?? ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

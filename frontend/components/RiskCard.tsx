import { HazardData, RiskLevel } from "@/lib/types";

interface Props {
  hazardData: HazardData;
}

const RISK_LABELS: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  high:    { label: "高",   color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  medium:  { label: "中",   color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  low:     { label: "低",   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  unknown: { label: "不明", color: "text-gray-500",   bg: "bg-gray-50 border-gray-200" },
};

const RISKS = [
  { key: "flood" as const,      icon: "🌊", label: "洪水" },
  { key: "landslide" as const,  icon: "⛰️",  label: "土砂災害" },
  { key: "tsunami" as const,    icon: "🌊", label: "津波" },
  { key: "stormSurge" as const, icon: "🌀", label: "高潮" },
];

export default function RiskCard({ hazardData }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        📍 {hazardData.areaName} の災害リスク評価
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        出典：国土交通省 不動産情報ライブラリ / 更新: {hazardData.updatedAt?.slice(0, 10) ?? "—"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RISKS.map(({ key, icon, label }) => {
          const r = hazardData[key];
          const style = RISK_LABELS[r.risk];
          return (
            <div key={key} className={`border rounded-xl p-3 ${style.bg}`}>
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-sm font-medium text-gray-700">{label}</div>
              <div className={`text-xl font-bold mt-1 ${style.color}`}>{style.label}</div>
              <p className="text-xs text-gray-500 mt-1 leading-snug">{r.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

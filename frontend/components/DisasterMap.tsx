"use client";

import { useEffect, useRef, useState } from "react";
import { HazardData } from "@/lib/types";

interface Props {
  lat: number;
  lng: number;
  hazardData: HazardData;
}

const LAYER_COLORS: Record<string, string> = {
  flood:      "#3b82f6",
  landslide:  "#f97316",
  tsunami:    "#06b6d4",
  stormSurge: "#8b5cf6",
};

export default function DisasterMap({ lat, lng, hazardData }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("maplibre-gl").Map | null>(null);
  const [layers, setLayers] = useState({
    flood: true,
    landslide: true,
    tsunami: true,
    stormSurge: true,
    shelters: true,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    let map: import("maplibre-gl").Map;

    import("maplibre-gl").then((ml) => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      map = new ml.default.Map({
        container: mapRef.current!,
        style: {
          version: 8,
          sources: {
            gsi: {
              type: "raster",
              tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© 国土地理院",
            },
          },
          layers: [{ id: "gsi-layer", type: "raster", source: "gsi" }],
        },
        center: [lng, lat],
        zoom: 13,
      });
      mapInstance.current = map;

      map.on("load", () => {
        // Search location marker
        new ml.default.Marker({ color: "#ef4444" })
          .setLngLat([lng, lat])
          .setPopup(new ml.default.Popup().setText(hazardData.areaName))
          .addTo(map);

        // Shelter markers
        hazardData.shelters.forEach((s) => {
          new ml.default.Marker({ color: "#22c55e", scale: 0.7 })
            .setLngLat([s.lng, s.lat])
            .setPopup(
              new ml.default.Popup().setHTML(
                `<strong>${s.name}</strong><br/>${s.address}<br/>対応: ${s.types.join("・")}`
              )
            )
            .addTo(map);
        });
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [lat, lng, hazardData]);

  const LAYER_LABELS = [
    { key: "flood" as const,      label: "洪水", color: LAYER_COLORS.flood },
    { key: "landslide" as const,  label: "土砂", color: LAYER_COLORS.landslide },
    { key: "tsunami" as const,    label: "津波", color: LAYER_COLORS.tsunami },
    { key: "stormSurge" as const, label: "高潮", color: LAYER_COLORS.stormSurge },
    { key: "shelters" as const,   label: "避難場所", color: "#22c55e" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">🗺️ ハザードマップ</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {LAYER_LABELS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-opacity ${
              layers[key] ? "opacity-100" : "opacity-40"
            }`}
            style={{ borderColor: color, color }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ background: color }}
            />
            {label}
          </button>
        ))}
      </div>
      <div ref={mapRef} className="w-full rounded-xl overflow-hidden" style={{ height: 380 }} />
      <p className="text-xs text-gray-400 mt-2">
        赤ピン: 検索住所 / 緑ピン: 避難場所（クリックで詳細）
      </p>
    </div>
  );
}

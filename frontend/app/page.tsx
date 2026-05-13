"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AddressSearch from "@/components/AddressSearch";
import RiskCard from "@/components/RiskCard";
import WeatherAlert from "@/components/WeatherAlert";
import ChatPanel from "@/components/ChatPanel";
import { queryDisaster } from "@/lib/api";
import { QueryResponse } from "@/lib/types";

// MapLibreはSSR非対応のためクライアント側のみロード
const DisasterMap = dynamic(() => import("@/components/DisasterMap"), { ssr: false });

export default function Home() {
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedAddress, setSearchedAddress] = useState("");

  async function handleSearch(address: string) {
    setLoading(true);
    setError(null);
    setSearchedAddress(address);
    try {
      const res = await queryDisaster({ address, question: "この地域の総合的な災害リスクを教えてください" });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900">DisasterRAG</h1>
            <p className="text-xs text-gray-500">防災情報AIシステム — 大阪府対応</p>
          </div>
          <div className="ml-auto flex gap-1.5 text-xs text-gray-400">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Gemini 2.0 Flash</span>
            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">気象庁</span>
            <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">国土交通省</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-1">住所を入力するだけで</h2>
          <p className="text-blue-100 text-sm">
            その場所の洪水・土砂災害・津波・高潮リスクをAIが総合解説します。
            気象庁・国土交通省の公式データをリアルタイムで参照。
          </p>
        </div>

        <AddressSearch onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
            <div className="animate-spin text-3xl mb-3">🔄</div>
            住所を解析してリスク情報を取得中です...
          </div>
        )}

        {result && !loading && (
          <>
            <RiskCard hazardData={result.hazardData ?? {
              areaCode: "", areaName: result.areaName,
              updatedAt: "", flood: { risk: "unknown", description: "データなし" },
              landslide: { risk: "unknown", description: "データなし" },
              tsunami: { risk: "unknown", description: "データなし" },
              stormSurge: { risk: "unknown", description: "データなし" },
              shelters: [],
            }} />

            <DisasterMap
              lat={result.lat}
              lng={result.lng}
              hazardData={result.hazardData ?? {
                areaCode: "", areaName: result.areaName,
                updatedAt: "", flood: { risk: "unknown", description: "" },
                landslide: { risk: "unknown", description: "" },
                tsunami: { risk: "unknown", description: "" },
                stormSurge: { risk: "unknown", description: "" },
                shelters: [],
              }}
            />

            {result.weatherData && (
              <WeatherAlert weatherData={result.weatherData} areaName={result.areaName} />
            )}

            <ChatPanel address={searchedAddress} />
          </>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 mt-8">
        © 2025 eggsystems.jp — データ出典：気象庁 / 国土交通省 不動産情報ライブラリ / 国土地理院
      </footer>
    </div>
  );
}

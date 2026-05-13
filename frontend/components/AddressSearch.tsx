"use client";

import { useState } from "react";

interface Props {
  onSearch: (address: string) => void;
  loading: boolean;
}

const PRESET_ADDRESSES = [
  "大阪府大阪市北区梅田1丁目",
  "大阪府大阪市中央区難波",
  "大阪府堺市堺区市之町",
  "大阪府茨木市駅前",
];

export default function AddressSearch({ onSearch, loading }: Props) {
  const [address, setAddress] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (address.trim()) onSearch(address.trim());
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        🔍 住所を入力して災害リスクを確認
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="例: 大阪府大阪市北区梅田1丁目"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "検索中..." : "検索"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESET_ADDRESSES.map((addr) => (
          <button
            key={addr}
            onClick={() => { setAddress(addr); onSearch(addr); }}
            className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-50 transition-colors"
          >
            {addr}
          </button>
        ))}
      </div>
    </div>
  );
}

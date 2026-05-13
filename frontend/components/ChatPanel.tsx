"use client";

import { useState } from "react";
import { queryDisaster } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  address: string;
}

const PRESET_QUESTIONS = [
  "近くの避難場所はどこですか？",
  "この地域の洪水リスクを詳しく教えて",
  "避難するタイミングはいつですか？",
  "ハザードマップの見方を教えて",
  "今発令されている警報・注意報は？",
];

export default function ChatPanel({ address }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await queryDisaster({ address, question: q });
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `エラーが発生しました: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">💬 AIに質問する</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-50 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
                回答を生成中...
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="この地域の防災について質問する..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          送信
        </button>
      </form>
    </div>
  );
}

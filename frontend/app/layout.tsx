import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "DisasterRAG — 防災情報AIシステム",
  description: "住所を入力するだけで、その場所の災害リスクをAIが総合的に解説するシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">{children}</body>
    </html>
  );
}

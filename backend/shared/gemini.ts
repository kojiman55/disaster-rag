import { GoogleGenAI } from "@google/genai";
import { getSecret } from "./secrets";

let genai: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  if (!genai) {
    const apiKey = await getSecret("disaster-rag/gemini-api-key");
    genai = new GoogleGenAI({ apiKey });
  }
  return genai;
}

export async function generateAnswer(prompt: string): Promise<string> {
  const client = await getClient();
  const res = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });
  return res.text ?? "";
}

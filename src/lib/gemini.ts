import { GoogleGenAI } from "@google/genai";

// Model terbaru yang cepat dan pintar
const AI_MODEL = "gemini-3-flash-preview";

export interface OnboardingData {
  major: string;
  year: string;
  location: string;
  hobbies: string;
  futurePlans?: string;
  language: 'id' | 'en';
}

export async function generateThesisResponse(
  messages: { role: 'user' | 'model'; parts: { text: string }[] }[],
  onboarding: OnboardingData
) {
  // CARA AMAN: Cek Vercel/Vite dulu, lalu fallback ke AI Studio
  // Kita pakai pengecekan 'typeof process' agar browser tidak crash di Vercel
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                 (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
  
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan. Pastikan VITE_GEMINI_API_KEY sudah diset di Vercel Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: messages as any,
      config: {
        systemInstruction: `
You are SkripsiMate, a specialized AI assistant that helps university students brainstorm thesis (skripsi) topics and titles.
Your goal is to "open their ideas so they can think of more ideas."

USER PROFILE:
- Major: ${onboarding.major}
- Current Year: ${onboarding.year}
- Location: ${onboarding.location}
- Hobbies: ${onboarding.hobbies}
- Future Plans: ${onboarding.futurePlans || "No specific plans mentioned"}
- Primary Language: ${onboarding.language === 'id' ? 'Indonesian (Bahasa Indonesia)' : 'English'}

GUIDELINES:
1. Always suggest 3-5 creative thesis titles/topics.
2. For each suggestion, explain relevancy to their major, hobbies, location, and future plans.
3. Maintain a supportive, inspiring, and academic yet friendly tone.
4. Use ${onboarding.language === 'id' ? 'Bahasa Indonesia' : 'English'}.

FORMAT:
Use clean Markdown. Use headers, bullet points, and bold text.
`,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    // Memberikan info error yang jelas di layar jika ada masalah key
    if (error.message?.includes("API_KEY_INVALID")) {
      return "Error: API Key Gemini tidak valid. Periksa kembali di dashboard Vercel.";
    }
    throw error;
  }
}

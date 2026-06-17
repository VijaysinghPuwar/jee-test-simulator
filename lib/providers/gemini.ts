import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "gemini-2.0-flash";

export const parseWithGemini: ParseFn = async (input, apiKey) => {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(
    buildUserPrompt(input.questionPaperText, input.answerKeyText)
  );
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no content");
  return text;
};

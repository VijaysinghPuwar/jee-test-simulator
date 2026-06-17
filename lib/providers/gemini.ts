import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "gemini-2.0-flash";

export const parseWithGemini: ParseFn = async (input, apiKey) => {
  const client = new GoogleGenerativeAI(apiKey);
  const system = input.subject
    ? subjectSystemPrompt(input.subject)
    : SYSTEM_PROMPT_BASE;
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: system,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 16000,
    },
  });
  const result = await model.generateContent(
    buildUserPrompt(input.questionPaperText, input.answerKeyText, input.subject)
  );
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no content");
  return text;
};

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import { pageImageContext, parseImageDataUrl } from "./image-input";
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
  const questionPages = input.questionPaperPageImages ?? [];
  const answerPages = input.answerKeyPageImages ?? [];
  const parts: Array<Record<string, unknown>> = [
    {
      text: buildUserPrompt(
        input.questionPaperText,
        input.answerKeyText,
        input.subject,
        pageImageContext(questionPages, answerPages)
      ),
    },
  ];
  for (const page of questionPages) {
    const image = parseImageDataUrl(page.dataUrl);
    parts.push(
      { text: `Question paper page ${page.pageNumber}` },
      {
        inlineData: {
          data: image.base64,
          mimeType: image.mediaType,
        },
      }
    );
  }
  for (const page of answerPages) {
    const image = parseImageDataUrl(page.dataUrl);
    parts.push(
      { text: `Answer key / solutions page ${page.pageNumber}` },
      {
        inlineData: {
          data: image.base64,
          mimeType: image.mediaType,
        },
      }
    );
  }
  const result = await model.generateContent(parts as never);
  const text = result.response.text();
  if (!text) throw new Error("Gemini returned no content");
  return text;
};

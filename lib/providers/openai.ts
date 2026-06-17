import OpenAI from "openai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import { pageImageContext } from "./image-input";
import type { ParseFn } from "./index";

const MODEL = "gpt-4.1-mini";

export const parseWithOpenAI: ParseFn = async (input, apiKey) => {
  const client = new OpenAI({ apiKey });
  const system = input.subject
    ? subjectSystemPrompt(input.subject)
    : SYSTEM_PROMPT_BASE;
  const questionPages = input.questionPaperPageImages ?? [];
  const answerPages = input.answerKeyPageImages ?? [];
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildUserPrompt(
        input.questionPaperText,
        input.answerKeyText,
        input.subject,
        pageImageContext(questionPages, answerPages)
      ),
    },
  ];
  for (const page of questionPages) {
    userContent.push(
      { type: "text", text: `Question paper page ${page.pageNumber}` },
      {
        type: "image_url",
        image_url: { url: page.dataUrl, detail: "high" },
      }
    );
  }
  for (const page of answerPages) {
    userContent.push(
      { type: "text", text: `Answer key / solutions page ${page.pageNumber}` },
      {
        type: "image_url",
        image_url: { url: page.dataUrl, detail: "high" },
      }
    );
  }
  const res = await client.chat.completions.create(
    {
      model: MODEL,
      response_format: { type: "json_object" },
      max_tokens: 12000,
      messages: [
        {
          role: "system",
          content: `${system}\n\nIMPORTANT: This endpoint requires a JSON object. Wrap your JSON array inside an object as {"questions": [...]}. The "questions" array MUST contain all requested items.`,
        },
        {
          role: "user",
          content: userContent as never,
        },
      ],
    },
    input.signal ? { signal: input.signal } : undefined
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return content;
};

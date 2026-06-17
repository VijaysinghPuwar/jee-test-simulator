import OpenAI from "openai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "gpt-4.1-mini";

export const parseWithOpenAI: ParseFn = async (input, apiKey) => {
  const client = new OpenAI({ apiKey });
  const system = input.subject
    ? subjectSystemPrompt(input.subject)
    : SYSTEM_PROMPT_BASE;
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
          content: buildUserPrompt(
            input.questionPaperText,
            input.answerKeyText,
            input.subject
          ),
        },
      ],
    },
    input.signal ? { signal: input.signal } : undefined
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return content;
};

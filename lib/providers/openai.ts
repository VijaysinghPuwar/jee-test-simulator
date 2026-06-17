import OpenAI from "openai";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "gpt-4.1-mini";

export const parseWithOpenAI: ParseFn = async (input, apiKey) => {
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nIMPORTANT: Wrap the JSON array inside an object as {"questions": [...]} since this endpoint requires a JSON object.`,
      },
      {
        role: "user",
        content: buildUserPrompt(input.questionPaperText, input.answerKeyText),
      },
    ],
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");
  return content;
};

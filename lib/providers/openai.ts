import OpenAI from "openai";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSectionSystemPrompt,
  subjectSystemPrompt,
} from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "gpt-4.1-mini";

export const parseWithOpenAI: ParseFn = async (input, apiKey) => {
  const client = new OpenAI({ apiKey });
  const system =
    input.subject && input.section
      ? subjectSectionSystemPrompt(input.subject, input.section)
      : input.subject
        ? subjectSystemPrompt(input.subject)
        : SYSTEM_PROMPT_BASE;
  const res = await client.chat.completions.create(
    {
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${system}\n\nIMPORTANT: This endpoint requires a JSON object. Wrap your JSON array inside an object as {"questions": [...]}.`,
        },
        {
          role: "user",
          content: buildUserPrompt(
            input.questionPaperText,
            input.answerKeyText,
            input.subject,
            input.section
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

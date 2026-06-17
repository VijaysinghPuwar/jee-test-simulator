import Anthropic from "@anthropic-ai/sdk";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "claude-sonnet-4-6";

export const parseWithAnthropic: ParseFn = async (input, apiKey) => {
  const client = new Anthropic({ apiKey });
  const system = input.subject
    ? subjectSystemPrompt(input.subject)
    : SYSTEM_PROMPT_BASE;
  const msg = await client.messages.create(
    {
      model: MODEL,
      max_tokens: input.subject ? 6000 : 16000,
      system,
      messages: [
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
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }
  return text.text;
};

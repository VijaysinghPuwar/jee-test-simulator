import Anthropic from "@anthropic-ai/sdk";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ParseFn } from "./index";

const MODEL = "claude-sonnet-4-6";

export const parseWithAnthropic: ParseFn = async (input, apiKey) => {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(input.questionPaperText, input.answerKeyText),
      },
    ],
  });
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }
  return text.text;
};

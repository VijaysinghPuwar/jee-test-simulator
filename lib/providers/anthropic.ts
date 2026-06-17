import Anthropic from "@anthropic-ai/sdk";
import {
  buildUserPrompt,
  SYSTEM_PROMPT_BASE,
  subjectSystemPrompt,
} from "./prompt";
import { pageImageContext, parseImageDataUrl } from "./image-input";
import type { ParseFn } from "./index";

const MODEL = "claude-sonnet-4-6";

export const parseWithAnthropic: ParseFn = async (input, apiKey) => {
  const client = new Anthropic({ apiKey });
  const system = input.subject
    ? subjectSystemPrompt(input.subject)
    : SYSTEM_PROMPT_BASE;
  const questionPages = input.questionPaperPageImages ?? [];
  const answerPages = input.answerKeyPageImages ?? [];
  const content: Array<Record<string, unknown>> = [
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
    const image = parseImageDataUrl(page.dataUrl);
    content.push(
      { type: "text", text: `Question paper page ${page.pageNumber}` },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.base64,
        },
      }
    );
  }
  for (const page of answerPages) {
    const image = parseImageDataUrl(page.dataUrl);
    content.push(
      { type: "text", text: `Answer key / solutions page ${page.pageNumber}` },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.base64,
        },
      }
    );
  }
  const msg = await client.messages.create(
    {
      model: MODEL,
      max_tokens: input.subject ? 12000 : 32000,
      system,
      messages: [
        {
          role: "user",
          content: content as never,
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

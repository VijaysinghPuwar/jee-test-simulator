import type { Provider } from "@/lib/key-store";
import { parseWithAnthropic } from "./anthropic";
import { parseWithOpenAI } from "./openai";
import { parseWithGemini } from "./gemini";

export interface ParseInput {
  questionPaperText: string;
  answerKeyText: string;
}

export type ParseFn = (input: ParseInput, apiKey: string) => Promise<string>;

const PROVIDER_FNS: Record<Provider, ParseFn> = {
  anthropic: parseWithAnthropic,
  openai: parseWithOpenAI,
  gemini: parseWithGemini,
};

export async function parseWithProvider(
  provider: Provider,
  apiKey: string,
  input: ParseInput
): Promise<string> {
  const fn = PROVIDER_FNS[provider];
  if (!fn) throw new Error(`Unsupported provider: ${provider}`);
  return fn(input, apiKey);
}

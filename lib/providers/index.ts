import type { Provider } from "@/lib/key-store";
import type { Subject } from "@/lib/types";
import { parseWithAnthropic } from "./anthropic";
import { parseWithOpenAI } from "./openai";
import { parseWithGemini } from "./gemini";
import type { PageImageInput } from "./image-input";

export interface ParseInput {
  questionPaperText: string;
  answerKeyText: string;
  questionPaperPageImages?: PageImageInput[];
  answerKeyPageImages?: PageImageInput[];
  subject?: Subject;
  signal?: AbortSignal;
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

import { z } from "zod";

export const ProviderSchema = z.enum(["anthropic", "openai", "gemini"]);

export const SaveKeySchema = z.object({
  provider: ProviderSchema,
  apiKey: z
    .string()
    .min(8, "API key looks too short")
    .max(512, "API key looks too long"),
});

export const TestTypeSchema = z.enum(["JEE_MAIN"]);

export const ParseRequestSchema = z.object({
  testType: TestTypeSchema.default("JEE_MAIN"),
  questionPaperText: z.string().min(50).max(200_000),
  answerKeyText: z.string().min(10).max(200_000),
});

export const QuestionSchema = z.object({
  id: z.string().min(1).max(16),
  subject: z.enum(["Mathematics", "Physics", "Chemistry"]),
  section: z.enum(["I", "II"]),
  type: z.enum(["mcq", "numerical"]),
  questionText: z.string().min(1).max(4000),
  options: z.array(z.string().max(1000)).length(4).optional(),
  correctAnswer: z.string().max(200),
});

export const QuestionsArraySchema = z.array(QuestionSchema).min(1).max(200);

export type ParseRequest = z.infer<typeof ParseRequestSchema>;
export type ValidatedQuestion = z.infer<typeof QuestionSchema>;

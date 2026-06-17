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

export const PageImageSchema = z.object({
  pageNumber: z.number().int().positive().max(200),
  text: z.string().max(8000),
  dataUrl: z
    .string()
    .max(150_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Invalid page image"),
});

export const ParseRequestSchema = z.object({
  testType: TestTypeSchema.default("JEE_MAIN"),
  questionPaperText: z.string().min(50).max(120_000),
  answerKeyText: z.string().min(10).max(120_000),
  questionPaperPageImages: z.array(PageImageSchema).max(40).optional(),
  answerKeyPageImages: z.array(PageImageSchema).max(40).optional(),
});

export const QuestionSchema = z.object({
  id: z.string().min(1).max(16),
  subject: z.enum(["Mathematics", "Physics", "Chemistry"]),
  section: z.enum(["I", "II"]),
  type: z.enum(["mcq", "numerical"]),
  questionText: z.string().min(1).max(4000),
  options: z.array(z.string().min(1).max(1000)).length(4).optional(),
  correctAnswer: z.string().max(200),
});

export const QuestionsArraySchema = z.array(QuestionSchema).min(1).max(200);

export type ParseRequest = z.infer<typeof ParseRequestSchema>;
export type ValidatedQuestion = z.infer<typeof QuestionSchema>;

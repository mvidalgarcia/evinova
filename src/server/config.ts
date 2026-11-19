import { z } from "zod";
import { createFakeClient } from "./llm/fake";
import type { LlmClient } from "./llm/client";
import { createOpenAiClient } from "./llm/openai";

const MODEL_TIMEOUT_MS = 15_000;

const EnvSchema = z.discriminatedUnion("LLM_PROVIDER", [
  z.object({
    LLM_PROVIDER: z.literal("openai"),
    LLM_BASE_URL: z.url().default("https://api.groq.com/openai/v1"),
    LLM_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
    LLM_API_KEY: z.string().min(1, "LLM_API_KEY is required unless LLM_PROVIDER=fake"),
  }),
  z.object({ LLM_PROVIDER: z.literal("fake") }),
]);

/** Fails at startup on a bad configuration; never falls back to the fake silently. */
export function createLlmClientFromEnv(env: NodeJS.ProcessEnv = process.env): LlmClient {
  const parsed = EnvSchema.safeParse({ ...env, LLM_PROVIDER: env.LLM_PROVIDER ?? "openai" });
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const config = parsed.data;
  if (config.LLM_PROVIDER === "fake") {
    console.warn("LLM_PROVIDER=fake: extractions come from keyword rules, not a model.");
    return createFakeClient();
  }
  return createOpenAiClient({
    baseURL: config.LLM_BASE_URL,
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL,
    timeoutMs: MODEL_TIMEOUT_MS,
  });
}

import type { LlmClient } from "./client";

/** Opt-in offline stand-in (LLM_PROVIDER=fake): the same valid reply for every submission. */
const FAKE_REPLY = JSON.stringify({
  category: "other",
  sentiment: "neutral",
  severity: "low",
  summary: "Fixed extraction from the offline fake model.",
  suggestedAction: "Set LLM_PROVIDER=openai and LLM_API_KEY for real extraction.",
});

export function createFakeClient(): LlmClient {
  return {
    complete: async (_prompt: string): Promise<string> => FAKE_REPLY,
  };
}

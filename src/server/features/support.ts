import { z } from "zod";
import { FeedbackRecordSchema } from "../../contract/feedback";
import type { createApp } from "../app";
import type { LlmClient } from "../llm/client";

type App = ReturnType<typeof createApp>;

/** Invented feedback; never real personal or health data. */
export const VALID_FEEDBACK =
  "The export button on the reports page does nothing when I click it.";

export const VALID_EXTRACTION = {
  category: "bug",
  sentiment: "negative",
  severity: "medium",
  summary: "The export button on the reports page does not respond.",
  suggestedAction: "Check the click handler of the reports export button.",
};

/**
 * Fakes only the model's raw response, so tests still exercise the prompt,
 * JSON parsing, the Zod gate and the retry. Returns `responses` in order and
 * repeats the last one once they run out.
 */
export function scriptedLlm(responses: readonly string[]) {
  const prompts: string[] = [];
  const client: LlmClient = {
    complete: async (prompt: string): Promise<string> => {
      prompts.push(prompt);
      const index = Math.min(prompts.length, responses.length) - 1; // repeat the last response
      const response = responses[index];
      if (response === undefined) throw new Error("scriptedLlm needs at least one response");
      return response;
    },
  };
  return { client, prompts };
}

export function submitFeedback(app: App, text: string): Promise<Response> {
  return Promise.resolve(
    app.request("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }),
  );
}

export async function listRecords(app: App) {
  const response = await app.request("/api/feedback");
  return z.array(FeedbackRecordSchema).parse(await response.json());
}

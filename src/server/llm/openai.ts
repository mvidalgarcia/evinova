import OpenAI, { APIConnectionError, InternalServerError, RateLimitError } from "openai";
import { z } from "zod";
import { ExtractionSchema } from "../../contract/feedback";
import { type LlmClient, LlmUnavailableError } from "./client";

export type OpenAiClientConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Injected in tests to simulate provider failures. */
  fetch?: typeof fetch;
};

// Strict structured outputs use the schema generated from the contract, so the two can't drift.
const { $schema: _draft, ...extractionJsonSchema } = z.toJSONSchema(ExtractionSchema);

/** Timeouts, network errors, 429 and 5xx: the provider is struggling, not us. */
function isUnavailable(err: unknown): boolean {
  // APIConnectionTimeoutError is a subclass of APIConnectionError.
  return (
    err instanceof APIConnectionError ||
    err instanceof RateLimitError ||
    err instanceof InternalServerError
  );
}

export function createOpenAiClient(config: OpenAiClientConfig): LlmClient {
  const openai = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
    maxRetries: 0, // our code owns the whole retry policy
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });

  return {
    complete: async (prompt: string): Promise<string> => {
      try {
        const completion = await openai.chat.completions.create({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: { name: "extraction", strict: true, schema: extractionJsonSchema },
          },
        });
        // An empty reply fails the Zod gate like any other invalid output.
        return completion.choices[0]?.message.content ?? "";
      } catch (err) {
        if (isUnavailable(err)) throw new LlmUnavailableError("The model is unavailable.", { cause: err });
        throw err; // 400/401/403/404: our misconfiguration, surfaces as 500
      }
    },
  };
}

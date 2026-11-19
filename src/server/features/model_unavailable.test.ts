import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { ApiErrorSchema } from "../../contract/api-error";
import { createApp } from "../app";
import { createOpenAiClient } from "../llm/openai";
import { exampleFixture, listRecords, submitFeedback, VALID_FEEDBACK } from "./support";

const feature = await loadFeature("src/server/features/model_unavailable.feature");

const TIMEOUT_MS = 50;

function errorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: { message: `provider returned ${status}` } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Fake provider behaviours, at the HTTP level so the real SDK client handles them. */
const FAILURES: Record<string, (init?: RequestInit) => Promise<Response>> = {
  "a timeout": (init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }),
  "a 429 response": async () => errorResponse(429),
  "a 500 response": async () => errorResponse(500),
  "a network error": async () => {
    throw new TypeError("fetch failed");
  },
};

describeFeature(feature, ({ ScenarioOutline }) => {
  ScenarioOutline(
    "An unavailable model is not retried and nothing is stored",
    ({ Given, When, Then, And }, variables) => {
      let calls = 0;
      let app: ReturnType<typeof createApp>;
      let response: Response;

      Given("the model provider fails with <failure>", () => {
        const fail = exampleFixture(FAILURES, variables.failure);
        const llm = createOpenAiClient({
          baseURL: "https://provider.invalid/v1",
          apiKey: "test-key",
          model: "test-model",
          timeoutMs: TIMEOUT_MS,
          fetch: (_input, init) => {
            calls += 1;
            return fail(init);
          },
        });
        app = createApp({ llm });
      });

      When("I submit valid feedback", async () => {
        response = await submitFeedback(app, VALID_FEEDBACK);
      });

      Then('the response status is 503 with error code "MODEL_UNAVAILABLE"', async () => {
        expect(response.status).toBe(503);
        const body = ApiErrorSchema.parse(await response.json());
        expect(body.error.code).toBe("MODEL_UNAVAILABLE");
      });

      And("the model was called 1 time", () => {
        expect(calls).toBe(1);
      });

      And("no record is stored", async () => {
        expect(await listRecords(app)).toEqual([]);
      });
    },
  );
});

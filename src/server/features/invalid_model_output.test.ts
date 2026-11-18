import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { ApiErrorSchema } from "../../contract/api-error";
import { createApp } from "../app";
import {
  listRecords,
  scriptedLlm,
  submitFeedback,
  VALID_EXTRACTION,
  VALID_FEEDBACK,
} from "./support";

const feature = await loadFeature("src/server/features/invalid_model_output.feature");

const { severity: _omitted, ...missingSeverity } = VALID_EXTRACTION;

const INVALID_OUTPUTS: Record<string, string> = {
  "text that is not JSON": "Sure! Here is the extraction you asked for.",
  'JSON missing the "severity" field': JSON.stringify(missingSeverity),
  'a "category" outside the allowed values': JSON.stringify({
    ...VALID_EXTRACTION,
    category: "complaint",
  }),
};

describeFeature(feature, ({ Scenario, ScenarioOutline }) => {
  ScenarioOutline(
    "Invalid model output is rejected and nothing is stored",
    ({ Given, When, Then, And }, variables) => {
      let llm: ReturnType<typeof scriptedLlm>;
      let app: ReturnType<typeof createApp>;
      let response: Response;

      Given("the model returns <output> on every attempt", () => {
        const name: unknown = variables.output;
        const output = typeof name === "string" ? INVALID_OUTPUTS[name] : undefined;
        if (output === undefined) throw new Error(`No fixture for output ${String(name)}`);
        llm = scriptedLlm([output]);
        app = createApp({ llm: llm.client });
      });

      When("I submit valid feedback", async () => {
        response = await submitFeedback(app, VALID_FEEDBACK);
      });

      Then('the response status is 502 with error code "EXTRACTION_INVALID"', async () => {
        expect(response.status).toBe(502);
        const body = ApiErrorSchema.parse(await response.json());
        expect(body.error.code).toBe("EXTRACTION_INVALID");
      });

      And("the model was called 2 times", () => {
        expect(llm.prompts).toHaveLength(2);
      });

      And("no record is stored", async () => {
        expect(await listRecords(app)).toEqual([]);
      });
    },
  );

  Scenario("The model recovers on the repair retry", ({ Given, When, Then, And }) => {
    let llm: ReturnType<typeof scriptedLlm>;
    let app: ReturnType<typeof createApp>;
    let response: Response;

    Given("the model returns invalid output first and a valid extraction second", () => {
      llm = scriptedLlm(["not JSON at all", JSON.stringify(VALID_EXTRACTION)]);
      app = createApp({ llm: llm.client });
    });

    When("I submit valid feedback", async () => {
      response = await submitFeedback(app, VALID_FEEDBACK);
    });

    Then("the response status is 201", () => {
      expect(response.status).toBe(201);
    });

    And("the model was called 2 times", () => {
      expect(llm.prompts).toHaveLength(2);
    });
  });
});

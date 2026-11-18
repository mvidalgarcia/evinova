import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";
import { type FeedbackRecord, FeedbackRecordSchema } from "../../contract/feedback";
import { createApp } from "../app";
import { scriptedLlm, submitFeedback, VALID_EXTRACTION, VALID_FEEDBACK } from "./support";

const feature = await loadFeature("src/server/features/submit_feedback.feature");

/** Server-owned values the model must not be able to set. Valid by format, so only provenance can reject them. */
const MODEL_ID = "fb_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const MODEL_STATUS = "resolved";

describeFeature(feature, ({ Scenario }) => {
  Scenario("A valid submission produces a conforming record", ({ Given, When, Then, And }) => {
    let app: ReturnType<typeof createApp>;
    let response: Response;
    let record: FeedbackRecord;
    let submittedFrom: number;
    let submittedTo: number;

    Given('the model returns a valid extraction that also contains "id" and "status" values', () => {
      const output = JSON.stringify({ ...VALID_EXTRACTION, id: MODEL_ID, status: MODEL_STATUS });
      app = createApp({ llm: scriptedLlm([output]).client });
    });

    When("I submit valid feedback", async () => {
      submittedFrom = Date.now();
      response = await submitFeedback(app, VALID_FEEDBACK);
      submittedTo = Date.now();
    });

    Then("the response status is 201", () => {
      expect(response.status).toBe(201);
    });

    And("the response body satisfies the FeedbackRecord contract", async () => {
      record = FeedbackRecordSchema.parse(await response.json());
      expect(record).toMatchObject({ ...VALID_EXTRACTION, text: VALID_FEEDBACK });
    });

    And("the id, submittedAt and status are server-generated, not taken from the model", () => {
      expect(record.id).not.toBe(MODEL_ID);
      expect(record.status).toBe("new");
      const submittedAt = Date.parse(record.submittedAt);
      expect(submittedAt).toBeGreaterThanOrEqual(submittedFrom);
      expect(submittedAt).toBeLessThanOrEqual(submittedTo);
    });
  });
});

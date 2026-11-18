import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ulid } from "ulid";
import { z } from "zod";
import type { ApiError, ErrorCode } from "../contract/api-error";
import { type FeedbackRecord, FeedbackInputSchema, FeedbackRecordSchema } from "../contract/feedback";
import { extract } from "./extraction";
import { type LlmClient, LlmUnavailableError } from "./llm/client";
import { createMemoryStore, type FeedbackStore } from "./store";

export type AppDeps = {
  llm: LlmClient;
  store?: FeedbackStore;
  now?: () => Date;
};

function apiError(code: ErrorCode, message: string, details?: unknown): ApiError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function createApp({ llm, store = createMemoryStore(), now = () => new Date() }: AppDeps) {
  const app = new Hono()
    .post(
      "/api/feedback",
      zValidator("json", FeedbackInputSchema, (result, c) => {
        if (!result.success) {
          return c.json(apiError("INVALID_INPUT", "Invalid feedback.", result.error.issues), 400);
        }
      }),
      async (c) => {
        const { text } = c.req.valid("json");
        const result = await extract(llm, text);
        if (!result.ok) {
          return c.json(
            apiError("EXTRACTION_INVALID", "The model's output did not satisfy the contract.", result.issues),
            502,
          );
        }
        // Server-owned fields are set here, never taken from the model.
        const record: FeedbackRecord = FeedbackRecordSchema.parse({
          ...result.extraction,
          id: `fb_${ulid()}`,
          submittedAt: now().toISOString(),
          status: "new",
          text,
        });
        store.add(record);
        return c.json(record, 201);
      },
    )
    .get("/api/feedback", (c) => c.json(z.array(FeedbackRecordSchema).parse(store.list()), 200))
    .get("/api/feedback/:id", (c) => {
      const record = store.get(c.req.param("id"));
      if (!record) return c.json(apiError("NOT_FOUND", "Feedback not found."), 404);
      return c.json(FeedbackRecordSchema.parse(record), 200);
    });

  app.notFound((c) => c.json(apiError("NOT_FOUND", "Route not found."), 404));

  app.onError((err, c) => {
    if (err instanceof LlmUnavailableError) {
      return c.json(apiError("MODEL_UNAVAILABLE", "The model is unavailable. Try again later."), 503);
    }
    if (err instanceof HTTPException && err.status === 400) {
      // e.g. a body that is not JSON, rejected before the validator hook runs
      return c.json(apiError("INVALID_INPUT", err.message), 400);
    }
    console.error(err);
    return c.json(apiError("INTERNAL_ERROR", "Unexpected error."), 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;

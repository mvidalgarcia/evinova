import { hc } from "hono/client";
import { z } from "zod";
import { ApiErrorSchema, type ErrorCode } from "../contract/api-error";
import { type FeedbackRecord, FeedbackRecordSchema } from "../contract/feedback";
import type { AppType } from "../server/app";

// Typed from the server routes; type-only import, so no server code reaches the bundle.
const client = hc<AppType>("/");

export type SubmitResult = { ok: true } | { ok: false; message: string };

/** What the person sees for each API error code. */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "Please check your feedback and try again.",
  NOT_FOUND: "Something went wrong. Please try again.",
  EXTRACTION_INVALID: "We couldn't process your feedback this time. Please try again.",
  MODEL_UNAVAILABLE: "We're busy right now. Please try again in a minute.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again later.",
};
const UNKNOWN_ERROR = "Something went wrong. Please try again.";
const NETWORK_ERROR = "Can't reach the server. Check your connection and try again.";

export async function submitFeedback(text: string): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await client.api.feedback.$post({ json: { text } });
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  if (response.ok) return { ok: true };

  // Validate the error body too: a proxy or gateway may answer with something else.
  const body: unknown = await response.json().catch(() => null);
  const parsed = ApiErrorSchema.safeParse(body);
  return { ok: false, message: parsed.success ? ERROR_MESSAGES[parsed.data.error.code] : UNKNOWN_ERROR };
}

export type ListResult = { ok: true; records: FeedbackRecord[] } | { ok: false; message: string };

export async function listFeedback(): Promise<ListResult> {
  let response: Response;
  try {
    response = await client.api.feedback.$get();
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
  const body: unknown = await response.json().catch(() => null);
  // Records are validated on the way in too, so the UI never renders an off-contract record.
  const records = z.array(FeedbackRecordSchema).safeParse(body);
  if (response.ok && records.success) return { ok: true, records: records.data };
  const error = ApiErrorSchema.safeParse(body);
  return { ok: false, message: error.success ? ERROR_MESSAGES[error.data.error.code] : UNKNOWN_ERROR };
}

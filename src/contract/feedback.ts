import { z } from "zod";

export const FeedbackInputSchema = z.object({
  text: z.string().trim().min(10).max(2000),
});
export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

const ShortText = z.string().trim().min(1).max(200);

/** Fields the model produces. Everything else on a record is set by our code. */
export const ExtractionSchema = z.object({
  category: z.enum(["bug", "feature_request", "praise", "other"]),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  severity: z.enum(["low", "medium", "high"]),
  summary: ShortText,
  suggestedAction: ShortText,
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export const FeedbackRecordSchema = ExtractionSchema.extend({
  /** `fb_` + ULID (Crockford base32), sortable by time. */
  id: z.string().regex(/^fb_[0-9A-HJKMNP-TV-Z]{26}$/),
  /** ISO 8601 in UTC (`Z` suffix). */
  submittedAt: z.iso.datetime(),
  status: z.enum(["new", "triaged", "resolved"]),
  text: FeedbackInputSchema.shape.text,
});
export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "NOT_FOUND",
  "EXTRACTION_INVALID",
  "MODEL_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** The one shape every error leaves the API in. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

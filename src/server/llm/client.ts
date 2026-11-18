/** The only seam to the model: send a prompt, get its raw text back. */
export interface LlmClient {
  complete: (prompt: string) => Promise<string>;
}

/** The model could not be reached (timeout, 429, 5xx, network). Maps to 503, never retried. */
export class LlmUnavailableError extends Error {
  override readonly name = "LlmUnavailableError";
}

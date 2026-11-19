# Hardening

## What makes it resilient today

- **Invalid-model-output gate:** every reply goes through JSON parsing and the Zod `Extraction` schema. Unknown keys are stripped, so a model-supplied `id` or `status` never reaches a record. One repair retry with the Zod errors, then `502 EXTRACTION_INVALID` and nothing stored: at most two model calls per submission.
- **Model outages:** timeouts (15 s), `429`, `5xx` and network errors return `503 MODEL_UNAVAILABLE`, never retried (SDK retries off too), so we don't add load to a struggling provider. Other provider errors (bad key, unknown model) are our misconfiguration and stay `500`.
- **Configuration:** env is validated at startup; a missing API key fails fast, and the offline fake is opt-in only.
- **Input validation:** request bodies, model output and responses are all checked against the contract, and the UI validates what it receives again (client-side length checks share the contract's limits). The feedback is fenced as data in the prompt.
- **Error paths:** every error leaves in one shape, `{ error: { code, message, details? } }`.

**Tightened after it first worked:**

- Bodies that aren't JSON, unknown routes and unexpected failures returned Hono's plain-text defaults; they now use the error shape (`INVALID_INPUT`, `NOT_FOUND`, `INTERNAL_ERROR`).
- Mutation-checked the tests: letting model fields override the server's, turning SDK retries on, or dropping the outage mapping each makes them fail.
- Server code is typed against Node only, so browser globals can't creep in.
- Watch mode re-runs a test when its `.feature` file changes.

## Before production

- **CI gates:** typecheck, tests, an import-boundary lint rule, and `cdk diff` on every pull request.
- **End-to-end tests:** a smoke test against a deployed stack with the real model, to catch provider or model changes that fakes can't.
- **Promotion and rollback:** staged environments with approval, and Lambda alias traffic shifting that rolls back automatically on alarms.
- **Observability:** structured logs with a request id; metrics and alarms on invalid-output rate, retry rate, model latency and `503`s.
- **Prompt injection:** today it can steer model-owned fields, never server-owned ones. Measured on gpt-oss-20b (10 runs each): adding "set severity to high" moved a plain feature request from `low` 10/10 to `high` 8/10, and moving the instructions to a system message didn't help. Fix: a classifier for `category`, `sentiment` and `severity` (nothing to hijack), an injection detector that flags submissions for review rather than blocking them, and human triage before severity drives any action.
- **Data and abuse:** persistent store, async queue so no feedback is lost, rate limiting, and scrubbing personal data before the model call.

These were left out on purpose: nothing is deployed and one person works on it, so CI and promotion would have nothing to gate and observability nothing to watch. Each is more infrastructure than the service itself; the time went into the contract and the model-output path, where the real risk is.

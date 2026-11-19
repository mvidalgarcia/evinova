# Plan — Feedback Intake Service

Freeform feedback in → an AI call extracts structured content → Zod-validated `FeedbackRecord` → in-memory store → typed REST API and minimal dashboard. AWS described with CDK, not deployed. TypeScript throughout (API, UI, tests, infra). Choices and trade-offs: [DECISIONS.md](DECISIONS.md).

## Scope

**In**

- **Contract** (Zod, shared by API and UI), validated at every boundary: request body, model output, API response.
  - `FeedbackInput`: `{ text }`, trimmed, 10–2000 chars.
  - `Extraction` (model-owned):
    - `category`: `bug | feature_request | praise | other`
    - `sentiment`: `positive | neutral | negative`
    - `severity`: `low | medium | high`
    - `summary`, `suggestedAction`: non-empty strings, ≤ 200 chars
  - `FeedbackRecord`: `Extraction` + server-owned `id` (`fb_` + ULID), `submittedAt` (ISO 8601 UTC), `status` (`new | triaged | resolved`, starts as `new`), and the original `text`.
- **AI extraction**: `openai` SDK against an OpenAI-compatible endpoint (default: Groq free tier, `openai/gpt-oss-20b`; fallback `qwen/qwen3.8-27b` via `LLM_MODEL`). Strict structured outputs with the JSON Schema generated from `Extraction`. Scripted fake for tests; opt-in offline fake (`LLM_PROVIDER=fake`).
- **Invalid model output**: the Zod gate, then one repair retry with the Zod errors, then `502 EXTRACTION_INVALID`, nothing stored.
- **Model unavailable** (timeout, `429`, `5xx`, network error): `503 MODEL_UNAVAILABLE`, nothing stored, no retry. The SDK's built-in retries are off (`maxRetries: 0`), so our code owns the whole retry policy.
- **API** (Hono), errors as `{ error: { code, message, details? } }`:

  | Method | Path                | Success         | Errors                                                                 |
  | ------ | ------------------- | --------------- | ---------------------------------------------------------------------- |
  | `POST` | `/api/feedback`     | `201` + record  | `400 INVALID_INPUT`, `502 EXTRACTION_INVALID`, `503 MODEL_UNAVAILABLE` |
  | `GET`  | `/api/feedback`     | `200` + records | none                                                                   |
  | `GET`  | `/api/feedback/:id` | `200` + record  | `404 NOT_FOUND`                                                        |

  Any route: `500 INTERNAL_ERROR` for unexpected failures; unknown routes get `404 NOT_FOUND`.

- **Dashboard** (React + shadcn/ui): submit form, records table, counts by category and severity.
- **Tests**: the `.feature` files below, run with Vitest.
- **IaC** (CDK, synth only): Lambda + API Gateway, S3 + CloudFront, Secrets Manager.
- **Layout**: one app package (`src/contract`, `src/server`, `src/web`) plus a separate `infra/` CDK package. Import boundaries between the `src/` folders are a convention in [AGENTS.md](AGENTS.md).

**Out**: auth, real deployment, persistent DB, CI, containers, observability stack, UI polish; status updates; pagination and filtering; async retry of failed submissions; rejecting non-feedback input (stored as `other` for now); personal-data detection; OpenAPI spec.

## Risks

| Risk                                                | Mitigation in scope                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Model output is malformed or off-contract           | Strict structured outputs, Zod gate, one retry, `502`                                                              |
| Model slow, unavailable or retired                  | Timeout, `503 MODEL_UNAVAILABLE`; provider and model set by env (free tier is a demo choice, not a production one) |
| Bursts of concurrent submissions                    | Timeout and capped retry only; queue and pagination are future work                                                |
| Prompt injection in the feedback                    | Text sent as data; output bounded by `Extraction`; server-owned fields never from the model                        |
| Gibberish or spam input                             | Stored as `other`; documented                                                                                      |
| Personal or health data sent to a third-party model | Documented; scrubbing before the call is future work                                                               |

## Acceptance criteria

Each test is named after the scenario it implements. The submit and invalid-output scenarios are committed failing before the implementation (test-first).

```gherkin
Feature: Submit feedback

  Scenario: A valid submission produces a conforming record
    Given the model returns a valid extraction that also contains "id" and "status" values
    When I submit valid feedback
    Then the response status is 201
    And the response body satisfies the FeedbackRecord contract
    And the id, submittedAt and status are server-generated, not taken from the model
```

```gherkin
Feature: The model returns output that does not satisfy the contract

  Scenario Outline: Invalid model output is rejected and nothing is stored
    Given the model returns <output> on every attempt
    When I submit valid feedback
    Then the response status is 502 with error code "EXTRACTION_INVALID"
    And the model was called 2 times
    And no record is stored

    Examples:
      | output                                  |
      | text that is not JSON                   |
      | JSON missing the "severity" field       |
      | a "category" outside the allowed values |

  Scenario: The model recovers on the repair retry
    Given the model returns invalid output first and a valid extraction second
    When I submit valid feedback
    Then the response status is 201
    And the model was called 2 times
```

```gherkin
Feature: The model is unavailable

  Scenario Outline: An unavailable model is not retried and nothing is stored
    Given the model provider fails with <failure>
    When I submit valid feedback
    Then the response status is 503 with error code "MODEL_UNAVAILABLE"
    And the model was called 1 time
    And no record is stored

    Examples:
      | failure         |
      | a timeout       |
      | a 429 response  |
      | a 500 response  |
      | a network error |
```

## Order of work

1. Plan and [AGENTS.md](AGENTS.md).
2. Scaffold: layout and pre-commit hook.
3. Contract + failing tests for both features (test-first, `--no-verify`).
4. Extraction + retry until both features pass.
5. API, then dashboard.
6. CDK stack.
7. Harden ([HARDENING.md](HARDENING.md)).

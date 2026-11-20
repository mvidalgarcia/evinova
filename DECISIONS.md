# Decisions

Key choices and why. Scope and acceptance criteria are in [PLAN.md](PLAN.md).

## Key choices

**API framework: Hono** (over Express 5 and Next.js)

- `@hono/zod-validator` validates request bodies with the contract's Zod schemas and types them, so validation at the boundary costs no extra code.
- The `hc` client gives the React dashboard types inferred from the server routes. That makes the API typed end to end with no code generation and no hand-shared types.
- Express 5 would need a separate validation layer and hand-written client types for the same result. Next.js was ruled out because deploying it with CDK needs OpenNext, which is more infrastructure than the service warrants.

**Repo layout: one app package plus a separate `infra/` package**

- `src/contract`, `src/server` and `src/web` share one `package.json`, `tsconfig` and Vitest config. The contract is shared by relative import with no build step, and the dashboard's `hc` client imports the server's route types directly. `infra/` is its own pnpm workspace member, so the heavy CDK dependencies stay out of the app.
- The risk of one package is server code (such as the `openai` SDK) leaking into the browser bundle. It's handled by convention: `web` imports only _types_ from `server` (see [AGENTS.md](AGENTS.md)). The risk is small and fails loudly, since type imports are erased at build time and the SDK refuses to run in a browser. The upgrade path is a lint rule (`no-restricted-imports` with `allowTypeImports`).
- Rejected: a pnpm workspace per piece. It gives the strongest boundaries but costs four `package.json` files, project references and per-package scripts, too much for a service this size. I'd move to one once the contract has a second consumer.

**UI: React + shadcn/ui**

- Ready-made table, card, form and badge components cover a functional dashboard with no custom design work. They're copied into the repo as plain code (Tailwind + Radix), so there's no component-library version to manage.

**AI provider and model: Groq's free tier through the `openai` SDK, `openai/gpt-oss-20b`, fallback `qwen/qwen3.8-27b`**

- One OpenAI-compatible client; provider and model are switched by `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`.
- Groq gives a free API key usable from any app, supports strict structured outputs, and by default "does not retain customer data for inference requests". OpenCode Zen was the first choice, but its docs restrict free chat models to the OpenCode app.
- gpt-oss-20b is one of the few Groq models with strict mode (constrained decoding), has production status, is the fastest (~1000 tokens/s), and is enough for picking three enum values and writing two short sentences. qwen3.8-27b is the fallback: a different model family, so it fails differently, though it's a preview model that Groq may discontinue at short notice.
- The free tier is a demo choice: zero cost and an easy key for running it locally. Production would use a paid tier with a data processing agreement, zero data retention and production-status models only.

**Handling model output: prevent, validate, retry once, fail honestly**

- **Prevent and validate:** the request uses strict structured outputs with the JSON Schema generated from `ExtractionSchema` (`z.toJSONSchema()`), so the prompt and validation contracts can't drift. The Zod gate still always runs, because another provider or model set by env may not enforce the schema. Unexpected keys are stripped, not rejected: the record is built only from parsed fields, and failing a response whose required fields are valid is not acceptable.
- **Retry once, then fail:** one repair retry with the Zod errors, a deliberate exception to one model call per submission. Then `502 EXTRACTION_INVALID` and nothing stored. Not losing feedback (store it, retry asynchronously) is future work.
- **Unavailable is not invalid:** timeouts, `429`, `5xx` and network errors return `503 MODEL_UNAVAILABLE` with no retry, since calling again right away only adds load to a provider that is already struggling. The SDK's own retries are off, so one submission makes at most two model calls.

**Tests: Vitest running the `.feature` files with `@amiceli/vitest-cucumber`** (over `quickpickle`)

- The Gherkin is executed as written, inside the same runner as everything else, so tests can't drift from the spec: a scenario fails if code and `.feature` disagree on a step.
- Chosen over quickpickle for fewer dependencies and more recent maintenance (it declares Vitest 5 support).

**IaC: CDK (synth only)**

- One stack per environment, each in its own account. Promotion deploys the same synthesised template to the next account.
- Rollback: prod shifts 10% of traffic to a new version for 5 minutes and rolls back if the alias reports Lambda errors (crashes, timeouts, failed cold starts). Not on `5xx` responses: a model outage returns `503` and would roll back a good release.
- The model key is read from Secrets Manager with the AWS SDK at cold start, never in the template or the function's environment.

## Known limitations

- The in-memory store is per process, so per Lambda instance in AWS: records are lost on restart and not shared between instances. The store sits behind a repository interface for the swap to DynamoDB.
- API Gateway cuts requests off at 30 s; a slow first reply followed by a repair retry can come close (two 15 s calls).

## With more time

Production hardening (CI, observability, prompt injection, queue, rate limiting, persistent store, data scrubbing) is in [HARDENING.md](HARDENING.md). Beyond that:

- Broader unit tests (prompt building, extraction parsing, config, the fake's rules, dashboard sorting and counts). Today's tests cover only the acceptance scenarios.
- Pagination, filtering and sorting on `GET /api/feedback`, with aggregates computed by the store instead of in the browser.
- A status update endpoint (`new` → `triaged` → `resolved`) and a "proportion resolved" view.
- Let the model flag non-feedback input and answer `422`.
- Client-side routing: the UI picks its page from `location.pathname` today.

## AI vs. my calls

- **My calls:** the initial plan draft, Hono over Express, Groq after finding OpenCode Zen's free models restricted to its own app, qwen as the fallback model, retry once then fail, storing gibberish as-is, no PII flag, AGENTS.md as the rules file (imported by `CLAUDE.md`), the pre-commit hook, and the no-commit-without-permission rule.
- **AI-proposed, then reviewed by me:** the schema split, the risk list and the extra working rules. The Gherkin scenarios were written by AI from my descriptions.
- **Code:** AI wrote most of it, one piece at a time. For each piece I had it interview me to refine the requirements, asked for pros and cons before choosing, and challenged its output. Calls made that way: vitest-cucumber over quickpickle, the canary and rollback in the CDK code, reading the key from Secrets Manager with the SDK, and explicit code over clever code.

## Time spent

About 5 hours, two thirds of it on the plan (scope, contract, acceptance criteria, working rules), the rest building and hardening.

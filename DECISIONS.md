# Decisions

Key choices and why. Scope and acceptance criteria are in [PLAN.md](PLAN.md).

## Key choices

**API framework: Hono** (over Express 5 and Next.js)

- `@hono/zod-validator` validates request bodies with the contract's Zod schemas and types them, so validation at the boundary costs no extra code.
- The `hc` client gives the React dashboard types inferred from the server routes. That makes the API typed end to end with no code generation and no hand-shared types.
- Runs on Lambda through the built-in `hono/aws-lambda` adapter.
- Trade-off: Express is better known and has a larger middleware ecosystem, but this service needs no middleware beyond validation. Next.js was ruled out because deploying it with CDK needs OpenNext, which is more infrastructure than the service warrants.

**Repo layout: one app package plus a separate `infra/` package**

- `src/contract`, `src/server` and `src/web` share one `package.json`, `tsconfig` and Vitest config. The contract is shared by relative import with no build step, and the dashboard's `hc` client imports the server's route types directly.
- `infra/` has its own `package.json`, as `cdk init` creates, so the heavy CDK dependencies stay out of the app.
- The risk of one package is server code (such as the `openai` SDK) leaking into the browser bundle. It's handled by convention: `web` imports only _types_ from `server` (see [AGENTS.md](AGENTS.md)). The risk is small and fails loudly: type imports are erased at build time, and the SDK refuses to run in a browser. The upgrade path is a lint rule (`@typescript-eslint/no-restricted-imports` with `allowTypeImports`).
- Rejected: a pnpm workspace per piece. It gives the strongest boundaries, but costs four `package.json` files, project references and per-package scripts, which is too much for a service this size. I'd move to one once the contract has a second consumer or the UI gets its own team.

**UI: React + shadcn/ui**

- Ready-made table, card, form and badge components, enough for a functional dashboard with no custom design work.
- Components are copied into the repo as plain code (Tailwind + Radix), so there's no component-library version to manage and anything can be changed in place.

**AI provider: `openai` SDK against Groq's free tier**

- One OpenAI-compatible client; provider and model are switched by `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`.
- OpenCode Zen was the first choice, but its docs restrict free chat models to the OpenCode app ("Free-tier chat models require OpenCode; use paid models or Go from other clients"). Zen stays usable through env with paid credits.
- Groq gives a free API key usable from any app, supports strict structured outputs, and by default "does not retain customer data for inference requests".
- Verified with a real call: `openai/gpt-oss-20b` with a strict `json_schema` returned exactly the schema's JSON.

**Model: `openai/gpt-oss-20b`, fallback `qwen/qwen3.8-27b`**

- gpt-oss-20b: one of the few Groq models with strict mode (constrained decoding), production status, the fastest (~1000 tokens/s), and enough for picking three enum values and writing two short sentences.
- qwen3.8-27b as the fallback via `LLM_MODEL`: a different model family, so it fails differently. Caveat: it is a preview model that Groq says "may be discontinued at short notice".
- The free tier is a demo choice: zero cost and an easy key for running it locally. Production would use a paid tier with a data processing agreement, zero data retention and production-status models only.

**Handling model output: prevent, validate, retry once, fail honestly**

- **Prevent:** the request uses strict structured outputs with the JSON Schema generated from `ExtractionSchema` (`z.toJSONSchema()`), so the prompt contract and the validation contract can't drift.
- **Validate:** the Zod gate always runs, because another provider or model set by env may not enforce the schema, nor length limits. Unexpected keys are stripped, not rejected: the record is built only from parsed fields, and failing a response whose required fields are valid is not acceptable.
- **Retry once:** one repair retry with the Zod errors. A deliberate exception to one model call per submission, recovering the common slip for one capped extra call.
- **Fail honestly:** `502 EXTRACTION_INVALID`, nothing stored. Not losing feedback (store it, retry asynchronously) is future work.
- **Unavailable is not invalid:** timeouts, `429`, `5xx` and network errors return `503 MODEL_UNAVAILABLE` with no retry. Calling again right away only adds load to a provider that is already struggling. The SDK's own retries are off, so one submission makes at most two model calls.

**Test doubles: fake the model's raw response, not the extraction**

- Only `LlmClient.complete(prompt) → string` is swapped. Faking the whole extractor would let tests skip the prompt, JSON parsing, Zod gate and retry, which are exactly what they must exercise.
- Offline runs use a canned client returning one valid response. It is opt-in (`LLM_PROVIDER=fake`) with a startup warning, never a silent fallback: a misconfigured deployment must fail at startup, not quietly store made-up records.

**Tests: Vitest running the `.feature` files with `@amiceli/vitest-cucumber`** (over `quickpickle`)

- The Gherkin in PLAN.md is executed as written, inside the same runner as everything else, so tests can't drift from the spec.
- Typed: each scenario is plain TypeScript with typed state and example values, and it fails if code and `.feature` disagree on a scenario or step.
- More recent activity (a release this month vs. last May; it declares Vitest 5 support) and fewer dependencies (4 vs. 11, with no image-diff tooling).

**IaC: CDK, Lambda + API Gateway + S3/CloudFront**

- Lambda keeps the service container-free (containers are out of scope) and needs no adapter beyond Hono's own.

**Schema**

- Split into `FeedbackInput`, `Extraction` (model-owned) and `FeedbackRecord` (adds server-owned `id`, `submittedAt`, `status`).
- Added the original `text` for audit and reprocessing, plus length limits on input and generated text.
- IDs are `fb_` + ULID, which sorts by time.

## Known limitations

- The in-memory store is per process, so per Lambda instance in AWS: records are lost on restart and not shared between instances. The store sits behind a repository interface for the swap to DynamoDB.
- _More to fill during execute and harden._

## With more time

- Asynchronous submission via a queue (`202` + `pending`, worker capped at the provider's rate limit, dead-letter queue): no lost feedback, absorbs bursts. Plus per-client rate limiting and an idempotency key on `POST`.
- Pagination and filtering (category, severity, status, date) on `GET /api/feedback`, with aggregates computed by the store instead of over the whole list.
- Let the model flag non-feedback input and answer `422`.
- Scrub personal and health data before the text leaves the service.
- A dedicated decision model for `category`, `sentiment` and `severity`, with the LLM producing only the free-text fields; for example Jev, which answers typed choice questions with probabilities.
- A status update endpoint (`new` → `triaged` → `resolved`) and a "proportion resolved" view.
- DynamoDB instead of the in-memory store.

## AI vs. my calls

- **My calls:** the initial plan draft, Hono after comparing it with Express, Groq after finding OpenCode Zen's free models restricted to its own app, qwen as the fallback model, retry once then fail, storing gibberish as-is, no PII flag, AGENTS.md as the rules file (imported by `CLAUDE.md`), the pre-commit hook, and the no-commit-without-permission rule.
- **AI-proposed, then reviewed by me:** splitting the schema into input, extraction and record; the risk list; the Gherkin scenarios; the extra working rules.
- **Code:** _to fill during execute._

## Time spent

_To fill at the end._

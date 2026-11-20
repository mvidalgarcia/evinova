# Feedback Intake Service

Submit freeform feedback; an AI model extracts a structured, validated `FeedbackRecord`; browse the records on a small dashboard.

## Run locally

Requires Node 24+ and pnpm 10.

```sh
pnpm install      # also points git at .githooks/ (pre-commit: typecheck + tests)
cp .env.example .env
pnpm typecheck
pnpm test
pnpm dev          # runs dev:api and dev:web together, output prefixed per script
pnpm seed         # submits 25 invented feedbacks to the running API
```

- `pnpm dev:api`: API on http://localhost:8787, reloads on save, reads `.env`, logs each request.
- `pnpm dev:web`: form on http://localhost:5173, dashboard on `/dashboard`; forwards `/api/` to the API.

> [!NOTE]
> Without a key, `LLM_PROVIDER=fake pnpm dev` runs offline. With `LLM_PROVIDER=openai` and no `LLM_API_KEY`, the server refuses to start.

### Get a Groq API key

The key is free and needs no credit card.

1. Sign up or log in at [console.groq.com](https://console.groq.com).
2. Open **API Keys** in the sidebar (or go to [console.groq.com/keys](https://console.groq.com/keys)).
3. Click **Create API Key**, give it a name (e.g. `feedback-intake`) and submit.
4. Copy the key straight away: Groq shows it only once.
5. Paste it into `.env` as `LLM_API_KEY=<your key>`, then restart `pnpm dev`.

`.env` is git-ignored, so the key stays out of the repo.

## Configuration

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `openai` (default) for a real model, `fake` for the offline stub below |
| `LLM_BASE_URL` | OpenAI-compatible endpoint (default: `https://api.groq.com/openai/v1`) |
| `LLM_MODEL` | Model id (default: `openai/gpt-oss-20b`; fallback: `qwen/qwen3.8-27b`) |
| `LLM_API_KEY` | API key, free at [console.groq.com](https://console.groq.com). Required unless `LLM_PROVIDER=fake`; the app refuses to start without it |
| `LLM_API_KEY_SECRET_ID` | AWS only, set by the CDK stack: the Secrets Manager secret the Lambda reads the key from, instead of `LLM_API_KEY`. Not used locally |

## Infrastructure (AWS CDK)

`pnpm synth` builds the UI and synthesises one stack per environment (`FeedbackIntake-dev`, `FeedbackIntake-prod`) into `infra/cdk.out`. No AWS account is needed. What a stack contains:

- CloudFront serves the UI from a private S3 bucket and forwards `/api/*` to an API Gateway HTTP API, so browser and API share one domain.
- The API is a Lambda (`src/server/lambda.ts`) behind a `live` alias. CodeDeploy shifts traffic to new versions (prod: 10% for 5 minutes) and rolls back if the alias's error alarm fires.
- The model API key lives in Secrets Manager. The stack creates it with a random placeholder; the Lambda reads it at cold start, so it never appears in the template or the function's environment.

To deploy (not done here): set `DEV_ACCOUNT_ID`/`PROD_ACCOUNT_ID`, run `cdk bootstrap` and `cdk deploy` from `infra/`, then store the key with `aws secretsmanager put-secret-value`, using the `ApiKeySecretName` output.

## Stubbed parts

- **Fake model**: with `LLM_PROVIDER=fake`, no model is called; keyword rules pick a plausible category, sentiment and severity, and the summary is the feedback itself. Validation and record creation still run for real. A warning is logged at startup.
- **Tests**: use a scripted fake model to simulate valid, invalid and retry responses, and a fake `fetch` to simulate provider outages; they never call a real model.
- **Infrastructure**: the CDK stacks are synthesised only, never deployed.

## Docs

- [PLAN.md](PLAN.md): scope, risks, acceptance criteria
- [DECISIONS.md](DECISIONS.md): key choices and trade-offs
- [HARDENING.md](HARDENING.md): what makes it resilient today and what is needed before production
- [AGENTS.md](AGENTS.md): working rules

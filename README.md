# Feedback Intake Service

Submit freeform feedback; an AI model extracts a structured, validated `FeedbackRecord`; browse the records on a small dashboard.

## Run locally

Requires Node 24+ and pnpm 10.

```sh
pnpm install      # also points git at .githooks/ (pre-commit: typecheck + tests)
cp .env.example .env
pnpm typecheck
pnpm test
pnpm dev:api      # API on http://localhost:8787, reloads on save; reads .env
pnpm dev:web      # form on http://localhost:5173, dashboard on /dashboard; forwards /api/ to the API (run both)
```

Without a key, `LLM_PROVIDER=fake pnpm dev:api` runs offline. With `LLM_PROVIDER=openai` and no `LLM_API_KEY`, the server refuses to start.


## Configuration

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `openai` (default) for a real model, `fake` for the offline stub below |
| `LLM_BASE_URL` | OpenAI-compatible endpoint (default: `https://api.groq.com/openai/v1`) |
| `LLM_MODEL` | Model id (default: `openai/gpt-oss-20b`; fallback: `qwen/qwen3.8-27b`) |
| `LLM_API_KEY` | API key, free at [console.groq.com](https://console.groq.com). Required unless `LLM_PROVIDER=fake`; the app refuses to start without it |

## Stubbed parts

- **Fake model**: with `LLM_PROVIDER=fake`, no model is called; keyword rules pick a plausible category, sentiment and severity, and the summary is the feedback itself. Validation and record creation still run for real. A warning is logged at startup.
- **Tests**: use a scripted fake model to simulate valid, invalid and retry responses, and a fake `fetch` to simulate provider outages; they never call a real model.
- **Infrastructure**: the CDK stack is synthesised only, never deployed.

## Docs

- [PLAN.md](PLAN.md): scope, risks, acceptance criteria
- [DECISIONS.md](DECISIONS.md): key choices and trade-offs
- [AGENTS.md](AGENTS.md): working rules

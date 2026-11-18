# Feedback Intake Service

Submit freeform feedback; an AI model extracts a structured, validated `FeedbackRecord`; browse the records on a small dashboard.

## Run locally

_Steps added once the app is scaffolded._

## Configuration

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `openai` (default) for a real model, `fake` for the offline stub below |
| `LLM_BASE_URL` | OpenAI-compatible endpoint (default: `https://api.groq.com/openai/v1`) |
| `LLM_MODEL` | Model id (default: `openai/gpt-oss-20b`; fallback: `qwen/qwen3.8-27b`) |
| `LLM_API_KEY` | API key, free at [console.groq.com](https://console.groq.com). Required unless `LLM_PROVIDER=fake`; the app refuses to start without it |

## Stubbed parts

- **Fake model**: with `LLM_PROVIDER=fake`, every submission gets the same canned model response instead of a real one. Validation and record creation still run for real. A warning is logged at startup.
- **Tests**: use a scripted fake model to simulate valid, invalid and retry responses; they never call a real model.
- **Infrastructure**: the CDK stack is synthesised only, never deployed.

## Docs

- [PLAN.md](PLAN.md): scope, risks, acceptance criteria
- [DECISIONS.md](DECISIONS.md): key choices and trade-offs
- [AGENTS.md](AGENTS.md): working rules

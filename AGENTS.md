# Working rules

Rules for anyone changing this repo, human or AI agent. Scope and acceptance criteria live in [PLAN.md](PLAN.md); this file is about *how* we work.

## Commits

- **Never commit or push without the repo owner's explicit permission**, given for that specific commit or push. AI agents prepare the change and the message, then ask.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, in the imperative and lower case, no trailing period.
  - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`.
  - Scopes: `contract`, `extraction`, `api`, `ui`, `infra`, `plan`.
  - Example: `feat(extraction): retry once with validation errors on invalid model output`.
- Small commits, one concern each. Do not mix a refactor with a behaviour change.
- The history should show plan → execute → harden.
- Typecheck and tests must pass before every commit; the pre-commit hook enforces it.
- **One allowed exception:** the test-first commit that adds a deliberately failing acceptance test. Commit it with `--no-verify` and say so in the message, e.g. `test(extraction): add failing scenario for invalid model output (test-first)`.
- Never use `--no-verify` for anything else.

## Spec first

- The Gherkin scenarios in PLAN.md and the `.feature` files are the specification.
- A behaviour change updates the `.feature` file first, then the code.
- Every acceptance test is named exactly after the scenario it implements.
- Tests are targeted, not exhaustive: the contract at the boundaries and the invalid-model-output path. No coverage for its own sake.

## Contract and ownership

- The Zod schemas are the single source of truth. Derive types with `z.infer`; never hand-write a duplicate type.
- Validate at every boundary: request bodies, model output, and records leaving the API.
- The model only produces `Extraction` fields. `id`, `submittedAt`, `status` and the original `text` are always set by our code, never copied from model output.

## Import boundaries

A convention, not enforced by tooling. Respect it in every change and flag any violation in review.

| Folder | May import from |
| --- | --- |
| `src/contract/` | nothing else in `src/` (only `zod`) |
| `src/server/` | `src/contract/` |
| `src/web/` | `src/contract/`, plus **type-only** imports from `src/server/` (for the `hc` client) |
| `infra/` | nothing in `src/`; it references the Lambda entry file by path, not by import |

## Code

- TypeScript strict mode. No `any`; use `unknown` and narrow it.
- Keep dependencies few and pinned. Ask before adding one.
- Errors leave the API in one shape: `{ error: { code, message, details? } }`.

## Scope guard

- Build only what PLAN.md lists as in scope.
- Do not build what PLAN.md lists as out of scope, in particular auth, real deployment, persistent DB, CI, containers, observability stack, UI polish.
- If something seems needed but isn't in scope, raise it and record it in DECISIONS.md instead of building it.

## Secrets and data

- No secrets in git. `.env` is git-ignored; `.env.example` lists every variable with a safe placeholder.
- Use invented feedback in tests and fixtures. Never real personal or health data.

## Docs as we go

- Record each decision in DECISIONS.md when it is made, not at the end.
- Note where AI wrote code and where a human made the call.
- Anything stubbed or faked (e.g. the fake LLM client) is stated in the README.

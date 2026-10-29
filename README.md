# AI Document Review & Compliance Copilot

> Upload business documents, extract their text with page-level provenance, review them against versioned policies using deterministic rules **and** an LLM (AWS Bedrock), get structured findings where **every material claim cites verifiable source evidence**, and send anything uncertain or high-risk to a human reviewer — with a full audit trail and a reproducible evaluation framework.

**The AI assists human reviewers. It does not make consequential legal, financial, employment or regulatory decisions.** This system is not certified compliant with any regulation, and no finding should be treated as a legal verdict. See [docs/limitations.md](docs/limitations.md) before anything else.

Built to demonstrate Senior AI Solutions Engineering practice: provider abstraction, RAG with verified citations, strict structured-output validation, prompt-injection defences, tenant isolation, human-in-the-loop review, measurable quality, and honest reporting of what was and was not verified.

---

## Table of contents
1. [Problem statement](#1-problem-statement) · 2. [Features](#2-features) · 3. [Screenshots](#3-screenshots) · 4. [Architecture](#4-architecture) · 5. [Tech stack](#5-tech-stack) · 6. [Project structure](#6-project-structure) · 7. [Quick start](#7-quick-start-local-no-docker) · 8. [Docker setup](#8-docker-setup) · 9. [Environment variables](#9-environment-variables) · 10. [Demo accounts & walkthrough](#10-demo-accounts--walkthrough) · 11. [Running tests](#11-running-tests) · 12. [Evaluation](#12-evaluation) · 13. [API](#13-api) · 14. [Security](#14-security) · 15. [AWS deployment](#15-aws-deployment-summary) · 16. [Verification status](#16-verification-status-read-this) · 17. [Known limitations](#17-known-limitations) · 18. [Roadmap](#18-roadmap) · 19. [All commands](#19-all-commands)

## 1. Problem statement
Teams review contracts, policies and procedures by hand. It is slow, inconsistent between reviewers, and hard to audit afterwards: *who saw which version, what evidence supported a decision, and did anything get missed?* This platform makes review faster and auditable without removing the human: machines extract, retrieve, check and draft; humans decide.

## 2. Features
- **Upload & processing pipeline** — PDF/DOCX/TXT with type + magic-byte + size validation, generated storage IDs (uploaded filenames are never trusted as paths), private storage, explicit status machine (`uploaded → queued → extracting → indexing → reviewing → completed | failed`), Celery async processing, idempotent retries, failures never disguised as success.
- **Review engine** (service layer, not views) — versioned policies, deterministic rule engine (required-phrase/clause checks), hybrid retrieval (keyword + vector cosine, tenant-filtered *before* ranking), versioned prompts, LLM call, **Pydantic schema validation**, **server-side citation verification** (chunk ID, page and quote must match stored text), explicit priority scoring, human-review escalation rules.
- **Provider abstraction** — `MockProvider` (deterministic, default: the whole product works with **zero AWS credentials**) and `BedrockProvider` (boto3 Converse API, model ID + region from env, clear error when unconfigured — no model ID is promised to exist in your account).
- **Human review workflow** — approve / reject / escalate / edit with comments; original AI output is preserved, decisions are stored separately; AI findings remain visually and structurally distinct from human-confirmed ones.
- **RBAC + tenant isolation** — Administrator / Reviewer / Uploader enforced server-side on every endpoint; every queryset is organization-scoped; cross-tenant IDs return 404. Automated cross-user, cross-tenant and IDOR tests included. The UI also follows the role model (§10): each role only sees its own pages, and the API enforces the same boundaries — starting a review is restricted to Administrator/Reviewer, policy writes (create / edit / delete / add-version) to Administrator only, and evaluation runs to Administrator only.
- **Audit trail** — uploads, review creation, finding decisions, policy changes and deletions recorded as `AuditEvent`s.
- **Evaluation framework** — 36 labelled synthetic cases, reproducible `run_evaluation` management command writing JSON + CSV, metrics computed from predictions (precision/recall/F1, FP/FN rates, citation correctness, structured-output validity, escalation rate, latency, estimated cost).
- **Observability & cost** — structured JSON logs, `X-Request-ID` on every response, per-run latency/token usage in `ModelUsageRecord`, cost estimated only from an operator-configured price (default 0 = unknown).
- **Real-data UI** — React + TypeScript dashboard whose numbers come from `/api/v1/dashboard/stats/`; no fabricated statistics, charts or demo data anywhere in the frontend.

## 3. Screenshots
No screenshots are included, deliberately: shipping polished-looking images that were not captured from this running build would misrepresent the product. Run it locally (5 minutes, §7) and you will see: Login → Overview dashboard → Document library → Document detail with extracted chunks → Findings review with evidence quotes → Policies → Evaluation → Settings. Recruiters: the fastest honest screenshot is the one you take yourself from the demo walkthrough in §10.

## 4. Architecture
```mermaid
flowchart LR
  U[Reviewer / Uploader / Admin] --> FE[React + TypeScript SPA]
  FE -->|REST /api/v1, token auth| API[Django + DRF API]
  API --> DB[(PostgreSQL + pgvector in prod / SQLite locally)]
  API --> FS[Private file storage]
  API -->|enqueue| Q[Redis broker]
  Q --> W[Celery worker]
  W --> RE[Review Engine: extraction, chunking, embeddings, hybrid retrieval, rules]
  RE --> LLM[LLM provider: Mock default / AWS Bedrock via boto3]
  RE --> VAL[Pydantic validation + citation verification]
  VAL --> DB
```
Full detail: [docs/architecture.md](docs/architecture.md).

## 5. Tech stack
| Layer | Technology |
|---|---|
| Backend | Python 3.12, Django 4.2, Django REST Framework, Celery, drf-spectacular (OpenAPI) |
| AI | AWS Bedrock via boto3 (Converse), Pydantic v2 structured-output contract, provider abstraction |
| Retrieval | Configurable embeddings (local deterministic provider; Bedrock embedding provider behind the same interface), hybrid keyword + cosine ranking, pgvector path documented for production PostgreSQL |
| Data | PostgreSQL (production/Docker) or SQLite (local/tests, via `DATABASE_URL`), Redis broker |
| Frontend | React 18, TypeScript, Vite, Vitest + Testing Library |
| Quality | Pytest (27 backend tests), Ruff, TypeScript strict, GitHub Actions CI with a secret-pattern scan |
| Infra | Docker Compose (pgvector Postgres, Redis, API, worker, frontend/nginx), AWS ECS Fargate guide |

## 6. Project structure
```
ai-document-review-copilot/
├── README.md                  <- you are here
├── ALL_COMMANDS.md            <- every command, clone to deploy, beginner-proof
├── docker-compose.yml
├── .env.example               <- every variable explained; no real secrets anywhere
├── backend/
│   ├── config/                <- settings, urls, celery
│   ├── apps/                  <- accounts, documents, policies, reviews, audit, evaluation, usage
│   ├── services/              <- extraction, chunking, embeddings, retrieval, llm, prompts,
│   │                            schemas, validation, rules, review_engine, evaluation
│   ├── evaluation_data/       <- dataset_v1.json (36 labelled cases)
│   └── tests/                 <- pytest suite (API, tenancy, security, units)
├── frontend/                  <- React + TS SPA (src/api, src/components, pages in src/App.tsx)
├── docs/                      <- architecture, api, security, evaluation, deployment, runbook, limitations
└── infra/                     <- infrastructure notes
```

## 7. Quick start (local, no Docker)
Works with **no AWS account, no Postgres and no Redis**: SQLite + Celery eager mode + mock AI provider are the defaults.

```bash
git clone <https://github.com/m-ijaz-hussnain/ai-document-review-copilot> ai-document-review-copilot
cd ai-document-review-copilot/backend
python -m venv .venv
# Windows (Git Bash):  source .venv/Scripts/activate
# Linux/macOS:         source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```
In a second terminal:
```bash
cd ../frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api to :8000)
```
Open http://localhost:5173 and sign in with a demo account (§10).

## 8. Docker setup
```bash
cp .env.example .env
docker compose up --build
# Frontend http://localhost:5173 · API http://localhost:8000 · OpenAPI UI http://localhost:8000/api/docs/
```
Compose runs Postgres (pgvector image), Redis, the API (migrates + seeds on start), a Celery worker (`CELERY_TASK_ALWAYS_EAGER=false`) and the frontend behind nginx. Note the verification table in §16: the Compose stack itself was not executed in the original build sandbox (no Docker daemon there) — it is consistent with the verified local run, but run it once on your machine before relying on it.

## 9. Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `DJANGO_SECRET_KEY` | dev placeholder | Set a long random value outside local dev |
| `DJANGO_DEBUG` | `true` | `false` in production |
| `DATABASE_URL` | empty → SQLite | `postgres://user:pass@host:5432/db` for PostgreSQL |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | local Redis | Redis URLs |
| `CELERY_TASK_ALWAYS_EAGER` | `true` | `true` = tasks run inline (local/tests); `false` with a real worker |
| `AI_PROVIDER` | `mock` | `mock` \| `bedrock` |
| `BEDROCK_MODEL_ID` | empty | A model ID **you** have been granted access to. None is guaranteed |
| `AWS_REGION` | `us-east-1` | Bedrock region |
| `EMBEDDING_PROVIDER` / `EMBEDDING_MODEL_ID` / `EMBEDDING_DIM` | `local` / empty / `64` | Embedding backend |
| `MAX_UPLOAD_MB` / `MAX_PAGES` | `10` / `200` | Upload limits |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `RETRIEVAL_TOP_K` | `800` / `100` / `5` | RAG tuning |
| `COST_PER_1K_TOKENS_USD` | `0` (unknown) | Your verified current price for estimates only |
| `DEMO_PASSWORD` | `DemoPass123!` | Password set by `seed_demo` (local demo only) |

AWS credentials are **never** read from this file in deployment — use IAM roles / Secrets Manager (see docs/deployment.md).

## 10. Demo accounts & walkthrough
Created by `python manage.py seed_demo` — **local demo only; change or disable before any shared use.**

| Username | Password | Role |
|---|---|---|
| `admin` | value of `DEMO_PASSWORD` (default `DemoPass123!`) | Administrator |
| `reviewer` | same | Reviewer |
| `uploader` | same | Uploader |

**Who sees what (enforced in the UI and on the server):**

| Role | Pages shown | Can do |
|---|---|---|
| Administrator | Dashboard, Documents, Findings, Policies, Evaluation, Settings | Everything: upload, start reviews, decide findings, create/edit policies and add policy versions, view evaluation runs and the user list |
| Reviewer | Dashboard, Documents, Findings | Upload, open documents, start reviews (policy list stays readable for the review dropdown), approve / reject / escalate findings |
| Uploader | Dashboard, Documents | Upload documents and view their detail and extracted text — no Start Review control, no Findings / Policies / Evaluation / Settings pages |

Hiding pages is only presentation: the API returns **403** for the same actions (for example an uploader calling the create-review, policy-create or evaluation endpoints directly), so the boundary does not depend on the frontend.

**Shell & profile UX:** the navbar and footer are fixed (the page scrolls under them), mobile screens get a hamburger button opening a slide-in sidebar with the same role-filtered pages, and the navbar user menu shows an initials avatar with name + role and a dropdown (Profile / Settings / Logout). The Profile modal is view-only (name, email, role, organization, member since, status) with an "Edit Profile" button that opens the Settings modal, where first name, last name and username are editable while email is read-only. Every action shows an auto-dismissing toast (4 seconds); logout shows a "Logout successful" message on the login screen. Lists are newest-first everywhere (documents, findings, policies, users, audit events, evaluation runs); document chunks stay in reading order.

**5-minute demo script:**
1. Sign in as `admin`. Overview shows real counts (all zero on a fresh seed — that is correct, not a bug).
2. Documents → upload a `.txt` file, e.g. a vendor agreement that never mentions a termination clause. Status moves to `completed` with extracted chunks.
3. Open the document → pick **Vendor Contract Checklist v1.0** → *Run review*.
4. Findings → see "Possibly missing: termination clause" with the cited passage, page number and quote. Note it *requires human review*.
5. Sign out, sign in as `reviewer`, add a note and **Approve** (or Reject/Escalate). Try the same as `uploader` — the API returns 403, by design.
6. Findings page bottom + Settings show the audit history of everything you just did.
7. Run the evaluation (§12) and open the Evaluation page.

Seeded policies: **Data Protection Policy Review v1.0** (requires "data retention period", "data protection officer") and **Vendor Contract Checklist v1.0** (requires "termination clause", "liability cap").

## 11. Running tests
```bash
cd backend && pytest -q            # 27 tests: upload validation, tenancy/IDOR, prompt-injection-as-data,
                                   # citations, schema, metrics, idempotency, review decisions, audit,
                                   # role permissions (review start, policy writes, evaluation access)
ruff check .                       # lint
cd ../frontend && npm test         # Vitest: login form, loading/error/empty states
npm run build                      # TypeScript strict + production build
```
CI (`.github/workflows/ci.yml`) runs all of the above plus an evaluation smoke run and a secret-pattern scan. CI needs **no AWS credentials** and incurs **no Bedrock cost** — tests use the mock provider.

## 12. Evaluation
```bash
cd backend
python manage.py run_evaluation    # -> evaluation_results/latest.json + latest.csv + an EvaluationRun row
```
Dataset: `backend/evaluation_data/dataset_v1.json`, version 1.0, **36 labelled synthetic cases** (the original target of 100–200 is documented as an extension path in docs/evaluation.md — 36 real cases ship rather than a padded count). Methodology, metric definitions and the honest reading of the mock baseline: [docs/evaluation.md](docs/evaluation.md).

## 13. API
Versioned under `/api/v1/` — documents CRUD, reviews, finding decisions, policies + versions, audit events, dashboard stats, evaluation runs, plus `/health/live/` and `/health/ready/`. Full table: [docs/api.md](docs/api.md). Live OpenAPI: `/api/docs/` on a running server.

## 14. Security
Server-side RBAC and tenant isolation on every endpoint, magic-byte upload validation, private storage, prompt-injection layering (documents are data, never instructions; outputs and citations verified; the model has no tools and cannot approve its own findings), throttling, audit logging, secrets only via environment. Threat model and residual risks: [docs/security.md](docs/security.md). **Malware scanning is a required pre-production integration point, not built in.**

## 15. AWS deployment summary
ECS Fargate (API + worker) behind an HTTPS ALB, RDS PostgreSQL (pgvector) and ElastiCache in private subnets, S3 private file storage, Secrets Manager, task role limited to the one Bedrock model ARN + one bucket prefix, CloudWatch alarms on failed jobs and 5xx. Step-by-step: [docs/deployment.md](docs/deployment.md). Nothing deploys automatically; there are no credentials in this repo.

## 16. Verification status (read this)
What was actually executed for this build, in the build sandbox:

| Check | Result |
|---|---|
| Backend pytest | ✅ 27 passed, 0 failed |
| Ruff | ✅ All checks passed (E701/E702 ignored by documented config choice) |
| Migrations + seed + evaluation commands | ✅ Ran; evaluation computed from the 36-case dataset (mock provider) |
| End-to-end smoke (test client) | ✅ login → upload TXT → processed (completed, chunks created) → review → 2 findings with page-1 evidence → approve → audit events present → dashboard stats correct |
| Role-permission smoke (test client, seeded demo users) | ✅ uploader create-review → 403, reviewer create-review → 201 with findings, uploader policy create / add-version → 403, admin policy create + add-version → 201 (v2.0 with its required phrase visible in GET /policies/), reviewer evaluation-runs → 403, admin → 200 |
| Frontend `npm run build` (tsc strict + Vite) | ✅ Passed |
| Frontend Vitest | ✅ 3 passed |
| Frontend lint (`tsc --noEmit`) | ✅ Passed |
| Docker build / Compose run | ⚠️ **Not executed** — no Docker daemon in the build sandbox. Files provided and reviewed |
| Real AWS Bedrock call | ⚠️ **Not executed** — no AWS credentials in the sandbox. Provider implemented via boto3 Converse; the unconfigured path is unit-tested to fail with a clear error |

## 17. Known limitations
Small synthetic evaluation set; uncalibrated confidence scores; DOCX page numbers approximate; token auth is a local/demo choice (use OIDC in production); retrieval ranking is simple by design; malware scanning not built in; cost figures are operator-priced estimates. Full list: [docs/limitations.md](docs/limitations.md).

## 18. Roadmap
OIDC authentication · pgvector ANN index + retrieval evaluation at scale · ClamAV/managed malware scanning · 100–200-case reviewed evaluation set + Bedrock baseline · per-tenant quotas UI · S3 storage backend · reviewer assignment workflow.

## 19. All commands
Every command for this project — setup, run, test, evaluate, Docker, Git — with where each one runs: **[ALL_COMMANDS.md](ALL_COMMANDS.md)**.

---
*Honesty note for reviewers: every number in this README that describes this build (test counts, evaluation size, verification status) was produced by actually running the commands above. Anything not run is labelled as not run.*

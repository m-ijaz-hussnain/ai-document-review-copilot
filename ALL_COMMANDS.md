# ALL COMMANDS — AI Document Review & Compliance Copilot

Every command you need, from cloning the repo to running, testing, evaluating, Docker and Git.
**Where each command runs** is written with it. Terminal names: **Git Bash** (Windows), **Terminal** (Linux/macOS). Backend commands run inside `backend/`, frontend inside `frontend/` unless stated. Run commands in order the first time.

---

## 1. Get the code
| # | Command | Where |
|---|---|---|
| 1 | `git clone <your-repo-url> ai-document-review-copilot` | Git Bash / Terminal, any folder |
| 2 | `cd ai-document-review-copilot` | same |

## 2. Backend — first-time setup (no Docker)
| # | Command | Where |
|---|---|---|
| 3 | `cd backend` | project root |
| 4 | `python -m venv .venv` | backend/ (needs Python 3.12) |
| 5 | `source .venv/Scripts/activate` | **Windows Git Bash**. Linux/macOS: `source .venv/bin/activate` |
| 6 | `pip install -r requirements-dev.txt` | backend/, venv active |
| 7 | `cp ../.env.example ../.env` *(optional — defaults work without it)* | backend/ |
| 8 | `python manage.py migrate` | backend/ — creates the SQLite database + all tables |
| 9 | `python manage.py seed_demo` | backend/ — demo org, 3 users, 2 policies |
| 10 | `python manage.py runserver` | backend/ — API on http://localhost:8000 (leave running) |

Check it: open http://localhost:8000/health/live/ → `{"status": "ok"}` · API docs: http://localhost:8000/api/docs/

## 3. Frontend — first-time setup
Open a **second** terminal.
| # | Command | Where |
|---|---|---|
| 11 | `cd frontend` | project root |
| 12 | `npm install` | frontend/ (needs Node 20+) |
| 13 | `npm run dev` | frontend/ — app on http://localhost:5173 (leave running) |

Sign in at http://localhost:5173 with `admin` / `DemoPass123!` (see README §10 for all demo accounts).

## 4. Everyday run (after first setup)
| Command | Where |
|---|---|
| `source .venv/Scripts/activate` (Win) / `source .venv/bin/activate` (Linux/mac) then `python manage.py runserver` | backend/ |
| `npm run dev` | frontend/ |
| Stop a server | `Ctrl + C` in its terminal |

## 5. Celery worker (only when NOT using eager mode)
Local defaults use `CELERY_TASK_ALWAYS_EAGER=true`, so no worker or Redis is needed. For real async:
| Command | Where |
|---|---|
| Start Redis (Docker): `docker run -p 6379:6379 redis:7-alpine` | any terminal |
| Set `CELERY_TASK_ALWAYS_EAGER=false` in your environment / `.env` | — |
| `celery -A config worker --loglevel=info` | backend/, venv active (Windows may need `--pool=solo`) |

## 6. Tests & quality checks
| Command | Where | Expected (this build) |
|---|---|---|
| `pytest -q` | backend/ | 27 passed |
| `pytest -q --cov` | backend/ | tests + coverage |
| `ruff check .` | backend/ | All checks passed |
| `ruff check . --fix` | backend/ | auto-fix safe issues |
| `npm test` | frontend/ | 3 passed (Vitest) |
| `npm run lint` | frontend/ | TypeScript check, no errors |
| `npm run build` | frontend/ | production build in `dist/` |

## 7. Evaluation
| Command | Where |
|---|---|
| `python manage.py migrate` (once) | backend/ |
| `python manage.py run_evaluation` | backend/ → writes `evaluation_results/latest.json` + `latest.csv` |
| `cat evaluation_results/latest.json` (Linux/mac) / `type evaluation_results\latest.json` (Windows cmd) | backend/ |

## 8. Database & Django utilities
| Command | Where | Purpose |
|---|---|---|
| `python manage.py makemigrations` | backend/ | after changing models |
| `python manage.py migrate` | backend/ | apply migrations |
| `python manage.py createsuperuser` | backend/ | Django admin superuser |
| `python manage.py shell` | backend/ | Django shell |
| `python manage.py seed_demo` | backend/ | safe to re-run (get-or-create) |

## 9. Using real AWS Bedrock (optional)
| Step | Command / action | Where |
|---|---|---|
| 1 | Request model access for your chosen model | AWS Console → Bedrock → Model access |
| 2 | `export AI_PROVIDER=bedrock` (Linux/mac) / `set AI_PROVIDER=bedrock` (Windows cmd) / `$env:AI_PROVIDER="bedrock"` (PowerShell) | backend terminal |
| 3 | `export BEDROCK_MODEL_ID=<model-id-you-were-granted>` and `export AWS_REGION=<your-region>` | backend terminal |
| 4 | Configure AWS credentials via `aws configure` / IAM role — **never** paste keys into the repo | your machine |
| 5 | `python manage.py runserver` and run a review | backend/ |
If the model/region is wrong, reviews fail with an explicit provider error — that is the designed behaviour.

## 10. Docker (full stack)
| Command | Where |
|---|---|
| `cp .env.example .env` | project root |
| `docker compose up --build` | project root — API :8000, app :5173 |
| `docker compose ps` | project root |
| `docker compose logs -f backend` (or `worker`, `frontend`, `db`) | project root |
| `docker compose exec backend python manage.py pytest -q` *(tests inside the container)* | project root |
| `docker compose down` | project root — stop (data volume kept) |
| `docker compose down -v` | project root — stop **and delete** the database volume |

## 11. Git (saving & publishing your work)
| Command | Where | Purpose |
|---|---|---|
| `git status` | project root | what changed |
| `git add .` | project root | stage everything (`.gitignore` excludes `.env`, `node_modules`, DB) |
| `git commit -m "Describe your change"` | project root | commit |
| `git branch -M main` | project root | main branch (first publish) |
| `git remote add origin <your-github-repo-url>` | project root | first publish only |
| `git push -u origin main` | project root | publish |
| `git pull` | project root | get latest |
| `git log --oneline -5` | project root | recent history |
⚠️ Before every push: `git status` and confirm `.env` is **not** listed. Real secrets must never be committed.

## 12. Troubleshooting quick table
| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'django'` | venv not active — repeat step 5, then step 6 |
| Port 8000 / 5173 already in use | stop the other server (`Ctrl+C`) or use `python manage.py runserver 8001` / `npm run dev -- --port 5174` |
| Document stuck on `queued` | eager mode off but no worker — repeat §5, or set `CELERY_TASK_ALWAYS_EAGER=true` and restart |
| Login fails after re-seeding | password comes from `DEMO_PASSWORD` (default `DemoPass123!`) |
| Frontend shows API errors | backend not running — repeat step 10, check http://localhost:8000/health/live/ |

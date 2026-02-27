# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Task Tracking (Beads / bd)

Use `bd` for ALL tasks/issues (no markdown TODO lists).
- Start of session: `bd ready`
- Create work: `bd create "Title" -p 1 --description "Context + acceptance criteria"`
- Update status: `bd update <id> --status in_progress`
- Finish: `bd close <id> --reason "Done"`
- End of session: `bd sync` (flush/import/export + git sync)
- After upgrading `bd`, run: `bd info --whats-new`
- If `bd info` warns about hooks, run: `bd hooks install`

## Project Overview

**Perception** is an AI news intelligence platform using Google's Agent Development Kit (ADK). 9 specialized agents on Vertex AI Agent Engine coordinate to collect, analyze, and synthesize news into executive briefs.

**GCP Project:** `perception-with-intent`
**Dashboard:** https://perception-with-intent.web.app
**MCP Service:** https://perception-mcp-w53xszfqnq-uc.a.run.app
**Agent Engine ID:** `4241324322704064512`

## Architecture

```
Firebase Dashboard (React + Vite + TypeScript)
    ↓ Firestore real-time listeners + auto-ingestion trigger
Vertex AI Agent Engine (9 Agents via A2A Protocol)
    ↓ ADK sub_agents + config_path references
Cloud Run MCP Service (FastAPI, 7 tool endpoints + /trigger/ingestion)
    ↓
Firestore (named database: "perception-db")
  └── Collections: articles, daily_summaries, topics_to_monitor
```

**Key principle:** Firebase = humans, Agents = thinking, MCPs = doing, Firestore = storage.

### Two Entrypoints

The agent system has two different entrypoints:

1. **Local dev** (`perception_app/main.py`) - Imports `jvp_agent.build_a2a_agent()` and runs via uvicorn. The `jvp_agent` package is a **top-level module** (not inside `perception_app/`), providing the A2A protocol wrapper.

2. **Production** (`perception_app/agent_engine_app.py`) - Loads the orchestrator YAML config for Vertex AI Agent Engine deployment. Currently stubbed with TODOs for ADK loader integration.

### Agent System (perception_app/perception_agent/agents/)

Agent 0 (orchestrator) loads all sub-agents via `config_path` references in its YAML. Each agent has a corresponding tools file (`perception_app/perception_agent/tools/agent_N_tools.py`).

| Agent | Role |
|-------|------|
| 0 - Orchestrator | Editor-in-Chief, coordinates the full ingestion workflow |
| 1 - Source Harvester | Fetches news from RSS/APIs |
| 2 - Topic Manager | Manages tracked keywords |
| 3 - Relevance Ranking | Scores articles 1-10 |
| 4 - Brief Writer | Generates executive summaries |
| 5 - Alert & Anomaly | Detects alerts worth surfacing |
| 6 - Validator | Data quality checks |
| 7 - Storage Manager | Firestore persistence |
| 8 - Tech Editor | Technology section curation |

### MCP Service (perception_app/mcp_service/)

FastAPI app with routers at `/mcp/tools/*`. Real implementation: `fetch_rss_feed`. Stubbed: `fetch_api_feed`, `fetch_webpage`, `store_articles`, `generate_brief`, `log_ingestion_run`, `send_notification`. Also exposes `/trigger/ingestion` for dashboard auto-ingestion.

### Dashboard (dashboard/)

React 18 SPA with Firebase Auth (protected routes), Firestore real-time data, and an auto-ingestion hook (`useAutoIngestion`) that fires once per session on Dashboard mount. Uses shadcn/ui components (`dashboard/src/components/ui/`), Framer Motion animations, and Tremor charts.

Routes: `/` (Articles feed), `/dashboard` (command center), `/briefs`, `/authors`, `/topics`, `/about` (landing), `/login`.

**Firestore named database:** The dashboard connects to `perception-db` (not the default database): `getFirestore(app, 'perception-db')`.

### Functions (functions/)

Firebase Cloud Functions (Node.js 22). Minimal setup — `firebase-admin` + `firebase-functions` only. No TypeScript source files yet.

## Commands

### Setup
```bash
make install                    # Create venv + install requirements.txt
pip install -r requirements-test.txt  # Additional test deps (separate file)
gcloud auth application-default login
gcloud config set project perception-with-intent
```

### Development
```bash
# Agent system (local)
make dev                        # Run local ADK server (localhost:8080)

# Dashboard
cd dashboard && npm install && npm run dev   # Vite dev server

# Verify agent YAML configs load
python perception_app/agent_engine_app.py
```

### Testing
```bash
# Run all tests
make test                       # Note: Makefile uses --cov=app (legacy path)
pytest tests/ -v --cov=perception_app  # Correct coverage target

# By test directory (matches CI)
pytest tests/unit/ -v --no-cov
pytest tests/api/ -v --no-cov
pytest tests/mcp/ -v --no-cov
pytest tests/agent/ -v --no-cov
pytest tests/security/ -v --no-cov

# By marker (defined in pyproject.toml)
pytest -m unit                  # Fast, no external deps
pytest -m smoke                 # Quick smoke tests
pytest -m "not slow"            # Skip slow tests
pytest -m e2e                   # Playwright browser tests (needs: playwright install)

# Single file
pytest tests/unit/test_rss_parsing.py -v

# Full suite (~5,196 tests)
./scripts/run_all_tests.sh
```

### Linting
```bash
make lint                       # Note: Makefile targets app/ (legacy path)
make format                     # Auto-format with black

# Run against correct paths (both app/ and perception_app/ exist)
black --check perception_app/
ruff check perception_app/
mypy perception_app/

# Dashboard
cd dashboard && npm run lint
```

### Deployment
```bash
# MCP to Cloud Run
gcloud run deploy perception-mcp \
  --source perception_app/mcp_service \
  --region us-central1

# Agent Engine
./scripts/deploy_agent_engine.sh

# Dashboard
cd dashboard && npm run build && firebase deploy --only hosting

# Functions
firebase deploy --only functions

# Terraform
cd infra/terraform/envs/dev && tofu init && tofu plan && tofu apply
```

## CI/CD

Push to `main` or `develop` triggers `.github/workflows/ci.yml`:
1. **lint** - black, ruff (both `app/` and `perception_app/` paths)
2. **test** - pytest by directory (unit, api, mcp, agent, security) using `requirements-test.txt`
3. **security** - safety check on requirements.txt
4. **tofu** - OpenTofu init/fmt/validate on `infra/terraform/envs/dev`

Deployment workflows (separate files):
- `deploy-mcp.yml` - MCP to Cloud Run
- `deploy-agent-engine.yml` / `deploy-agents.yml` - Agents to Vertex AI
- `deploy-dashboard.yml` / `deploy-firebase-dashboard.yml` - Dashboard to Firebase

Uses Workload Identity Federation (WIF) for keyless GCP auth.

## Cloud-Only MCP Policy

MCPs run ONLY on Cloud Run. No localhost MCP servers.
- Agents: Local development OK (`make dev`)
- MCP: Cloud Run only — never run locally
- Tests: Use staging Cloud Run URLs
- Dashboard auto-ingestion hits the Cloud Run MCP directly

## Codebase Gotchas

- **Dual source paths**: Both `app/` and `perception_app/` exist. The Makefile lint/test targets reference `app/` (legacy), while active code is in `perception_app/`. CI lints both.
- **`jvp_agent` is top-level**: Not inside `perception_app/`. It's imported directly by `perception_app/main.py`.
- **Named Firestore database**: `perception-db`, not `(default)`. Must pass this name when initializing Firestore clients.
- **pytest asyncio**: `asyncio_mode = "auto"` in pyproject.toml — no need for `@pytest.mark.asyncio`.
- **Line length**: 120 chars (black + ruff both configured to 120).

## Environment Variables

Local development needs no env vars. Production requires:
```bash
VERTEX_PROJECT_ID=perception-with-intent
VERTEX_LOCATION=us-central1
VERTEX_AGENT_ENGINE_ID=4241324322704064512
```

Dashboard uses `VITE_FIREBASE_*` env vars (with hardcoded fallbacks in `dashboard/src/firebase.ts`).

## Documentation

All docs in `000-docs/` with naming convention: `PREFIX-TYPE-CATEGORY-description.md`
- `6767-*` = Evergreen (architecture, guides, plans)
- `0XX-*` = Sequential (AARs, phase reports)

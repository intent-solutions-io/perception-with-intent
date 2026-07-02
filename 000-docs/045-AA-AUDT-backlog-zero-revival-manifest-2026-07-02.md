# Backlog Zero — Perception Revival Manifest (2026-07-02)

**Campaign:** Backlog Zero, Wave 0 (dormant-repo settle)
**Repo:** `jeremylongshore/perception-with-intent` (local: `~/000-projects/perception`)
**Dormant since:** last substantive commit 2026-03-03 (`cff2f0f`); audit-harness baseline merged 2026-05-01 (`089f9e3`)
**Runner:** perception/backlog-zero-runner (db mutation-runner, scout verdicts verified against disk + git log)
**Beads before:** 31 open · **Beads after:** 7 open (1 revival epic + 6 needs-human) · 15 deferred until 2026-10-01 · 10 closed with evidence
**Revival epic:** `perception-b7a` — "Revive or archive perception: settle the dormant backlog and decide the project's future"

Every disposition below was verified against the working tree and git history on 2026-07-02 (skeptic pass: scout "done/obsolete" verdicts were actively refuted where possible before closing).

---

## 1. Closed — done-but-open drift (6)

| Bead | Title | Evidence (stranger-checkable) |
|---|---|---|
| `perception-a27.2` | Add /trigger/ingestion endpoint to MCP Cloud Run service | `perception_app/mcp_service/routers/trigger.py` exists, registered in `mcp_service/main.py:29,102`; commit `0bc83d4`. Closed `--force` past open dep `a27.1` (live-GCP needs-human item that does not gate the code). |
| `perception-pkm` | Implement MCP store_articles | Real Firestore batch writes in `routers/storage.py:85-164` (perception-db client, 500-op batches, URL dedupe) + `tools/agent_7_tools.py store_articles()`; commit `0bc83d4`. |
| `perception-3yj` | Create initial test suite | 47 test files under `tests/` (agent/api/e2e/firebase/gcp/integration/factories/fixtures) + CI `.github/workflows/{ci,test,ci-smoke}.yml`; commit `b48251c`. |
| `perception-l96` | Wire dashboard to Firestore articles | `dashboard/src/pages/Articles.tsx:2,236,257` — `collection(db,'articles')` + `getDocs`; commit `733fdf9`. |
| `perception-75u` | Wire dashboard to Firestore briefs | `dashboard/src/pages/DailyBriefs.tsx:2,75,77` ('briefs' collection) + `components/TodayBriefCard.tsx`; commit `733fdf9`. |
| `perception-q34` | Add live ingestion status to dashboard | `components/SystemActivityCard.tsx:2,62` reads 'ingestion_runs', auto-refresh on `ingestion-complete` event (lines 85-89); commit `733fdf9`. |

## 2. Closed — obsolete: Discord demo cluster (4)

Pivot evidence common to all four: **no Discord integration code exists anywhere in the repo** (the only "discord" hits are a Discord Blog RSS feed URL at `perception_app/mcp_service/config/rss_sources.yaml:216`, a feed-test entry, and planning docs). The shipped replacement delivery surface is the React dashboard (`dashboard/src/pages/*.tsx`, commit `733fdf9`) plus Slack signup notifications (`functions/index.js` `onNewUser` with `SLACK_WEBHOOK_URL`, commit `2bf2d7c`). The original plan is retained as a historical record at `000-docs/6767-PP-PLAN-rssatoms-discord-epic.md`.

| Bead | Title | Additional evidence |
|---|---|---|
| `perception-1sz` | Create Discord server and webhooks for perception demo | No server/webhook ever stood up. |
| `perception-6gz` | Wire Agent 7 to Discord delivery for alerts | Agent 7 is the Firestore storage manager (`tools/agent_7_tools.py`); no delivery path. |
| `perception-6kz` | Add send_discord_alert MCP tool | Shipped notifications router (`routers/notifications.py:31`) targets `slack\|email\|webhook` only. |
| `perception-d2a` | Create Discord invite and welcome flow | Onboarding is the dashboard login flow (`dashboard/src/pages/Login.tsx`, Firebase Auth). |

## 3. Deferred until 2026-10-01 — still valid, project dormant (15)

All reparented under `perception-b7a` where orphaned; each carries a defer comment with verification detail.

| Bead | Title | One-line verification |
|---|---|---|
| `perception-2sm` | Complete Terraform agent_runtime | `infra/terraform/modules/agent_runtime/` exists but is TODO(ask) placeholders; re-scope vs GCP exodus on revival. |
| `perception-5ay` | Add Gemini API calls to Agent 4 | `tools/agent_4_tools.py:193,208,225` still TODO. |
| `perception-7z6` | Implement Agent 2 Topic Manager | `tools/agent_2_tools.py` all TODO stubs (lines 29,44,65,83). |
| `perception-bzu` | Implement Agent 5 Alert & Anomaly | `tools/agent_5_tools.py` all TODO stubs (lines 31,48,69,86). |
| `perception-cw3` | Implement remaining MCP tools | **Scout "done" verdict REFUTED** — see § 5. |
| `perception-t89` | Implement MCP generate_brief | `routers/briefs.py` returns "PHASE 4: Fake response"; no Gemini call. |
| `perception-eg5` | Create rssatoms category to perception section mapping | Raw per-feed categories exist (commit `fa4bf43`) but no category→section mapping anywhere. |
| `perception-w1y` | Document demo script for stakeholder presentations | Not Discord-specific; no demo-script doc in `000-docs/`; dashboard demo still viable on revival. |
| `perception-80v.1` | Uncomment and configure OpenTelemetry in MCP service | OTel imports still commented out at `mcp_service/main.py:25-26`. |
| `perception-80v.2` | Add Cloud Trace exporter configuration | No exporter configured; trace backend to be re-scoped vs GCP exodus. |
| `perception-t9w.1` | Wire daily_summaries Firestore writes into ingestion pipeline | No `daily_summaries` writes in any Python file (rg confirms absent). |
| `perception-t9w` | PERC-CONTENT: Brief & Summary Generation (epic) | Only child deferred; epic deferred with it. |
| `perception-80v` | PERC-OBSERVABILITY: OpenTelemetry + Monitoring (epic) | Code children deferred; child `80v.3` remains open needs-human. |
| `perception-a27` | PERC-INGEST: Automated Daily Ingestion Pipeline (epic) | Code child `a27.2` shipped/closed; `a27.1/.3/.4` remain open needs-human. |
| `perception-s9t` | PERC-NOTIFY: User Signup Slack Notifications (epic) | Code shipped (`2bf2d7c`); `s9t.2/.3` remain open needs-human. |

## 4. Needs-human — open, awaiting Jeremy (6) · decision-by 2026-07-16

All are live GCP/Firebase state the repo cannot confirm, and/or NEW GCP infrastructure under the company GCP exodus (prod consolidated on the Contabo VPS 2026-05-01).

| Bead | Title | Question | Recommended default |
|---|---|---|---|
| `perception-a27.1` | Enable Cloud Scheduler API on GCP project | Enable a new GCP API under exodus? | Obsolete under GCP exodus; re-scope scheduling (VPS cron/systemd timer) on revival. |
| `perception-a27.3` | Create Cloud Scheduler job (daily 6am UTC) | Create new GCP infra for a shipped endpoint? | Obsolete under GCP exodus; trigger from VPS on revival. |
| `perception-a27.4` | Configure MCP_BASE_URL env var on Agent Engine runtime | Touch live Agent Engine (itself under exodus review)? | Obsolete under GCP exodus; re-scope agent runtime hosting on revival. |
| `perception-s9t.2` | Deploy Cloud Functions (firebase deploy --only functions) | Was the shipped Slack notifier ever deployed; should it be? | Obsolete under GCP exodus; re-scope signup notifications on revival. |
| `perception-s9t.3` | Test Slack notification with new dashboard signup | E2E test blocked on s9t.2 + live webhook secret. | Obsolete alongside s9t.2; re-test once path re-scoped. |
| `perception-80v.3` | Verify traces flowing in Cloud Console | OTel not enabled in code and Cloud Trace under exodus — verify what? | Obsolete under GCP exodus; verify against a non-GCP trace backend on revival. |

## 5. Refuted scout verdicts (skeptic pass findings)

1. **`perception-cw3` "Implement remaining MCP tools" — done-drift verdict REFUTED.** The scout cited "fetch_webpage/fetch_api_feed/logging/notifications routers all exist"; they exist and are registered, but `fetch_webpage` (`routers/webpage.py`), `fetch_api_feed` (`routers/api.py`), and `send_notification` (`routers/notifications.py`) all still return literal "PHASE 4: Fake response" stub data. Only `fetch_rss_feed`, `store_articles`, and `log_ingestion_run` (real Firestore writes to `ingestion_runs`) are implemented. Deferred, not closed.
2. **Brief-generation cluster partially refuted:** `store_articles` is real (closed `pkm`) but `generate_brief` (`routers/briefs.py`) is a hardcoded Phase-4 stub — `t89` deferred, not closed.
3. Scout's likely_split estimated 8 done-but-open; disk verification supported 6 (the two overcounts are items 1–2 above).

## 6. In-flight residue (as found; not touched by this run)

- **In-progress beads:** none (0 in_progress, 0 blocked before and after the run).
- **Open PRs:** none (`gh pr list` empty).
- **Branches:** local `feat/install-audit-harness-baseline` (2026-05-01; its remote was deleted after merge as PR #10 → `089f9e3`, so the local copy is merged residue and safe to delete on revival); remotes `origin/feat/dashboard-landing-auto-ingestion` (2026-02-26, merged as #9), `origin/fix/ingestion-mcp-parameter-mismatch` (2026-02-12, merged as #4).
- **Dirty working tree on main (left alone per campaign rules):** pre-staged `.beads/` daemon/index entries (`daemon.lock`, `dolt-monitor.pid.lock`, `interactions.jsonl`, `issues.jsonl.backup`, `last-touched` deletion, `metadata.json`, `.beads/.gitignore`) plus staged `.gitignore`, `AGENTS.md` and unstaged `LICENSE`, `README.md` edits. These predate the run and were deliberately not committed; only `.beads/issues.jsonl` (tracked) ships in this PR.
- **Local main is behind `origin/main`** (`cff2f0f` vs `089f9e3`) — fast-forward on next active session.

## 7. End-state verification

From re-exported `.beads/issues.jsonl` after the final write: **44 beads total — 22 closed, 15 deferred (until 2026-10-01), 7 open.** The 7 open are exactly the revival epic `perception-b7a` plus the 6 needs-human beads in § 4. Backlog Zero end-state satisfied.

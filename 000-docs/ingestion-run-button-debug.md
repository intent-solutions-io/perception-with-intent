# Ingestion Run Button - Debug Runbook

## System Map

```text
Dashboard (IngestionButton.tsx)
    │
    ├── POST /trigger/ingestion → 202 Accepted {run_id, poll_url}
    │   └── Background: run_ingestion_pipeline()
    │       ├── Phase: loading_sources (rss_sources.yaml)
    │       ├── Phase: fetching_feeds (128x /mcp/tools/fetch_rss_feed)
    │       ├── Phase: storing_articles (batches → /mcp/tools/store_articles)
    │       └── Phase: upserting_authors (/mcp/tools/upsert_author)
    │
    ├── Poll: GET /trigger/ingestion/{run_id} (every 3s)
    │   └── Reads Firestore ingestion_runs/{run_id}
    │
    └── On completion: CustomEvent('ingestion-complete')
        └── SystemActivityCard auto-refreshes
```

## Failure Taxonomy

### F1: No toast appears after clicking Run Ingestion
- **Cause**: POST failed (network, CORS, Cloud Run cold start timeout)
- **Debug**:
  ```bash
  curl -X POST <SERVICE_URL>/trigger/ingestion \
    -H "Content-Type: application/json" \
    -d '{"trigger":"manual"}'
  ```
- **Fix**: Check Cloud Run logs, verify service is deployed, check CORS config

### F2: "Already in progress" when nothing is running
- **Cause**: Previous run stuck in `accepted` or `running` status
- **Debug**:
  ```bash
  # Check Firestore for stuck runs
  gcloud firestore documents list \
    --project=perception-with-intent \
    --database=perception-db \
    --collection=ingestion_runs \
    --filter='status="running"'
  ```
- **Fix**: Stale runs (>10 min) are auto-cleaned. Manual fix: update status to `failed` in Firestore console

### F3: Stuck forever (spinner never stops)
- **Cause**: Background task crashed, Firestore never updated to terminal state
- **Debug**: Check Cloud Run logs for unhandled exceptions
  ```bash
  gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="perception-mcp" AND severity>=ERROR' \
    --project=perception-with-intent --limit=20 --format=json
  ```
- **Fix**: Dashboard has 5-minute stuck detection. Add catch-all in `run_ingestion_pipeline`

### F4: No data in SystemActivityCard
- **Cause**: Firestore docs not being written, or Firebase client SDK can't read them
- **Debug**:
  ```bash
  # Check if docs exist
  gcloud firestore documents list \
    --project=perception-with-intent \
    --database=perception-db \
    --collection=ingestion_runs --limit=5
  ```
- **Fix**: Verify `ingestion_runs` collection exists, check Firestore security rules

### F5: High error count in completed run
- **Cause**: RSS feeds returning errors (timeouts, 403s, DNS failures)
- **Debug**: Check `errors` array in Firestore doc
- **Fix**: Review error patterns, update/remove broken feeds from `rss_sources.yaml`

### F6: 0 articles stored
- **Cause**: All feeds failed, or `store_articles` endpoint broken
- **Debug**:
  ```bash
  curl -X POST <SERVICE_URL>/mcp/tools/store_articles \
    -H "Content-Type: application/json" \
    -d '{"run_id":"test","articles":[{"title":"t","url":"https://x.com","source_id":"s","published_at":"2025-01-01"}]}'
  ```
- **Fix**: Check Firestore permissions for MCP service account

### F7: Cold start timeout on POST
- **Cause**: Cloud Run container starting up, POST times out before ready
- **Debug**: Check Cloud Run startup latency in metrics
- **Fix**: `--cpu-boost` flag enables faster cold starts; consider `--min-instances 1`

## Key Diagnostic Queries

### Cloud Logging
```bash
# All ingestion run logs
gcloud logging read 'resource.type="cloud_run_revision" AND jsonPayload.router="trigger"' \
  --project=perception-with-intent --limit=50

# Specific run
gcloud logging read 'resource.type="cloud_run_revision" AND jsonPayload.run_id="run-XXXXX"' \
  --project=perception-with-intent --limit=50

# Errors only
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR AND resource.labels.service_name="perception-mcp"' \
  --project=perception-with-intent --limit=20
```

### Firestore
```bash
# List recent runs
gcloud firestore documents list \
  --project=perception-with-intent \
  --database=perception-db \
  --collection=ingestion_runs --limit=10

# Get specific run
gcloud firestore documents get \
  --project=perception-with-intent \
  --database=perception-db \
  ingestion_runs/run-XXXXX
```

### curl Commands
```bash
# Health check
curl <SERVICE_URL>/health

# Trigger ingestion
curl -X POST <SERVICE_URL>/trigger/ingestion \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual","time_window_hours":24,"max_items_per_source":50}'

# Check run status
curl <SERVICE_URL>/trigger/ingestion/run-XXXXX
```

## SLO Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| POST response time | < 1s | > 3s |
| End-to-end success rate | > 95% | < 90% |
| Source error rate | < 10% | > 25% |
| Total duration | < 300s | > 600s |
| Articles stored per run | > 100 | < 10 |

## Architecture Notes

- Background task uses `asyncio.create_task()` - requires `--no-cpu-throttling` on Cloud Run
- `--cpu-boost` gives extra CPU during cold starts
- Idempotency guard prevents concurrent runs (10 min stale timeout)
- Firestore composite index on `[status ASC, startedAt DESC]` for active run query

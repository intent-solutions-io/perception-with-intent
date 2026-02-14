"""
Trigger Router

Orchestration endpoints for running full ingestion pipelines.
Not an MCP tool - this is a higher-level coordinator that calls MCP tools internally.

POST /ingestion → 202 Accepted, creates Firestore run doc, fires background task
GET /ingestion/{run_id} → reads run status from Firestore
"""

import asyncio
import hashlib
import logging
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from google.cloud import firestore

logger = logging.getLogger(__name__)
router = APIRouter()

# Firestore client (lazy init)
_db: Optional[firestore.Client] = None


def _get_db() -> firestore.Client:
    """Get or create Firestore client."""
    global _db
    if _db is None:
        _db = firestore.Client(project="perception-with-intent", database="perception-db")
    return _db


# --- Request/Response Models ---


class TriggerIngestionRequest(BaseModel):
    """Request schema for trigger ingestion endpoint."""

    trigger: str = Field("manual", description="Trigger source: manual, scheduled, test")
    time_window_hours: int = Field(24, description="Only fetch articles from last N hours", ge=1, le=720)
    max_items_per_source: int = Field(50, description="Max articles per source", ge=1, le=500)


class TriggerAcceptedResponse(BaseModel):
    """Response returned immediately when ingestion is accepted."""

    run_id: str
    status: str = "accepted"
    message: str
    poll_url: str


class IngestionRunStatus(BaseModel):
    """Response for GET /ingestion/{run_id}."""

    run_id: str
    status: str
    phase: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    stats: Optional[Dict[str, Any]] = None
    errors: Optional[List[Dict[str, Any]]] = None
    is_successful: Optional[bool] = None


# --- Helper Functions ---


def evaluate_run_success(run_data: Dict[str, Any]) -> bool:
    """Evaluate whether an ingestion run was successful.

    Criteria:
    - articles_stored > 0
    - error_rate < 50% (sourcesFailed / sourcesChecked)
    - duration < 300s
    """
    stats = run_data.get("stats", {})
    articles_stored = stats.get("articlesStored", 0)
    sources_checked = stats.get("sourcesChecked", 0)
    sources_failed = stats.get("sourcesFailed", 0)
    duration = run_data.get("duration", 0)

    if articles_stored <= 0:
        return False

    if sources_checked > 0 and (sources_failed / sources_checked) >= 0.5:
        return False

    if duration and duration > 300:
        return False

    return True


async def check_active_run(db: firestore.Client) -> Optional[str]:
    """Check if there's an active ingestion run (idempotency guard).

    Returns run_id if an active run exists (blocks new run).
    Marks stale runs (>10 min) as failed and allows new run.
    """
    runs_ref = db.collection("ingestion_runs")
    query = (
        runs_ref.where(filter=firestore.FieldFilter("status", "in", ["accepted", "running"]))
        .order_by("startedAt", direction=firestore.Query.DESCENDING)
        .limit(1)
    )

    docs = query.stream()
    for doc in docs:
        data = doc.to_dict()
        started_at = data.get("startedAt")
        if started_at:
            if hasattr(started_at, "timestamp"):
                age_seconds = time.time() - started_at.timestamp()
            else:
                logger.error(
                    json.dumps(
                        {
                            "severity": "ERROR",
                            "message": f"Invalid startedAt type for run {doc.id}: {type(started_at)}",
                            "router": "trigger",
                        }
                    )
                )
                age_seconds = 601  # Treat as stale to avoid blocking all future runs

            if age_seconds < 600:  # 10 minutes
                return doc.id
            else:
                # Stale run - mark as failed
                doc.reference.update(
                    {
                        "status": "failed",
                        "phase": "stale_cleanup",
                        "completedAt": firestore.SERVER_TIMESTAMP,
                        "errors": [{"message": f"Marked as failed: stale after {int(age_seconds)}s"}],
                    }
                )
                logger.warning(
                    json.dumps(
                        {
                            "severity": "WARNING",
                            "message": f"Cleaned up stale run {doc.id} after {int(age_seconds)}s",
                            "router": "trigger",
                        }
                    )
                )

    return None


def load_sources() -> List[Dict[str, Any]]:
    """Load RSS sources from config/rss_sources.yaml."""
    yaml_path = Path(__file__).parent.parent / "config" / "rss_sources.yaml"

    try:
        with open(yaml_path, "r") as f:
            config = yaml.safe_load(f)

        sources = []
        for source in config.get("sources", []):
            if source.get("active", True):
                source_id = source["name"].lower().replace(" ", "-").replace("/", "-")
                sources.append(
                    {
                        "source_id": source_id,
                        "name": source["name"],
                        "url": source["url"],
                        "category": source.get("category", "general"),
                    }
                )

        logger.info(
            json.dumps({"severity": "INFO", "message": f"Loaded {len(sources)} sources from YAML", "router": "trigger"})
        )
        return sources

    except FileNotFoundError:
        logger.error(
            json.dumps({"severity": "ERROR", "message": f"YAML config not found: {yaml_path}", "router": "trigger"})
        )
        return []
    except Exception as e:
        logger.error(json.dumps({"severity": "ERROR", "message": f"Failed to load sources: {e}", "router": "trigger"}))
        return []


async def fetch_single_feed(
    client: httpx.AsyncClient,
    source: Dict[str, Any],
    time_window_hours: int,
    max_items: int,
    run_id: str,
) -> Dict[str, Any]:
    """Fetch a single RSS feed via the local MCP endpoint."""
    try:
        response = await client.post(
            "http://localhost:8080/mcp/tools/fetch_rss_feed",
            json={
                "feed_url": source["url"],
                "time_window_hours": time_window_hours,
                "max_items": max_items,
                "request_id": f"{run_id}_{source['source_id']}",
            },
        )
        response.raise_for_status()
        data = response.json()
        return {
            "source": source,
            "articles": data.get("articles", []),
            "feed_metadata": data.get("feed_metadata"),
            "article_count": data.get("article_count", 0),
        }
    except Exception as e:
        return {
            "source": source,
            "articles": [],
            "feed_metadata": None,
            "article_count": 0,
            "error": str(e),
        }


# --- Background Pipeline ---


async def run_ingestion_pipeline(
    run_id: str,
    request: TriggerIngestionRequest,
    db: firestore.Client,
) -> None:
    """Run the full ingestion pipeline as a background task.

    Updates Firestore doc progressively through phases:
    loading_sources → fetching_feeds → storing_articles → upserting_authors → done
    """
    doc_ref = db.collection("ingestion_runs").document(run_id)
    start_time = time.time()

    try:
        # Phase: loading_sources
        doc_ref.update({"status": "running", "phase": "loading_sources"})

        sources = load_sources()
        if not sources:
            doc_ref.update(
                {
                    "status": "failed",
                    "phase": "loading_sources",
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "duration": round(time.time() - start_time, 2),
                    "errors": [{"message": "No sources loaded from config"}],
                }
            )
            return

        doc_ref.update(
            {
                "phase": "fetching_feeds",
                "stats": {"sourcesChecked": len(sources), "sourcesFailed": 0, "articlesFetched": 0},
            }
        )

        # Phase: fetching_feeds
        semaphore = asyncio.Semaphore(10)
        errors: List[Dict[str, Any]] = []
        all_articles: List[Dict[str, Any]] = []
        sources_processed = 0

        async def fetch_with_semaphore(client, source):
            async with semaphore:
                return await fetch_single_feed(
                    client, source, request.time_window_hours, request.max_items_per_source, run_id
                )

        async with httpx.AsyncClient(timeout=60.0) as client:
            tasks = [fetch_with_semaphore(client, s) for s in sources]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        sources_failed = 0
        for result in results:
            if isinstance(result, Exception):
                errors.append({"message": str(result)})
                sources_failed += 1
                continue

            sources_processed += 1
            source = result["source"]

            if "error" in result:
                errors.append(
                    {
                        "source": source["name"],
                        "url": source["url"],
                        "message": result["error"],
                    }
                )
                sources_failed += 1
                continue

            for raw_article in result["articles"]:
                all_articles.append(
                    {
                        "title": raw_article.get("title", "Untitled"),
                        "url": raw_article.get("url", ""),
                        "source_id": source["source_id"],
                        "source_name": source["name"],
                        "category": source["category"],
                        "published_at": raw_article.get("published_at", ""),
                        "summary": raw_article.get("summary"),
                        "content": raw_article.get("raw_content") or raw_article.get("content_snippet"),
                        "categories": raw_article.get("categories", []),
                    }
                )

        total_fetched = len(all_articles)

        doc_ref.update(
            {
                "phase": "storing_articles",
                "stats": {
                    "sourcesChecked": len(sources),
                    "sourcesFailed": sources_failed,
                    "articlesFetched": total_fetched,
                    "articlesStored": 0,
                },
            }
        )

        # Phase: storing_articles
        articles_stored = 0
        if all_articles:
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    batch_size = 200
                    for i in range(0, len(all_articles), batch_size):
                        chunk = all_articles[i : i + batch_size]
                        store_response = await client.post(
                            "http://localhost:8080/mcp/tools/store_articles",
                            json={
                                "run_id": run_id,
                                "articles": chunk,
                            },
                        )
                        if store_response.status_code == 200:
                            store_data = store_response.json()
                            articles_stored += store_data.get("stored_count", 0)
                        else:
                            errors.append(
                                {
                                    "message": f"store_articles returned {store_response.status_code}",
                                    "batch_start": i,
                                }
                            )
            except Exception as e:
                errors.append({"message": f"store_articles failed: {e}"})

        doc_ref.update(
            {
                "phase": "upserting_authors",
                "stats": {
                    "sourcesChecked": len(sources),
                    "sourcesFailed": sources_failed,
                    "articlesFetched": total_fetched,
                    "articlesStored": articles_stored,
                    "authorsUpserted": 0,
                },
            }
        )

        # Phase: upserting_authors
        authors_upserted = 0
        feed_groups: Dict[str, Dict[str, Any]] = {}
        for result in results:
            if isinstance(result, Exception) or "error" in result:
                continue
            source = result["source"]
            feed_url = source["url"]
            if feed_url not in feed_groups:
                feed_groups[feed_url] = {
                    "articles": [],
                    "feed_metadata": result.get("feed_metadata"),
                }
            for raw_article in result["articles"]:
                feed_groups[feed_url]["articles"].append(
                    {
                        "title": raw_article.get("title", "Untitled"),
                        "url": raw_article.get("url", ""),
                        "source_id": source["source_id"],
                        "published_at": raw_article.get("published_at", ""),
                        "summary": raw_article.get("summary"),
                        "categories": raw_article.get("categories", []),
                    }
                )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for feed_url, group in feed_groups.items():
                    if not group["articles"]:
                        continue
                    try:
                        resp = await client.post(
                            "http://localhost:8080/mcp/tools/upsert_author",
                            json={
                                "feed_url": feed_url,
                                "articles": group["articles"],
                                "feed_metadata": group["feed_metadata"],
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            if data.get("status") in ("created", "updated"):
                                authors_upserted += 1
                    except Exception as e:
                        errors.append({"message": f"upsert_author failed for {feed_url}: {e}"})
        except Exception as e:
            errors.append({"message": f"Author upsert phase failed: {e}"})

        # Final update
        duration = round(time.time() - start_time, 2)
        if errors and articles_stored == 0:
            final_status = "failed"
        elif errors:
            final_status = "completed_with_errors"
        else:
            final_status = "completed"

        doc_ref.update(
            {
                "status": final_status,
                "phase": "done",
                "completedAt": firestore.SERVER_TIMESTAMP,
                "duration": duration,
                "stats": {
                    "sourcesChecked": len(sources),
                    "sourcesFailed": sources_failed,
                    "articlesFetched": total_fetched,
                    "articlesStored": articles_stored,
                    "articlesIngested": articles_stored,
                    "authorsUpserted": authors_upserted,
                },
                "errors": errors[:50],
            }
        )

        logger.info(
            json.dumps(
                {
                    "severity": "INFO",
                    "message": "Ingestion run completed",
                    "router": "trigger",
                    "run_id": run_id,
                    "status": final_status,
                    "sources_processed": sources_processed,
                    "articles_fetched": total_fetched,
                    "articles_stored": articles_stored,
                    "authors_upserted": authors_upserted,
                    "error_count": len(errors),
                    "duration_seconds": duration,
                }
            )
        )

    except Exception as e:
        duration = round(time.time() - start_time, 2)
        logger.error(
            json.dumps(
                {
                    "severity": "ERROR",
                    "message": f"Ingestion pipeline failed: {e}",
                    "router": "trigger",
                    "run_id": run_id,
                }
            )
        )
        try:
            doc_ref.update(
                {
                    "status": "failed",
                    "completedAt": firestore.SERVER_TIMESTAMP,
                    "duration": duration,
                    "errors": [{"message": f"Pipeline exception: {e}"}],
                }
            )
        except Exception:
            pass  # If Firestore itself is down, we can't do much


# --- Endpoints ---


@router.post("/ingestion", response_model=TriggerAcceptedResponse, status_code=202)
async def trigger_ingestion(request: TriggerIngestionRequest):
    """
    Trigger a full ingestion pipeline across all configured sources.

    Returns 202 Accepted immediately with a run_id.
    The pipeline runs in the background, updating Firestore progressively.
    Poll GET /trigger/ingestion/{run_id} for status.
    """
    db = _get_db()
    run_id = f"run-{uuid.uuid4().hex[:12]}"

    # Idempotency guard: reject if another run is active
    active_run_id = await check_active_run(db)
    if active_run_id:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "An ingestion run is already in progress",
                "active_run_id": active_run_id,
                "poll_url": f"/trigger/ingestion/{active_run_id}",
            },
        )

    logger.info(
        json.dumps(
            {
                "severity": "INFO",
                "message": "Accepting ingestion run",
                "router": "trigger",
                "run_id": run_id,
                "trigger": request.trigger,
            }
        )
    )

    # Create initial Firestore doc
    db.collection("ingestion_runs").document(run_id).set(
        {
            "status": "accepted",
            "phase": "initializing",
            "trigger": request.trigger,
            "startedAt": firestore.SERVER_TIMESTAMP,
            "timeWindowHours": request.time_window_hours,
            "maxItemsPerSource": request.max_items_per_source,
            "stats": {},
            "errors": [],
        }
    )

    # Fire background task
    asyncio.create_task(run_ingestion_pipeline(run_id, request, db))

    return TriggerAcceptedResponse(
        run_id=run_id,
        status="accepted",
        message="Ingestion pipeline started. Poll the poll_url for progress.",
        poll_url=f"/trigger/ingestion/{run_id}",
    )


@router.get("/ingestion/{run_id}", response_model=IngestionRunStatus)
async def get_ingestion_status(run_id: str):
    """
    Get the status of an ingestion run.

    Returns current phase, stats, and completion info.
    """
    db = _get_db()
    doc_ref = db.collection("ingestion_runs").document(run_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail=f"Ingestion run '{run_id}' not found")

    data = doc.to_dict()

    # Format timestamps
    started_at = None
    completed_at = None
    if data.get("startedAt"):
        ts = data["startedAt"]
        if hasattr(ts, "isoformat"):
            started_at = ts.isoformat()
    if data.get("completedAt"):
        ts = data["completedAt"]
        if hasattr(ts, "isoformat"):
            completed_at = ts.isoformat()

    # Evaluate success for terminal states
    is_successful = None
    if data.get("status") in ("completed", "completed_with_errors", "failed"):
        is_successful = evaluate_run_success(data)

    return IngestionRunStatus(
        run_id=run_id,
        status=data.get("status", "unknown"),
        phase=data.get("phase"),
        started_at=started_at,
        completed_at=completed_at,
        duration_seconds=data.get("duration"),
        stats=data.get("stats"),
        errors=data.get("errors"),
        is_successful=is_successful,
    )

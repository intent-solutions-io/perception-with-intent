"""
Logging Tool Router

Handles ingestion run logging to Firestore.
Writes real documents to ingestion_runs collection.
"""

import logging as python_logging
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from google.cloud import firestore

logger = python_logging.getLogger(__name__)
router = APIRouter()

# Firestore client (lazy init)
_db: Optional[firestore.Client] = None


def _get_db() -> firestore.Client:
    """Get or create Firestore client."""
    global _db
    if _db is None:
        _db = firestore.Client(project="perception-with-intent", database="perception-db")
    return _db


# Pydantic Models
class IngestionStats(BaseModel):
    """Statistics for an ingestion run."""

    sources_checked: int
    articles_fetched: int
    articles_stored: int
    duplicates_skipped: int
    brief_generated: bool
    errors: List[str] = Field(default_factory=list)


class LogIngestionRunRequest(BaseModel):
    """Request schema for log_ingestion_run tool."""

    run_id: str = Field(..., description="Ingestion run ID")
    status: str = Field(..., description="Run status: running | completed | failed")
    stats: IngestionStats
    started_at: str = Field(..., description="Run start time (ISO 8601)")
    completed_at: Optional[str] = Field(None, description="Run completion time (ISO 8601)")


class LogIngestionRunResponse(BaseModel):
    """Response schema for log_ingestion_run tool."""

    run_id: str
    logged_at: str
    firestore_path: str


# Tool Endpoint
@router.post("/log_ingestion_run", response_model=LogIngestionRunResponse)
async def log_ingestion_run(request: LogIngestionRunRequest):
    """
    Create or update an ingestion run record in Firestore.

    Writes to ingestion_runs/{run_id} with merge semantics.
    """
    logger.info(
        json.dumps(
            {
                "severity": "INFO",
                "message": "Logging ingestion run",
                "mcp_tool": "log_ingestion_run",
                "run_id": request.run_id,
                "status": request.status,
            }
        )
    )

    db = _get_db()
    doc_ref = db.collection("ingestion_runs").document(request.run_id)

    doc_data = {
        "status": request.status,
        "startedAt": datetime.fromisoformat(request.started_at),
        "stats": {
            "sourcesChecked": request.stats.sources_checked,
            "articlesFetched": request.stats.articles_fetched,
            "articlesStored": request.stats.articles_stored,
            "articlesIngested": request.stats.articles_stored,
            "articlesDeduplicated": request.stats.duplicates_skipped,
            "briefGenerated": request.stats.brief_generated,
            "errors": request.stats.errors,
        },
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    if request.completed_at:
        doc_data["completedAt"] = datetime.fromisoformat(request.completed_at)
        # Calculate duration
        started = datetime.fromisoformat(request.started_at)
        completed = datetime.fromisoformat(request.completed_at)
        doc_data["duration"] = round((completed - started).total_seconds(), 2)

    try:
        doc_ref.set(doc_data, merge=True)
    except Exception as e:
        logger.error(
            json.dumps(
                {
                    "severity": "ERROR",
                    "message": f"Failed to write ingestion run to Firestore: {e}",
                    "mcp_tool": "log_ingestion_run",
                    "run_id": request.run_id,
                }
            )
        )
        raise HTTPException(status_code=500, detail=f"Firestore write failed: {e}")

    logged_at = datetime.now(tz=timezone.utc).isoformat()

    logger.info(
        json.dumps(
            {
                "severity": "INFO",
                "message": "Ingestion run logged successfully",
                "mcp_tool": "log_ingestion_run",
                "run_id": request.run_id,
                "status": request.status,
            }
        )
    )

    return LogIngestionRunResponse(
        run_id=request.run_id,
        logged_at=logged_at,
        firestore_path=f"ingestion_runs/{request.run_id}",
    )

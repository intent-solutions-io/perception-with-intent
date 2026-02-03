"""
Tools for Agent 7 (Storage Manager).

These functions handle all Firestore writes including articles, briefs,
and ingestion run finalization.

Phase E2E: Implements production-ready Firestore writes with batch operations
and deduplication.
"""

from typing import Any, Dict, List
from datetime import datetime, timezone
import logging
import json
import hashlib
from google.cloud import firestore

logger = logging.getLogger(__name__)

# Lazy-initialized Firestore client
_db_client = None


def _get_db():
    """Get or initialize Firestore client."""
    global _db_client
    if _db_client is None:
        _db_client = firestore.Client(
            project="perception-with-intent",
            database="perception-db"
        )
    return _db_client


def _generate_article_id(url: str) -> str:
    """
    Generate deterministic article ID from URL.

    Args:
        url: Article URL

    Returns:
        SHA256 hash of URL (first 16 chars)
    """
    if not url:
        # Fallback to timestamp-based ID if no URL
        return f"article-{datetime.now(timezone.utc).isoformat()}"

    url_hash = hashlib.sha256(url.encode()).hexdigest()
    return f"art-{url_hash[:16]}"


def store_articles(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Batch write articles to Firestore /articles collection with deduplication.

    Args:
        articles: List of validated article dicts.

    Returns:
        Storage result with:
        - stored_count (int): Number of articles successfully stored
        - errors (list): Any failed writes
    """
    db = _get_db()
    errors = []
    stored_count = 0

    # Deduplicate by URL
    unique_articles = deduplicate_by_url(articles)

    logger.info(json.dumps({
        "severity": "INFO",
        "tool": "agent_7",
        "operation": "store_articles",
        "input_count": len(articles),
        "unique_count": len(unique_articles)
    }))

    # Firestore batches limited to 500 operations
    batch_size = 500

    for i in range(0, len(unique_articles), batch_size):
        batch_articles = unique_articles[i:i + batch_size]
        batch = db.batch()

        try:
            for article in batch_articles:
                # Generate article ID from URL hash
                article_id = _generate_article_id(article.get("url", ""))

                # Add timestamp
                article["stored_at"] = datetime.now(timezone.utc).isoformat()

                # Write to Firestore
                doc_ref = db.collection("articles").document(article_id)
                batch.set(doc_ref, article, merge=True)  # merge=True for upsert behavior

            # Commit batch
            batch.commit()
            stored_count += len(batch_articles)

            logger.info(json.dumps({
                "severity": "INFO",
                "tool": "agent_7",
                "operation": "store_articles_batch",
                "batch_stored": len(batch_articles),
                "total_stored": stored_count
            }))

        except Exception as e:
            error_msg = f"Batch write failed: {str(e)}"
            errors.append(error_msg)
            logger.error(json.dumps({
                "severity": "ERROR",
                "tool": "agent_7",
                "operation": "store_articles_batch",
                "error": error_msg
            }))

    logger.info(json.dumps({
        "severity": "INFO",
        "tool": "agent_7",
        "operation": "store_articles",
        "stored_count": stored_count,
        "error_count": len(errors)
    }))

    return {
        "stored_count": stored_count,
        "errors": errors
    }


def store_brief(brief: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write brief to Firestore /briefs collection.

    Args:
        brief: Validated brief dict.

    Returns:
        Storage result with:
        - brief_id (str): Document ID
        - status (str): "stored" or "failed"
        - error (str, optional): Error message if failed
    """
    db = _get_db()

    try:
        brief_id = brief.get("brief_id")
        if not brief_id:
            return {
                "brief_id": None,
                "status": "failed",
                "error": "Missing brief_id"
            }

        # Add storage timestamp
        brief["stored_at"] = datetime.now(timezone.utc).isoformat()

        # Write to Firestore using brief_id as document ID
        doc_ref = db.collection("briefs").document(brief_id)
        doc_ref.set(brief)

        logger.info(json.dumps({
            "severity": "INFO",
            "tool": "agent_7",
            "operation": "store_brief",
            "brief_id": brief_id,
            "status": "stored"
        }))

        return {
            "brief_id": brief_id,
            "status": "stored"
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(json.dumps({
            "severity": "ERROR",
            "tool": "agent_7",
            "operation": "store_brief",
            "error": error_msg
        }))

        return {
            "brief_id": brief.get("brief_id"),
            "status": "failed",
            "error": error_msg
        }


def update_ingestion_run(run_id: str, status: str, stats: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Update ingestion run record in Firestore /ingestion_runs collection.

    Args:
        run_id: Ingestion run ID.
        status: Run status ("success" or "failed").
        stats: Optional run statistics (articles_ingested, articles_selected, brief_id, etc.)

    Returns:
        Storage result with:
        - run_id (str): The run ID
        - status (str): "updated" or "failed"
        - error (str, optional): Error message if failed
    """
    db = _get_db()

    try:
        # Build update payload
        update_data = {
            "status": status,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }

        # Merge in stats if provided
        if stats:
            update_data.update(stats)

        # Update Firestore document
        doc_ref = db.collection("ingestion_runs").document(run_id)
        doc_ref.set(update_data, merge=True)

        logger.info(json.dumps({
            "severity": "INFO",
            "tool": "agent_7",
            "operation": "update_ingestion_run",
            "run_id": run_id,
            "status": status,
            "stats": stats or {}
        }))

        return {
            "run_id": run_id,
            "status": "updated"
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(json.dumps({
            "severity": "ERROR",
            "tool": "agent_7",
            "operation": "update_ingestion_run",
            "run_id": run_id,
            "error": error_msg
        }))

        return {
            "run_id": run_id,
            "status": "failed",
            "error": error_msg
        }


def deduplicate_by_url(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate articles by URL before storage.

    Args:
        articles: List of articles.

    Returns:
        Deduplicated list of articles.
    """
    seen_urls = set()
    unique_articles = []

    for article in articles:
        url = article.get("url")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_articles.append(article)

    return unique_articles


def handle_storage_errors(errors: List[Dict[str, Any]]) -> None:
    """
    Stub: Handle storage errors with retry logic and logging.

    Args:
        errors: List of error dicts from failed writes.
    """
    # TODO: implement retry logic with exponential backoff
    # TODO: log errors to Cloud Logging
    # TODO: emit OpenTelemetry error events
    pass


def batch_write_articles(articles: List[Dict[str, Any]], batch_size: int = 500) -> List[Dict[str, Any]]:
    """
    Stub: Write articles in batches for efficiency.

    Firestore has a limit of 500 writes per batch.

    Args:
        articles: List of articles to write.
        batch_size: Max writes per batch (default 500).

    Returns:
        List of storage result dicts, one per batch.
    """
    # TODO: implement batched Firestore writes
    results = []
    for i in range(0, len(articles), batch_size):
        batch = articles[i : i + batch_size]
        result = store_articles(batch)
        results.append(result)

    return results

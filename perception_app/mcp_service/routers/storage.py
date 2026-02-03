"""
Storage Tool Router

Handles Firestore writes for articles and data persistence.

Phase 4: Returns fake but structurally correct responses.
Phase 5: Wire up real Firestore batch writes.
"""

import hashlib
import logging
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from fastapi import APIRouter
from pydantic import BaseModel, Field
from google.cloud import firestore

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic Models
class Article(BaseModel):
    """Article to store in Firestore."""
    title: str
    url: str
    source_id: str
    published_at: str
    summary: Optional[str] = None
    content: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_tags: List[str] = Field(default_factory=list)
    relevance_score: Optional[float] = None
    categories: List[str] = Field(default_factory=list)


class StoreArticlesRequest(BaseModel):
    """Request schema for store_articles tool."""
    run_id: str = Field(..., description="Ingestion run ID")
    articles: List[Article] = Field(..., description="Articles to store")


class StoreArticlesResponse(BaseModel):
    """Response schema for store_articles tool."""
    run_id: str
    stored_count: int
    failed_count: int
    failed_urls: List[str] = Field(default_factory=list)
    storage_stats: Dict[str, Any]


class FeedMetadata(BaseModel):
    """Feed-level metadata for author tracking."""
    title: Optional[str] = None
    link: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None


class UpsertAuthorRequest(BaseModel):
    """Request schema for upsert_author tool."""
    feed_url: str = Field(..., description="RSS feed URL")
    articles: List[Article] = Field(..., description="Articles from this feed")
    feed_metadata: Optional[FeedMetadata] = Field(None, description="Feed-level metadata")


class UpsertAuthorResponse(BaseModel):
    """Response schema for upsert_author tool."""
    author_id: Optional[str]
    author_name: Optional[str] = None
    status: str  # "created", "updated", "skipped", "failed"
    error: Optional[str] = None


# Tool Endpoint
@router.post("/store_articles", response_model=StoreArticlesResponse)
async def store_articles(request: StoreArticlesRequest):
    """
    Batch write articles to Firestore /articles collection.

    Phase 4: Returns fake data.
    Phase 5 TODO:
    - Initialize Firestore client
    - Use batch writes (max 500 per batch)
    - Deduplicate by URL before storing
    - Handle partial failures gracefully
    - Return stats about writes
    """
    logger.info(json.dumps({
        "severity": "INFO",
        "message": "Storing articles",
        "mcp_tool": "store_articles",
        "run_id": request.run_id,
        "article_count": len(request.articles)
    }))

    # PHASE 4: Fake response
    response = StoreArticlesResponse(
        run_id=request.run_id,
        stored_count=len(request.articles),
        failed_count=0,
        failed_urls=[],
        storage_stats={
            "firestore_writes": len(request.articles),
            "duplicates_skipped": 0,
            "latency_ms": 250
        }
    )

    logger.info(json.dumps({
        "severity": "INFO",
        "message": "Articles stored successfully",
        "mcp_tool": "store_articles",
        "run_id": request.run_id,
        "stored_count": response.stored_count
    }))

    return response


@router.post("/upsert_author", response_model=UpsertAuthorResponse)
async def upsert_author(request: UpsertAuthorRequest):
    """
    Create or update author record based on fetched articles.

    This endpoint tracks authors/feeds and their freshness for the
    author-focused dashboard. It updates:
    - lastPublished: Most recent article date
    - lastFetched: Current timestamp
    - articleCount: Incremented by articles count
    - categories: Merged from article categories

    Phase implementation: Real Firestore writes.
    """
    logger.info(json.dumps({
        "severity": "INFO",
        "message": "Upserting author",
        "mcp_tool": "upsert_author",
        "feed_url": request.feed_url,
        "article_count": len(request.articles)
    }))

    if not request.articles:
        return UpsertAuthorResponse(
            author_id=None,
            status="skipped",
            error="No articles to process"
        )

    try:
        # Initialize Firestore
        db = firestore.Client(
            project="perception-with-intent",
            database="perception-db"
        )

        # Generate author ID from feed URL
        url_hash = hashlib.sha256(request.feed_url.encode()).hexdigest()[:16]
        author_id = f"author-{url_hash}"

        # Find newest article
        newest_published = None
        for article in request.articles:
            pub_at = article.published_at
            if pub_at:
                try:
                    dt = datetime.fromisoformat(pub_at.replace('Z', '+00:00'))
                    if newest_published is None or dt > newest_published:
                        newest_published = dt
                except (ValueError, TypeError):
                    pass

        if newest_published is None:
            newest_published = datetime.now(timezone.utc)

        # Extract author name
        author_name = None
        if request.feed_metadata:
            author_name = request.feed_metadata.title or request.feed_metadata.author

        if not author_name:
            # Try to get from first article
            for article in request.articles:
                if hasattr(article, 'author') and article.author:
                    author_name = article.author
                    break

        if not author_name:
            # Fallback to domain
            parsed = urlparse(request.feed_url)
            author_name = parsed.netloc.replace('www.', '')

        # Extract website URL
        website_url = None
        if request.feed_metadata and request.feed_metadata.link:
            website_url = request.feed_metadata.link
        else:
            parsed = urlparse(request.feed_url)
            website_url = f"{parsed.scheme}://{parsed.netloc}"

        # Collect categories
        categories = set()
        for article in request.articles:
            for cat in article.categories:
                if cat:
                    categories.add(cat)

        # Build update document
        now = datetime.now(timezone.utc)
        update_data = {
            'name': author_name,
            'feedUrl': request.feed_url,
            'websiteUrl': website_url,
            'lastPublished': newest_published,
            'lastFetched': now,
            'updatedAt': now,
            'status': 'active',
            'consecutiveErrors': 0,
        }

        if categories:
            update_data['categories'] = list(categories)

        if request.feed_metadata and request.feed_metadata.description:
            update_data['feedDescription'] = request.feed_metadata.description

        # Check if document exists
        doc_ref = db.collection("authors").document(author_id)
        doc = doc_ref.get()

        if doc.exists:
            existing_data = doc.to_dict()
            existing_count = existing_data.get('articleCount', 0)
            update_data['articleCount'] = existing_count + len(request.articles)
            status = "updated"
        else:
            update_data['createdAt'] = now
            update_data['articleCount'] = len(request.articles)
            status = "created"

        # Write to Firestore
        doc_ref.set(update_data, merge=True)

        logger.info(json.dumps({
            "severity": "INFO",
            "message": f"Author {status}",
            "mcp_tool": "upsert_author",
            "author_id": author_id,
            "author_name": author_name,
            "status": status
        }))

        return UpsertAuthorResponse(
            author_id=author_id,
            author_name=author_name,
            status=status
        )

    except Exception as e:
        logger.error(json.dumps({
            "severity": "ERROR",
            "message": "Failed to upsert author",
            "mcp_tool": "upsert_author",
            "feed_url": request.feed_url,
            "error": str(e)
        }))

        return UpsertAuthorResponse(
            author_id=None,
            status="failed",
            error=str(e)
        )

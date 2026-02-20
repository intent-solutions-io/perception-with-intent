"""
RSS Feed Tool Router

Fetches and parses articles from RSS feeds.

Phase 5: Real implementation with feedparser and HTTP fetching.
"""

import logging
import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException
import httpx
import feedparser
from dateutil import parser as date_parser
from pydantic import BaseModel, Field

# TODO Phase 5: Import OpenTelemetry
# from opentelemetry import trace
# tracer = trace.get_tracer(__name__)

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic Models
class FetchRSSFeedRequest(BaseModel):
    """Request schema for fetch_rss_feed tool."""
    feed_url: str = Field(..., description="RSS feed URL to fetch")
    time_window_hours: Optional[int] = Field(24, description="Only return articles from last N hours", ge=1, le=720)
    max_items: Optional[int] = Field(50, description="Maximum number of articles to return", ge=1, le=500)
    request_id: Optional[str] = Field(None, description="Optional request tracking ID")


class Article(BaseModel):
    """Individual article from RSS feed."""
    title: str
    url: str
    published_at: str  # ISO 8601 timestamp
    summary: Optional[str] = None
    author: Optional[str] = None
    content_snippet: Optional[str] = None
    raw_content: Optional[str] = None
    categories: List[str] = Field(default_factory=list)


class FeedMetadata(BaseModel):
    """Feed-level metadata for author tracking."""
    title: Optional[str] = None  # Feed/blog title
    link: Optional[str] = None  # Website URL
    description: Optional[str] = None  # Feed description
    author: Optional[str] = None  # Feed-level author if available


class FetchRSSFeedResponse(BaseModel):
    """Response schema for fetch_rss_feed tool."""
    feed_id: str
    feed_url: str
    fetched_at: str  # ISO 8601 timestamp
    article_count: int
    articles: List[Article]
    feed_metadata: Optional[FeedMetadata] = None  # Feed-level metadata for author tracking


class ErrorDetail(BaseModel):
    """Error details for failures."""
    http_status: Optional[int] = None
    timeout_seconds: Optional[int] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    code: str
    message: str
    feed_id: Optional[str] = None
    details: Optional[ErrorDetail] = None


# Helper functions
def normalize_published_date(entry) -> Optional[str]:
    """
    Extract and normalize published date from RSS entry.

    Returns ISO 8601 timestamp or None if not available.
    """
    try:
        # Try published_parsed first (time.struct_time)
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()

        # Try published string
        if hasattr(entry, 'published'):
            dt = date_parser.parse(entry.published)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()

        # Try updated_parsed
        if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
            return dt.isoformat()

        # Fallback to now
        return datetime.now(tz=timezone.utc).isoformat()
    except Exception as e:
        logger.warning(f"Date parsing failed: {e}")
        return datetime.now(tz=timezone.utc).isoformat()


def extract_categories(entry) -> List[str]:
    """Extract categories/tags from RSS entry."""
    categories = []

    if hasattr(entry, 'tags'):
        categories = [tag.get('term', '') for tag in entry.tags if tag.get('term')]

    if hasattr(entry, 'category'):
        categories.append(entry.category)

    return list(set(categories))  # Deduplicate


def is_within_time_window(published_at: str, time_window_hours: int) -> bool:
    """Check if article is within the specified time window."""
    try:
        article_time = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
        cutoff_time = datetime.now(tz=timezone.utc) - timedelta(hours=time_window_hours)
        return article_time >= cutoff_time
    except Exception as e:
        logger.warning(f"is_within_time_window: failed to parse '{published_at}': {e}")
        return False  # Exclude if we can't parse date


# Tool Endpoint
@router.post("/fetch_rss_feed", response_model=FetchRSSFeedResponse)
async def fetch_rss_feed(request: FetchRSSFeedRequest):
    """
    Fetch and parse articles from an RSS feed.

    Phase 5: Real implementation with feedparser and HTTP fetching.
    """
    start_time = datetime.now(tz=timezone.utc)

    # TODO Phase 5: Add OpenTelemetry span
    # with tracer.start_as_current_span("fetch_rss_feed") as span:
    #     span.set_attribute("mcp.tool.name", "fetch_rss_feed")
    #     span.set_attribute("feed.url", request.feed_url)

    logger.info(json.dumps({
        "severity": "INFO",
        "message": "Fetching RSS feed",
        "mcp_tool": "fetch_rss_feed",
        "feed_url": request.feed_url,
        "time_window_hours": request.time_window_hours,
        "max_items": request.max_items,
        "request_id": request.request_id
    }))

    try:
        # Fetch RSS feed via HTTP
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(request.feed_url, follow_redirects=True)
                response.raise_for_status()
            except httpx.TimeoutException:
                logger.error(json.dumps({
                    "severity": "ERROR",
                    "message": "RSS feed fetch timeout",
                    "feed_url": request.feed_url,
                    "timeout_seconds": 30
                }))
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": {
                            "code": "FEED_FETCH_FAILED",
                            "message": "Feed fetch timeout after 30 seconds",
                            "feed_url": request.feed_url,
                            "details": {"timeout_seconds": 30}
                        }
                    }
                )
            except httpx.HTTPStatusError as e:
                logger.error(json.dumps({
                    "severity": "ERROR",
                    "message": "RSS feed HTTP error",
                    "feed_url": request.feed_url,
                    "status_code": e.response.status_code
                }))
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail={
                        "error": {
                            "code": "FEED_FETCH_FAILED",
                            "message": f"Feed returned HTTP {e.response.status_code}",
                            "feed_url": request.feed_url,
                            "details": {"http_status": e.response.status_code}
                        }
                    }
                )

        # Parse RSS with feedparser
        feed_content = response.text
        feed = feedparser.parse(feed_content)

        if feed.bozo and not feed.entries:
            # Feed is malformed and has no entries
            logger.warning(json.dumps({
                "severity": "WARNING",
                "message": "Malformed RSS feed",
                "feed_url": request.feed_url,
                "bozo_exception": str(feed.bozo_exception) if hasattr(feed, 'bozo_exception') else None
            }))
            # Return empty list instead of failing
            return FetchRSSFeedResponse(
                feed_id="",  # No feed_id in Phase 5 spec
                feed_url=request.feed_url,
                fetched_at=datetime.now(tz=timezone.utc).isoformat(),
                article_count=0,
                articles=[]
            )

        # Normalize articles
        articles = []
        for entry in feed.entries:
            published_at = normalize_published_date(entry)

            # Filter by time window
            if request.time_window_hours and not is_within_time_window(published_at, request.time_window_hours):
                continue

            # Extract content snippet (prefer summary, fallback to description)
            content_snippet = None
            if hasattr(entry, 'summary'):
                content_snippet = entry.summary[:500] if len(entry.summary) > 500 else entry.summary
            elif hasattr(entry, 'description'):
                content_snippet = entry.description[:500] if len(entry.description) > 500 else entry.description

            # Build normalized article
            article = Article(
                title=entry.get('title', 'Untitled'),
                url=entry.get('link', ''),
                published_at=published_at,
                summary=entry.get('summary'),
                author=entry.get('author'),
                content_snippet=content_snippet,
                raw_content=entry.get('content', [{}])[0].get('value') if entry.get('content') else None,
                categories=extract_categories(entry)
            )
            articles.append(article)

            # Respect max_items limit
            if request.max_items and len(articles) >= request.max_items:
                break

        # Extract feed-level metadata for author tracking
        feed_metadata = FeedMetadata()
        if hasattr(feed, 'feed'):
            feed_info = feed.feed
            feed_metadata.title = feed_info.get('title')
            feed_metadata.link = feed_info.get('link')
            feed_metadata.description = feed_info.get('description') or feed_info.get('subtitle')
            author_detail = feed_info.get('author_detail', {})
            feed_metadata.author = feed_info.get('author') or author_detail.get('name')

        # Build response
        end_time = datetime.now(tz=timezone.utc)
        latency_ms = int((end_time - start_time).total_seconds() * 1000)

        result = FetchRSSFeedResponse(
            feed_id="",  # No feed_id in Phase 5 spec
            feed_url=request.feed_url,
            fetched_at=end_time.isoformat(),
            article_count=len(articles),
            articles=articles,
            feed_metadata=feed_metadata
        )

        logger.info(json.dumps({
            "severity": "INFO",
            "message": "RSS feed fetched successfully",
            "mcp_tool": "fetch_rss_feed",
            "feed_url": request.feed_url,
            "article_count": result.article_count,
            "latency_ms": latency_ms,
            "request_id": request.request_id
        }))

        # TODO Phase 5: Set OpenTelemetry attributes
        # span.set_attribute("articles.count", result.article_count)
        # span.set_attribute("latency_ms", latency_ms)

        return result

    except HTTPException:
        # Re-raise HTTP exceptions (already logged)
        raise
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(json.dumps({
            "severity": "ERROR",
            "message": "Unexpected error fetching RSS feed",
            "feed_url": request.feed_url,
            "error": str(e),
            "request_id": request.request_id
        }))
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "FEED_FETCH_FAILED",
                    "message": f"Unexpected error: {str(e)}",
                    "feed_url": request.feed_url
                }
            }
        )

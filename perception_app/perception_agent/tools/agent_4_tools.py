"""
Tools for Agent 4 (Brief Writer).

These functions generate executive daily briefs from top-ranked articles,
creating summaries, highlights, and strategic insights.

Also handles AI-generated author bios using Gemini.

Phase E2E: Implements production-ready brief generation with section-based organization.
"""

from typing import Any, Dict, List, Optional
from datetime import date, datetime, timezone
import logging
import json
import hashlib
import os

logger = logging.getLogger(__name__)

# Vertex AI configuration
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "perception-with-intent")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")


def get_gemini_client():
    """Get Vertex AI Gemini client (lazy initialization)."""
    import vertexai
    from vertexai.generative_models import GenerativeModel

    vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
    return GenerativeModel("gemini-2.0-flash-exp")


async def generate_author_bio(
    author_id: str,
    author_name: str,
    articles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Generate an AI bio for an author based on their recent articles.

    Args:
        author_id: Firestore author document ID
        author_name: Author's display name
        articles: List of article dicts (title, summary, content, categories)

    Returns:
        Dict with:
        - bio (str): Generated 2-3 sentence bio
        - status (str): "success" or "failed"
        - error (str, optional): Error message if failed
    """
    if not articles:
        return {
            "bio": None,
            "status": "failed",
            "error": "No articles provided"
        }

    try:
        # Format articles for the prompt
        article_text = []
        for i, article in enumerate(articles[:5], 1):  # Use up to 5 articles
            title = article.get("title", "Untitled")
            summary = article.get("summary") or article.get("content_snippet") or ""
            categories = article.get("categories", [])
            cat_str = f" [{', '.join(categories[:3])}]" if categories else ""

            article_text.append(f"{i}. {title}{cat_str}")
            if summary:
                article_text.append(f"   Summary: {summary[:200]}...")

        articles_formatted = "\n".join(article_text)

        prompt = f"""Based on these recent articles by {author_name}, write a 2-3 sentence professional bio.

Focus on:
- Their expertise and main topics they write about
- Their writing style or unique perspective (if apparent)
- Who would benefit from following their content

Articles:
{articles_formatted}

Write only the bio, no introduction or explanation. Keep it under 150 words."""

        # Call Gemini
        model = get_gemini_client()
        response = model.generate_content(prompt)

        bio = response.text.strip()

        # Clean up bio (remove any quotes or extra formatting)
        bio = bio.strip('"\'')
        if bio.startswith("Bio:"):
            bio = bio[4:].strip()

        logger.info(json.dumps({
            "severity": "INFO",
            "tool": "agent_4",
            "operation": "generate_author_bio",
            "author_id": author_id,
            "bio_length": len(bio)
        }))

        return {
            "bio": bio,
            "status": "success"
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(json.dumps({
            "severity": "ERROR",
            "tool": "agent_4",
            "operation": "generate_author_bio",
            "author_id": author_id,
            "error": error_msg
        }))

        return {
            "bio": None,
            "status": "failed",
            "error": error_msg
        }


def update_author_bio(
    author_id: str,
    bio: str,
) -> Dict[str, Any]:
    """
    Update author's bio in Firestore.

    Args:
        author_id: Firestore author document ID
        bio: Generated bio text

    Returns:
        Dict with status
    """
    from google.cloud import firestore

    try:
        db = firestore.Client(
            project="perception-with-intent",
            database="perception-db"
        )

        now = datetime.now(timezone.utc)

        doc_ref = db.collection("authors").document(author_id)
        doc_ref.update({
            "bio": bio,
            "bioGeneratedAt": now,
            "updatedAt": now
        })

        logger.info(json.dumps({
            "severity": "INFO",
            "tool": "agent_4",
            "operation": "update_author_bio",
            "author_id": author_id,
            "status": "updated"
        }))

        return {"status": "updated", "author_id": author_id}

    except Exception as e:
        error_msg = str(e)
        logger.error(json.dumps({
            "severity": "ERROR",
            "tool": "agent_4",
            "operation": "update_author_bio",
            "author_id": author_id,
            "error": error_msg
        }))

        return {"status": "failed", "error": error_msg}


def generate_executive_summary(articles: List[Dict[str, Any]]) -> str:
    """
    Stub: Generate a concise 1-2 sentence executive summary.

    Args:
        articles: List of top-ranked articles.

    Returns:
        Executive summary string.
    """
    # TODO: implement Gemini API call for summary generation
    return "No articles available for summary."


def extract_highlights(articles: List[Dict[str, Any]], max_highlights: int = 7) -> List[str]:
    """
    Stub: Extract 3-7 key highlights from articles.

    Args:
        articles: List of top-ranked articles.
        max_highlights: Maximum number of highlights to extract.

    Returns:
        List of highlight strings.
    """
    # TODO: implement Gemini API call to extract key points
    return []


def analyze_strategic_implications(
    articles: List[Dict[str, Any]], topics: List[Dict[str, Any]]
) -> Dict[str, str]:
    """
    Stub: Analyze strategic implications per topic.

    Args:
        articles: List of articles.
        topics: List of topics to analyze.

    Returns:
        Dict mapping topic_id -> strategic implications string.
    """
    # TODO: implement Gemini API call for strategic analysis
    return {}


def calculate_brief_metrics(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calculate metrics for the brief.

    Args:
        articles: List of articles included in brief.

    Returns:
        Metrics dict with:
        - article_count
        - top_sources: dict of source_id -> count
        - main_topics: list of most frequent topics
    """
    metrics = {
        "article_count": len(articles),
        "top_sources": {},
        "main_topics": [],
    }

    # Count sources
    for article in articles:
        source_id = article.get("source_id")
        if source_id:
            metrics["top_sources"][source_id] = (
                metrics["top_sources"].get(source_id, 0) + 1
            )

    # TODO: extract main topics from article topics

    return metrics


def generate_brief(
    articles: List[Dict[str, Any]],
    topics: List[Dict[str, Any]],
    brief_date: str | None = None,
) -> Dict[str, Any]:
    """
    Stub: Generate complete daily brief.

    Args:
        articles: Top-ranked articles.
        topics: Active topics.
        brief_date: Date for brief (YYYY-MM-DD), defaults to today.

    Returns:
        Complete brief dict with:
        - date
        - executive_summary
        - highlights
        - strategic_implications
        - metrics
    """
    if brief_date is None:
        brief_date = date.today().isoformat()

    return {
        "date": brief_date,
        "executive_summary": generate_executive_summary(articles),
        "highlights": extract_highlights(articles),
        "strategic_implications": analyze_strategic_implications(articles, topics),
        "metrics": calculate_brief_metrics(articles),
    }


def build_brief_payload(scored_articles: List[Dict[str, Any]], run_id: str | None = None) -> Dict[str, Any]:
    """
    Build a complete brief payload ready for Firestore /briefs collection.

    Args:
        scored_articles: List of scored and filtered articles from Agent 3
        run_id: Optional ingestion run ID

    Returns:
        Brief payload dict with:
        - brief_id: Generated unique ID
        - date: ISO date string
        - headline: Brief headline
        - sections: List of section dicts (name, key_points, top_articles)
        - meta: Metadata (counts, run_id, created_at)
    """
    today = date.today().isoformat()
    now = datetime.now(timezone.utc).isoformat()

    # Generate brief_id
    brief_id = _generate_brief_id(today)

    # Group articles by section
    sections_data = _group_articles_by_section(scored_articles)

    # Build sections list
    sections = []
    for section_name, section_articles in sections_data.items():
        section = _build_section(section_name, section_articles)
        sections.append(section)

    # Sort sections by priority (Tech first, then Business, etc.)
    section_priority = {"Tech": 1, "Business": 2, "Politics": 3, "Sports": 4, "General": 5}
    sections.sort(key=lambda s: section_priority.get(s["section_name"], 99))

    # Generate headline
    headline = _generate_headline(today, len(scored_articles), sections)

    # Build meta
    meta = {
        "article_count": len(scored_articles),
        "section_count": len(sections),
        "run_id": run_id,
        "created_at": now
    }

    brief_payload = {
        "brief_id": brief_id,
        "date": today,
        "headline": headline,
        "sections": sections,
        "meta": meta
    }

    logger.info(json.dumps({
        "severity": "INFO",
        "tool": "agent_4",
        "operation": "build_brief_payload",
        "brief_id": brief_id,
        "article_count": len(scored_articles),
        "section_count": len(sections)
    }))

    return brief_payload


def _generate_brief_id(date_str: str) -> str:
    """Generate unique brief ID from date."""
    return f"brief-{date_str}"


def _group_articles_by_section(articles: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group articles by section name."""
    sections_data = {}
    for article in articles:
        section = article.get("section", "General")
        if section not in sections_data:
            sections_data[section] = []
        sections_data[section].append(article)
    return sections_data


def _build_section(section_name: str, articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a section dict for the brief.

    Returns:
        Section dict with:
        - section_name: str
        - key_points: list of bullet strings
        - top_articles: list of article reference dicts
    """
    # Sort articles by relevance score
    sorted_articles = sorted(articles, key=lambda a: a.get("relevance_score", 0), reverse=True)

    # Take top 5 articles for this section
    top_articles = sorted_articles[:5]

    # Generate key points (one per article)
    key_points = []
    for article in top_articles:
        title = article.get("title", "Untitled")
        tags = article.get("ai_tags", [])
        tag_str = f" ({', '.join(tags[:2])})" if tags else ""
        key_point = f"• {title}{tag_str}"
        key_points.append(key_point)

    # Build article references
    article_refs = []
    for article in top_articles:
        article_ref = {
            "title": article.get("title", "Untitled"),
            "url": article.get("url", ""),
            "source_id": article.get("source_id", ""),
            "relevance_score": article.get("relevance_score", 0)
        }
        article_refs.append(article_ref)

    return {
        "section_name": section_name,
        "key_points": key_points,
        "top_articles": article_refs
    }


def _generate_headline(date_str: str, article_count: int, sections: List[Dict[str, Any]]) -> str:
    """Generate headline for the brief."""
    section_names = [s["section_name"] for s in sections]
    section_str = ", ".join(section_names[:3])
    return f"Daily Intelligence Brief - {date_str} ({article_count} articles across {section_str})"

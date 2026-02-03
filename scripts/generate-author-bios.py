#!/usr/bin/env python3
"""
Generate AI bios for authors using Gemini.

This script fetches authors from Firestore who:
- Have at least 3 articles
- Either have no bio, or bio is older than 30 days

For each author, it fetches their last 5 articles and generates
a 2-3 sentence bio using Gemini 2.0 Flash.

Usage:
    python scripts/generate-author-bios.py [--limit N] [--dry-run] [--force]
"""

import argparse
import asyncio
import logging
import json
import os
from datetime import datetime, timezone, timedelta

from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
FIRESTORE_PROJECT = "perception-with-intent"
FIRESTORE_DATABASE = "perception-db"
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "perception-with-intent")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")

# Thresholds
MIN_ARTICLES_FOR_BIO = 3
BIO_REFRESH_DAYS = 30


def get_firestore_client():
    """Get Firestore client."""
    return firestore.Client(
        project=FIRESTORE_PROJECT,
        database=FIRESTORE_DATABASE
    )


def get_gemini_model():
    """Initialize and return Gemini model."""
    vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
    return GenerativeModel("gemini-2.0-flash-exp")


def needs_bio_generation(author: dict, force: bool = False) -> bool:
    """Check if author needs a bio generated."""
    if force:
        return True

    # Must have minimum articles
    if author.get('articleCount', 0) < MIN_ARTICLES_FOR_BIO:
        return False

    # No bio yet
    if not author.get('bio'):
        return True

    # Bio is stale
    bio_generated_at = author.get('bioGeneratedAt')
    if bio_generated_at:
        if isinstance(bio_generated_at, datetime):
            age_days = (datetime.now(timezone.utc) - bio_generated_at.replace(tzinfo=timezone.utc)).days
        else:
            age_days = (datetime.now(timezone.utc) - bio_generated_at).days
        return age_days >= BIO_REFRESH_DAYS

    return True


def fetch_author_articles(db, author_id: str, limit: int = 5) -> list:
    """
    Fetch recent articles for an author.

    This queries the articles collection for articles matching the author's feed URL
    or author name.
    """
    # Get author doc to find feed URL
    author_doc = db.collection('authors').document(author_id).get()
    if not author_doc.exists:
        return []

    author_data = author_doc.to_dict()
    feed_url = author_data.get('feedUrl', '')

    # Query articles by source_id (feed URL based) or by matching domain
    articles = []

    # Try to find articles by source_id matching
    # Note: In a real implementation, you'd have a proper link between articles and authors
    # For now, we'll use what's available in the article's metadata

    articles_ref = db.collection('articles')

    # Query recent articles - in production, you'd filter by author
    # For now, get recent articles and filter client-side
    recent = articles_ref.order_by('published_at', direction=firestore.Query.DESCENDING).limit(100).get()

    # Extract domain from feed URL for matching
    from urllib.parse import urlparse
    feed_domain = urlparse(feed_url).netloc.replace('www.', '')

    for doc in recent:
        article = doc.to_dict()

        # Match by URL domain
        article_url = article.get('url', '')
        article_domain = urlparse(article_url).netloc.replace('www.', '')

        if article_domain == feed_domain:
            articles.append(article)
            if len(articles) >= limit:
                break

    return articles


async def generate_bio(model, author_name: str, articles: list) -> str:
    """Generate bio using Gemini."""
    if not articles:
        return None

    # Format articles
    article_text = []
    for i, article in enumerate(articles[:5], 1):
        title = article.get("title", "Untitled")
        summary = article.get("summary") or article.get("content_snippet") or article.get("content", "")
        if summary:
            summary = summary[:200] + "..." if len(summary) > 200 else summary
        categories = article.get("categories", [])
        cat_str = f" [{', '.join(categories[:3])}]" if categories else ""

        article_text.append(f"{i}. {title}{cat_str}")
        if summary:
            article_text.append(f"   Summary: {summary}")

    articles_formatted = "\n".join(article_text)

    prompt = f"""Based on these recent articles by {author_name}, write a 2-3 sentence professional bio.

Focus on:
- Their expertise and main topics they write about
- Their writing style or unique perspective (if apparent)
- Who would benefit from following their content

Articles:
{articles_formatted}

Write only the bio, no introduction or explanation. Keep it under 150 words."""

    try:
        response = model.generate_content(prompt)
        bio = response.text.strip()

        # Clean up
        bio = bio.strip('"\'')
        if bio.lower().startswith("bio:"):
            bio = bio[4:].strip()

        return bio

    except Exception as e:
        logger.error(f"Gemini error for {author_name}: {e}")
        return None


async def process_authors(
    limit: int = None,
    dry_run: bool = False,
    force: bool = False
):
    """Process authors and generate bios."""
    db = get_firestore_client()
    model = get_gemini_model()

    # Fetch authors who need bios
    authors_ref = db.collection('authors')
    query = authors_ref.order_by('articleCount', direction=firestore.Query.DESCENDING)

    if limit:
        query = query.limit(limit * 2)  # Fetch more to account for filtering

    authors_snapshot = query.get()

    candidates = []
    for doc in authors_snapshot:
        author = doc.to_dict()
        author['id'] = doc.id

        if needs_bio_generation(author, force):
            candidates.append(author)

        if limit and len(candidates) >= limit:
            break

    logger.info(f"Found {len(candidates)} authors needing bio generation")

    if dry_run:
        logger.info("DRY RUN - Would generate bios for:")
        for author in candidates[:20]:
            logger.info(f"  - {author.get('name')} ({author.get('articleCount', 0)} articles)")
        if len(candidates) > 20:
            logger.info(f"  ... and {len(candidates) - 20} more")
        return {"processed": 0, "generated": 0, "failed": 0}

    # Process each author
    processed = 0
    generated = 0
    failed = 0

    for author in candidates:
        author_id = author['id']
        author_name = author.get('name', 'Unknown')

        logger.info(f"Processing: {author_name}")

        # Fetch articles
        articles = fetch_author_articles(db, author_id)

        if len(articles) < MIN_ARTICLES_FOR_BIO:
            logger.info(f"  Skipping: only {len(articles)} articles found")
            continue

        # Generate bio
        bio = await generate_bio(model, author_name, articles)

        if bio:
            # Update Firestore
            now = datetime.now(timezone.utc)
            db.collection('authors').document(author_id).update({
                'bio': bio,
                'bioGeneratedAt': now,
                'updatedAt': now
            })
            logger.info(f"  Generated bio: {bio[:80]}...")
            generated += 1
        else:
            logger.warning(f"  Failed to generate bio")
            failed += 1

        processed += 1

        # Rate limiting - Gemini has quotas
        await asyncio.sleep(1)

    return {
        "processed": processed,
        "generated": generated,
        "failed": failed
    }


def main():
    parser = argparse.ArgumentParser(
        description='Generate AI bios for authors using Gemini'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Maximum number of authors to process'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Regenerate bios even for authors who already have one'
    )

    args = parser.parse_args()

    logger.info("Starting author bio generation...")
    logger.info(f"Options: limit={args.limit}, dry_run={args.dry_run}, force={args.force}")

    results = asyncio.run(
        process_authors(
            limit=args.limit,
            dry_run=args.dry_run,
            force=args.force
        )
    )

    print("\n" + "=" * 50)
    print("BIO GENERATION SUMMARY")
    print("=" * 50)
    print(f"Authors processed: {results['processed']}")
    print(f"Bios generated:    {results['generated']}")
    print(f"Failed:            {results['failed']}")
    print("=" * 50)

    if args.dry_run:
        print("\nThis was a DRY RUN. No data was written to Firestore.")
        print("Remove --dry-run flag to actually generate bios.")


if __name__ == '__main__':
    main()

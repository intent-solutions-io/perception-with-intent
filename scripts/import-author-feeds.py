#!/usr/bin/env python3
"""
Import author feeds from multiple curated sources into Firestore.

Sources:
- HN Blog Popularity Gist (~90 feeds)
- awesome-rss-feeds (~500 feeds)
- awesome-AI-feeds (~30 feeds)
- awesome_ML_AI_RSS_feed (~50 feeds)
- awesome-tech-rss (~50 feeds)
- allainews_sources (~40 feeds)
- Local verified feeds (128 feeds)

Total: ~760 unique feeds after deduplication

Usage:
    python scripts/import-author-feeds.py [--dry-run] [--test-feeds] [--limit N]
"""

import argparse
import asyncio
import hashlib
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

import httpx
import yaml
from google.cloud import firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Project root
PROJECT_ROOT = Path(__file__).parent.parent

# Firestore config
FIRESTORE_PROJECT = "perception-with-intent"
FIRESTORE_DATABASE = "perception-db"


def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    # Lowercase and replace spaces with hyphens
    slug = text.lower().strip()
    # Remove special characters
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace spaces with hyphens
    slug = re.sub(r'[-\s]+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug[:64]  # Limit length


def generate_author_id(feed_url: str, name: str) -> str:
    """Generate deterministic author ID from feed URL.

    Uses the same format as the ingestion pipeline (author-{hash16})
    to ensure consistency across import and live ingestion.
    """
    url_hash = hashlib.sha256(feed_url.encode()).hexdigest()[:16]
    return f"author-{url_hash}"


def extract_website_url(feed_url: str) -> str:
    """Extract website URL from feed URL."""
    parsed = urlparse(feed_url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def fetch_url(client: httpx.AsyncClient, url: str, timeout: float = 30.0) -> Optional[str]:
    """Fetch URL content with error handling."""
    try:
        response = await client.get(url, timeout=timeout, follow_redirects=True)
        response.raise_for_status()
        return response.text
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


async def test_feed_accessible(client: httpx.AsyncClient, feed_url: str, timeout: float = 10.0) -> bool:
    """Test if a feed URL is accessible."""
    try:
        response = await client.head(feed_url, timeout=timeout, follow_redirects=True)
        return response.status_code < 400
    except Exception:
        # Try GET as fallback (some servers don't support HEAD)
        try:
            response = await client.get(feed_url, timeout=timeout, follow_redirects=True)
            return response.status_code < 400
        except Exception:
            return False


# =============================================================================
# Source Parsers
# =============================================================================

async def parse_hn_gist(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse HN Blog Popularity Gist."""
    url = "https://gist.githubusercontent.com/emschwartz/608934c1817ce9b7baf3f5b9186cae6b/raw/hn-blog-popularity.txt"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    for line in content.strip().split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        parts = line.split('\t')
        if len(parts) >= 2:
            domain = parts[0].strip()
            try:
                score = int(parts[1].strip())
            except ValueError:
                score = 0

            # Construct feed URL (common patterns)
            feed_url = None
            for pattern in [
                f"https://{domain}/feed",
                f"https://{domain}/rss",
                f"https://{domain}/feed.xml",
                f"https://{domain}/rss.xml",
                f"https://{domain}/atom.xml",
                f"https://{domain}/index.xml",
            ]:
                feed_url = pattern
                break  # We'll test later

            if feed_url:
                feeds.append({
                    'name': domain,
                    'feedUrl': f"https://{domain}/feed",  # Default, will be validated
                    'websiteUrl': f"https://{domain}",
                    'categories': ['tech'],
                    'source': 'hn-gist',
                    'metadata': {'hn_score': score}
                })

    logger.info(f"Parsed {len(feeds)} feeds from HN Gist")
    return feeds


async def parse_awesome_rss(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse awesome-rss-feeds README.md."""
    url = "https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/README.md"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    current_category = "general"

    # Pattern to match markdown links with RSS URLs
    link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+(?:\.xml|/rss|/feed|/atom)[^\)]*)\)', re.IGNORECASE)

    for line in content.split('\n'):
        # Track category headers
        if line.startswith('##'):
            category = line.strip('#').strip().lower()
            category = slugify(category)
            if category:
                current_category = category

        # Find RSS links
        for match in link_pattern.finditer(line):
            name = match.group(1).strip()
            feed_url = match.group(2).strip()

            feeds.append({
                'name': name,
                'feedUrl': feed_url,
                'websiteUrl': extract_website_url(feed_url),
                'categories': [current_category],
                'source': 'awesome-rss',
            })

    logger.info(f"Parsed {len(feeds)} feeds from awesome-rss-feeds")
    return feeds


async def parse_awesome_ai(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse RSS-Renaissance/awesome-AI-feeds README.md."""
    url = "https://raw.githubusercontent.com/RSS-Renaissance/awesome-AI-feeds/main/README.md"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    # Pattern for markdown links
    link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')

    for line in content.split('\n'):
        for match in link_pattern.finditer(line):
            name = match.group(1).strip()
            url = match.group(2).strip()

            # Check if it looks like an RSS feed
            if any(x in url.lower() for x in ['rss', 'feed', 'atom', '.xml']):
                feeds.append({
                    'name': name,
                    'feedUrl': url,
                    'websiteUrl': extract_website_url(url),
                    'categories': ['ai'],
                    'source': 'awesome-ai',
                })

    logger.info(f"Parsed {len(feeds)} feeds from awesome-AI-feeds")
    return feeds


async def parse_awesome_ml(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse vishalshar/awesome_ML_AI_RSS_feed README.md."""
    url = "https://raw.githubusercontent.com/vishalshar/awesome_ML_AI_RSS_feed/main/README.md"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')

    for line in content.split('\n'):
        for match in link_pattern.finditer(line):
            name = match.group(1).strip()
            url = match.group(2).strip()

            if any(x in url.lower() for x in ['rss', 'feed', 'atom', '.xml']):
                feeds.append({
                    'name': name,
                    'feedUrl': url,
                    'websiteUrl': extract_website_url(url),
                    'categories': ['ai', 'ml'],
                    'source': 'awesome-ml',
                })

    logger.info(f"Parsed {len(feeds)} feeds from awesome_ML_AI_RSS_feed")
    return feeds


async def parse_awesome_tech(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse tuan3w/awesome-tech-rss README.md."""
    url = "https://raw.githubusercontent.com/tuan3w/awesome-tech-rss/master/README.md"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    current_category = "tech"
    link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')

    for line in content.split('\n'):
        if line.startswith('##'):
            category = line.strip('#').strip().lower()
            category = slugify(category)
            if category:
                current_category = category

        for match in link_pattern.finditer(line):
            name = match.group(1).strip()
            url = match.group(2).strip()

            if any(x in url.lower() for x in ['rss', 'feed', 'atom', '.xml']):
                feeds.append({
                    'name': name,
                    'feedUrl': url,
                    'websiteUrl': extract_website_url(url),
                    'categories': [current_category],
                    'source': 'awesome-tech',
                })

    logger.info(f"Parsed {len(feeds)} feeds from awesome-tech-rss")
    return feeds


async def parse_allainews(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Parse foorilla/allainews_sources JSON."""
    url = "https://raw.githubusercontent.com/foorilla/allainews_sources/main/sources.json"

    content = await fetch_url(client, url)
    if not content:
        return []

    feeds = []
    try:
        data = json.loads(content)
        sources = data if isinstance(data, list) else data.get('sources', [])

        for source in sources:
            feed_url = source.get('rss') or source.get('feed_url') or source.get('url')
            name = source.get('name') or source.get('title', 'Unknown')

            if feed_url:
                feeds.append({
                    'name': name,
                    'feedUrl': feed_url,
                    'websiteUrl': source.get('website') or extract_website_url(feed_url),
                    'categories': ['ai'],
                    'source': 'allainews',
                })

    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse allainews JSON: {e}")

    logger.info(f"Parsed {len(feeds)} feeds from allainews_sources")
    return feeds


def parse_local_sources() -> List[Dict[str, Any]]:
    """Parse local rss_sources.yaml."""
    yaml_path = PROJECT_ROOT / "perception_app" / "perception_agent" / "config" / "rss_sources.yaml"

    if not yaml_path.exists():
        logger.warning(f"Local sources file not found: {yaml_path}")
        return []

    with open(yaml_path) as f:
        data = yaml.safe_load(f)

    feeds = []
    for source in data.get('sources', []):
        if source.get('active', True):
            feeds.append({
                'name': source.get('name'),
                'feedUrl': source.get('url'),
                'websiteUrl': extract_website_url(source.get('url', '')),
                'categories': [source.get('category', 'general')],
                'source': 'local-verified',
            })

    logger.info(f"Parsed {len(feeds)} feeds from local sources")
    return feeds


# =============================================================================
# Main Import Logic
# =============================================================================

def deduplicate_feeds(feeds: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate feeds by URL, preferring verified sources."""
    seen_urls: Dict[str, Dict[str, Any]] = {}

    # Priority order for sources (higher = preferred)
    source_priority = {
        'local-verified': 100,
        'hn-gist': 80,
        'awesome-rss': 60,
        'awesome-ai': 50,
        'awesome-ml': 50,
        'awesome-tech': 40,
        'allainews': 30,
    }

    for feed in feeds:
        url = feed.get('feedUrl', '').lower().rstrip('/')

        if url in seen_urls:
            # Compare priorities
            existing = seen_urls[url]
            existing_priority = source_priority.get(existing.get('source', ''), 0)
            new_priority = source_priority.get(feed.get('source', ''), 0)

            if new_priority > existing_priority:
                # Merge categories
                existing_cats = set(existing.get('categories', []))
                new_cats = set(feed.get('categories', []))
                feed['categories'] = list(existing_cats | new_cats)
                seen_urls[url] = feed
            else:
                # Merge categories into existing
                existing_cats = set(existing.get('categories', []))
                new_cats = set(feed.get('categories', []))
                existing['categories'] = list(existing_cats | new_cats)
        else:
            seen_urls[url] = feed

    return list(seen_urls.values())


async def import_all_feeds(
    test_feeds: bool = False,
    dry_run: bool = False,
    limit: Optional[int] = None
) -> Tuple[int, int, int]:
    """
    Import all feeds from all sources.

    Returns:
        Tuple of (total_found, unique_count, imported_count)
    """
    all_feeds: List[Dict[str, Any]] = []

    async with httpx.AsyncClient() as client:
        # Fetch from all remote sources in parallel
        tasks = [
            parse_hn_gist(client),
            parse_awesome_rss(client),
            parse_awesome_ai(client),
            parse_awesome_ml(client),
            parse_awesome_tech(client),
            parse_allainews(client),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Source fetch failed: {result}")
            elif result:
                all_feeds.extend(result)

    # Add local sources
    all_feeds.extend(parse_local_sources())

    total_found = len(all_feeds)
    logger.info(f"Total feeds found: {total_found}")

    # Deduplicate
    unique_feeds = deduplicate_feeds(all_feeds)
    unique_count = len(unique_feeds)
    logger.info(f"Unique feeds after deduplication: {unique_count}")

    # Apply limit
    if limit:
        unique_feeds = unique_feeds[:limit]
        logger.info(f"Limited to {limit} feeds")

    # Test feed accessibility if requested
    if test_feeds:
        logger.info("Testing feed accessibility...")
        async with httpx.AsyncClient() as client:
            accessible_feeds = []
            for i, feed in enumerate(unique_feeds):
                if i % 50 == 0:
                    logger.info(f"Testing feed {i}/{len(unique_feeds)}...")

                is_accessible = await test_feed_accessible(client, feed['feedUrl'])
                if is_accessible:
                    accessible_feeds.append(feed)
                else:
                    logger.debug(f"Feed not accessible: {feed['feedUrl']}")

            unique_feeds = accessible_feeds
            logger.info(f"Accessible feeds: {len(unique_feeds)}")

    # Write to Firestore
    if dry_run:
        logger.info("DRY RUN - Would import the following feeds:")
        for feed in unique_feeds[:20]:
            logger.info(f"  - {feed['name']}: {feed['feedUrl']}")
        if len(unique_feeds) > 20:
            logger.info(f"  ... and {len(unique_feeds) - 20} more")
        return total_found, unique_count, 0

    # Initialize Firestore
    db = firestore.Client(project=FIRESTORE_PROJECT, database=FIRESTORE_DATABASE)
    now = datetime.now(timezone.utc)

    # Batch write
    imported_count = 0
    batch_size = 500

    for i in range(0, len(unique_feeds), batch_size):
        batch_feeds = unique_feeds[i:i + batch_size]
        batch = db.batch()

        for feed in batch_feeds:
            author_id = generate_author_id(feed['feedUrl'], feed['name'])

            doc_data = {
                'name': feed['name'],
                'feedUrl': feed['feedUrl'],
                'websiteUrl': feed.get('websiteUrl', ''),
                'categories': feed.get('categories', []),
                'source': feed.get('source', 'unknown'),
                'status': 'active',
                'articleCount': 0,
                'consecutiveErrors': 0,
                'lastFetched': now,
                'lastPublished': now,  # Will be updated on first fetch
                'createdAt': now,
                'updatedAt': now,
            }

            # Preserve any existing metadata
            if 'metadata' in feed:
                doc_data['metadata'] = feed['metadata']

            doc_ref = db.collection('authors').document(author_id)
            batch.set(doc_ref, doc_data, merge=True)

        batch.commit()
        imported_count += len(batch_feeds)
        logger.info(f"Imported batch: {imported_count}/{len(unique_feeds)}")

    logger.info(f"Import complete: {imported_count} authors imported")
    return total_found, unique_count, imported_count


def main():
    parser = argparse.ArgumentParser(
        description='Import author feeds from curated sources into Firestore'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print what would be imported without writing to Firestore'
    )
    parser.add_argument(
        '--test-feeds',
        action='store_true',
        help='Test each feed for accessibility before importing'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit the number of feeds to import (for testing)'
    )

    args = parser.parse_args()

    logger.info("Starting author feed import...")
    logger.info(f"Options: dry_run={args.dry_run}, test_feeds={args.test_feeds}, limit={args.limit}")

    total, unique, imported = asyncio.run(
        import_all_feeds(
            test_feeds=args.test_feeds,
            dry_run=args.dry_run,
            limit=args.limit
        )
    )

    print("\n" + "=" * 50)
    print("IMPORT SUMMARY")
    print("=" * 50)
    print(f"Total feeds found:    {total}")
    print(f"Unique after dedup:   {unique}")
    print(f"Imported to Firestore: {imported}")
    print("=" * 50)

    if args.dry_run:
        print("\nThis was a DRY RUN. No data was written to Firestore.")
        print("Remove --dry-run flag to actually import.")


if __name__ == '__main__':
    main()

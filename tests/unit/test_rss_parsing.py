"""
RSS Parsing Unit Tests
======================

Tests for RSS feed parsing functionality.
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import feedparser

# Import functions to test
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


class TestNormalizePublishedDate:
    """Tests for normalize_published_date function."""

    def test_parse_rfc822_date(self):
        """Test parsing RFC 822 date format."""
        from perception_app.mcp_service.routers.rss import normalize_published_date

        entry = MagicMock()
        entry.published_parsed = (2024, 1, 15, 10, 30, 0, 0, 0, 0)
        entry.published = "Mon, 15 Jan 2024 10:30:00 GMT"

        result = normalize_published_date(entry)

        assert result is not None
        assert "2024-01-15" in result
        assert "10:30:00" in result

    def test_parse_iso8601_date(self):
        """Test parsing ISO 8601 date format."""
        from perception_app.mcp_service.routers.rss import normalize_published_date

        entry = MagicMock()
        entry.published_parsed = None
        entry.published = "2024-01-15T10:30:00Z"

        result = normalize_published_date(entry)

        assert result is not None
        assert "2024-01-15" in result

    def test_fallback_to_updated_parsed(self):
        """Test fallback to updated_parsed when published not available."""
        from perception_app.mcp_service.routers.rss import normalize_published_date

        entry = MagicMock()
        entry.published_parsed = None
        # Remove published attribute to trigger fallback
        del entry.published
        entry.updated_parsed = (2024, 1, 15, 10, 30, 0, 0, 0, 0)

        result = normalize_published_date(entry)

        assert result is not None
        assert "2024-01-15" in result

    def test_fallback_to_current_time(self):
        """Test fallback to current time when no date available."""
        from perception_app.mcp_service.routers.rss import normalize_published_date

        entry = MagicMock()
        entry.published_parsed = None
        delattr(entry, 'published')
        entry.updated_parsed = None

        result = normalize_published_date(entry)

        assert result is not None
        now = datetime.now(tz=timezone.utc)
        assert now.strftime("%Y-%m-%d") in result

    def test_malformed_date_string(self):
        """Test handling of malformed date strings."""
        from perception_app.mcp_service.routers.rss import normalize_published_date

        entry = MagicMock()
        entry.published_parsed = None
        entry.published = "not a valid date"
        entry.updated_parsed = None

        result = normalize_published_date(entry)

        # Should return current time as fallback
        assert result is not None


class TestExtractCategories:
    """Tests for extract_categories function."""

    def test_extract_from_tags(self):
        """Test extracting categories from tags."""
        from perception_app.mcp_service.routers.rss import extract_categories

        entry = MagicMock(spec=['tags'])  # spec prevents extra attributes
        entry.tags = [
            {'term': 'technology'},
            {'term': 'AI'},
            {'term': 'startups'}
        ]

        result = extract_categories(entry)

        assert len(result) == 3
        assert 'technology' in result
        assert 'AI' in result
        assert 'startups' in result

    def test_extract_from_category(self):
        """Test extracting from category attribute."""
        from perception_app.mcp_service.routers.rss import extract_categories

        entry = MagicMock()
        entry.tags = []
        entry.category = "tech"

        result = extract_categories(entry)

        assert 'tech' in result

    def test_deduplicate_categories(self):
        """Test that duplicate categories are removed."""
        from perception_app.mcp_service.routers.rss import extract_categories

        entry = MagicMock()
        entry.tags = [
            {'term': 'tech'},
            {'term': 'tech'},
            {'term': 'AI'}
        ]
        entry.category = "tech"

        result = extract_categories(entry)

        # Should deduplicate
        assert result.count('tech') == 1

    def test_empty_tags(self):
        """Test handling of empty tags."""
        from perception_app.mcp_service.routers.rss import extract_categories

        entry = MagicMock()
        entry.tags = []
        delattr(entry, 'category')

        result = extract_categories(entry)

        assert result == []

    def test_filter_empty_terms(self):
        """Test filtering of empty term values."""
        from perception_app.mcp_service.routers.rss import extract_categories

        entry = MagicMock()
        entry.tags = [
            {'term': 'tech'},
            {'term': ''},
            {'term': None},
            {'other': 'value'}
        ]

        result = extract_categories(entry)

        assert 'tech' in result
        assert '' not in result


class TestIsWithinTimeWindow:
    """Tests for is_within_time_window function."""

    def test_article_within_window(self):
        """Test article within time window returns True."""
        from perception_app.mcp_service.routers.rss import is_within_time_window

        # Article from 12 hours ago
        article_time = (datetime.now(tz=timezone.utc) - timedelta(hours=12)).isoformat()

        result = is_within_time_window(article_time, 24)

        assert result is True

    def test_article_outside_window(self):
        """Test article outside time window returns False."""
        from perception_app.mcp_service.routers.rss import is_within_time_window

        # Article from 48 hours ago
        article_time = (datetime.now(tz=timezone.utc) - timedelta(hours=48)).isoformat()

        result = is_within_time_window(article_time, 24)

        assert result is False

    def test_article_exactly_at_boundary(self):
        """Test article at exact boundary."""
        from perception_app.mcp_service.routers.rss import is_within_time_window

        # Article from slightly less than 24 hours ago (boundary inclusive)
        article_time = (datetime.now(tz=timezone.utc) - timedelta(hours=23, minutes=59)).isoformat()

        result = is_within_time_window(article_time, 24)

        assert result is True  # Within window

    def test_malformed_date_returns_false(self):
        """Test malformed date returns False (exclude unparseable articles)."""
        from perception_app.mcp_service.routers.rss import is_within_time_window

        result = is_within_time_window("not-a-date", 24)

        assert result is False

    def test_with_z_suffix(self):
        """Test date with Z timezone suffix."""
        from perception_app.mcp_service.routers.rss import is_within_time_window

        article_time = (datetime.now(tz=timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

        result = is_within_time_window(article_time, 24)

        assert result is True


class TestFeedParserIntegration:
    """Tests for feedparser integration."""

    def test_parse_valid_rss_feed(self):
        """Test parsing a valid RSS feed."""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
            <channel>
                <title>Test Feed</title>
                <link>https://example.com</link>
                <description>A test feed</description>
                <item>
                    <title>Test Article</title>
                    <link>https://example.com/article</link>
                    <description>Article description</description>
                    <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
                </item>
            </channel>
        </rss>"""

        feed = feedparser.parse(rss_content)

        assert len(feed.entries) == 1
        assert feed.entries[0].title == "Test Article"
        assert feed.entries[0].link == "https://example.com/article"

    def test_parse_atom_feed(self):
        """Test parsing an Atom feed."""
        atom_content = """<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
            <title>Test Atom Feed</title>
            <link href="https://example.com"/>
            <entry>
                <title>Atom Article</title>
                <link href="https://example.com/atom-article"/>
                <id>urn:uuid:1234</id>
                <updated>2024-01-15T10:30:00Z</updated>
                <summary>Atom summary</summary>
            </entry>
        </feed>"""

        feed = feedparser.parse(atom_content)

        assert len(feed.entries) == 1
        assert feed.entries[0].title == "Atom Article"

    def test_parse_empty_feed(self):
        """Test parsing an empty feed."""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
            <channel>
                <title>Empty Feed</title>
                <link>https://example.com</link>
            </channel>
        </rss>"""

        feed = feedparser.parse(rss_content)

        assert len(feed.entries) == 0

    def test_parse_malformed_xml(self):
        """Test parsing malformed XML."""
        invalid_content = "<rss><channel><title>Broken"

        feed = feedparser.parse(invalid_content)

        assert feed.bozo == 1  # Indicates parsing error

    def test_parse_feed_with_namespaces(self):
        """Test parsing feed with various namespaces."""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
            <channel>
                <title>Feed with DC</title>
                <item>
                    <title>DC Article</title>
                    <link>https://example.com/dc</link>
                    <dc:creator>John Doe</dc:creator>
                </item>
            </channel>
        </rss>"""

        feed = feedparser.parse(rss_content)

        assert len(feed.entries) == 1
        assert feed.entries[0].get('author') or hasattr(feed.entries[0], 'dc_creator')


class TestArticlePydanticModel:
    """Tests for Article Pydantic model."""

    def test_valid_article_creation(self):
        """Test creating a valid Article."""
        from perception_app.mcp_service.routers.rss import Article

        article = Article(
            title="Test Article",
            url="https://example.com/article",
            published_at="2024-01-15T10:30:00Z",
            summary="A test summary"
        )

        assert article.title == "Test Article"
        assert article.url == "https://example.com/article"

    def test_article_with_optional_fields(self):
        """Test Article with all optional fields."""
        from perception_app.mcp_service.routers.rss import Article

        article = Article(
            title="Full Article",
            url="https://example.com/full",
            published_at="2024-01-15T10:30:00Z",
            summary="Summary",
            author="John Doe",
            content_snippet="Content snippet...",
            raw_content="<p>Full HTML content</p>",
            categories=["tech", "AI"]
        )

        assert article.author == "John Doe"
        assert len(article.categories) == 2

    def test_article_missing_required_fields(self):
        """Test Article validation with missing required fields."""
        from perception_app.mcp_service.routers.rss import Article
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Article(summary="Just a summary")  # Missing title, url, published_at


class TestFetchRSSFeedRequest:
    """Tests for FetchRSSFeedRequest Pydantic model."""

    def test_valid_request(self):
        """Test creating a valid request."""
        from perception_app.mcp_service.routers.rss import FetchRSSFeedRequest

        request = FetchRSSFeedRequest(
            feed_url="https://example.com/rss"
        )

        assert request.feed_url == "https://example.com/rss"
        assert request.time_window_hours == 24  # Default
        assert request.max_items == 50  # Default

    def test_request_with_custom_values(self):
        """Test request with custom parameter values."""
        from perception_app.mcp_service.routers.rss import FetchRSSFeedRequest

        request = FetchRSSFeedRequest(
            feed_url="https://example.com/rss",
            time_window_hours=48,
            max_items=100,
            request_id="test-123"
        )

        assert request.time_window_hours == 48
        assert request.max_items == 100
        assert request.request_id == "test-123"

    def test_request_validation_min_values(self):
        """Test request validation for minimum values."""
        from perception_app.mcp_service.routers.rss import FetchRSSFeedRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            FetchRSSFeedRequest(
                feed_url="https://example.com/rss",
                time_window_hours=0  # ge=1
            )

    def test_request_validation_max_values(self):
        """Test request validation for maximum values."""
        from perception_app.mcp_service.routers.rss import FetchRSSFeedRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            FetchRSSFeedRequest(
                feed_url="https://example.com/rss",
                max_items=1000  # le=500
            )


# Parametrized tests for date parsing
@pytest.mark.parametrize("date_string,expected_year", [
    ("Mon, 15 Jan 2024 10:30:00 GMT", "2024"),
    ("2024-01-15T10:30:00Z", "2024"),
    ("2024-01-15T10:30:00+00:00", "2024"),
    ("15 Jan 2024 10:30:00", "2024"),
    ("January 15, 2024", "2024"),
])
def test_various_date_formats(date_string, expected_year):
    """Test parsing various date formats."""
    from perception_app.mcp_service.routers.rss import normalize_published_date

    entry = MagicMock()
    entry.published_parsed = None
    entry.published = date_string
    entry.updated_parsed = None

    result = normalize_published_date(entry)

    assert expected_year in result


# Parametrized tests for time window
@pytest.mark.parametrize("hours_ago,window_hours,expected", [
    (1, 24, True),   # 1 hour ago, 24 hour window
    (23, 24, True),  # 23 hours ago, 24 hour window
    (25, 24, False), # 25 hours ago, 24 hour window
    (0.5, 1, True),  # 30 min ago, 1 hour window
    (2, 1, False),   # 2 hours ago, 1 hour window
    (168, 720, True), # 1 week ago, 30 day window
])
def test_time_window_parametrized(hours_ago, window_hours, expected):
    """Test time window with various parameters."""
    from perception_app.mcp_service.routers.rss import is_within_time_window

    article_time = (datetime.now(tz=timezone.utc) - timedelta(hours=hours_ago)).isoformat()

    result = is_within_time_window(article_time, window_hours)

    assert result == expected

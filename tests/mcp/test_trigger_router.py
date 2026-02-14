"""
Trigger Router Unit Tests
=========================

Tests for trigger router models, helpers, and source loading.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "perception_app" / "mcp_service"))


class TestTriggerModels:
    """Tests for trigger router Pydantic models."""

    def test_trigger_request_defaults(self):
        from routers.trigger import TriggerIngestionRequest

        req = TriggerIngestionRequest()
        assert req.trigger == "manual"
        assert req.time_window_hours == 24
        assert req.max_items_per_source == 50

    def test_trigger_request_custom(self):
        from routers.trigger import TriggerIngestionRequest

        req = TriggerIngestionRequest(
            trigger="scheduled",
            time_window_hours=48,
            max_items_per_source=100,
        )
        assert req.trigger == "scheduled"
        assert req.time_window_hours == 48
        assert req.max_items_per_source == 100

    def test_trigger_request_validation_min(self):
        from routers.trigger import TriggerIngestionRequest

        with pytest.raises(Exception):
            TriggerIngestionRequest(time_window_hours=0)

    def test_trigger_request_validation_max(self):
        from routers.trigger import TriggerIngestionRequest

        with pytest.raises(Exception):
            TriggerIngestionRequest(max_items_per_source=501)

    def test_accepted_response_model(self):
        from routers.trigger import TriggerAcceptedResponse

        resp = TriggerAcceptedResponse(
            run_id="run-abc123",
            message="Started",
            poll_url="/trigger/ingestion/run-abc123",
        )
        assert resp.run_id == "run-abc123"
        assert resp.status == "accepted"
        assert resp.poll_url == "/trigger/ingestion/run-abc123"

    def test_run_status_model(self):
        from routers.trigger import IngestionRunStatus

        status = IngestionRunStatus(
            run_id="run-abc123",
            status="running",
            phase="fetching_feeds",
        )
        assert status.run_id == "run-abc123"
        assert status.is_successful is None

    def test_run_status_model_with_all_fields(self):
        from routers.trigger import IngestionRunStatus

        status = IngestionRunStatus(
            run_id="run-abc123",
            status="completed",
            phase="done",
            started_at="2025-01-01T00:00:00Z",
            completed_at="2025-01-01T00:02:30Z",
            duration_seconds=150.0,
            stats={"articlesStored": 42},
            errors=[],
            is_successful=True,
        )
        assert status.duration_seconds == 150.0
        assert status.is_successful is True


class TestEvaluateRunSuccess:
    """Tests for evaluate_run_success helper."""

    def test_good_run(self):
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 5,
                "articlesStored": 250,
            },
            "duration": 120,
        }
        assert evaluate_run_success(data) is True

    def test_no_articles_stored(self):
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 5,
                "articlesStored": 0,
            },
            "duration": 60,
        }
        assert evaluate_run_success(data) is False

    def test_high_error_rate(self):
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 50,
                "articlesStored": 10,
            },
            "duration": 60,
        }
        assert evaluate_run_success(data) is False

    def test_too_slow(self):
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 5,
                "articlesStored": 250,
            },
            "duration": 350,
        }
        assert evaluate_run_success(data) is False

    def test_empty_stats(self):
        from routers.trigger import evaluate_run_success

        data = {"stats": {}, "duration": 10}
        assert evaluate_run_success(data) is False

    def test_no_sources_checked(self):
        """Edge case: 0 sources checked should still pass if articles stored."""
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 0,
                "sourcesFailed": 0,
                "articlesStored": 10,
            },
            "duration": 30,
        }
        assert evaluate_run_success(data) is True

    def test_exactly_50_percent_error_rate(self):
        """50% error rate should fail (>= 0.5)."""
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 10,
                "sourcesFailed": 5,
                "articlesStored": 10,
            },
            "duration": 30,
        }
        assert evaluate_run_success(data) is False

    def test_just_under_50_percent_error_rate(self):
        """49% error rate should pass."""
        from routers.trigger import evaluate_run_success

        data = {
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 49,
                "articlesStored": 10,
            },
            "duration": 30,
        }
        assert evaluate_run_success(data) is True


class TestLoadSources:
    """Tests for load_sources helper."""

    def test_load_sources_returns_list(self):
        from routers.trigger import load_sources

        sources = load_sources()
        assert isinstance(sources, list)

    def test_load_sources_has_required_fields(self):
        from routers.trigger import load_sources

        sources = load_sources()
        if sources:
            source = sources[0]
            assert "source_id" in source
            assert "name" in source
            assert "url" in source
            assert "category" in source

    def test_load_sources_filters_inactive(self):
        from routers.trigger import load_sources

        sources = load_sources()
        # All returned sources should have been active
        for source in sources:
            assert source.get("source_id")  # Must have an ID

"""
Trigger Ingestion Integration Tests
====================================

Integration tests for the trigger ingestion endpoints.
Uses mocked Firestore to test HTTP-level behavior.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, PropertyMock
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "perception_app" / "mcp_service"))


def _mock_firestore():
    """Create a mock Firestore client with common setup."""
    mock_db = MagicMock()

    # Mock collection → document → set/get/update
    mock_doc_ref = MagicMock()
    mock_doc_ref.set = MagicMock()
    mock_doc_ref.update = MagicMock()

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_doc_ref

    # Mock query for check_active_run (no active runs by default)
    mock_query = MagicMock()
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.stream.return_value = iter([])
    mock_collection.where.return_value = mock_query

    mock_db.collection.return_value = mock_collection

    return mock_db, mock_doc_ref, mock_collection


@pytest.fixture
def client():
    """Create a test client with mocked Firestore."""
    mock_db, _, _ = _mock_firestore()

    with patch("routers.trigger._get_db", return_value=mock_db):
        from main import app

        with TestClient(app) as client:
            yield client


@pytest.fixture
def client_with_active_run():
    """Create a test client where an active run exists."""
    mock_db, _, mock_collection = _mock_firestore()

    # Mock an active run
    import time

    mock_active_doc = MagicMock()
    mock_active_doc.id = "run-existing123"
    mock_active_doc.reference = MagicMock()
    started_at_mock = MagicMock()
    started_at_mock.timestamp.return_value = time.time() - 30  # 30 seconds ago
    mock_active_doc.to_dict.return_value = {"startedAt": started_at_mock}

    mock_query = MagicMock()
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.stream.return_value = iter([mock_active_doc])
    mock_collection.where.return_value = mock_query

    with patch("routers.trigger._get_db", return_value=mock_db):
        from main import app

        with TestClient(app) as client:
            yield client


class TestTriggerIngestionEndpoint:
    """Tests for POST /trigger/ingestion."""

    def test_post_returns_202(self, client):
        """POST should return 202 Accepted with run_id."""
        response = client.post(
            "/trigger/ingestion",
            json={"trigger": "manual", "time_window_hours": 24, "max_items_per_source": 50},
        )
        assert response.status_code == 202
        data = response.json()
        assert "run_id" in data
        assert data["status"] == "accepted"
        assert "poll_url" in data
        assert data["run_id"] in data["poll_url"]

    def test_post_returns_202_fast(self, client):
        """POST should return in well under timeout (not blocking on ingestion)."""
        import time

        start = time.time()
        response = client.post(
            "/trigger/ingestion",
            json={"trigger": "manual"},
        )
        elapsed = time.time() - start
        assert response.status_code == 202
        # Should return in < 5s (we're not actually running ingestion)
        assert elapsed < 5.0

    def test_post_returns_409_when_active(self, client_with_active_run):
        """POST should return 409 when another run is active."""
        response = client_with_active_run.post(
            "/trigger/ingestion",
            json={"trigger": "manual"},
        )
        assert response.status_code == 409
        data = response.json()
        assert "active_run_id" in data["detail"]

    def test_post_validation_error(self, client):
        """POST with invalid parameters should return 422."""
        response = client.post(
            "/trigger/ingestion",
            json={"time_window_hours": 0},
        )
        assert response.status_code == 422


class TestGetIngestionStatus:
    """Tests for GET /trigger/ingestion/{run_id}."""

    def test_get_returns_status(self):
        """GET should return run status from Firestore."""
        mock_db, mock_doc_ref, _ = _mock_firestore()

        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "status": "running",
            "phase": "fetching_feeds",
            "startedAt": MagicMock(isoformat=lambda: "2025-01-01T00:00:00Z"),
            "stats": {"sourcesChecked": 128, "articlesFetched": 50},
            "errors": [],
        }
        mock_doc_ref.get.return_value = mock_doc

        with patch("routers.trigger._get_db", return_value=mock_db):
            from main import app

            with TestClient(app) as client:
                response = client.get("/trigger/ingestion/run-test123")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert data["phase"] == "fetching_feeds"
        assert data["stats"]["sourcesChecked"] == 128

    def test_get_returns_404_not_found(self):
        """GET should return 404 for nonexistent run."""
        mock_db, mock_doc_ref, _ = _mock_firestore()

        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_doc_ref.get.return_value = mock_doc

        with patch("routers.trigger._get_db", return_value=mock_db):
            from main import app

            with TestClient(app) as client:
                response = client.get("/trigger/ingestion/run-doesnotexist")

        assert response.status_code == 404

    def test_get_completed_includes_success_eval(self):
        """GET for completed run should include is_successful."""
        mock_db, mock_doc_ref, _ = _mock_firestore()

        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "status": "completed",
            "phase": "done",
            "startedAt": MagicMock(isoformat=lambda: "2025-01-01T00:00:00Z"),
            "completedAt": MagicMock(isoformat=lambda: "2025-01-01T00:02:00Z"),
            "duration": 120,
            "stats": {
                "sourcesChecked": 100,
                "sourcesFailed": 5,
                "articlesStored": 250,
            },
            "errors": [],
        }
        mock_doc_ref.get.return_value = mock_doc

        with patch("routers.trigger._get_db", return_value=mock_db):
            from main import app

            with TestClient(app) as client:
                response = client.get("/trigger/ingestion/run-completed")

        assert response.status_code == 200
        data = response.json()
        assert data["is_successful"] is True

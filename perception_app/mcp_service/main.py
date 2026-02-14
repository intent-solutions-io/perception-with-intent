"""
Perception With Intent - MCP Service

FastAPI application exposing 7 MCP tools as HTTP endpoints.
Agents call these tools to interact with external systems.

Phase 4 Status: SCAFFOLDING ONLY
- All responses are fake but structurally correct
- No real Firestore, RSS, or Gemini calls yet
- TODO comments mark where real implementations go

Deployment:
- Local: uvicorn main:app --reload --port 8080
- Cloud Run: perception-mcp (internal-only ingress)
"""

import logging
import json
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# TODO Phase 5: Import OpenTelemetry for tracing
# from opentelemetry import trace
# from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Import routers (created in next step)
from routers import rss, api, webpage, storage, briefs, logging as log_router, notifications, trigger

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(message)s")  # JSON logs, no need for text formatting
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Perception MCP Service",
    description="Model Context Protocol tools for Perception agents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware (for local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO Phase 5: Restrict to agent endpoints only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO Phase 5: Add OpenTelemetry instrumentation
# FastAPIInstrumentor.instrument_app(app)


# Health check endpoint
@app.get("/health")
async def health_check():
    """
    Health check for Cloud Run liveness/readiness probes.
    """
    return {
        "status": "healthy",
        "service": "mcp-service",
        "version": "1.0.0",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


# Root endpoint
@app.get("/")
async def root():
    """
    MCP service root - redirects to docs.
    """
    return {
        "service": "Perception MCP Service",
        "docs": "/docs",
        "health": "/health",
        "tools": [
            "/mcp/tools/fetch_rss_feed",
            "/mcp/tools/fetch_api_feed",
            "/mcp/tools/fetch_webpage",
            "/mcp/tools/store_articles",
            "/mcp/tools/generate_brief",
            "/mcp/tools/log_ingestion_run",
            "/mcp/tools/send_notification",
        ],
        "triggers": ["/trigger/ingestion", "/trigger/ingestion/{run_id}"],
    }


# Register tool routers
app.include_router(rss.router, prefix="/mcp/tools", tags=["RSS Tools"])
app.include_router(api.router, prefix="/mcp/tools", tags=["API Tools"])
app.include_router(webpage.router, prefix="/mcp/tools", tags=["Web Scraping Tools"])
app.include_router(storage.router, prefix="/mcp/tools", tags=["Storage Tools"])
app.include_router(briefs.router, prefix="/mcp/tools", tags=["Brief Generation Tools"])
app.include_router(log_router.router, prefix="/mcp/tools", tags=["Logging Tools"])
app.include_router(notifications.router, prefix="/mcp/tools", tags=["Notification Tools"])
app.include_router(trigger.router, prefix="/trigger", tags=["Trigger"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch all unhandled exceptions and return structured error response.
    """
    logger.error(
        json.dumps(
            {
                "severity": "ERROR",
                "message": "Unhandled exception",
                "error": str(exc),
                "path": request.url.path,
                "method": request.method,
            }
        )
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {"exception": str(exc)},
            }
        },
    )


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Log all incoming requests with structured logging.
    """
    start_time = datetime.now(tz=timezone.utc)

    # Log request
    logger.info(
        json.dumps(
            {
                "severity": "INFO",
                "message": "Incoming request",
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host if request.client else "unknown",
            }
        )
    )

    # Process request
    response = await call_next(request)

    # Calculate latency
    end_time = datetime.now(tz=timezone.utc)
    latency_ms = int((end_time - start_time).total_seconds() * 1000)

    # Log response
    logger.info(
        json.dumps(
            {
                "severity": "INFO",
                "message": "Request completed",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            }
        )
    )

    return response


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True, log_level="info")

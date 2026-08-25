# Perception

> **AI-powered news intelligence that cuts through the noise**

Stop manually checking 50 news sources every morning. Perception monitors everything, filters what matters using 8 specialized Vertex AI agents, and delivers executive-level insights to your dashboard.

**Live Demo:** [perception-with-intent.web.app](https://perception-with-intent.web.app)

---

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U5S225PTME)

## What Is This?

Perception is a production example of an AI agent system built on Google Cloud. It demonstrates how to architect, deploy, and operate multi-agent systems for real-world intelligence gathering.

This repository contains:
- 8 specialized AI agents coordinated via A2A Protocol
- Source-agnostic news ingestion (RSS, APIs, custom connectors)
- Real-time executive dashboard (Firebase + Firestore)
- Production deployment infrastructure (Terraform + GitHub Actions)
- Complete CI/CD pipeline with Workload Identity Federation

**Built by [Intent Solutions IO](https://intentsolutions.io)** — We design and deploy custom AI agent systems for enterprise intelligence.

---

## Key Features

### Source Agnostic
Monitor any topic from any source. RSS feeds, proprietary APIs, or custom connectors. No vendor lock-in.

### AI-Powered Analysis
Gemini 2.0 Flash generates summaries, extracts insights, and identifies strategic implications automatically.

### Executive Dashboard
Real-time intelligence delivered through a clean, professional interface. Filter by relevance, topic, or priority.

### Daily Executive Briefs
Automated summaries highlight patterns, emerging trends, and strategic implications across all monitored topics.

### Smart Alerts
Configurable alerts notify you when high-priority signals emerge. Slack, email, or webhook integration.

### Enterprise Security
Built on Google Cloud with Workload Identity Federation, encrypted storage, and comprehensive audit logging.

---

## ⚡ Quick Start

### Prerequisites

```bash
# Required
- Python 3.11+
- Docker Desktop
- Google Cloud account
- Node.js 18+ (for dashboard)

# Get started in 5 minutes
```

### 1. Clone & Install

```bash
git clone https://github.com/[your-username]/perception.git
cd perception

# Install dependencies
make install

# Or manually:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Set Up GCP

```bash
# Authenticate
gcloud auth application-default login
gcloud config set project perception-with-intent

# Deploy infrastructure (one-time setup)
cd infra/terraform/envs/dev
terraform init && terraform apply
```

### 3. Run Locally

```bash
# Start the agent system (in-memory mode, no cloud needed)
make dev

# Agents available at:
# http://localhost:8080/v1/card
```

### 4. Deploy to Production

```bash
# GitHub Actions handles everything
git push origin main

# Dashboard deploys to:
# https://perception-with-intent.web.app
```

**That's it.** Seriously.

---

## 🏗️ Architecture

Perception uses 8 specialized AI agents orchestrated via Google's A2A Protocol on Vertex AI Agent Engine.

```
┌─────────────────────────────────────────────────────────────────┐
│                  FIREBASE (Human Interface)                      │
│  • React Dashboard - Real-time intelligence feed                │
│  • API Gateway - Ad-hoc queries                                  │
│  • Authentication - Multi-tenant (Phase 2)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ A2A Protocol
┌─────────────────────────────────────────────────────────────────┐
│              VERTEX AI AGENT ENGINE (The Brains)                 │
│                                                                   │
│  Agent 0: Root Orchestrator (The Boss)                           │
│    ├─→ Agent 1: Topic Manager → Firestore                        │
│    ├─→ Agent 2: News Aggregator → NewsIngestionMCP               │
│    ├─→ Agent 3: Relevance Scorer → RelevanceMCP                  │
│    ├─→ Agent 4: Article Analyst → LLMToolsMCP (Gemini)           │
│    ├─→ Agent 5: Daily Synthesizer → StorageMCP                   │
│    ├─→ Agent 6: Validator → ValidationMCP                        │
│    └─→ Agent 7: Storage Manager → Firestore                      │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓ MCP Protocol
┌─────────────────────────────────────────────────────────────────┐
│            CLOUD RUN MCPs (The Toolboxes)                        │
│                                                                   │
│  Each MCP is a dumb tool that does ONE thing well:              │
│  • NewsIngestionMCP - RSS/API fetching                           │
│  • RelevanceMCP - Article scoring                                │
│  • LLMToolsMCP - AI summaries & tags                             │
│  • StorageMCP - Firestore operations                             │
│  • ValidationMCP - Data quality                                  │
│  • DeliveryMCP - Slack/email notifications                       │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   FIRESTORE (The Memory)                         │
│  • topics_to_monitor - What we track                             │
│  • articles - Analyzed intelligence                              │
│  • daily_summaries - Executive briefs                            │
└─────────────────────────────────────────────────────────────────┘
```

### The Daily Flow

Every morning at 7:30 AM CST:

```
Cloud Scheduler ───> Pub/Sub ───> Root Orchestrator
                                          │
                    ┌─────────────────────┴──────────────────────┐
                    │                                             │
                    ↓                                             ↓
            Topic Manager                                 News Aggregator
         (Fetch keywords)                              (Collect from 15 feeds)
                    │                                             │
                    └─────────────────────┬──────────────────────┘
                                          ↓
                                  Relevance Scorer
                                  (Score & rank)
                                          │
                                          ↓
                                  Article Analyst
                              (Gemini summaries + tags)
                                          │
                                          ↓
                                  Daily Synthesizer
                              (Executive brief)
                                          │
                                          ↓
                                  Storage Manager
                              (Save to Firestore)
                                          │
                                          ↓
                          Dashboard updates automatically
```

---

## 🚀 Deployment

### Current Status: v0.3.0 (2025-11-15)

**What's Deployed:**
- ✅ **MCP Service on Cloud Run** - `https://perception-mcp-348724539390.us-central1.run.app`
  - Real RSS fetching validated (5+ articles, 270ms latency)
  - Cloud Logging operational
  - Health endpoint verified
- ✅ **8-Agent System Complete** - Agent 0-7 + Tech Editor
  - E2E ingestion pipeline built
  - Firestore batch operations working
- ✅ **Infrastructure Ready**
  - Terraform provisioned
  - WIF configured (GitHub → GCP keyless auth)
  - Firebase dashboard with Auth enabled

**What's Pending:**
- ⏳ Agent Engine deployment (scripts ready)
- ⏳ E2E ingestion run (awaiting Agent Engine)
- ⏳ Dashboard data integration (wire Firestore to UI)

### Phase 2: SaaS Platform (Future)

Coming next:
- 🔄 User accounts (Firebase Auth)
- 🔄 Custom topics per client
- 🔄 Stripe billing
- 🔄 API access
- 🔄 White-label options

**Timeline:** 3-4 weeks after Phase 1

### Deploy Commands

**IMPORTANT:** All MCP testing happens in the cloud. NO localhost MCP servers.

```bash
# Local agent development ONLY (agents run anywhere)
make dev
# Serves agents at http://localhost:8080 (NOT the MCP)

# Deploy MCP to Cloud Run (the ONLY valid MCP runtime)
gcloud run deploy perception-mcp \
  --source app/mcp_service \
  --region us-central1 \
  --project perception-with-intent

# Deploy Agent Engine to Vertex AI
export VERTEX_PROJECT_ID=perception-with-intent
export VERTEX_LOCATION=us-central1
./scripts/deploy_agent_engine.sh

# Run E2E ingestion test (after Agent Engine deployed)
export VERTEX_AGENT_ID=<from-gcloud-agents-list>
./scripts/run_ingestion_via_agent_engine.sh

# Deploy dashboard to Firebase
cd dashboard
npm run build
firebase deploy --only hosting

# Verify MCP is alive
curl https://perception-mcp-348724539390.us-central1.run.app/health
```

---

## 💰 Cost Reality

**Monthly operational costs** (based on 100 articles/day):

| Component | Monthly Cost |
|-----------|--------------|
| Cloud Run MCPs | ~$15 (scale-to-zero) |
| Vertex AI Agents | ~$25 |
| Gemini 2.0 Flash | ~$20 (analysis only) |
| Firestore | ~$10 |
| Firebase Hosting | **Free** (Spark plan) |
| **Total** | **~$70/month** |

**That's less than your coffee budget** for executive-level intelligence.

### Cost Optimization

- MCPs scale to zero when idle
- Gemini 2.0 Flash is 60% cheaper than GPT-4
- Firebase Hosting free tier covers most traffic
- No Imagen/Lyria costs (text-only analysis)

---

## 🛠️ Development

### Cloud-Only MCP Philosophy

**CRITICAL:** All testing and deployment happens in the cloud. NO localhost MCP servers.

```
Push to GitHub → CI/CD → Deploy to STAGING Cloud Run → Test in Cloud → Promote to PRODUCTION
```

**What This Means:**
- ✅ **Agents:** Local development with `make dev` is OK (agents run anywhere)
- ❌ **MCP Service:** NO local MCP servers - Cloud Run is the ONLY valid runtime
- ✅ **Testing:** All E2E tests use staging Cloud Run URLs
- ✅ **MCP URL:** `https://perception-mcp-348724539390.us-central1.run.app`

**Staging (Current):**
- MCP on Cloud Run with `--ingress all` for testing
- Firestore production database
- Cloud Logging enabled
- Real RSS feeds, real data

**Production (Future):**
- Full Bob's Brain rules (R1-R10)
- CI-only deployments (GitHub Actions + WIF)
- `--ingress internal-and-cloud-load-balancing`
- SPIFFE IDs everywhere
- Drift detection blocks everything

### Key Commands

```bash
# Development
make dev              # Run local ADK server
make test             # Run test suite
make lint             # Run linting

# Deployment
make setup-gcp        # Authenticate GCP
make deploy           # Deploy to production
make docker           # Build Docker image

# Utilities
make clean            # Clean build artifacts
make format           # Auto-format code
make check-auth       # Verify GCP auth
```

### Testing

```bash
# Run unit tests locally
pytest

# Test specific agent
pytest tests/agents/test_article_analyst.py

# Test with coverage
pytest --cov=app --cov-report=html

# Test MCP endpoint (Cloud Run ONLY - NO localhost)
curl https://perception-mcp-348724539390.us-central1.run.app/health

# Test RSS fetching (real data)
curl -X POST https://perception-mcp-348724539390.us-central1.run.app/mcp/tools/fetch_rss_feed \
  -H "Content-Type: application/json" \
  -d '{"feed_id": "hackernews"}'

# View MCP logs in Cloud Logging
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="perception-mcp"' \
  --project=perception-with-intent \
  --limit=20
```

---

## 📊 Dashboard

Live at: **https://perception-with-intent.web.app**

### Features

- **Real-time feed** - Articles update as they're analyzed
- **Topic management** - Add/remove keywords on the fly
- **Daily briefs** - Executive summaries every morning
- **Source analytics** - Track which sources matter
- **Trend visualization** - Spot patterns over time
- **Search & filter** - Find exactly what you need

### Tech Stack

```
Frontend:  React 18 + TypeScript + Vite
Styling:   TailwindCSS
State:     Firebase SDK (real-time)
Charts:    Chart.js
Hosting:   Firebase Hosting
```

---

## 🔧 Configuration

### Topics You Track

Edit in Firestore or via dashboard:

```javascript
{
  "keywords": ["openai", "anthropic", "gemini"],
  "category": "ai",
  "active": true
}
```

### RSS Sources

Add to `app/perception_agent/config/rss_sources.yaml`:

```yaml
sources:
  - name: "TechCrunch"
    url: "https://techcrunch.com/feed/"
    category: "tech"
    active: true
```

### Environment Variables

For production (local dev doesn't need these):

```bash
VERTEX_PROJECT_ID=perception-with-intent
VERTEX_LOCATION=us-central1
FIRESTORE_DATABASE=(default)
AGENT_SPIFFE_ID=spiffe://perception/agent/[name]
```

---

## 🐛 Troubleshooting

### "It's broken!"

```bash
# Check MCP service logs
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="perception-mcp"' \
  --project=perception-with-intent \
  --limit=50

# Test MCP health
curl https://perception-mcp-348724539390.us-central1.run.app/health

# Check Agent Engine logs
gcloud logging read \
  'resource.type="aiplatform.googleapis.com/Agent"' \
  --project=perception-with-intent \
  --limit=20

# Verify Firestore
firebase firestore:indexes
```

### "Deploy failed!"

Check GitHub Actions. If WIF auth failed:

```bash
gcloud iam workload-identity-pools list --location=global
# See WIF-SETUP-GUIDE.md for full setup
```

### "Local dev not working!"

```bash
# Kill production env vars
unset VERTEX_PROJECT_ID
unset VERTEX_LOCATION

# Just run it
make dev
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `ImportError: google-adk` | `pip install google-adk==1.17.0` |
| Docker permission denied | `sudo systemctl start docker` |
| Firestore connection fails | Check `GOOGLE_APPLICATION_CREDENTIALS` |
| Agent 0 can't find sub-agents | Deploy sub-agents before Agent 0 |

---

## 🎓 Philosophy

Perception isn't another half-assed news aggregator. It combines:

- **JVP's flexibility** — Develop anywhere, deploy anywhere
- **Bob's Brain enforcement** — Production that doesn't break
- **MCP architecture** — Clean separation, no spaghetti

### The Rules

**Firebase** = Humans interact here ONLY
**Agents** = Think and decide
**MCPs** = Do without thinking
**Data** = Lives in Firestore/BigQuery

Simple. Powerful. Ships.

---

## 📚 Documentation

### Project Documentation
- **[CLAUDE.md](CLAUDE.md)** - Complete system overview & current architecture
- **[CHANGELOG.md](CHANGELOG.md)** - Version history (v0.3.0, v0.2.0, v0.1.0)
- **[AGENTS-DEPLOYMENT.md](AGENTS-DEPLOYMENT.md)** - Agent architecture details
- **[000-docs/](000-docs/)** - All technical documentation

### Key Technical Docs
- **[6767-AT-ARCH-observability-and-monitoring.md](000-docs/6767-AT-ARCH-observability-and-monitoring.md)** - Monitoring stack
- **[6767-OD-GUID-agent-engine-deploy.md](000-docs/6767-OD-GUID-agent-engine-deploy.md)** - Agent Engine deployment
- **[6767-PP-PLAN-release-log.md](000-docs/6767-PP-PLAN-release-log.md)** - Release tracking
- **[041-AA-REPT-phase-E2E-agent-engine-deployment.md](000-docs/041-AA-REPT-phase-E2E-agent-engine-deployment.md)** - Latest AAR

### External Resources
- **[Google ADK Docs](https://github.com/google/adk-python)** - Official ADK documentation
- **[Vertex AI Agents](https://cloud.google.com/vertex-ai/docs/agents)** - Agent Engine documentation

---

## 🤝 Contributing

PRs welcome if they:
- ✅ Make it faster
- ✅ Make it smarter
- ✅ Make it cleaner
- ❌ Don't break production

### Development Setup

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test: `make test`
4. Commit: `git commit -m "feat: add amazing feature"`
5. Push: `git push origin feature/amazing-feature`
6. Open PR with clear description

---

## 📊 Status

**Version:** v0.3.0 (2025-11-15)

**What's Working:**
- ✅ **MCP Service Deployed to Cloud Run**
  - Service URL: `https://perception-mcp-348724539390.us-central1.run.app`
  - Real RSS fetching validated (5+ articles, 270ms)
  - Cloud Logging operational, zero ERROR logs
- ✅ **8-Agent System Complete**
  - Agent 0-7 + Technology Desk Editor
  - E2E ingestion pipeline built
  - Firestore batch operations working
  - A2A Protocol integration ready
- ✅ **Infrastructure Ready**
  - Terraform provisioned
  - WIF configured (GitHub → GCP keyless auth)
  - Firebase dashboard with Auth enabled
- ✅ **Documentation Complete**
  - Observability guide, deployment guide
  - Release log tracking 3 versions
  - First AAR created

**What's Pending:**
- ⏳ Agent Engine deployment (scripts ready, needs manual trigger)
- ⏳ E2E ingestion run (awaiting Agent Engine deployment)
- ⏳ MCP_BASE_URL configuration (research needed)
- ⏳ Dashboard data integration (wire Firestore to UI)

**Next Phase:** v0.4.0 - Dashboard integration with live Firestore data

---

## 🏆 Credits

Built on:
- [Google ADK](https://github.com/google/adk-python) - Agent Development Kit
- [Vertex AI Agent Engine](https://cloud.google.com/vertex-ai/docs/agents) - Agent orchestration
- [Firebase](https://firebase.google.com) - Hosting & real-time database
- [JVP Base](https://github.com/jeremylongshore/intent-agent-model-jvp-base) - Flexible development framework
- [Bob's Brain](https://github.com/jeremylongshore/bobs-brain) - Production enforcement

---

## Who Is This For?

**Executives** who need strategic intelligence without manual research

**Intelligence Teams** looking to automate competitive monitoring

**Operations Leaders** tracking market signals and trends

**Engineering Teams** evaluating Google ADK for production use

**Consultancies** building custom intelligence systems for clients

---

## Contributing

This is a production showcase repository. For custom deployments or modifications:

**[Contact Intent Solutions IO](https://intentsolutions.io)**

We build and deploy custom AI agent systems for enterprise intelligence needs.

---

## License

MIT License - See [LICENSE](LICENSE) for details

---

## About Intent Solutions IO

We design and deploy custom AI agent systems for organizations that need strategic intelligence without the noise.

**Specialties:**
- Multi-agent system architecture
- Google ADK + Vertex AI Agent Engine
- Production-grade AI deployments
- Enterprise intelligence platforms

**Learn More:** [intentsolutions.io](https://intentsolutions.io)

---

**Powered by Google Cloud Vertex AI** • © 2025 Intent Solutions IO

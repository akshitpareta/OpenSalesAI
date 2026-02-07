# CLAUDE.md — OpenSalesAI Project Instructions

## ⚡ ENABLE AGENT TEAMS FIRST
```powershell
# Add to your environment BEFORE starting Claude Code (PowerShell)
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

# OR set permanently via System Environment Variables
[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1", "User")

# OR add to your settings.json
# { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

---

## 🎯 PROJECT OVERVIEW

**OpenSalesAI** is an open-source, AI-powered Route-to-Market (RTM) intelligence platform for CPG/FMCG companies. It replicates the core capabilities of commercial platforms like SalesCode.ai ($33M+ funded, serving Coca-Cola, PepsiCo, ITC) using entirely open-source technologies.

### What It Does (In Plain English)
Imagine you run a company that sells packaged goods (like snacks, drinks, soap) through thousands of small retail stores. You have 200 sales reps visiting these stores daily. OpenSalesAI:

1. **AI Task Engine** — Every morning at 7 AM, each rep gets personalized WhatsApp messages: "Visit Store #1247, push 2 cases of Product X — they haven't ordered in 14 days. Suggest 5% volume discount." The AI knows each store's history.
2. **WhatsApp Ordering** — Retailers can text/voice-note/photograph handwritten orders via WhatsApp. AI parses everything into structured orders automatically.
3. **Demand Forecasting** — Predicts what each store will need next week, prevents stock-outs, and auto-suggests reorders to distributors.
4. **AI Voice Agent** — Makes automated phone calls for payment collection, coaching, and order-taking in 30+ languages.
5. **Smart Dashboards** — Managers see real-time maps of rep locations, store coverage, and AI-explained KPI insights.

### Target Scale
- MVP: 50-500 retail outlets, 10-50 sales reps
- Growth: 500-5,000 outlets
- Enterprise: 5,000-50,000 outlets (Kubernetes required — use Docker Desktop K8s or AKS)

---

## 💻 DEVELOPMENT ENVIRONMENT (Windows 11 Workstation)

| Component | Spec |
|-----------|------|
| **OS** | Windows 11 (build 26200) |
| **GPU** | 2× NVIDIA GeForce RTX 5090 (32GB VRAM each = **64GB total**) |
| **Node.js** | v25.2.1 (npm 11.6.2) |
| **Python** | 3.13.0 (3.14 also available) |
| **Docker** | Docker Desktop with WSL2 backend + built-in Kubernetes |
| **LLM Runtime** | Ollama (also LM Studio available) |
| **Shell** | PowerShell / Git Bash (MSYS2) |
| **IDE** | VS Code / Cursor |

### GPU Capabilities
With 64GB of combined VRAM across two RTX 5090s:
- **LLM**: Run Llama 3.1 70B natively (no quantization needed), or 405B Q4-quantized
- **STT**: Whisper Large-v3 GPU-accelerated alongside LLM serving
- **Vision**: LLaVA 34B for image/handwriting parsing (WhatsApp photo orders)
- **Embeddings**: Run embedding models on second GPU while LLM uses first
- **Concurrent**: All models can run simultaneously — no need to swap

### Infrastructure Cost: $0/month
This workstation exceeds the Enterprise tier specs. No cloud infrastructure needed for development or small-scale production (up to ~5,000 outlets). The full stack runs locally:
- PostgreSQL, Redis, Qdrant, MinIO, Keycloak, n8n — all in Docker Desktop
- Kubernetes via Docker Desktop built-in K8s (not K3s — K3s doesn't run on Windows natively)
- Caddy reverse proxy — containerized (not a native Windows service)

### Windows-Specific Notes
- Use **PowerShell** for all scripts (not bash) — `.ps1` instead of `.sh`
- File paths use backslashes (`\`) natively, but Docker and Node.js handle forward slashes
- Docker Desktop requires **Hyper-V** or **WSL2 backend** enabled
- Ollama runs as a native Windows service with GPU passthrough
- For WSL2 workloads, GPU passthrough is automatic (CUDA in WSL2)

---

## 🏗️ TECH STACK (All Open-Source)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Workflow Engine** | n8n (self-hosted) | Business process orchestration, WhatsApp webhooks, cron jobs |
| **AI/LLM** | LangChain + LangGraph | RAG pipelines, multi-agent AI, tool calling |
| **LLM Serving** | Ollama (Llama 3.1 70B default, 405B Q4 capable) | Local LLM inference on 2×RTX 5090; Claude/OpenAI API as cloud fallback |
| **Vector DB** | Qdrant | Store embeddings for RAG (store profiles, product catalog) |
| **Backend API** | Node.js + Fastify | SFA service, eB2B service, notification service |
| **ML Services** | Python + FastAPI | Task engine, prediction service, agent service |
| **Frontend Web** | Next.js 14 + Tailwind CSS | Admin dashboard, retailer PWA |
| **Mobile App** | React Native | Sales rep mobile app (Android primary) |
| **Database** | PostgreSQL 16 + TimescaleDB | Primary data store + time-series metrics |
| **Cache/Queue** | Redis 7 | Session cache, message broker, task queue |
| **Object Storage** | MinIO | S3-compatible file/image/ML artifact storage |
| **Auth** | Keycloak | SSO, RBAC, JWT tokens |
| **Analytics** | Metabase | Self-service BI dashboards |
| **ML Ops** | MLflow + Evidently AI | Model registry, drift monitoring |
| **Voice AI** | Whisper Large-v3 (STT) + Piper (TTS) | Speech-to-text (GPU-accelerated) and text-to-speech |
| **Infra** | Docker Desktop (WSL2 backend) + Kubernetes | Containerization + Docker Desktop built-in Kubernetes |
| **Monitoring** | Prometheus + Grafana + Loki | Metrics, dashboards, log aggregation |
| **Reverse Proxy** | Caddy (containerized) | Auto-TLS, reverse proxy — runs inside Docker, not native Windows |
| **WhatsApp** | WhatsApp Business Cloud API | Retailer messaging channel |

---

## 📁 MONOREPO STRUCTURE

```
opensalesai/
├── CLAUDE.md                          # THIS FILE — project instructions
├── docker-compose.yml                 # Full stack local development
├── docker-compose.infra.yml           # Infrastructure only (DB, Redis, Qdrant, MinIO)
├── .env.example                       # Environment template
├── package.json                       # Workspace root (npm workspaces)
├── turbo.json                         # Turborepo config
│
├── apps/
│   ├── dashboard/                     # Next.js 14 — Manager admin dashboard
│   │   ├── src/
│   │   │   ├── app/                   # App router pages
│   │   │   ├── components/            # React components
│   │   │   ├── lib/                   # Utilities, API client
│   │   │   └── hooks/                 # Custom React hooks
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   ├── retailer-pwa/                  # Next.js 14 — Retailer ordering PWA
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── mobile/                        # React Native — Sales rep app
│       ├── src/
│       │   ├── screens/
│       │   ├── components/
│       │   ├── navigation/
│       │   ├── services/
│       │   └── store/
│       ├── android/
│       ├── ios/
│       └── package.json
│
├── services/
│   ├── api-gateway/                   # Fastify — API gateway + auth middleware
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── plugins/
│   │   │   └── index.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma          # Database schema
│   │   └── package.json
│   │
│   ├── sfa-service/                   # Fastify — Sales Force Automation
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── beats.ts           # Beat plan management
│   │   │   │   ├── visits.ts          # Store visit tracking
│   │   │   │   ├── orders.ts          # Order capture
│   │   │   │   └── reps.ts            # Rep management
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── eb2b-service/                  # Fastify — eB2B commerce
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── catalog.ts         # Product catalog
│   │   │   │   ├── cart.ts            # Shopping cart
│   │   │   │   ├── orders.ts          # Order management
│   │   │   │   └── whatsapp.ts        # WhatsApp webhook handler
│   │   │   ├── services/
│   │   │   │   ├── order-parser.ts    # NLU order parsing
│   │   │   │   ├── catalog-matcher.ts # Fuzzy SKU matching
│   │   │   │   └── perfect-basket.ts  # AI basket recommendation
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ai-service/                    # Python FastAPI — AI/ML core
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   │   ├── tasks.py           # Task generation endpoints
│   │   │   │   ├── predictions.py     # ML prediction endpoints
│   │   │   │   ├── agents.py          # LangGraph agent endpoints
│   │   │   │   └── rag.py             # RAG query endpoints
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── database.py
│   │   │   │   └── security.py
│   │   │   ├── agents/
│   │   │   │   ├── supervisor.py      # LangGraph supervisor agent
│   │   │   │   ├── order_agent.py     # Order processing agent
│   │   │   │   ├── coach_agent.py     # Sales coaching agent
│   │   │   │   ├── collection_agent.py # Payment collection agent
│   │   │   │   ├── analytics_agent.py # Sales Lens / analytics agent
│   │   │   │   └── promo_agent.py     # Promotion design agent
│   │   │   ├── ml/
│   │   │   │   ├── demand_forecast.py # Prophet + XGBoost
│   │   │   │   ├── stockout.py        # Stock-out prediction
│   │   │   │   ├── credit_score.py    # Retailer credit scoring
│   │   │   │   ├── attrition.py       # Outlet churn prediction
│   │   │   │   └── route_optimizer.py # OR-Tools route optimization
│   │   │   ├── rag/
│   │   │   │   ├── embeddings.py      # Embedding generation
│   │   │   │   ├── retriever.py       # Qdrant retrieval
│   │   │   │   ├── prompts.py         # Prompt templates
│   │   │   │   └── pipeline.py        # End-to-end RAG pipeline
│   │   │   └── services/
│   │   │       ├── task_generator.py   # Nightly task generation logic
│   │   │       ├── whisper_stt.py      # Speech-to-text service
│   │   │       └── tts_service.py      # Text-to-speech service
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   │
│   └── notification-service/          # Node.js — Notifications
│       ├── src/
│       │   ├── channels/
│       │   │   ├── whatsapp.ts        # WhatsApp Business API
│       │   │   ├── sms.ts             # SMS gateway
│       │   │   └── push.ts            # FCM push notifications
│       │   ├── templates/
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── shared/                        # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/                 # TypeScript interfaces
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   └── ui/                            # Shared UI component library
│       ├── src/
│       │   └── components/
│       └── package.json
│
├── workflows/                         # n8n workflow JSON exports
│   ├── WF-001-nightly-pipeline.json
│   ├── WF-002-task-generation.json
│   ├── WF-003-task-distribution.json
│   ├── WF-004-whatsapp-order.json
│   ├── WF-005-voice-order.json
│   ├── WF-009-stockout-alert.json
│   ├── WF-014-distributor-sync.json
│   └── WF-015-manager-digest.json
│
├── infra/
│   ├── docker/                        # Dockerfiles per service
│   ├── k8s/                           # Kubernetes manifests (Docker Desktop K8s)
│   ├── helm/                          # Helm charts
│   └── terraform/                     # IaC for cloud deployment
│
├── scripts/
│   ├── seed-demo.ts                   # Seed demo data
│   ├── setup-qdrant.py                # Initialize vector collections
│   ├── train-models.py                # Train initial ML models
│   └── migrate.ps1                    # Run all DB migrations (PowerShell)
│
├── data/
│   ├── sample/                        # Sample CSV data for seeding
│   │   ├── stores.csv
│   │   ├── products.csv
│   │   ├── transactions.csv
│   │   └── reps.csv
│   └── prompts/                       # LLM prompt templates
│       ├── task-generator.md
│       ├── order-parser.md
│       ├── coach-scenario.md
│       └── analytics-query.md
│
└── docs/
    ├── PRD.md                         # Full PRD (reference)
    ├── API.md                         # API documentation
    ├── DEPLOYMENT.md                  # Deployment guide
    └── ARCHITECTURE.md                # Architecture deep-dive
```

---

## 🐝 AGENT TEAMS — SWARM CONFIGURATION

### How to Use This
When you start Claude Code in this project, say:

> "Build the OpenSalesAI platform using agent teams. Use the swarm configuration from CLAUDE.md."

Claude will read this file, create the team, spawn specialists, and coordinate parallel development.

---

### TEAM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    🎯 TEAM LEAD                          │
│              (You — the orchestrator)                    │
│         Plans, delegates, reviews, merges                │
└──────────┬──────────┬──────────┬──────────┬─────────────┘
           │          │          │          │
     ┌─────▼───┐ ┌───▼─────┐ ┌▼────────┐ ┌▼──────────┐
     │ INFRA   │ │BACKEND  │ │ AI/ML   │ │ FRONTEND  │
     │ AGENT   │ │ AGENT   │ │ AGENT   │ │ AGENT     │
     │         │ │         │ │         │ │           │
     │Docker   │ │Fastify  │ │LangChain│ │Next.js    │
     │Desktop  │ │Prisma   │ │LangGraph│ │React      │
     │Postgres │ │APIs     │ │Qdrant   │ │Tailwind   │
     │Redis/K8s│ │Auth     │ │ML/AI    │ │Mobile     │
     └─────────┘ └─────────┘ └─────────┘ └───────────┘
           │          │          │          │
     ┌─────▼───┐ ┌───▼─────┐                             
     │WORKFLOW │ │  QA /   │                              
     │ AGENT   │ │ TESTER  │                              
     │         │ │         │                              
     │n8n JSON │ │Tests    │                              
     │Cron     │ │Linting  │                              
     │Webhooks │ │Security │                              
     └─────────┘ └─────────┘                              
```

---

### STEP-BY-STEP SWARM LAUNCH SEQUENCE

When asked to build this project with agent teams, follow this exact sequence:

#### PHASE 1: Create Team + Task List

```
Teammate({ operation: "spawnTeam", team_name: "opensalesai", description: "Building the OpenSalesAI CPG sales intelligence platform" })
```

Then create the master task list with dependencies:

```
TaskCreate({ subject: "Infrastructure Setup", description: "Docker compose, PostgreSQL schema, Redis, Qdrant, MinIO, Keycloak — all infra containers running with health checks. Create prisma schema with all 12 core tables (tenants, companies, stores, products, reps, transactions, transaction_items, tasks, visits, orders_eb2b, predictions, incentives). Run migrations. Seed with demo data (50 stores, 200 products, 10 reps, 5000 transactions)." })

TaskCreate({ subject: "Backend API Services", description: "Build Fastify API services: api-gateway (auth middleware, rate limiting, JWT validation via Keycloak), sfa-service (CRUD for beats, visits, orders, reps with GPS validation), eb2b-service (catalog, cart, checkout, WhatsApp webhook handler). All services must use Prisma ORM, have OpenAPI docs, and follow REST conventions." })

TaskCreate({ subject: "AI/ML Core Engine", description: "Build Python FastAPI ai-service: RAG pipeline (Qdrant + LangChain + Ollama), task generator (analyzes store history, generates personalized daily tasks with AI reasoning), demand forecasting (Prophet + XGBoost), stock-out prediction (Random Forest), LangGraph multi-agent system (supervisor → order_agent, coach_agent, analytics_agent). Include embedding generation script for store profiles and product catalog." })

TaskCreate({ subject: "Frontend Dashboard", description: "Build Next.js 14 admin dashboard: login page (Keycloak SSO), dashboard home (KPI cards: revenue, coverage, task completion, active reps), rep tracking map (live GPS positions on Mapbox), task management view (list of AI-generated tasks with status), store directory (searchable/filterable store list), order management (recent orders with source channel filter), analytics page (Recharts graphs for sales trends). Use Tailwind CSS, Zustand for state, React Query for data fetching." })

TaskCreate({ subject: "n8n Workflow Engine", description: "Create n8n workflow JSON files for: WF-001 (nightly data pipeline, cron 2AM), WF-003 (task distribution via WhatsApp at 7AM), WF-004 (WhatsApp order processing — text/voice/image branches with LLM parsing), WF-007 (task completion handler with incentive calculation), WF-009 (stock-out alert every 4 hours), WF-015 (manager daily digest at 8PM). Each workflow must be importable JSON." })

TaskCreate({ subject: "Testing & QA", description: "Write comprehensive tests: unit tests for all API routes (Vitest), integration tests for order flow (end-to-end from WhatsApp message to order creation), API contract tests, load test script (k6) targeting 500 concurrent users, security audit (check for SQL injection, XSS, auth bypass). Lint all code with ESLint + Prettier (TS) and Ruff + Black (Python)." })
```

Set dependencies:
```
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })  // Backend needs infra first
TaskUpdate({ taskId: "3", addBlockedBy: ["1"] })  // AI needs infra first
TaskUpdate({ taskId: "4", addBlockedBy: ["2"] })  // Frontend needs backend APIs
TaskUpdate({ taskId: "5", addBlockedBy: ["2", "3"] })  // Workflows need backend + AI
TaskUpdate({ taskId: "6", addBlockedBy: ["2", "3", "4"] })  // QA needs everything
```

#### PHASE 2: Spawn Specialist Agents

Spawn all teammates in parallel (single message, multiple Task calls):

```
// 🔧 INFRA AGENT — Docker, databases, DevOps
Task({
  team_name: "opensalesai",
  name: "infra-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the Infrastructure Engineer for OpenSalesAI. PLATFORM: Windows 11 + Docker Desktop (WSL2 backend). Your responsibilities:

1. Create docker-compose.yml with services: postgres (16-alpine), redis (7-alpine), qdrant (latest), minio (latest), keycloak (latest), n8n (latest), caddy (latest — reverse proxy runs containerized, NOT as a native Windows service)
2. Create docker-compose.infra.yml for infra-only startup
3. Write the Prisma schema (services/api-gateway/prisma/schema.prisma) with ALL 12 tables from the PRD:
   - tenants, companies, stores (with lat/lng), products (with sku_code), reps (with points_balance)
   - transactions, transaction_items, tasks (with ai_reasoning text), visits (with GPS)
   - orders_eb2b (with whatsapp_msg_id), predictions, incentives
   - All tables: UUID PKs, created_at/updated_at timestamps, soft-delete (deleted_at)
   - Proper relations, indexes, and enums
4. Create seed script (scripts/seed-demo.ts) with realistic Indian CPG data
5. Create .env.example with all environment variables documented
6. Write Dockerfiles for each service (multi-stage builds)
7. For Kubernetes: use Docker Desktop built-in Kubernetes (NOT K3s — it doesn't run natively on Windows). Create k8s/ manifests compatible with Docker Desktop K8s.

IMPORTANT: All shell scripts must be PowerShell (.ps1) not bash (.sh). Use Windows-compatible paths (backslashes) where needed.
Use Git Worktree for isolation. Mark Task 1 complete when all containers start with health checks passing.",
  run_in_background: true
})

// 🖥️ BACKEND AGENT — Node.js APIs
Task({
  team_name: "opensalesai",
  name: "backend-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the Backend Engineer for OpenSalesAI. WAIT for Task 1 (Infrastructure) to complete before starting. Your responsibilities:

1. Build api-gateway service (services/api-gateway/):
   - Fastify with TypeScript, Prisma client
   - JWT validation middleware (verify Keycloak tokens)
   - Rate limiting (fastify-rate-limit)
   - CORS configuration
   - Health check endpoint
   - OpenAPI/Swagger docs (fastify-swagger)

2. Build sfa-service (services/sfa-service/):
   - POST/GET /beats — beat plan CRUD with weekly scheduling
   - POST /visits — store check-in with GPS validation (must be within 100m of store)
   - POST /visits/:id/checkout — check-out with minimum 5-minute visit duration
   - POST/GET /orders — order capture with line items
   - GET /reps — rep listing with filters (territory, skill tier)
   - GET /reps/:id/dashboard — individual rep KPIs (tasks completed, orders placed, revenue)

3. Build eb2b-service (services/eb2b-service/):
   - GET /catalog — product catalog with search, category filter, pagination
   - POST /cart — add to cart with inventory validation
   - POST /orders — create order from cart, calculate totals
   - POST /whatsapp/webhook — receive WhatsApp messages, route by type (text/audio/image)
   - GET /orders/:storeId/perfect-basket — AI-recommended basket endpoint (calls ai-service)

4. Build notification-service (services/notification-service/):
   - POST /notify/whatsapp — send WhatsApp template messages
   - POST /notify/sms — SMS fallback
   - POST /notify/push — FCM push notifications

All services: proper error handling, request validation (Zod), logging (pino), TypeScript strict mode.
Communicate with infra-engineer via team messages if you need schema changes.",
  run_in_background: true
})

// 🤖 AI/ML AGENT — Python, LangChain, ML models
Task({
  team_name: "opensalesai",
  name: "ai-ml-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the AI/ML Engineer for OpenSalesAI. WAIT for Task 1 (Infrastructure) to complete. Your responsibilities:

1. Build ai-service (services/ai-service/) with Python FastAPI:

   a) RAG Pipeline (app/rag/):
      - embeddings.py: Generate embeddings using sentence-transformers (all-MiniLM-L6-v2)
      - retriever.py: Query Qdrant with metadata filters (company_id, territory_id)
      - pipeline.py: End-to-end RAG — assemble context → construct prompt → call LLM → parse output
      - prompts.py: Jinja2 prompt templates for task generation, order parsing, coaching

   b) Task Generator (app/services/task_generator.py):
      - Pull store transaction history (90 days) from PostgreSQL
      - Compute per-store features: purchase_frequency, msl_gaps, days_since_last_order, avg_order_value
      - For each store, RAG-retrieve store profile + relevant playbooks
      - LLM generates prioritized task list (JSON output): action, reasoning, priority (0-100), estimated_impact
      - Validate tasks (no duplicates, territory constraints), write to tasks table

   c) ML Models (app/ml/):
      - demand_forecast.py: Prophet + XGBoost ensemble for 7/14/30 day demand prediction per store-SKU
      - stockout.py: Random Forest predicting stock-out probability (features: current_stock, consumption_rate, lead_time)
      - credit_score.py: XGBoost credit risk tier (A/B/C/D) based on payment history
      - attrition.py: Logistic Regression churn score per store
      - route_optimizer.py: Google OR-Tools TSP solver for daily route optimization

   d) LangGraph Agents (app/agents/):
      - supervisor.py: StateGraph that routes to sub-agents based on intent detection
      - order_agent.py: Parse text/voice/image orders → catalog match → inventory check → create order
      - coach_agent.py: Simulate sales scenarios, evaluate rep responses, score and provide feedback
      - analytics_agent.py: Natural-language queries → SQL generation → result explanation (Sales Lens)

   e) API Endpoints (app/api/):
      - POST /tasks/generate — trigger task generation for all reps
      - GET /tasks/{rep_id}/today — get today's tasks for a rep
      - POST /orders/parse — parse natural language order text
      - POST /predictions/demand — get demand forecast for store-SKU
      - POST /agent/chat — conversational endpoint for LangGraph agents
      - POST /rag/query — direct RAG query endpoint

2. Create setup script (scripts/setup-qdrant.py):
   - Create Qdrant collections: store_profiles (384-dim), product_catalog, sales_playbooks
   - Ingest sample data and generate embeddings

3. Write requirements.txt with all Python dependencies pinned.

HARDWARE: 2×NVIDIA RTX 5090 (64GB VRAM total). Use Ollama with llama3.1:70b as default model — it fits comfortably in 64GB VRAM. Use llama3.1:8b only for low-latency tasks (autocomplete, quick classification). Whisper Large-v3 can run GPU-accelerated alongside the 70B model. Support ANTHROPIC_API_KEY env var for Claude API fallback.
Python version: 3.13+ (not 3.11). Use pathlib.Path for all file paths (Windows compatibility).
Message backend-engineer if you need API changes.",
  run_in_background: true
})

// 🎨 FRONTEND AGENT — Next.js, React, UI
Task({
  team_name: "opensalesai",
  name: "frontend-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the Frontend Engineer for OpenSalesAI. WAIT for Task 2 (Backend) to complete. Your responsibilities:

1. Build dashboard app (apps/dashboard/) with Next.js 14 App Router:

   Pages:
   - /login — Keycloak SSO login (next-auth with keycloak provider)
   - / — Dashboard home with KPI cards:
     * Total Revenue (today/week/month)
     * Store Coverage % (visited vs total)
     * Task Completion Rate
     * Active Reps count
     * AI Tasks Generated today
   - /reps — Sales rep list with search, territory filter, status badges
   - /reps/[id] — Individual rep dashboard (map of visited stores, task list, KPIs)
   - /stores — Store directory with search, channel filter, MSL compliance badge
   - /stores/[id] — Store detail (purchase history chart, current tasks, credit score)
   - /tasks — AI task management (filterable by rep, status, priority, date)
   - /orders — Order management (all channels: manual, WhatsApp, PWA, voice)
   - /analytics — Sales trends (Recharts line/bar charts), territory comparison

   Components:
   - KPICard (value, trend arrow, label)
   - DataTable (sortable, filterable, paginated)
   - MapView (Mapbox GL with rep pins and store markers)
   - TaskCard (priority color, action, store name, reasoning, complete button)
   - OrderTimeline (order status steps)
   - Sidebar (collapsible navigation)
   - TopBar (search, notifications bell, user avatar)

   Tech: Tailwind CSS, Zustand state management, React Query for API calls, Recharts for charts.

2. Build retailer PWA (apps/retailer-pwa/):
   - / — Perfect Basket view (AI-recommended products with one-click reorder)
   - /catalog — Browse product catalog with search and category filter
   - /orders — Order history
   - /cart — Shopping cart with quantity adjustment
   - Installable as PWA (manifest.json, service worker for offline)

3. Shared UI package (packages/ui/): Button, Input, Select, Modal, Toast, Badge components.

Use TypeScript strict mode. Mobile-responsive. Dark mode support.",
  run_in_background: true
})

// ⚙️ WORKFLOW AGENT — n8n, automations
Task({
  team_name: "opensalesai",
  name: "workflow-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the Workflow Engineer for OpenSalesAI. WAIT for Tasks 2+3 (Backend + AI) to complete. Your responsibilities:

Create n8n workflow JSON files in /workflows/ directory. Each must be valid importable n8n JSON.

1. WF-001-nightly-pipeline.json:
   - Cron trigger: 02:00 AM IST daily
   - HTTP Request: GET /api/transactions?since=yesterday (pull latest data)
   - HTTP Request: POST /ai/tasks/generate (trigger AI task generation)
   - IF node: Check response.success
   - On success: log completion to monitoring endpoint
   - On failure: send Slack/email alert

2. WF-003-task-distribution.json:
   - Cron trigger: 07:00 AM IST daily
   - HTTP Request: GET /api/reps (get all active reps)
   - Loop: For each rep → GET /ai/tasks/{rep_id}/today
   - HTTP Request: POST /notify/whatsapp (send task summary to each rep)
   - Template: 'Good morning {rep_name}! Here are your {count} tasks for today: {task_list}'

3. WF-004-whatsapp-order.json (MOST COMPLEX):
   - Webhook trigger: POST /webhooks/whatsapp
   - Switch node: message.type → text | audio | image
   - Branch text: HTTP POST /ai/orders/parse with body text
   - Branch audio: HTTP GET media URL → POST /ai/stt/transcribe → POST /ai/orders/parse
   - Branch image: HTTP GET media URL → POST /ai/vision/parse → POST /ai/orders/parse
   - Merge node: structured [{item, qty}] from all branches
   - HTTP POST /eb2b/catalog/match (fuzzy SKU matching)
   - IF: all confidence > 0.8 → proceed; else → send clarification WhatsApp
   - HTTP POST /eb2b/inventory/check
   - IF: available → create order → send confirmation; else → send substitution suggestions
   - Error handler: send apologetic message with support phone number

4. WF-007-task-completion.json:
   - Webhook trigger: POST /webhooks/task-complete
   - HTTP PUT /api/tasks/{id} (update status to completed)
   - HTTP POST /api/incentives (calculate reward points)
   - HTTP POST /notify/push (send congrats push notification)
   - Update leaderboard cache in Redis

5. WF-009-stockout-alert.json:
   - Cron trigger: every 4 hours
   - HTTP POST /ai/predictions/stockout-scan
   - Filter: only items with stockout_probability > 0.7
   - Loop: For each alert → POST /notify/whatsapp to distributor
   - Template: '⚠️ Stock Alert: {product} at {store} likely out of stock in {days} days. Suggested reorder: {qty} cases.'

6. WF-015-manager-digest.json:
   - Cron trigger: 08:00 PM IST daily
   - HTTP GET /api/analytics/daily-summary
   - Build HTML email template with: revenue, coverage, top/bottom reps, missed beats, alerts
   - HTTP POST /notify/email to all managers

Ensure all workflows have proper error handling nodes and retry logic.",
  run_in_background: true
})

// 🧪 QA/TESTING AGENT — Tests, linting, security
Task({
  team_name: "opensalesai",
  name: "qa-engineer",
  subagent_type: "general-purpose",
  prompt: "You are the QA Engineer for OpenSalesAI. WAIT for Tasks 2, 3, and 4 to complete. Your responsibilities:

1. Unit Tests (Vitest for TypeScript, Pytest for Python):
   - services/sfa-service: test all CRUD routes, GPS validation logic, order calculations
   - services/eb2b-service: test WhatsApp webhook parsing, catalog matching, cart operations
   - services/ai-service: test RAG pipeline output format, task generator logic, ML model predictions
   - apps/dashboard: test critical React components (KPICard, TaskCard, DataTable)

2. Integration Tests:
   - End-to-end order flow: WhatsApp message → parse → catalog match → inventory check → order create → confirmation
   - Task generation flow: seed data → trigger generate → verify tasks created with valid reasoning
   - Auth flow: login → get token → access protected route → token refresh → logout

3. Load Testing (k6 script — scripts/load-test.js):
   - Scenario: 500 concurrent users
   - Endpoints: GET /tasks (P95 < 500ms), POST /orders (P95 < 2s), POST /whatsapp/webhook (P95 < 3s)
   - Duration: 5 minutes sustained load
   - Report: response times, error rates, throughput

4. Security Audit:
   - Check all API routes have auth middleware
   - Verify no raw SQL (must use Prisma/SQLAlchemy parameterized queries)
   - Check for XSS in frontend (no dangerouslySetInnerHTML without sanitization)
   - Verify PII redaction before LLM calls (phone numbers, names masked in prompts)
   - Check rate limiting on public endpoints

5. Code Quality:
   - ESLint + Prettier config for all TypeScript code
   - Ruff + Black config for all Python code
   - Pre-commit hooks configuration (.husky/)
   - TypeScript strict mode verification

Run all tests and report results to the team lead. Flag blocking issues immediately.",
  run_in_background: true
})
```

#### PHASE 3: Coordination During Execution

The team lead monitors progress and coordinates:

```
// Check on all teammates
Teammate({ operation: "read" })

// Send priority message to specific agent
Teammate({ operation: "write", target_agent_id: "backend-engineer", value: "Priority: the WhatsApp webhook route needs to support verification token for Meta webhook setup. Add GET /whatsapp/webhook with hub.verify_token check." })

// Broadcast to all agents
Teammate({ operation: "broadcast", team_name: "opensalesai", value: "All agents: use UTC timestamps in database. IST conversion happens only at the notification layer." })

// Check task progress
TaskList()

// When agent finishes and sends idle notification, assign next task
TaskUpdate({ taskId: "5", owner: "workflow-engineer" })
```

#### PHASE 4: Shutdown Sequence

```
// After all tasks complete
Teammate({ operation: "requestShutdown", target_agent_id: "infra-engineer" })
Teammate({ operation: "requestShutdown", target_agent_id: "backend-engineer" })
Teammate({ operation: "requestShutdown", target_agent_id: "ai-ml-engineer" })
Teammate({ operation: "requestShutdown", target_agent_id: "frontend-engineer" })
Teammate({ operation: "requestShutdown", target_agent_id: "workflow-engineer" })
Teammate({ operation: "requestShutdown", target_agent_id: "qa-engineer" })

// Final cleanup
Teammate({ operation: "cleanup" })
```

---

## 📋 CODING STANDARDS

### TypeScript (Node.js services + Frontend)
- **Strict mode** always enabled
- **Prisma** for all database access (never raw SQL)
- **Zod** for request/response validation
- **Pino** for structured logging
- **Fastify** for HTTP servers (not Express)
- **React Query** for API calls (no useEffect + fetch)
- **Zustand** for client state (not Redux)
- File naming: `kebab-case.ts` for files, `PascalCase` for components
- Prefer `const` over `let`, never `var`
- Use `async/await`, never raw promises with `.then()`

### Python (AI/ML services)
- **Python 3.13+** required (3.13.0 installed; 3.14 also available)
- **FastAPI** for HTTP servers
- **SQLAlchemy 2.x** with async support for database
- **Pydantic v2** for data models
- **Ruff** for linting, **Black** for formatting
- Type hints on all functions
- Docstrings on all public functions
- Use `pathlib.Path` not `os.path`
- Async where possible (aiohttp, asyncpg)

### Database
- **UUID** primary keys everywhere (never auto-increment integers)
- **Soft delete** pattern (deleted_at timestamp, never hard delete)
- **created_at** and **updated_at** on every table
- **BRIN indexes** on date columns for time-range queries
- **GiST indexes** on lat/lng columns for spatial queries
- Multi-tenant: all queries MUST filter by tenant_id/company_id

### Git
- Branch naming: `feature/module-name-description`
- Commit messages: `feat(sfa): add beat plan CRUD routes`
- Each agent works in its own Git Worktree to prevent conflicts
- PR required before merging to main (QA agent reviews)

---

## 🚀 QUICK START COMMANDS

### Prerequisites (Windows 11)
```powershell
# Install Docker Desktop (enables WSL2 backend + built-in Kubernetes)
winget install Docker.DockerDesktop
# After install: Settings → General → "Use WSL 2 based engine" ✓
# Settings → Kubernetes → "Enable Kubernetes" ✓

# Install Ollama
winget install Ollama.Ollama
```

### Setup & Run
```powershell
# Clone and setup
git clone <repo-url> opensalesai; cd opensalesai
Copy-Item .env.example .env

# Start infrastructure (Docker Desktop must be running)
docker compose -f docker-compose.infra.yml up -d

# Install dependencies
npm install                    # Node.js v25.x workspaces
cd services\ai-service; pip install -r requirements.txt; cd ..\..

# Run migrations + seed
npx prisma migrate dev --schema services/api-gateway/prisma/schema.prisma
npx ts-node scripts/seed-demo.ts

# Setup vector DB
python scripts/setup-qdrant.py

# Start services (dev mode)
npm run dev                    # Starts all Node.js services
cd services\ai-service; uvicorn app.main:app --reload --port 8000

# Start n8n (runs in Docker via docker-compose)
# n8n is included in docker-compose.yml — access at http://localhost:5678

# Pull LLM models (2×RTX 5090 = 64GB VRAM — run 70B natively)
ollama pull llama3.1:70b       # Primary model — fits easily in 64GB VRAM
ollama pull llama3.1:8b        # Fast model for low-latency tasks
# Optional: ollama pull llama3.1:405b-q4_K_M  # Quantized 405B if you want maximum quality
```

---

## 📌 CRITICAL REMINDERS FOR ALL AGENTS

1. **Never hardcode API keys** — always use environment variables from .env
2. **Multi-tenant from day 1** — every query must scope to tenant_id
3. **Offline-first for mobile** — the React Native app must work without internet
4. **WhatsApp is the primary channel** — 80% of users will interact via WhatsApp, not the app
5. **Indian market focus** — currency in INR (₹), time in IST, Hindi language support required
6. **GPS accuracy matters** — store visits must validate proximity (< 100m from store coordinates)
7. **AI must explain itself** — every AI-generated task includes a `reasoning` field explaining WHY
8. **Points/gamification is key** — rep adoption depends on instant reward feedback
9. **Fail gracefully** — if LLM is down, fall back to rule-based task generation
10. **Log everything** — structured JSON logs with correlation IDs across all services

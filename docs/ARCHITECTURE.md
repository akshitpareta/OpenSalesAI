# OpenSalesAI Architecture

## Overview

OpenSalesAI is an AI-powered Route-to-Market (RTM) intelligence platform for CPG/FMCG companies. It is designed as a modular, microservices-based system built entirely with open-source technologies. The platform serves three primary user groups: sales reps in the field, retail store owners, and sales managers/admins.

---

## 1. Architecture Layers

The system is organized into six logical layers:

```
+=========================================================================+
|                         LAYER 1: CLIENT LAYER                           |
|-------------------------------------------------------------------------|
|  Dashboard       Retailer PWA     Mobile App        WhatsApp / Voice    |
|  (Next.js 14)    (Next.js 14)     (React Native)    (Business API)      |
|  Port 3010       Port 3011        Android            Meta Cloud API     |
+=========================================================================+
         |                |               |                  |
         v                v               v                  v
+=========================================================================+
|                       LAYER 2: API GATEWAY                              |
|-------------------------------------------------------------------------|
|                    Caddy Reverse Proxy (Port 80/443)                     |
|                         + Auto-TLS                                      |
|-------------------------------------------------------------------------|
|                    API Gateway (Fastify, Port 3000)                      |
|                    - JWT validation (Keycloak)                           |
|                    - Rate limiting                                       |
|                    - CORS                                                |
|                    - Request routing                                     |
+=========================================================================+
         |                |               |                  |
         v                v               v                  v
+=========================================================================+
|                    LAYER 3: SERVICE LAYER                               |
|-------------------------------------------------------------------------|
|  SFA Service      eB2B Service      Notification       AI Service       |
|  (Fastify)        (Fastify)         Service (Fastify)  (FastAPI)        |
|  Port 3001        Port 3002         Port 3003          Port 8000        |
|                                                                         |
|  - Beat plans     - Product catalog - WhatsApp send    - Task generator |
|  - Store visits   - Shopping cart   - SMS gateway      - Order parser   |
|  - Field orders   - eB2B orders    - Push (FCM)       - Demand forecast|
|  - Rep mgmt       - WhatsApp recv   - Email            - LangGraph agent|
|                   - Perfect basket                     - RAG pipeline   |
|                                                        - Whisper STT    |
+=========================================================================+
         |                |               |                  |
         v                v               v                  v
+=========================================================================+
|                   LAYER 4: DATA & AI LAYER                             |
|-------------------------------------------------------------------------|
|  PostgreSQL 16     Redis 7         Qdrant           MinIO              |
|  + TimescaleDB     - Session cache - Vector search  - Object storage   |
|  - Primary store   - Task queue    - RAG embeddings - Images/files     |
|  - 12 core tables  - Pub/Sub       - 384-dim MiniLM - ML artifacts     |
|  - BRIN indexes    - Leaderboard   - Store profiles  - Voice recordings|
|                    - Rate limits    - Product catalog                   |
|-------------------------------------------------------------------------|
|  Ollama                            MLflow            Evidently AI      |
|  - Llama 3.1 70B (primary)        - Model registry  - Drift monitor   |
|  - Llama 3.1 8B (fast tasks)      - Experiment log  - Data quality    |
|  - Whisper Large-v3 (STT)         - Artifact store                    |
|  - Piper TTS                                                          |
|  - LLaVA 34B (vision)                                                 |
+=========================================================================+
         |                |               |                  |
         v                v               v                  v
+=========================================================================+
|                   LAYER 5: ORCHESTRATION                               |
|-------------------------------------------------------------------------|
|  n8n Workflow Engine (Port 5678)                                       |
|  - WF-001: Nightly data pipeline (cron 2 AM)                          |
|  - WF-003: Task distribution via WhatsApp (cron 7 AM)                  |
|  - WF-004: WhatsApp order processing (webhook)                         |
|  - WF-007: Task completion handler (webhook)                           |
|  - WF-009: Stock-out alerts (cron every 4 hours)                       |
|  - WF-015: Manager daily digest (cron 8 PM)                           |
+=========================================================================+
         |                |               |                  |
         v                v               v                  v
+=========================================================================+
|                  LAYER 6: INFRASTRUCTURE                               |
|-------------------------------------------------------------------------|
|  Docker Desktop (WSL2 backend)     Keycloak (SSO/RBAC)                 |
|  Docker Compose (local dev)        Prometheus + Grafana (metrics)       |
|  Kubernetes (prod via Docker K8s)  Loki (log aggregation)              |
|  Metabase (BI dashboards)          Caddy (reverse proxy + TLS)         |
+=========================================================================+
```

---

## 2. Data Flow Diagrams

### 2.1 Daily Task Generation Flow

This flow runs every night at 2 AM via n8n, generating personalized AI tasks for each sales rep.

```
[Cron 2:00 AM]
     |
     v
[n8n WF-001: Nightly Pipeline]
     |
     +--> [GET /api/transactions?since=yesterday]
     |         |
     |         v
     |    [SFA Service reads latest transactions from PostgreSQL]
     |
     +--> [POST /ai/tasks/generate]
              |
              v
         [AI Service: Task Generator]
              |
              +---> [Query PostgreSQL: store history, 90-day features]
              |
              +---> [Query Qdrant: RAG-retrieve store profiles + playbooks]
              |
              +---> [Ollama LLM: Generate task list with reasoning]
              |         |
              |         v
              |    [LLM returns JSON: actions, priorities, pitches]
              |
              +---> [Validate tasks: dedup, territory check, priority cap]
              |
              +---> [Write tasks to PostgreSQL tasks table]
              |
              v
         [Return summary: 87 tasks for 10 reps]

[Cron 7:00 AM]
     |
     v
[n8n WF-003: Task Distribution]
     |
     +--> [GET /api/reps (all active)]
     |
     +--> [For each rep: GET /ai/tasks/{rep_id}/today]
     |
     +--> [POST /notify/whatsapp (send task summary)]
              |
              v
         [WhatsApp message delivered to each rep's phone]
```

### 2.2 WhatsApp Order Processing Flow

This flow triggers when a retailer sends an order via WhatsApp (text, voice note, or photo).

```
[Retailer sends WhatsApp message]
     |
     v
[Meta Cloud API --> POST /whatsapp/webhook]
     |
     v
[eB2B Service: Route by message type]
     |
     +--[text]--> [POST /ai/orders/parse]
     |                  |
     |                  v
     |             [LLM parses natural language into structured items]
     |
     +--[audio]--> [Download media from Meta]
     |                  |
     |                  v
     |             [POST /ai/stt/transcribe (Whisper Large-v3)]
     |                  |
     |                  v
     |             [POST /ai/orders/parse (text from transcription)]
     |
     +--[image]--> [Download media from Meta]
                        |
                        v
                   [POST /ai/vision/parse (LLaVA 34B OCR)]
                        |
                        v
                   [POST /ai/orders/parse (text from OCR)]
     |
     v
[Merge: All branches produce [{product, qty, confidence}]]
     |
     v
[POST /eb2b/catalog/match (fuzzy SKU matching)]
     |
     v
[Confidence check]
     |
     +--[all >= 0.8]--> [POST /eb2b/inventory/check]
     |                        |
     |                        +--[in stock]--> [Create eB2B order]
     |                        |                     |
     |                        |                     v
     |                        |               [Send confirmation WhatsApp]
     |                        |               "Order #1234 confirmed:
     |                        |                2 cs Parle-G, 1 ctn Coke.
     |                        |                Total: INR 1,440.
     |                        |                Delivery by tomorrow 2 PM."
     |                        |
     |                        +--[out of stock]--> [Send substitution msg]
     |                                             "Parle-G 250g is out of
     |                                              stock. Would you like
     |                                              Britannia Marie Gold
     |                                              instead?"
     |
     +--[any < 0.8]--> [Send clarification WhatsApp]
                        "I understood 2 cs Parle-G but couldn't identify
                         the second item. Did you mean Surf Excel 500g
                         or 1kg?"
```

### 2.3 Store Visit and Order Capture Flow

```
[Sales Rep opens mobile app]
     |
     v
[View today's tasks: GET /ai/tasks/{rep_id}/today]
     |
     v
[Navigate to store using route optimizer]
     |
     v
[Check in: POST /visits]
     |
     +---> [GPS validation: distance to store < 100m?]
     |          |
     |          +--[yes]--> [Visit created, timer starts]
     |          +--[no]---> [400 error: GPS_VALIDATION_FAILED]
     |
     v
[Execute tasks: view AI reasoning and suggested pitches]
     |
     v
[Capture order: POST /orders]
     |
     +---> [Line items validated against catalog]
     +---> [Total calculated, transaction recorded]
     |
     v
[Complete tasks: PATCH /tasks/{id} status=COMPLETED]
     |
     +---> [n8n WF-007: Task completion handler]
     |          |
     |          +---> [Calculate reward points]
     |          +---> [Update rep points_balance]
     |          +---> [Send push notification: "You earned 15 points!"]
     |          +---> [Update leaderboard in Redis]
     |
     v
[Check out: POST /visits/{id}/checkout]
     |
     +---> [Duration check: >= 5 minutes?]
     |          |
     |          +--[yes]--> [Visit completed, photos uploaded to MinIO]
     |          +--[no]---> [400 error: VISIT_TOO_SHORT]
     |
     v
[Rep moves to next store]
```

### 2.4 Manager Analytics Flow (Sales Lens)

```
[Manager opens dashboard or sends query via agent/chat]
     |
     v
[POST /agent/chat: "What were my top stores last week?"]
     |
     v
[LangGraph Supervisor Agent]
     |
     +---> [Intent detection: analytics query]
     |
     +---> [Route to analytics_agent]
              |
              v
         [analytics_agent]
              |
              +---> [Convert natural language to SQL]
              |     (using analytics-query.md prompt template)
              |
              +---> [Execute SQL against PostgreSQL]
              |     (read-only, scoped to company_id)
              |
              +---> [LLM explains results in plain language]
              |
              +---> [Suggest follow-up questions]
              |
              v
         [Return formatted response with data, explanation,
          visualization hint, and follow-ups]
```

---

## 3. Database Design

### Entity Relationship Overview

```
tenants (1) ---< companies (1) ---< stores
                                     |  |
                              (1)>---+  +---< transactions ---< transaction_items
                                |              |                       |
                           assigned_rep        |                    product
                                |              |
                              reps >-----------+
                                |
                                +---< tasks ---< incentives
                                |
                                +---< visits

companies (1) ---< products
companies (1) ---< predictions
companies (1) ---< orders_eb2b
```

### Key Design Decisions

1. **UUID Primary Keys:** Every table uses UUIDs instead of auto-increment integers. This prevents ID leakage, supports distributed inserts, and is required for multi-tenant data isolation.

2. **Soft Delete:** All tables have a `deleted_at` timestamp column. Records are never physically deleted. Every query in the application layer includes `WHERE deleted_at IS NULL`.

3. **Multi-Tenant Scoping:** All data belongs to a `company_id` which belongs to a `tenant_id`. Every query must scope by at least `company_id`. This is enforced at the Prisma middleware level.

4. **Time-Series Indexing:** Transaction dates use BRIN indexes (added via raw migration) for efficient range queries on large datasets. This is critical for analytics over millions of transactions.

5. **Spatial Indexing:** Store coordinates (lat/lng) use GiST indexes (added via raw migration) for proximity queries during GPS validation.

6. **JSONB for Flexible Data:** eB2B order items, tenant settings, and similar semi-structured data use PostgreSQL JSONB columns for flexibility.

---

## 4. AI/ML Architecture

### Model Stack

```
+------------------------------------------+
|          Ollama Model Server              |
|  GPU 1 (RTX 5090, 32GB VRAM):            |
|    - Llama 3.1 70B (primary LLM)         |
|    - LLaVA 34B (vision, loaded on demand) |
|                                           |
|  GPU 2 (RTX 5090, 32GB VRAM):            |
|    - Whisper Large-v3 (STT, always on)    |
|    - all-MiniLM-L6-v2 (embeddings)        |
|    - Llama 3.1 8B (fast classification)   |
|    - Piper TTS (text-to-speech)           |
+------------------------------------------+
```

### RAG Pipeline

```
[User query or store data]
     |
     v
[Generate embedding: all-MiniLM-L6-v2 (384-dim)]
     |
     v
[Search Qdrant: top-K similar documents]
     |  Collections:
     |  - store_profiles (store metadata, history summaries)
     |  - product_catalog (product descriptions, pricing)
     |  - sales_playbooks (strategy docs, SOPs, best practices)
     |
     v
[Assemble context: retrieved chunks + user query]
     |
     v
[Construct prompt from Jinja2 template]
     |
     v
[Call LLM (Llama 3.1 70B via Ollama)]
     |
     v
[Parse structured output (JSON)]
     |
     v
[Validate and return]
```

### LangGraph Multi-Agent System

```
                  +-------------------+
                  |    Supervisor     |
                  |  (Intent Router)  |
                  +---+---+---+---+--+
                      |   |   |   |
          +-----------+   |   |   +------------+
          |               |   |                |
          v               v   v                v
   +------------+  +----------+  +----------+ +----------+
   | Order      |  | Coach    |  | Analytics| | Promo    |
   | Agent      |  | Agent    |  | Agent    | | Agent    |
   |            |  |          |  |          | |          |
   | Parse text |  | Generate |  | NL -> SQL| | Design   |
   | Match SKU  |  | scenario |  | Execute  | | promos   |
   | Check inv  |  | Evaluate |  | Explain  | | Simulate |
   | Create ord |  | Score    |  | Visualize| | Recommend|
   +------------+  +----------+  +----------+ +----------+
```

The supervisor agent uses a LangGraph `StateGraph` to route user input to the appropriate sub-agent based on intent detection. Each sub-agent has its own tool set and prompt templates. Agents can call external APIs (SFA Service, eB2B Service) as tools.

### ML Models

| Model | Algorithm | Input Features | Output | Training Frequency |
|-------|-----------|----------------|--------|--------------------|
| Demand Forecast | Prophet + XGBoost | Transaction history, seasonality, store features | 7/14/30 day quantity prediction per store-SKU | Weekly |
| Stock-Out Prediction | Random Forest | Current stock estimate, consumption rate, lead time, day of week | Stock-out probability (0-1) | Weekly |
| Credit Scoring | XGBoost | Payment history, order frequency, order value, days overdue | Risk tier (A/B/C/D) | Monthly |
| Attrition Prediction | Logistic Regression | Order recency, frequency, monetary, visit frequency | Churn probability (0-1) | Monthly |
| Route Optimization | Google OR-Tools TSP | Store locations, time windows, priority scores | Ordered visit sequence with ETAs | Daily (per rep) |

### Fallback Strategy

When the LLM (Ollama) is unavailable:

1. **Task Generation:** Falls back to rule-based logic — generates tasks based on days-since-last-order thresholds and MSL gap analysis without AI reasoning.
2. **Order Parsing:** Falls back to regex-based pattern matching for common product abbreviations and quantities.
3. **Analytics:** Returns raw SQL results without natural language explanation.

The fallback is triggered by a circuit breaker (3 consecutive failures or >10s response time).

---

## 5. Technology Choices Explained

### Why Fastify (not Express)?

Fastify is 2-3x faster than Express in benchmarks, has built-in schema validation, first-class TypeScript support, and a plugin architecture that aligns with our microservices approach. Its serialization is particularly efficient for our JSON-heavy API responses.

### Why Prisma (not Knex/TypeORM)?

Prisma provides a type-safe database client generated from the schema, automatic migration management, and a declarative schema language that serves as both documentation and implementation. The generated types flow into our Zod validation schemas, providing end-to-end type safety.

### Why LangGraph (not raw LangChain)?

LangGraph provides explicit state management for multi-step AI workflows. Our supervisor-agent pattern requires conditional routing, tool calling, and state persistence across conversation turns. LangChain alone does not provide the graph-based execution model we need for complex agent workflows.

### Why Qdrant (not Pinecone/Weaviate)?

Qdrant is fully open-source with no usage-based pricing, supports metadata filtering (essential for multi-tenant queries scoped to company_id), runs efficiently on a single machine, and has a simple REST API. It fits our self-hosted, zero-cost infrastructure goal.

### Why n8n (not Temporal/Airflow)?

n8n provides a visual workflow builder that non-engineers (operations managers) can modify. It has native HTTP, webhook, and cron nodes that map directly to our business processes. Temporal is more powerful for complex orchestration but adds operational complexity we don't need at our target scale.

### Why Ollama (not vLLM/TGI)?

Ollama provides the simplest setup for local LLM serving on consumer GPUs. It handles model management (pull, serve, switch), supports multi-GPU inference out of the box, and runs natively on Windows. For production scale beyond 5,000 outlets, vLLM or TGI would be considered for better throughput.

### Why PostgreSQL + TimescaleDB (not ClickHouse)?

PostgreSQL is the foundation for our OLTP workload (orders, visits, tasks). TimescaleDB extends it with time-series capabilities (hypertables, continuous aggregates) without requiring a separate analytical database. For our target scale (up to 50,000 outlets), this combination handles both operational and analytical queries efficiently.

### Why Docker Desktop Kubernetes (not K3s)?

K3s does not run natively on Windows. Docker Desktop includes a certified Kubernetes distribution that integrates seamlessly with WSL2 and the Windows development experience. For production on Linux servers, K3s or standard Kubernetes can be used with the same manifests.

---

## 6. Security Architecture

### Authentication Flow

```
[Client] --> [Caddy] --> [API Gateway] --> [Service]
                              |
                              v
                         [Keycloak]
                         - OpenID Connect
                         - JWT RS256 tokens
                         - RBAC roles:
                           admin, manager, rep, retailer
```

1. Client authenticates with Keycloak, receives JWT access + refresh tokens.
2. Every API request includes the JWT in the Authorization header.
3. API Gateway validates the JWT signature against Keycloak's public key (JWKS endpoint).
4. API Gateway extracts `company_id`, `role`, and `user_id` from the JWT claims.
5. These values are injected into request headers for downstream services.
6. Downstream services trust the API Gateway headers (internal network only).

### Data Security

- **PII Redaction:** Before sending any data to the LLM, phone numbers are masked (`+91****3210`), owner names are generalized (`Store Owner`), and addresses are truncated to city level.
- **Encryption at Rest:** PostgreSQL and MinIO use disk-level encryption.
- **Encryption in Transit:** All inter-service communication uses HTTPS via Caddy. Internal Docker network traffic uses mTLS in Kubernetes mode.
- **Rate Limiting:** Applied at the API Gateway level to prevent abuse. Stricter limits on auth endpoints (10/min) and AI endpoints (20/min).
- **SQL Injection Prevention:** Prisma ORM (Node.js) and SQLAlchemy (Python) use parameterized queries exclusively. Raw SQL is prohibited.

---

## 7. Scalability Path

### Single Machine (Current - up to 5,000 outlets)

- All services run via Docker Compose on a single workstation
- PostgreSQL, Redis, Qdrant share resources
- Ollama serves LLMs on local GPUs
- Suitable for: MVP, pilot deployments, small/medium CPG companies

### Multi-Node (5,000-20,000 outlets)

- Kubernetes cluster (3 nodes via Docker Desktop K8s or AKS)
- PostgreSQL replicas for read scaling
- Redis Cluster for session distribution
- Multiple Ollama instances behind a load balancer
- Separate GPU nodes for AI workloads

### Enterprise (20,000-50,000 outlets)

- Full Kubernetes cluster (10+ nodes)
- PostgreSQL with Citus for horizontal sharding by company_id
- Dedicated GPU cluster for LLM serving (switch to vLLM for throughput)
- Event-driven architecture with Kafka for inter-service communication
- Multi-region deployment for geo-distributed teams

---

## 8. Monitoring and Observability

```
[Services emit metrics] --> [Prometheus scrape] --> [Grafana dashboards]
                                                        |
[Services emit logs]    --> [Loki ingest]       --------+
                                                        |
[n8n workflow status]   --> [Custom metrics]     --------+
```

### Key Metrics Monitored

- **API Latency:** P50, P95, P99 per endpoint
- **AI Task Generation:** Duration, tasks/rep, fallback rate
- **Order Processing:** Parse accuracy, end-to-end latency
- **LLM Performance:** Tokens/second, queue depth, GPU utilization
- **Business Metrics:** Daily revenue, coverage %, task completion rate

### Alerting Rules

- API P95 latency > 2s for 5 minutes
- LLM response time > 15s (trigger fallback)
- PostgreSQL connection pool > 80% utilization
- Redis memory > 80% capacity
- n8n workflow failure (any critical workflow)
- GPU temperature > 85C

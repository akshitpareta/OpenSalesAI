# OpenSalesAI Deployment Guide

This guide covers three deployment modes:

1. **Local Development** — Docker Desktop on a Windows 11 workstation
2. **Staging** — Docker Compose on a VPS (Linux)
3. **Production** — Kubernetes (Docker Desktop K8s or AKS)

---

## Prerequisites

### All Environments

| Tool | Minimum Version | Installation |
|------|----------------|-------------|
| Docker Desktop | 4.30+ | `winget install Docker.DockerDesktop` |
| Node.js | 22+ | `winget install OpenJS.NodeJS` |
| Python | 3.13+ | `winget install Python.Python.3.13` |
| Ollama | 0.3+ | `winget install Ollama.Ollama` |
| Git | 2.40+ | `winget install Git.Git` |

### Hardware Requirements

| Tier | CPU | RAM | GPU | Storage | Outlets |
|------|-----|-----|-----|---------|---------|
| Dev/MVP | 8 cores | 32 GB | 1x RTX 3090 (24 GB) | 100 GB SSD | 50-500 |
| Growth | 16 cores | 64 GB | 2x RTX 4090 (48 GB) | 500 GB NVMe | 500-5,000 |
| Enterprise | 32+ cores | 128 GB | 2x RTX 5090 (64 GB) | 1 TB NVMe | 5,000-50,000 |

The current development workstation (2x RTX 5090, 64 GB VRAM) handles the Enterprise tier.

---

## 1. Local Development (Docker Desktop)

### 1.1 Initial Setup

```powershell
# Clone the repository
git clone https://github.com/opensalesai/opensalesai.git
Set-Location opensalesai

# Copy environment file
Copy-Item .env.example .env

# Edit .env with your local settings
# At minimum, set:
#   DATABASE_URL=postgresql://opensales:opensales@localhost:5432/opensalesai
#   REDIS_URL=redis://localhost:6379
#   QDRANT_URL=http://localhost:6333
#   MINIO_ENDPOINT=localhost:9000
#   OLLAMA_BASE_URL=http://localhost:11434
```

### 1.2 Start Infrastructure

```powershell
# Start database, cache, vector DB, object storage, auth, and n8n
docker compose -f docker-compose.infra.yml up -d

# Verify all containers are healthy
docker compose -f docker-compose.infra.yml ps

# Expected output: all services showing "healthy" status
# postgres    - Port 5432
# redis       - Port 6379
# qdrant      - Port 6333 (REST), 6334 (gRPC)
# minio       - Port 9000 (API), 9001 (Console)
# keycloak    - Port 8080
# n8n         - Port 5678
```

### 1.3 Install Dependencies

```powershell
# Install Node.js workspace dependencies (from project root)
npm install

# Install Python dependencies for AI service
Set-Location services\ai-service
pip install -r requirements.txt
Set-Location ..\..
```

### 1.4 Database Migrations and Seeding

```powershell
# Generate Prisma client
npx prisma generate --schema=services/api-gateway/prisma/schema.prisma

# Run database migrations
npx prisma migrate dev --schema=services/api-gateway/prisma/schema.prisma

# Seed demo data (50 stores, 200 products, 10 reps, 5000+ transactions)
npx tsx scripts/seed-demo.ts
```

### 1.5 Setup Vector Database

```powershell
# Create Qdrant collections and ingest initial embeddings
python scripts/setup-qdrant.py
```

### 1.6 Pull LLM Models

```powershell
# Primary model (fits in 64 GB VRAM on 2x RTX 5090)
ollama pull llama3.1:70b

# Fast model for low-latency tasks
ollama pull llama3.1:8b

# Optional: maximum quality (requires 64 GB VRAM)
# ollama pull llama3.1:405b-q4_K_M

# Verify models are available
ollama list
```

### 1.7 Start Application Services

```powershell
# Terminal 1: Start all Node.js services (api-gateway, sfa, eb2b, notifications)
npm run dev

# Terminal 2: Start AI service
Set-Location services\ai-service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 1.8 Verify Setup

```powershell
# Health checks
Invoke-RestMethod http://localhost:3000/health    # API Gateway
Invoke-RestMethod http://localhost:3001/health    # SFA Service
Invoke-RestMethod http://localhost:3002/health    # eB2B Service
Invoke-RestMethod http://localhost:3003/health    # Notification Service
Invoke-RestMethod http://localhost:8000/health    # AI Service

# Access UIs
# Dashboard:      http://localhost:3010
# Retailer PWA:   http://localhost:3011
# n8n Workflows:  http://localhost:5678
# Keycloak Admin: http://localhost:8080
# MinIO Console:  http://localhost:9001
# Swagger (API):  http://localhost:3000/docs
```

### 1.9 Import n8n Workflows

```powershell
# Import all workflow JSON files into n8n
# Option A: Use the n8n UI at http://localhost:5678
#   Settings > Import > select files from workflows/ directory

# Option B: Use the n8n CLI (if available in the container)
$workflows = Get-ChildItem -Path workflows -Filter "*.json"
foreach ($wf in $workflows) {
    Write-Host "Importing $($wf.Name)..."
    docker exec opensalesai-n8n-1 n8n import:workflow --input=/workflows/$($wf.Name)
}
```

---

## 2. Staging (Docker Compose on VPS)

### 2.1 Server Preparation

Minimum VPS specs: 8 vCPU, 32 GB RAM, 200 GB SSD, Ubuntu 22.04 LTS.

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Install Ollama (if GPU available on VPS)
curl -fsSL https://ollama.com/install.sh | sh

# Clone the repository
git clone https://github.com/opensalesai/opensalesai.git
cd opensalesai
```

### 2.2 Configure Environment

```bash
cp .env.example .env
nano .env
```

Key settings to change for staging:

```env
# Database
DATABASE_URL=postgresql://opensales:STRONG_PASSWORD_HERE@postgres:5432/opensalesai

# Redis
REDIS_URL=redis://redis:6379

# Qdrant
QDRANT_URL=http://qdrant:6333

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=STRONG_PASSWORD_HERE

# Keycloak
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_ADMIN_PASSWORD=STRONG_PASSWORD_HERE

# Ollama (point to GPU server if separate)
OLLAMA_BASE_URL=http://ollama:11434
# Or if using cloud LLM fallback:
ANTHROPIC_API_KEY=sk-ant-xxx

# Domain (for Caddy auto-TLS)
DOMAIN=staging.opensalesai.com

# WhatsApp (Meta Business API)
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_secret
WHATSAPP_PHONE_ID=your_phone_number_id
```

### 2.3 Deploy Full Stack

```bash
# Start everything
docker compose up -d --build

# Monitor startup
docker compose logs -f --tail=50

# Check all services are healthy
docker compose ps
```

### 2.4 SSL/TLS with Caddy

The `docker-compose.yml` includes a Caddy service that automatically provisions Let's Encrypt certificates for your domain. Ensure:

1. Your domain DNS points to the VPS IP address.
2. Ports 80 and 443 are open in the firewall.
3. The `DOMAIN` environment variable is set correctly.

Caddy will handle HTTPS termination and reverse proxy all services:

| URL | Backend |
|-----|---------|
| `https://staging.opensalesai.com/api/` | API Gateway (port 3000) |
| `https://staging.opensalesai.com/` | Dashboard (port 3010) |
| `https://staging.opensalesai.com/pwa/` | Retailer PWA (port 3011) |
| `https://staging.opensalesai.com/n8n/` | n8n (port 5678) |
| `https://staging.opensalesai.com/auth/` | Keycloak (port 8080) |

### 2.5 Database Backups

```bash
# Create a backup script
cat > /opt/opensalesai/backup.sh << 'SCRIPT'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/opensalesai/backups

mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker exec opensalesai-postgres-1 \
  pg_dump -U opensales opensalesai | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Prune backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: db_$TIMESTAMP.sql.gz"
SCRIPT

chmod +x /opt/opensalesai/backup.sh

# Schedule daily backups at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/opensalesai/backup.sh") | crontab -
```

### 2.6 Monitoring Setup

```bash
# Prometheus and Grafana are included in docker-compose.yml
# Access Grafana at: https://staging.opensalesai.com:3500
# Default credentials: admin / admin (change immediately)

# Import the provided dashboards:
# - infra/grafana/opensalesai-overview.json
# - infra/grafana/api-performance.json
# - infra/grafana/ai-service-metrics.json
```

---

## 3. Production (Kubernetes)

### 3.1 Option A: Docker Desktop Kubernetes (Windows Workstation)

For on-premise deployments on a powerful Windows workstation.

```powershell
# Enable Kubernetes in Docker Desktop
# Docker Desktop > Settings > Kubernetes > Enable Kubernetes > Apply & Restart

# Verify cluster is running
kubectl cluster-info
kubectl get nodes

# Create namespace
kubectl create namespace opensalesai

# Apply configuration
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml

# Deploy infrastructure services
kubectl apply -f infra/k8s/postgres/
kubectl apply -f infra/k8s/redis/
kubectl apply -f infra/k8s/qdrant/
kubectl apply -f infra/k8s/minio/
kubectl apply -f infra/k8s/keycloak/

# Wait for infrastructure to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n opensalesai --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n opensalesai --timeout=60s
kubectl wait --for=condition=ready pod -l app=qdrant -n opensalesai --timeout=60s

# Run migrations (one-time job)
kubectl apply -f infra/k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/db-migrate -n opensalesai --timeout=120s

# Deploy application services
kubectl apply -f infra/k8s/api-gateway/
kubectl apply -f infra/k8s/sfa-service/
kubectl apply -f infra/k8s/eb2b-service/
kubectl apply -f infra/k8s/notification-service/
kubectl apply -f infra/k8s/ai-service/

# Deploy frontend applications
kubectl apply -f infra/k8s/dashboard/
kubectl apply -f infra/k8s/retailer-pwa/

# Deploy ingress (Caddy or nginx-ingress)
kubectl apply -f infra/k8s/ingress.yaml

# Verify all pods are running
kubectl get pods -n opensalesai
```

### 3.2 Option B: Azure Kubernetes Service (AKS)

For cloud production deployments.

```powershell
# Prerequisites
# - Azure CLI installed: winget install Microsoft.AzureCLI
# - Azure subscription with Contributor access

# Login to Azure
az login

# Create resource group
az group create --name opensalesai-rg --location centralindia

# Create AKS cluster with GPU node pool
az aks create `
  --resource-group opensalesai-rg `
  --name opensalesai-cluster `
  --node-count 3 `
  --node-vm-size Standard_D8s_v5 `
  --enable-managed-identity `
  --generate-ssh-keys

# Add GPU node pool for AI workloads
az aks nodepool add `
  --resource-group opensalesai-rg `
  --cluster-name opensalesai-cluster `
  --name gpupool `
  --node-count 1 `
  --node-vm-size Standard_NC24ads_A100_v4 `
  --node-taints "nvidia.com/gpu=true:NoSchedule" `
  --labels workload=ai

# Get credentials
az aks get-credentials --resource-group opensalesai-rg --name opensalesai-cluster

# Install NVIDIA device plugin for GPU nodes
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.14.1/nvidia-device-plugin.yml

# Create Azure Container Registry (ACR)
az acr create --resource-group opensalesai-rg --name opensalesaiacr --sku Standard
az aks update --resource-group opensalesai-rg --name opensalesai-cluster --attach-acr opensalesaiacr

# Build and push Docker images
$services = @("api-gateway", "sfa-service", "eb2b-service", "notification-service", "dashboard", "retailer-pwa", "ai-service")
foreach ($svc in $services) {
    $dockerfilePath = if ($svc -eq "ai-service") {
        "services/ai-service/Dockerfile"
    } else {
        "infra/docker/$svc.Dockerfile"
    }
    Write-Host "Building $svc..."
    az acr build `
      --registry opensalesaiacr `
      --image "opensalesai/$svc`:latest" `
      --file $dockerfilePath `
      .
}

# Install Helm (for managed services)
winget install Helm.Helm

# Deploy managed PostgreSQL (Azure Database for PostgreSQL Flexible Server)
az postgres flexible-server create `
  --resource-group opensalesai-rg `
  --name opensalesai-db `
  --location centralindia `
  --admin-user opensales `
  --admin-password "STRONG_PASSWORD_HERE" `
  --sku-name Standard_D4s_v3 `
  --storage-size 128 `
  --version 16

# Deploy managed Redis (Azure Cache for Redis)
az redis create `
  --resource-group opensalesai-rg `
  --name opensalesai-cache `
  --location centralindia `
  --sku Standard `
  --vm-size c1

# Deploy application using Helm
helm install opensalesai infra/helm/opensalesai `
  --namespace opensalesai `
  --create-namespace `
  --set global.registry=opensalesaiacr.azurecr.io `
  --set global.domain=app.opensalesai.com `
  --set postgres.host=opensalesai-db.postgres.database.azure.com `
  --set redis.host=opensalesai-cache.redis.cache.windows.net `
  -f infra/helm/values-production.yaml
```

### 3.3 Kubernetes Resource Limits

Recommended resource allocations:

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit | Replicas |
|---------|------------|-----------|----------------|-------------|----------|
| API Gateway | 250m | 1000m | 256Mi | 512Mi | 2 |
| SFA Service | 250m | 1000m | 256Mi | 512Mi | 2 |
| eB2B Service | 250m | 1000m | 256Mi | 512Mi | 2 |
| Notification Service | 100m | 500m | 128Mi | 256Mi | 2 |
| AI Service | 1000m | 4000m | 2Gi | 8Gi | 1 (GPU) |
| Dashboard | 100m | 500m | 128Mi | 256Mi | 2 |
| Retailer PWA | 100m | 500m | 128Mi | 256Mi | 2 |
| PostgreSQL | 1000m | 4000m | 2Gi | 8Gi | 1 (+ replica) |
| Redis | 250m | 1000m | 256Mi | 1Gi | 1 |
| Qdrant | 500m | 2000m | 1Gi | 4Gi | 1 |
| n8n | 250m | 1000m | 256Mi | 512Mi | 1 |

---

## 4. Environment Variables Reference

All environment variables used by the system:

```env
# =============================================================================
# Database
# =============================================================================
DATABASE_URL=postgresql://opensales:password@localhost:5432/opensalesai
# Connection pool size (per service instance)
DATABASE_POOL_SIZE=20

# =============================================================================
# Redis
# =============================================================================
REDIS_URL=redis://localhost:6379
# Separate DB numbers for different use cases
REDIS_SESSION_DB=0
REDIS_QUEUE_DB=1
REDIS_CACHE_DB=2

# =============================================================================
# Qdrant Vector Database
# =============================================================================
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# =============================================================================
# MinIO Object Storage
# =============================================================================
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_UPLOADS=uploads
MINIO_BUCKET_ML=ml-artifacts
MINIO_USE_SSL=false

# =============================================================================
# Keycloak Authentication
# =============================================================================
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=opensalesai
KEYCLOAK_CLIENT_ID=opensalesai-app
KEYCLOAK_CLIENT_SECRET=your-client-secret
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# =============================================================================
# LLM / AI
# =============================================================================
# Ollama (local inference)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_PRIMARY_MODEL=llama3.1:70b
OLLAMA_FAST_MODEL=llama3.1:8b
OLLAMA_VISION_MODEL=llava:34b

# Cloud fallback (optional)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Embedding model
EMBEDDING_MODEL=all-MiniLM-L6-v2

# =============================================================================
# WhatsApp Business API
# =============================================================================
WHATSAPP_TOKEN=your_whatsapp_access_token
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_secret
WHATSAPP_PHONE_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_API_URL=https://graph.facebook.com/v18.0

# =============================================================================
# SMS Gateway
# =============================================================================
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_account_sid
SMS_AUTH_TOKEN=your_auth_token
SMS_FROM_NUMBER=+1234567890

# =============================================================================
# Push Notifications (Firebase Cloud Messaging)
# =============================================================================
FCM_PROJECT_ID=your-firebase-project
FCM_SERVICE_ACCOUNT_KEY=path/to/serviceAccountKey.json

# =============================================================================
# Monitoring
# =============================================================================
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=admin
LOKI_URL=http://loki:3100

# =============================================================================
# Application
# =============================================================================
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3010,http://localhost:3011

# Service ports
API_GATEWAY_PORT=3000
SFA_SERVICE_PORT=3001
EB2B_SERVICE_PORT=3002
NOTIFICATION_SERVICE_PORT=3003
AI_SERVICE_PORT=8000
DASHBOARD_PORT=3010
RETAILER_PWA_PORT=3011

# Domain (for Caddy TLS)
DOMAIN=localhost

# =============================================================================
# MLflow
# =============================================================================
MLFLOW_TRACKING_URI=http://localhost:5000
MLFLOW_ARTIFACT_ROOT=s3://ml-artifacts
```

---

## 5. Operational Runbook

### 5.1 Common Operations

#### Restart a Single Service

```powershell
# Docker Compose (local/staging)
docker compose restart sfa-service

# Kubernetes
kubectl rollout restart deployment/sfa-service -n opensalesai
```

#### View Logs

```powershell
# Docker Compose
docker compose logs -f --tail=100 ai-service

# Kubernetes
kubectl logs -f deployment/ai-service -n opensalesai --tail=100
```

#### Run Database Migration

```powershell
# Local
npx prisma migrate dev --schema=services/api-gateway/prisma/schema.prisma

# Staging/Production
docker compose exec api-gateway npx prisma migrate deploy

# Kubernetes
kubectl exec -it deployment/api-gateway -n opensalesai -- npx prisma migrate deploy
```

#### Trigger Manual Task Generation

```powershell
# Via API
Invoke-RestMethod -Uri "http://localhost:8000/tasks/generate" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body '{"companyId":"your-company-uuid","taskDate":"2026-02-08"}'
```

### 5.2 Troubleshooting

#### LLM Not Responding

```powershell
# Check Ollama status
ollama list
ollama ps

# Restart Ollama service
Stop-Service ollama
Start-Service ollama

# Verify model is loaded
Invoke-RestMethod http://localhost:11434/api/tags

# The AI service has a fallback to rule-based task generation
# when the LLM is unavailable (circuit breaker activates after 3 failures).
```

#### Database Connection Refused

```powershell
# Check PostgreSQL container
docker compose ps postgres
docker compose logs postgres --tail=20

# Verify connection
docker exec opensalesai-postgres-1 pg_isready -U opensales

# If pool exhausted, check active connections
docker exec opensalesai-postgres-1 psql -U opensales -d opensalesai -c "SELECT count(*) FROM pg_stat_activity;"
```

#### WhatsApp Webhook Not Receiving

```powershell
# 1. Verify the webhook URL is configured in Meta Developer Console
# 2. Check that the verify token matches WHATSAPP_VERIFY_TOKEN
# 3. Test webhook verification manually:
Invoke-RestMethod "http://localhost:3002/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test"
# Should return: "test"

# 4. Check eB2B service logs for incoming messages
docker compose logs -f eb2b-service
```

#### High Memory Usage

```powershell
# Check container resource usage
docker stats --no-stream

# If PostgreSQL memory is high, check for long-running queries
docker exec opensalesai-postgres-1 psql -U opensales -d opensalesai -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 5;"

# If Redis memory is high, check key count
docker exec opensalesai-redis-1 redis-cli dbsize
docker exec opensalesai-redis-1 redis-cli info memory
```

### 5.3 Upgrade Procedure

```powershell
# 1. Pull latest code
git pull origin main

# 2. Install any new dependencies
npm install
Set-Location services\ai-service; pip install -r requirements.txt; Set-Location ..\..

# 3. Run migrations
npx prisma migrate deploy --schema=services/api-gateway/prisma/schema.prisma

# 4. Rebuild and restart
docker compose up -d --build

# 5. Verify health
Invoke-RestMethod http://localhost:3000/health
```

---

## 6. Security Checklist

Before deploying to staging or production, verify:

- [ ] All default passwords changed (PostgreSQL, Redis, Keycloak, MinIO, Grafana)
- [ ] `.env` file is NOT committed to git (check `.gitignore`)
- [ ] API keys and secrets are stored securely (Docker secrets, Azure Key Vault)
- [ ] Keycloak HTTPS is enabled in production
- [ ] CORS origin whitelist is restricted to actual domain names
- [ ] Rate limiting is configured on all public endpoints
- [ ] Database backups are scheduled and tested
- [ ] TLS certificates are provisioned (Caddy auto-TLS or Azure Front Door)
- [ ] WhatsApp webhook verify token is a strong random string
- [ ] PII redaction is enabled for LLM prompts
- [ ] Container images are scanned for vulnerabilities
- [ ] Network policies restrict inter-pod communication in Kubernetes
- [ ] Prometheus/Grafana are not exposed publicly without authentication

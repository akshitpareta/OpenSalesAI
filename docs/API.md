# OpenSalesAI API Documentation

Base URLs:
- **API Gateway:** `http://localhost:3000`
- **SFA Service:** `http://localhost:3001`
- **eB2B Service:** `http://localhost:3002`
- **Notification Service:** `http://localhost:3003`
- **AI Service:** `http://localhost:8000`

All endpoints (except health checks and WhatsApp webhook verification) require a valid JWT Bearer token obtained from Keycloak. Include it in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

All request/response bodies are JSON (`Content-Type: application/json`). All timestamps are in UTC (ISO 8601). All monetary values are in INR. All IDs are UUIDs.

---

## Table of Contents

1. [API Gateway](#1-api-gateway)
2. [SFA Service](#2-sfa-service)
3. [eB2B Service](#3-eb2b-service)
4. [Notification Service](#4-notification-service)
5. [AI Service](#5-ai-service)

---

## 1. API Gateway

The API Gateway handles authentication, rate limiting, and request proxying. It also provides health and OpenAPI endpoints directly.

### `GET /health`

Health check endpoint. No authentication required.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T12:00:00.000Z",
  "version": "0.1.0",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### `GET /docs`

Swagger UI for interactive API exploration. No authentication required.

**Example:**
```bash
# Open in browser
curl http://localhost:3000/docs
```

---

### `POST /auth/token`

Exchange Keycloak credentials for a JWT token (proxied to Keycloak).

**Request Body:**
```json
{
  "username": "admin@opensalesai.com",
  "password": "password123",
  "grant_type": "password"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@opensalesai.com","password":"password123","grant_type":"password"}'
```

---

### `POST /auth/refresh`

Refresh an expired access token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

---

### `POST /auth/logout`

Invalidate the current session.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (204):** No content.

---

## 2. SFA Service

The Sales Force Automation service manages beat plans, store visits, field orders, and sales rep operations.

### Beat Plans

#### `POST /beats`

Create a new beat plan (weekly store visit schedule for a rep).

**Request Body:**
```json
{
  "repId": "uuid",
  "name": "Monday-West Route",
  "dayOfWeek": 1,
  "storeIds": ["uuid1", "uuid2", "uuid3"],
  "effectiveFrom": "2026-02-10",
  "effectiveTo": "2026-03-10"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "repId": "uuid",
  "name": "Monday-West Route",
  "dayOfWeek": 1,
  "storeIds": ["uuid1", "uuid2", "uuid3"],
  "effectiveFrom": "2026-02-10T00:00:00.000Z",
  "effectiveTo": "2026-03-10T00:00:00.000Z",
  "createdAt": "2026-02-07T12:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/beats \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repId":"<rep-uuid>","name":"Monday-West Route","dayOfWeek":1,"storeIds":["<store-uuid>"],"effectiveFrom":"2026-02-10","effectiveTo":"2026-03-10"}'
```

---

#### `GET /beats`

List beat plans with optional filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repId` | UUID | No | Filter by sales rep |
| `dayOfWeek` | int (0-6) | No | Filter by day (0=Sunday) |
| `page` | int | No | Page number (default: 1) |
| `limit` | int | No | Items per page (default: 20, max: 100) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "repId": "uuid",
      "repName": "Amit Sharma",
      "name": "Monday-West Route",
      "dayOfWeek": 1,
      "storeIds": ["uuid1", "uuid2"],
      "storeCount": 2,
      "effectiveFrom": "2026-02-10T00:00:00.000Z",
      "effectiveTo": "2026-03-10T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Example:**
```bash
curl "http://localhost:3001/beats?repId=<rep-uuid>&dayOfWeek=1" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Store Visits

#### `POST /visits`

Check in to a store. GPS coordinates are validated against the store's location (must be within 100 meters).

**Request Body:**
```json
{
  "storeId": "uuid",
  "repId": "uuid",
  "checkInLat": 19.0760,
  "checkInLng": 72.8777
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "repId": "uuid",
  "checkInTime": "2026-02-07T09:30:00.000Z",
  "checkInLat": 19.076,
  "checkInLng": 72.8777,
  "status": "checked_in"
}
```

**Error (400) — Too far from store:**
```json
{
  "error": "GPS_VALIDATION_FAILED",
  "message": "Check-in location is 245m from store. Must be within 100m.",
  "distance_meters": 245
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/visits \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"<store-uuid>","repId":"<rep-uuid>","checkInLat":19.0760,"checkInLng":72.8777}'
```

---

#### `POST /visits/:id/checkout`

Check out from a store. Minimum visit duration is 5 minutes.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Visit ID |

**Request Body:**
```json
{
  "checkOutLat": 19.0761,
  "checkOutLng": 72.8778,
  "notes": "Placed order for 5 cases. Owner requested delivery by Friday.",
  "photos": ["https://minio.local/visits/photo1.jpg"]
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "repId": "uuid",
  "checkInTime": "2026-02-07T09:30:00.000Z",
  "checkOutTime": "2026-02-07T09:42:00.000Z",
  "durationMinutes": 12,
  "notes": "Placed order for 5 cases. Owner requested delivery by Friday.",
  "photos": ["https://minio.local/visits/photo1.jpg"]
}
```

**Error (400) — Visit too short:**
```json
{
  "error": "VISIT_TOO_SHORT",
  "message": "Visit duration is 3 minutes. Minimum is 5 minutes.",
  "duration_minutes": 3
}
```

---

### Orders (Field)

#### `POST /orders`

Create a field order captured by a sales rep during a store visit.

**Request Body:**
```json
{
  "storeId": "uuid",
  "repId": "uuid",
  "orderSource": "MANUAL",
  "items": [
    { "productId": "uuid", "quantity": 10, "unitPrice": 25.00 },
    { "productId": "uuid", "quantity": 5, "unitPrice": 60.00 }
  ]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "repId": "uuid",
  "orderSource": "MANUAL",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 250g",
      "quantity": 10,
      "unitPrice": 25.00,
      "lineTotal": 250.00
    },
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 800g",
      "quantity": 5,
      "unitPrice": 60.00,
      "lineTotal": 300.00
    }
  ],
  "totalValue": 550.00,
  "transactionDate": "2026-02-07T09:45:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"<store-uuid>","repId":"<rep-uuid>","orderSource":"MANUAL","items":[{"productId":"<product-uuid>","quantity":10,"unitPrice":25.00}]}'
```

---

#### `GET /orders`

List field orders with filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `storeId` | UUID | No | Filter by store |
| `repId` | UUID | No | Filter by rep |
| `orderSource` | string | No | MANUAL, EB2B, WHATSAPP, VOICE |
| `from` | ISO date | No | Start date |
| `to` | ISO date | No | End date |
| `page` | int | No | Page number (default: 1) |
| `limit` | int | No | Items per page (default: 20) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "storeName": "Sharma General Store",
      "repId": "uuid",
      "repName": "Amit Sharma",
      "orderSource": "MANUAL",
      "totalValue": 550.00,
      "itemCount": 2,
      "transactionDate": "2026-02-07T09:45:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 156, "totalPages": 8 }
}
```

---

### Sales Reps

#### `GET /reps`

List sales reps with filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `territory` | string | No | Filter by territory |
| `skillTier` | string | No | A, B, or C |
| `isActive` | boolean | No | Filter by active status |
| `search` | string | No | Search by name |
| `page` | int | No | Page number |
| `limit` | int | No | Items per page |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Amit Sharma",
      "phone": "+919876500001",
      "email": "amit.sharma@opensalesai.com",
      "territory": "Mumbai-West",
      "dailyTarget": 12,
      "monthlyQuota": 250000.00,
      "pointsBalance": 1250,
      "skillTier": "A",
      "isActive": true,
      "assignedStoreCount": 8
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

**Example:**
```bash
curl "http://localhost:3001/reps?territory=Mumbai-West&isActive=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /reps/:id/dashboard`

Get individual rep KPI dashboard.

**Response (200):**
```json
{
  "rep": {
    "id": "uuid",
    "name": "Amit Sharma",
    "territory": "Mumbai-West",
    "skillTier": "A",
    "pointsBalance": 1250
  },
  "kpis": {
    "today": {
      "storesVisited": 5,
      "targetStores": 12,
      "tasksCompleted": 8,
      "tasksAssigned": 12,
      "ordersPlaced": 4,
      "revenueGenerated": 12500.00
    },
    "thisMonth": {
      "storesVisited": 85,
      "totalStores": 100,
      "coveragePercent": 85.0,
      "tasksCompleted": 180,
      "tasksAssigned": 220,
      "completionRate": 81.8,
      "totalRevenue": 185000.00,
      "quotaAttainment": 74.0,
      "avgOrderValue": 2176.47,
      "pointsEarned": 450,
      "rank": 2
    }
  },
  "recentVisits": [
    {
      "storeId": "uuid",
      "storeName": "Sharma General Store",
      "checkInTime": "2026-02-07T09:30:00.000Z",
      "durationMinutes": 12,
      "orderPlaced": true,
      "orderValue": 3500.00
    }
  ]
}
```

---

## 3. eB2B Service

The eB2B Commerce service handles the digital ordering platform, product catalog, shopping cart, and WhatsApp integration.

### Product Catalog

#### `GET /catalog`

Browse product catalog with search and filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by product name or SKU |
| `category` | string | No | Filter by category |
| `subCategory` | string | No | Filter by sub-category |
| `isFocus` | boolean | No | Filter focus products |
| `page` | int | No | Page number |
| `limit` | int | No | Items per page |
| `sortBy` | string | No | name, mrp, category (default: name) |
| `sortOrder` | string | No | asc, desc (default: asc) |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "skuCode": "BIS-PG-250",
      "name": "Parle-G Glucose Biscuit 250g",
      "category": "Biscuits",
      "subCategory": "Glucose",
      "mrp": 25.00,
      "distributorPrice": 20.50,
      "marginPct": 18.00,
      "packSize": "250g",
      "isFocus": true,
      "inStock": true
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 200, "totalPages": 10 },
  "categories": ["Biscuits", "Snacks", "Beverages", "Personal Care", "Home Care", "Dairy", "Staples", "Confectionery", "Noodles/Pasta", "Health Foods"]
}
```

**Example:**
```bash
curl "http://localhost:3002/catalog?category=Biscuits&isFocus=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Shopping Cart

#### `POST /cart`

Add item to cart (or update quantity if already present).

**Request Body:**
```json
{
  "storeId": "uuid",
  "productId": "uuid",
  "quantity": 10
}
```

**Response (200):**
```json
{
  "cartId": "uuid",
  "storeId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 250g",
      "skuCode": "BIS-PG-250",
      "quantity": 10,
      "unitPrice": 20.50,
      "lineTotal": 205.00
    }
  ],
  "totalItems": 1,
  "totalValue": 205.00
}
```

---

#### `GET /cart/:storeId`

Get current cart for a store.

**Response (200):**
```json
{
  "cartId": "uuid",
  "storeId": "uuid",
  "items": [],
  "totalItems": 0,
  "totalValue": 0.00
}
```

---

#### `DELETE /cart/:storeId/items/:productId`

Remove an item from the cart.

**Response (200):**
```json
{
  "cartId": "uuid",
  "storeId": "uuid",
  "items": [],
  "totalItems": 0,
  "totalValue": 0.00
}
```

---

### eB2B Orders

#### `POST /orders`

Create an eB2B order from the cart.

**Request Body:**
```json
{
  "storeId": "uuid",
  "channel": "PWA",
  "deliveryNotes": "Deliver before 2 PM"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 250g",
      "quantity": 10,
      "unitPrice": 20.50,
      "lineTotal": 205.00
    }
  ],
  "totalValue": 205.00,
  "status": "PENDING",
  "channel": "PWA",
  "deliveryEta": "2026-02-08T14:00:00.000Z",
  "createdAt": "2026-02-07T10:00:00.000Z"
}
```

---

#### `GET /orders`

List eB2B orders with filters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `storeId` | UUID | No | Filter by store |
| `status` | string | No | PENDING, CONFIRMED, PROCESSING, DISPATCHED, DELIVERED, CANCELLED |
| `channel` | string | No | WHATSAPP, PWA, APP, VOICE |
| `from` | ISO date | No | Start date |
| `to` | ISO date | No | End date |
| `page` | int | No | Page number |
| `limit` | int | No | Items per page |

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "storeName": "Sharma General Store",
      "totalValue": 205.00,
      "status": "CONFIRMED",
      "channel": "PWA",
      "itemCount": 3,
      "createdAt": "2026-02-07T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

---

#### `GET /orders/:id`

Get a single eB2B order by ID.

**Response (200):**
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "storeName": "Sharma General Store",
  "items": [
    {
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 250g",
      "skuCode": "BIS-PG-250",
      "quantity": 10,
      "unitPrice": 20.50,
      "lineTotal": 205.00
    }
  ],
  "totalValue": 205.00,
  "status": "CONFIRMED",
  "channel": "PWA",
  "whatsappMsgId": null,
  "deliveryEta": "2026-02-08T14:00:00.000Z",
  "createdAt": "2026-02-07T10:00:00.000Z",
  "updatedAt": "2026-02-07T10:05:00.000Z"
}
```

---

#### `PATCH /orders/:id/status`

Update order status.

**Request Body:**
```json
{
  "status": "DISPATCHED"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "DISPATCHED",
  "updatedAt": "2026-02-07T14:00:00.000Z"
}
```

---

### Perfect Basket

#### `GET /orders/:storeId/perfect-basket`

Get AI-recommended basket for a store (calls the AI service internally).

**Response (200):**
```json
{
  "storeId": "uuid",
  "storeName": "Sharma General Store",
  "recommendations": [
    {
      "productId": "uuid",
      "productName": "Parle-G Glucose Biscuit 250g",
      "skuCode": "BIS-PG-250",
      "suggestedQuantity": 10,
      "reason": "This store orders 10 packs every 10 days. Last order was 12 days ago.",
      "confidence": 0.92,
      "unitPrice": 20.50,
      "lineTotal": 205.00
    },
    {
      "productId": "uuid",
      "productName": "Maggi 2-Minute Noodles 70g",
      "skuCode": "NDL-MAG-70",
      "suggestedQuantity": 24,
      "reason": "High-demand product in this area. Nearby stores average 30 packs/week.",
      "confidence": 0.85,
      "unitPrice": 11.48,
      "lineTotal": 275.52
    }
  ],
  "totalSuggestedValue": 480.52,
  "generatedAt": "2026-02-07T10:00:00.000Z"
}
```

---

### WhatsApp Webhook

#### `GET /whatsapp/webhook`

WhatsApp webhook verification (Meta webhook setup). No authentication required.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hub.mode` | string | Yes | Must be "subscribe" |
| `hub.verify_token` | string | Yes | Must match WHATSAPP_VERIFY_TOKEN env var |
| `hub.challenge` | string | Yes | Echoed back to Meta |

**Response (200):** Returns the `hub.challenge` string.

**Example:**
```bash
curl "http://localhost:3002/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=mysecrettoken&hub.challenge=1234567890"
```

---

#### `POST /whatsapp/webhook`

Receive incoming WhatsApp messages. No JWT auth (verified by Meta signature).

**Request Body (from Meta):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456",
      "changes": [
        {
          "value": {
            "messages": [
              {
                "id": "wamid.xxx",
                "from": "919876543210",
                "timestamp": "1707307200",
                "type": "text",
                "text": { "body": "2 cs PG 250g, 1 ctn Coke 300ml, 5 packet Maggi bhejo" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response (200):**
```json
{
  "status": "received",
  "messageId": "wamid.xxx",
  "processingId": "uuid"
}
```

---

## 4. Notification Service

The Notification Service handles outbound messaging across WhatsApp, SMS, and push notifications.

### `GET /health`

**Response (200):**
```json
{ "status": "ok", "timestamp": "2026-02-07T12:00:00.000Z" }
```

---

### WhatsApp Notifications

#### `POST /notify/whatsapp`

Send a WhatsApp template message to a phone number.

**Request Body:**
```json
{
  "to": "+919876543210",
  "templateName": "daily_task_summary",
  "languageCode": "en",
  "parameters": {
    "rep_name": "Amit",
    "task_count": "8",
    "task_list": "1. Visit Sharma Store - Push Parle-G\n2. Visit Patel Kirana - Reactivation\n3. Visit Mumbai Mart - MSL Fill"
  }
}
```

**Response (200):**
```json
{
  "messageId": "wamid.HBgMOTE5ODc2NTQz...",
  "status": "sent",
  "to": "+919876543210",
  "templateName": "daily_task_summary",
  "sentAt": "2026-02-07T01:30:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3003/notify/whatsapp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"+919876543210","templateName":"daily_task_summary","languageCode":"en","parameters":{"rep_name":"Amit","task_count":"8","task_list":"1. Visit Sharma Store"}}'
```

---

### SMS Notifications

#### `POST /notify/sms`

Send an SMS message (fallback when WhatsApp is unavailable).

**Request Body:**
```json
{
  "to": "+919876543210",
  "message": "OpenSalesAI: You have 8 tasks for today. Open the app to view details.",
  "priority": "normal"
}
```

**Response (200):**
```json
{
  "messageId": "sms_abc123",
  "status": "queued",
  "to": "+919876543210",
  "sentAt": "2026-02-07T01:30:00.000Z"
}
```

---

### Push Notifications

#### `POST /notify/push`

Send an FCM push notification to a mobile device.

**Request Body:**
```json
{
  "deviceTokens": ["fcm_token_1", "fcm_token_2"],
  "title": "Task Completed!",
  "body": "You earned 15 points for completing the MSL Fill task at Sharma Store.",
  "data": {
    "type": "task_completion",
    "taskId": "uuid",
    "pointsEarned": 15
  }
}
```

**Response (200):**
```json
{
  "successCount": 2,
  "failureCount": 0,
  "results": [
    { "deviceToken": "fcm_token_1", "status": "sent" },
    { "deviceToken": "fcm_token_2", "status": "sent" }
  ]
}
```

---

## 5. AI Service

The AI/ML Service handles task generation, order parsing, demand prediction, RAG queries, and LangGraph agent interactions. Built with Python FastAPI.

### `GET /health`

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T12:00:00.000Z",
  "models": {
    "llm": "llama3.1:70b",
    "embedding": "all-MiniLM-L6-v2",
    "whisper": "large-v3"
  },
  "gpu_available": true,
  "qdrant_connected": true
}
```

---

### Task Generation

#### `POST /tasks/generate`

Trigger AI task generation for all reps (or a specific rep). This is typically called nightly by the WF-001 workflow at 2 AM.

**Request Body:**
```json
{
  "companyId": "uuid",
  "repId": "uuid",
  "taskDate": "2026-02-08",
  "dryRun": false
}
```

- `repId` is optional. If omitted, tasks are generated for all active reps.
- `dryRun: true` returns generated tasks without writing to the database.

**Response (200):**
```json
{
  "status": "completed",
  "taskDate": "2026-02-08",
  "summary": {
    "repsProcessed": 10,
    "tasksGenerated": 87,
    "avgPriority": 62.4,
    "tasksByType": {
      "PUSH": 25,
      "MSL_FILL": 22,
      "REACTIVATION": 15,
      "UPSELL": 12,
      "CROSS_SELL": 8,
      "NEW_LAUNCH": 5
    }
  },
  "durationMs": 45200
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/tasks/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId":"<company-uuid>","taskDate":"2026-02-08"}'
```

---

#### `GET /tasks/{rep_id}/today`

Get today's AI-generated tasks for a specific rep.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status (PENDING, COMPLETED, etc.) |
| `sortBy` | string | No | priority, store_name (default: priority) |

**Response (200):**
```json
{
  "repId": "uuid",
  "repName": "Amit Sharma",
  "taskDate": "2026-02-07",
  "tasks": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "storeName": "Sharma General Store",
      "storeAddress": "14 MG Road Andheri West",
      "taskType": "REACTIVATION",
      "priorityScore": 92,
      "status": "PENDING",
      "productIds": ["uuid1", "uuid2"],
      "productNames": ["Parle-G Glucose Biscuit 250g", "Coca-Cola 300ml"],
      "aiReasoning": "Store has not ordered in 18 days (avg frequency: 10 days). Revenue declined 30% this month. Likely switching to competitor.",
      "suggestedPitch": "Sharma ji, aapka order 18 din se nahi aaya. Aaj special offer hai — 5% extra discount on Parle-G if you order 3+ cases. Kya 3 case book karein?",
      "estimatedImpact": 1500.00,
      "rewardPoints": 20
    }
  ],
  "totalTasks": 8,
  "totalEstimatedImpact": 12500.00
}
```

---

### Order Parsing

#### `POST /orders/parse`

Parse a natural language order (text, voice transcription, or image OCR) into structured line items.

**Request Body:**
```json
{
  "storeId": "uuid",
  "rawMessage": "2 cs PG 250g, 1 ctn Coke 300ml, aur 5 packet Maggi bhejo",
  "messageSource": "text",
  "language": "mixed"
}
```

**Response (200):**
```json
{
  "parsed_items": [
    {
      "product_name": "Parle-G Glucose Biscuit 250g",
      "product_id": "uuid",
      "sku_code": "BIS-PG-250",
      "quantity": 2,
      "unit": "case",
      "confidence": 0.95,
      "original_text": "2 cs PG 250g"
    },
    {
      "product_name": "Coca-Cola 300ml",
      "product_id": "uuid",
      "sku_code": "BEV-CCL-300",
      "quantity": 1,
      "unit": "carton",
      "confidence": 0.93,
      "original_text": "1 ctn Coke 300ml"
    },
    {
      "product_name": "Maggi 2-Minute Noodles 70g",
      "product_id": "uuid",
      "sku_code": "NDL-MAG-70",
      "quantity": 5,
      "unit": "pcs",
      "confidence": 0.90,
      "original_text": "5 packet Maggi"
    }
  ],
  "unparsed_text": "bhejo",
  "clarification_needed": [],
  "language_detected": "mixed",
  "order_intent_confidence": 0.97
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/orders/parse \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"<store-uuid>","rawMessage":"2 cs PG 250g, 1 ctn Coke 300ml","messageSource":"text"}'
```

---

### Speech-to-Text

#### `POST /stt/transcribe`

Transcribe audio (voice notes) to text using Whisper Large-v3.

**Request Body:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `audio` | file | Audio file (OGG, WAV, MP3, M4A) |
| `language` | string | Language hint: "hi" (Hindi), "en" (English), "auto" |

**Response (200):**
```json
{
  "text": "Bhai do case Parle-G 250 gram bhejo aur ek carton Coke 300ml",
  "language": "hi",
  "confidence": 0.94,
  "durationSeconds": 8.5
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/stt/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio=@voice_note.ogg" \
  -F "language=auto"
```

---

### Vision (Image Parsing)

#### `POST /vision/parse`

Parse a photograph of a handwritten order using LLaVA vision model.

**Request Body:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `image` | file | Image file (JPEG, PNG) |
| `storeId` | string | Store UUID for context |

**Response (200):**
```json
{
  "extracted_text": "PG 250g - 5 case\nCoke 300 - 2 ctn\nSurf 1kg - 3\nMaggi - 10 pkt",
  "confidence": 0.82,
  "image_quality": "good"
}
```

---

### Demand Predictions

#### `POST /predictions/demand`

Get demand forecast for a store-SKU combination.

**Request Body:**
```json
{
  "storeId": "uuid",
  "productId": "uuid",
  "horizonDays": 14
}
```

**Response (200):**
```json
{
  "storeId": "uuid",
  "productId": "uuid",
  "productName": "Parle-G Glucose Biscuit 250g",
  "predictions": [
    { "date": "2026-02-08", "predictedQuantity": 12, "lowerBound": 8, "upperBound": 16 },
    { "date": "2026-02-09", "predictedQuantity": 10, "lowerBound": 6, "upperBound": 14 },
    { "date": "2026-02-14", "predictedQuantity": 15, "lowerBound": 10, "upperBound": 20 }
  ],
  "modelVersion": "prophet-xgb-v1.2",
  "confidence": 0.87,
  "suggestedReorderQuantity": 48,
  "suggestedReorderDate": "2026-02-10"
}
```

---

#### `POST /predictions/stockout-scan`

Scan all store-SKU pairs for stock-out risk. Returns items with probability > threshold.

**Request Body:**
```json
{
  "companyId": "uuid",
  "threshold": 0.7
}
```

**Response (200):**
```json
{
  "alerts": [
    {
      "storeId": "uuid",
      "storeName": "Sharma General Store",
      "productId": "uuid",
      "productName": "Maggi 2-Minute Noodles 70g",
      "stockoutProbability": 0.89,
      "estimatedDaysUntilStockout": 3,
      "suggestedReorderQuantity": 48,
      "currentEstimatedStock": 5
    }
  ],
  "totalAlerts": 15,
  "scanDurationMs": 12400
}
```

---

### LangGraph Agent

#### `POST /agent/chat`

Conversational endpoint for the LangGraph multi-agent system (supervisor routes to sub-agents).

**Request Body:**
```json
{
  "sessionId": "uuid",
  "message": "What were my top 5 stores by revenue last week?",
  "context": {
    "companyId": "uuid",
    "userId": "uuid",
    "role": "manager"
  }
}
```

**Response (200):**
```json
{
  "sessionId": "uuid",
  "response": "Here are your top 5 stores by revenue for last week (Jan 27 - Feb 2):\n\n1. **Thakur Cash and Carry** (Mumbai) - INR 45,840\n2. **Delhi Supermart** (Delhi) - INR 38,200\n3. **Bengaluru Supermart** (Bangalore) - INR 32,400\n4. **Hyderabad Supermart** (Hyderabad) - INR 28,100\n5. **Reddy Super Mart** (Mumbai) - INR 24,680\n\nTotal: INR 1,69,220. This is 12% higher than the previous week.",
  "agentUsed": "analytics_agent",
  "sqlGenerated": "SELECT s.name, SUM(t.total_value) ... (truncated)",
  "metadata": {
    "tokensUsed": 450,
    "latencyMs": 2300
  }
}
```

---

### RAG Queries

#### `POST /rag/query`

Direct RAG query against the vector knowledge base.

**Request Body:**
```json
{
  "query": "What is the best strategy for reactivating inactive kirana stores?",
  "companyId": "uuid",
  "collection": "sales_playbooks",
  "topK": 5
}
```

**Response (200):**
```json
{
  "answer": "Based on our sales playbooks, the most effective reactivation strategy for kirana stores involves three steps: (1) Visit within 48 hours of identifying inactivity, (2) Offer a targeted discount on the store's top 3 previously-ordered products, and (3) Address the specific reason for lapse — which is most commonly delivery delays (42%) or competitor pricing (31%).",
  "sources": [
    {
      "documentId": "uuid",
      "title": "Kirana Reactivation Playbook v2",
      "chunk": "The optimal reactivation window is 14-21 days...",
      "relevanceScore": 0.94
    },
    {
      "documentId": "uuid",
      "title": "Competitor Response Guidelines",
      "chunk": "When a store cites competitor pricing...",
      "relevanceScore": 0.87
    }
  ],
  "tokensUsed": 380,
  "latencyMs": 1800
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/rag/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"best strategy for reactivating inactive kirana stores","companyId":"<company-uuid>","collection":"sales_playbooks","topK":5}'
```

---

## Error Handling

All services return errors in a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of the error.",
  "details": {}
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Normal response |
| 201 | Created | Resource created successfully |
| 204 | No Content | Successful deletion |
| 400 | Bad Request | Validation error, GPS too far |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate entry |
| 422 | Unprocessable Entity | Valid JSON but invalid business logic |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |
| 503 | Service Unavailable | Dependency down (DB, Redis, LLM) |

### Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Auth endpoints | 10 | 1 minute |
| Read endpoints (GET) | 100 | 1 minute |
| Write endpoints (POST/PUT/PATCH) | 30 | 1 minute |
| AI endpoints | 20 | 1 minute |
| WhatsApp webhook | 1000 | 1 minute |

---

## Pagination

All list endpoints use cursor-based or offset pagination with this standard meta block:

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

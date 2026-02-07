/**
 * k6 Load Test Script for OpenSalesAI
 *
 * Simulates 500 concurrent users across the main API endpoints.
 *
 * Prerequisites:
 *   - Install k6: https://k6.io/docs/getting-started/installation/
 *   - Ensure the API services are running on the configured BASE_URL
 *   - Set environment variables or use defaults below
 *
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run --env BASE_URL=http://localhost:4001 scripts/load-test.js
 *   k6 run --env AUTH_TOKEN=<jwt> scripts/load-test.js
 *
 * Reports:
 *   k6 run --out json=results.json scripts/load-test.js
 *   k6 run --out csv=results.csv scripts/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Configuration ───────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4001';
const EB2B_URL = __ENV.EB2B_URL || 'http://localhost:4002';
const AI_URL = __ENV.AI_URL || 'http://localhost:8000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-load-token';
const COMPANY_ID = __ENV.COMPANY_ID || 'company-load-test';

// ── Custom Metrics ──────────────────────────────────────────────────────────────

const getTasksDuration = new Trend('get_tasks_duration', true);
const createOrderDuration = new Trend('create_order_duration', true);
const whatsappWebhookDuration = new Trend('whatsapp_webhook_duration', true);
const catalogSearchDuration = new Trend('catalog_search_duration', true);
const visitCheckinDuration = new Trend('visit_checkin_duration', true);
const repDashboardDuration = new Trend('rep_dashboard_duration', true);

const errorRate = new Rate('errors');
const successfulOrders = new Counter('successful_orders');
const successfulVisits = new Counter('successful_visits');

// ── k6 Options ──────────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 VUs over 1 minute
    { duration: '3m', target: 500 },  // Sustain 500 VUs for 3 minutes
    { duration: '1m', target: 0 },    // Ramp down to 0 over 1 minute
  ],

  thresholds: {
    // Task listing must respond within 500ms at P95
    'http_req_duration{name:get_tasks}': ['p(95)<500'],

    // Order creation must respond within 2s at P95
    'http_req_duration{name:create_order}': ['p(95)<2000'],

    // WhatsApp webhook must respond within 3s at P95
    'http_req_duration{name:whatsapp_webhook}': ['p(95)<3000'],

    // Overall error rate must be below 1%
    http_req_failed: ['rate<0.01'],

    // Custom metric thresholds
    get_tasks_duration: ['p(95)<500', 'p(99)<1000'],
    create_order_duration: ['p(95)<2000', 'p(99)<3000'],
    whatsapp_webhook_duration: ['p(95)<3000', 'p(99)<5000'],
    catalog_search_duration: ['p(95)<800', 'p(99)<1500'],
    visit_checkin_duration: ['p(95)<1000', 'p(99)<2000'],
    rep_dashboard_duration: ['p(95)<1000', 'p(99)<2000'],

    // Error rate for custom metric
    errors: ['rate<0.01'],
  },

  // Tags for grouping in Grafana / k6 Cloud
  tags: {
    project: 'opensalesai',
    testType: 'load',
  },
};

// ── Test Data ───────────────────────────────────────────────────────────────────

const REP_IDS = Array.from({ length: 50 }, (_, i) =>
  `rep-load-${String(i + 1).padStart(3, '0')}`
);

const STORE_IDS = Array.from({ length: 200 }, (_, i) =>
  `store-load-${String(i + 1).padStart(4, '0')}`
);

const PRODUCT_IDS = Array.from({ length: 100 }, (_, i) =>
  `prod-load-${String(i + 1).padStart(3, '0')}`
);

const SEARCH_TERMS = [
  'Maggi', 'Lays', 'Parle', 'Britannia', 'Haldiram',
  'Amul', 'Nestle', 'Cadbury', 'Surf', 'Colgate',
  'Noodles', 'Biscuits', 'Chips', 'Soap', 'Detergent',
];

const CATEGORIES = [
  'Noodles', 'Snacks', 'Biscuits', 'Beverages', 'Dairy',
  'Personal Care', 'Home Care', 'Confectionery', 'Staples',
];

// Indian city coordinates for GPS simulation
const LOCATIONS = [
  { lat: 19.0760, lng: 72.8777 },  // Mumbai
  { lat: 28.6139, lng: 77.2090 },  // Delhi
  { lat: 13.0827, lng: 80.2707 },  // Chennai
  { lat: 22.5726, lng: 88.3639 },  // Kolkata
  { lat: 12.9716, lng: 77.5946 },  // Bangalore
  { lat: 17.3850, lng: 78.4867 },  // Hyderabad
  { lat: 23.0225, lng: 72.5714 },  // Ahmedabad
  { lat: 18.5204, lng: 73.8567 },  // Pune
  { lat: 26.9124, lng: 75.7873 },  // Jaipur
  { lat: 26.8467, lng: 80.9462 },  // Lucknow
];

const WHATSAPP_MESSAGES = [
  'I need 5 cases of Maggi Noodles and 3 cases of Lays Classic',
  'Mujhe 10 packet Parle-G aur 5 packet Good Day chahiye',
  'Send 2 carton Amul butter and 1 carton cheese',
  'Order: Surf Excel 1kg x 20, Vim bar x 50',
  'Please deliver 100 packets Britannia Marie Gold tomorrow',
  'Haan bhai, 50 Maggi bhejo aur 20 Lays bhi',
  'Need urgent: 5 cases Coca Cola 300ml, 3 cases Sprite 300ml',
  'Aaj ke liye: Parle G 10 carton, Tiger biscuit 5 carton',
  '3 dozen Colgate toothpaste and 2 dozen Closeup',
  'Cadbury Dairy Milk 20 pieces, 5 Star 30 pieces, Gems 15 pieces',
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'X-Company-Id': COMPANY_ID,
  };
}

function randomLocation() {
  const loc = randomItem(LOCATIONS);
  // Add small random offset (within ~50m)
  return {
    lat: loc.lat + (Math.random() - 0.5) * 0.001,
    lng: loc.lng + (Math.random() - 0.5) * 0.001,
  };
}

function randomOrderItems() {
  const count = randomIntBetween(1, 5);
  const items = [];
  const usedProducts = new Set();

  for (let i = 0; i < count; i++) {
    let productId;
    do {
      productId = randomItem(PRODUCT_IDS);
    } while (usedProducts.has(productId));
    usedProducts.add(productId);

    items.push({
      productId,
      quantity: randomIntBetween(1, 50),
    });
  }
  return items;
}

// ── Scenario Functions ──────────────────────────────────────────────────────────

/**
 * GET /tasks — Fetch today's tasks for a sales rep
 * Target: P95 < 500ms
 */
function getTasks() {
  const repId = randomItem(REP_IDS);
  const res = http.get(
    `${BASE_URL}/tasks?repId=${repId}&status=PENDING&limit=20`,
    {
      headers: getHeaders(),
      tags: { name: 'get_tasks' },
    },
  );

  const success = check(res, {
    'GET /tasks status is 200': (r) => r.status === 200,
    'GET /tasks has data': (r) => {
      try {
        const body = r.json();
        return body.success === true && Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'GET /tasks response time < 500ms': (r) => r.timings.duration < 500,
  });

  getTasksDuration.add(res.timings.duration);
  errorRate.add(!success);
}

/**
 * POST /orders — Create an order with line items
 * Target: P95 < 2000ms
 */
function createOrder() {
  const payload = JSON.stringify({
    storeId: randomItem(STORE_IDS),
    repId: randomItem(REP_IDS),
    source: randomItem(['MANUAL', 'WHATSAPP', 'PWA']),
    items: randomOrderItems(),
  });

  const res = http.post(`${BASE_URL}/orders`, payload, {
    headers: getHeaders(),
    tags: { name: 'create_order' },
  });

  const success = check(res, {
    'POST /orders status is 201': (r) => r.status === 201,
    'POST /orders has order id': (r) => {
      try {
        const body = r.json();
        return body.success === true && body.data && body.data.id;
      } catch {
        return false;
      }
    },
    'POST /orders response time < 2s': (r) => r.timings.duration < 2000,
  });

  createOrderDuration.add(res.timings.duration);
  errorRate.add(!success);
  if (success) {
    successfulOrders.add(1);
  }
}

/**
 * POST /whatsapp/webhook — Simulate WhatsApp incoming messages
 * Target: P95 < 3000ms
 */
function whatsappWebhook() {
  const phoneNumber = `91${randomIntBetween(7000000000, 9999999999)}`;
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-load-test',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '919876543210',
                phone_number_id: 'phone-load-test',
              },
              messages: [
                {
                  from: phoneNumber,
                  id: `wamid.load.${Date.now()}.${randomIntBetween(1000, 9999)}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: {
                    body: randomItem(WHATSAPP_MESSAGES),
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  });

  const res = http.post(`${EB2B_URL}/whatsapp/webhook`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'whatsapp_webhook' },
  });

  const success = check(res, {
    'POST /whatsapp/webhook status is 200': (r) => r.status === 200,
    'POST /whatsapp/webhook response time < 3s': (r) => r.timings.duration < 3000,
  });

  whatsappWebhookDuration.add(res.timings.duration);
  errorRate.add(!success);
}

/**
 * GET /catalog — Search the product catalog
 * Target: P95 < 800ms
 */
function searchCatalog() {
  const search = randomItem(SEARCH_TERMS);
  const category = Math.random() > 0.5 ? `&category=${randomItem(CATEGORIES)}` : '';
  const page = randomIntBetween(1, 5);

  const res = http.get(
    `${EB2B_URL}/catalog?search=${encodeURIComponent(search)}${category}&page=${page}&limit=20`,
    {
      headers: getHeaders(),
      tags: { name: 'catalog_search' },
    },
  );

  const success = check(res, {
    'GET /catalog status is 200': (r) => r.status === 200,
    'GET /catalog has products': (r) => {
      try {
        const body = r.json();
        return body.success === true;
      } catch {
        return false;
      }
    },
    'GET /catalog response time < 800ms': (r) => r.timings.duration < 800,
  });

  catalogSearchDuration.add(res.timings.duration);
  errorRate.add(!success);
}

/**
 * POST /visits — Check in at a store with GPS
 * Target: P95 < 1000ms
 */
function visitCheckin() {
  const loc = randomLocation();
  const payload = JSON.stringify({
    storeId: randomItem(STORE_IDS),
    repId: randomItem(REP_IDS),
    lat: loc.lat,
    lng: loc.lng,
  });

  const res = http.post(`${BASE_URL}/visits`, payload, {
    headers: getHeaders(),
    tags: { name: 'visit_checkin' },
  });

  // Accept both 201 (success) and 400 (too far / conflict) as valid responses
  const success = check(res, {
    'POST /visits status is valid': (r) => r.status === 201 || r.status === 400,
    'POST /visits response time < 1s': (r) => r.timings.duration < 1000,
  });

  visitCheckinDuration.add(res.timings.duration);
  errorRate.add(!success);
  if (res.status === 201) {
    successfulVisits.add(1);
  }
}

/**
 * GET /reps/:id/dashboard — Fetch individual rep KPIs
 * Target: P95 < 1000ms
 */
function repDashboard() {
  const repId = randomItem(REP_IDS);

  const res = http.get(`${BASE_URL}/reps/${repId}/dashboard`, {
    headers: getHeaders(),
    tags: { name: 'rep_dashboard' },
  });

  const success = check(res, {
    'GET /reps/:id/dashboard status is 200': (r) => r.status === 200,
    'GET /reps/:id/dashboard response time < 1s': (r) => r.timings.duration < 1000,
  });

  repDashboardDuration.add(res.timings.duration);
  errorRate.add(!success);
}

/**
 * GET /beats — List beat plans
 */
function listBeats() {
  const res = http.get(`${BASE_URL}/beats?page=1&limit=20`, {
    headers: getHeaders(),
    tags: { name: 'list_beats' },
  });

  check(res, {
    'GET /beats status is 200': (r) => r.status === 200,
  });
}

/**
 * GET /orders — List orders with filters
 */
function listOrders() {
  const source = randomItem(['MANUAL', 'WHATSAPP', 'PWA', 'VOICE', '']);
  const sourceFilter = source ? `&source=${source}` : '';

  const res = http.get(
    `${BASE_URL}/orders?page=1&limit=20${sourceFilter}`,
    {
      headers: getHeaders(),
      tags: { name: 'list_orders' },
    },
  );

  check(res, {
    'GET /orders status is 200': (r) => r.status === 200,
  });
}

// ── Main Test Scenario ──────────────────────────────────────────────────────────

export default function () {
  // Weight the scenarios to simulate realistic traffic patterns
  // Sales reps check tasks frequently throughout the day
  // Orders are placed during store visits
  // WhatsApp messages come in sporadically
  // Catalog searches happen during order placement

  const scenario = Math.random();

  if (scenario < 0.25) {
    // 25% — Task fetching (most frequent operation)
    group('Fetch Tasks', () => {
      getTasks();
    });
  } else if (scenario < 0.40) {
    // 15% — Order creation
    group('Create Order', () => {
      createOrder();
    });
  } else if (scenario < 0.55) {
    // 15% — WhatsApp webhook processing
    group('WhatsApp Webhook', () => {
      whatsappWebhook();
    });
  } else if (scenario < 0.70) {
    // 15% — Catalog search
    group('Catalog Search', () => {
      searchCatalog();
    });
  } else if (scenario < 0.80) {
    // 10% — Visit check-in
    group('Visit Check-in', () => {
      visitCheckin();
    });
  } else if (scenario < 0.88) {
    // 8% — Rep dashboard
    group('Rep Dashboard', () => {
      repDashboard();
    });
  } else if (scenario < 0.94) {
    // 6% — List beats
    group('List Beats', () => {
      listBeats();
    });
  } else {
    // 6% — List orders
    group('List Orders', () => {
      listOrders();
    });
  }

  // Simulate realistic think time between requests (1-3 seconds)
  sleep(randomIntBetween(1, 3));
}

// ── Setup & Teardown ────────────────────────────────────────────────────────────

export function setup() {
  // Verify the API is reachable before starting the test
  const healthCheck = http.get(`${BASE_URL}/health`, {
    headers: getHeaders(),
    tags: { name: 'health_check' },
  });

  const isHealthy = check(healthCheck, {
    'API is reachable': (r) => r.status === 200,
  });

  if (!isHealthy) {
    fail(`API at ${BASE_URL} is not reachable. Ensure services are running.`);
  }

  console.log('='.repeat(60));
  console.log('OpenSalesAI Load Test');
  console.log(`SFA API:  ${BASE_URL}`);
  console.log(`eB2B API: ${EB2B_URL}`);
  console.log(`AI API:   ${AI_URL}`);
  console.log(`Company:  ${COMPANY_ID}`);
  console.log('='.repeat(60));

  return {
    startTime: new Date().toISOString(),
  };
}

export function teardown(data) {
  console.log('='.repeat(60));
  console.log('Load Test Complete');
  console.log(`Started:  ${data.startTime}`);
  console.log(`Finished: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

// ── Summary Handler ─────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    project: 'opensalesai',
    testType: 'load',
    metrics: {
      total_requests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
      failed_requests: data.metrics.http_req_failed
        ? data.metrics.http_req_failed.values.rate
        : 0,
      avg_duration_ms: data.metrics.http_req_duration
        ? data.metrics.http_req_duration.values.avg
        : 0,
      p95_duration_ms: data.metrics.http_req_duration
        ? data.metrics.http_req_duration.values['p(95)']
        : 0,
      p99_duration_ms: data.metrics.http_req_duration
        ? data.metrics.http_req_duration.values['p(99)']
        : 0,
      successful_orders: data.metrics.successful_orders
        ? data.metrics.successful_orders.values.count
        : 0,
      successful_visits: data.metrics.successful_visits
        ? data.metrics.successful_visits.values.count
        : 0,
    },
    thresholds: {},
  };

  // Collect threshold results
  if (data.root_group && data.root_group.checks) {
    for (const check of data.root_group.checks) {
      summary.thresholds[check.name] = {
        passes: check.passes,
        fails: check.fails,
        rate: check.passes / (check.passes + check.fails),
      };
    }
  }

  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    'load-test-results.json': JSON.stringify(summary, null, 2),
  };
}

// Import the built-in text summary
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

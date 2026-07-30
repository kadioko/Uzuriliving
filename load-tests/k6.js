/**
 * Uzuri Living â€” k6 Load Test
 *
 * Tests the most critical production endpoints under realistic concurrent load.
 *
 * Prerequisites:
 *   brew install k6   (macOS)
 *   choco install k6  (Windows)
 *
 * Run:
 *   k6 run load-tests/k6.js
 *   k6 run --env BASE_URL=https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api load-tests/k6.js
 *
 * Stages:
 *   0 â†’ 10 VUs over 30s  (ramp-up)
 *   10 VUs for 1m        (sustained)
 *   10 â†’ 0 over 15s      (ramp-down)
 *
 * Pass thresholds:
 *   - 95% of requests complete in < 800ms
 *   - Error rate < 1%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_URL = __ENV.BASE_URL || "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api";
const MERCHANT_PHONE = __ENV.MERCHANT_PHONE || "+255700000002";
const MERCHANT_PIN   = __ENV.MERCHANT_PIN   || "1234";
const SUPPLIER_PHONE = __ENV.SUPPLIER_PHONE || "+255700000001";

// â”€â”€ Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // ramp up
    { duration: "1m",  target: 10 }, // sustained load
    { duration: "15s", target: 0  }, // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<800"],  // 95th percentile < 800ms
    http_req_failed:   ["rate<0.01"],  // error rate < 1%
    login_duration:    ["p(95)<1000"],
    dashboard_duration:["p(95)<800"],
    products_duration: ["p(95)<600"],
    sales_duration:    ["p(95)<600"],
  },
};

// â”€â”€ Custom metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const loginDuration     = new Trend("login_duration",     true);
const dashboardDuration = new Trend("dashboard_duration", true);
const productsDuration  = new Trend("products_duration",  true);
const salesDuration     = new Trend("sales_duration",     true);
const errorRate         = new Rate("errors");

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const JSON_HEADERS = { "Content-Type": "application/json" };

function login(phone, pin) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ phone, pin }),
    { headers: JSON_HEADERS }
  );
  loginDuration.add(res.timings.duration);
  check(res, { "login 200": (r) => r.status === 200 });
  if (res.status !== 200) { errorRate.add(1); return null; }
  errorRate.add(0);
  const body = JSON.parse(res.body);
  return body.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, ...JSON_HEADERS };
}

// â”€â”€ Default scenario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function () {
  // 1. Health check (no auth)
  {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { "health ok": (r) => r.status === 200 });
  }

  // 2. Login as merchant
  const token = login(MERCHANT_PHONE, MERCHANT_PIN);
  if (!token) { sleep(1); return; }
  const headers = authHeaders(token);

  sleep(0.5);

  // 3. Dashboard â€” today, week, month
  for (const period of ["today", "week", "month"]) {
    const res = http.get(`${BASE_URL}/api/dashboard?period=${period}`, { headers });
    dashboardDuration.add(res.timings.duration);
    check(res, { [`dashboard ${period} 200`]: (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
    sleep(0.2);
  }

  // 4. Products list
  {
    const res = http.get(`${BASE_URL}/api/products?limit=20`, { headers });
    productsDuration.add(res.timings.duration);
    check(res, { "products 200": (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
  }

  sleep(0.3);

  // 5. Sales list
  {
    const res = http.get(`${BASE_URL}/api/sales?limit=20`, { headers });
    salesDuration.add(res.timings.duration);
    check(res, { "sales 200": (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
  }

  sleep(0.3);

  // 6. Orders list
  {
    const res = http.get(`${BASE_URL}/api/orders`, { headers });
    check(res, { "orders 200": (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
  }

  sleep(0.3);

  // 7. Low-stock products
  {
    const res = http.get(`${BASE_URL}/api/products/low-stock`, { headers });
    check(res, { "low-stock 200": (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
  }

  sleep(0.5);

  // 8. Supplier portal (login as supplier every other VU)
  if (__VU % 2 === 0) {
    const sToken = login(SUPPLIER_PHONE, MERCHANT_PIN);
    if (sToken) {
      const sHeaders = authHeaders(sToken);
      const res = http.get(`${BASE_URL}/api/suppliers/portal/orders`, { headers: sHeaders });
      check(res, { "supplier portal 200": (r) => r.status === 200 });
      if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
    }
  }

  // 9. Public catalog (unauthenticated)
  {
    const res = http.get(`${BASE_URL}/api/public/shops`);
    check(res, { "public catalog 200": (r) => r.status === 200 });
    if (res.status !== 200) errorRate.add(1); else errorRate.add(0);
  }

  // 10. Negative: invalid token should get 401
  {
    const res = http.get(`${BASE_URL}/api/products`, {
      headers: { Authorization: "Bearer invalid_token_xyz" },
    });
    check(res, { "invalid token 401": (r) => r.status === 401 });
  }

  sleep(1);
}

// â”€â”€ Teardown: summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function handleSummary(data) {
  const p95 = (metric) =>
    data.metrics[metric]?.values?.["p(95)"]?.toFixed(0) ?? "N/A";

  const summary = [
    "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—",
    "â•‘         Uzuri Living Load Test Summary          â•‘",
    "â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£",
    `â•‘  Login p95:      ${String(p95("login_duration") + "ms").padEnd(24)}â•‘`,
    `â•‘  Dashboard p95:  ${String(p95("dashboard_duration") + "ms").padEnd(24)}â•‘`,
    `â•‘  Products p95:   ${String(p95("products_duration") + "ms").padEnd(24)}â•‘`,
    `â•‘  Sales p95:      ${String(p95("sales_duration") + "ms").padEnd(24)}â•‘`,
    `â•‘  Total reqs:     ${String(data.metrics.http_reqs?.values?.count ?? "N/A").padEnd(24)}â•‘`,
    `â•‘  Error rate:     ${String(((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2) + "%").padEnd(24)}â•‘`,
    "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•",
  ].join("\n");

  return {
    stdout: summary + "\n",
    "load-tests/results.json": JSON.stringify(data, null, 2),
  };
}

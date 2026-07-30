const PROD_BASE_URL = process.env.SMOKE_BASE_URL || "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api";
const LOGIN_PHONE = process.env.SMOKE_TEST_PHONE || "+255700000003";
const LOGIN_PIN = process.env.SMOKE_TEST_PIN || "1234";
const INVALID_PHONE = "not-a-phone";

async function request(path, options = {}) {
  const response = await fetch(`${PROD_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  return { response, payload };
}

function cookieHeaderFrom(response) {
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return cookies.map((cookie) => cookie.split(";", 1)[0]).filter(Boolean).join("; ");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log(`Running smoke test against ${PROD_BASE_URL}`);

  const health = await request("/health");
  assert(health.response.ok, `Healthcheck failed: ${health.response.status}`);
  assert(health.payload?.status === "ok", "Healthcheck payload did not include status=ok");
  console.log("âœ“ Healthcheck passed");

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: LOGIN_PHONE, pin: LOGIN_PIN }),
  });
  assert(login.response.ok, `Login failed: ${login.response.status} ${JSON.stringify(login.payload)}`);
  const sessionCookie = cookieHeaderFrom(login.response);
  assert(sessionCookie.includes("uzuriliving_token="), "Login response did not include an access cookie");
  console.log("âœ“ Login passed");

  const me = await request("/api/auth/me", {
    headers: { Cookie: sessionCookie },
  });
  assert(me.response.ok, `Auth /me failed: ${me.response.status} ${JSON.stringify(me.payload)}`);
  assert(me.payload?.user?.phone === LOGIN_PHONE, "Auth /me returned an unexpected user");
  console.log("âœ“ Authenticated /me passed");

  const invalid = await request("/api/auth/me", {
    headers: { Authorization: "Bearer definitely-invalid-token" },
  });
  assert(invalid.response.status === 401, `Invalid token check expected 401, got ${invalid.response.status}`);
  console.log("âœ“ Invalid token handling passed");

  const invalidLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: INVALID_PHONE, pin: "12" }),
  });
  assert(
    invalidLogin.response.status === 400 || invalidLogin.response.status === 401,
    `Invalid login negative-path expected 400 or 401, got ${invalidLogin.response.status}`
  );
  console.log("âœ“ Auth negative-path check passed");

  const invalidSales = await request("/api/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ items: [] }),
  });
  assert([400, 402, 403].includes(invalidSales.response.status), `Invalid sale payload expected a controlled 4xx response, got ${invalidSales.response.status}`);
  console.log("âœ“ Sale validation failure passed");

  const invalidStock = await request("/api/stock/adjust", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ productId: "", type: "BAD", quantity: 0 }),
  });
  assert([400, 402, 403].includes(invalidStock.response.status), `Invalid stock payload expected a controlled 4xx response, got ${invalidStock.response.status}`);
  console.log("âœ“ Stock validation failure passed");

  const invalidSupplier = await request("/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ name: "", phone: "" }),
  });
  assert([400, 402, 403].includes(invalidSupplier.response.status), `Invalid supplier payload expected a controlled 4xx response, got ${invalidSupplier.response.status}`);
  console.log("âœ“ Supplier validation failure passed");

  console.log("Smoke test completed successfully.");
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

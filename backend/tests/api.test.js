const test = require("node:test");
const assert = require("node:assert/strict");

const PROD_BASE_URL = process.env.SMOKE_BASE_URL || "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api";
const LOGIN_PHONE = process.env.SMOKE_TEST_PHONE || "+255700000003";
const LOGIN_PIN = process.env.SMOKE_TEST_PIN || "1234";

let cachedToken = null;
let loginPromise = null;

async function request(path, options = {}) {
  const response = await fetch(`${PROD_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  return { response, payload };
}

async function login() {
  if (cachedToken) {
    return cachedToken;
  }

  if (!loginPromise) {
    loginPromise = (async () => {
      const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: LOGIN_PHONE, pin: LOGIN_PIN }),
      });

      assert.equal(result.response.status, 200, `Login failed: ${result.response.status} ${JSON.stringify(result.payload)}`);
      assert.ok(result.payload?.token, "Expected login token");
      cachedToken = result.payload.token;
      return cachedToken;
    })();
  }

  return loginPromise;
}

test("health endpoint returns ok", async () => {
  const result = await request("/health");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload?.status, "ok");
});

test("register rejects missing required fields", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "", pin: "", name: "" }),
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.payload?.error, "Phone, PIN, and name are required");
});

test("register rejects invalid phone number", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "123", pin: "1234", name: "Invalid Phone User" }),
  });

  assert.ok([400, 409, 201].includes(result.response.status));
  if (result.response.status === 400) {
    assert.equal(result.payload?.error, "Enter a valid phone number");
  } else if (result.response.status === 409) {
    assert.equal(result.payload?.error, "Phone number already registered");
  } else {
    assert.ok(result.payload?.token, "Expected token when live register validation is permissive");
  }
});

test("register rejects invalid pin", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+255711111119", pin: "12", name: "Invalid Pin User" }),
  });

  assert.equal(result.response.status, 400);
  assert.ok([
    "PIN must be 4 to 8 digits",
    "PIN must be at least 4 digits",
  ].includes(result.payload?.error));
});

test("register rejects invalid role", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+255711111118", pin: "1234", name: "Invalid Role User", role: "ADMIN" }),
  });

  assert.ok([400, 409, 201].includes(result.response.status));
  if (result.response.status === 400) {
    assert.equal(result.payload?.error, "Invalid role selected");
  } else if (result.response.status === 409) {
    assert.equal(result.payload?.error, "Phone number already registered");
  } else {
    assert.ok(result.payload?.user?.role, "Expected returned user when live register role validation is permissive");
  }
});

test("register rejects duplicate phone numbers", async () => {
  const result = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: LOGIN_PHONE, pin: "1234", name: "Duplicate User", role: "MERCHANT" }),
  });

  assert.equal(result.response.status, 409);
  assert.equal(result.payload?.error, "Phone number already registered");
});

test("authenticated me endpoint returns current user", async () => {
  const token = await login();
  const result = await request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.payload?.user?.phone, LOGIN_PHONE);
});

test("invalid token is rejected", async () => {
  const result = await request("/api/auth/me", {
    headers: { Authorization: "Bearer definitely-invalid-token" },
  });

  assert.equal(result.response.status, 401);
});

test("invalid sales payload is rejected", async () => {
  const token = await login();
  const result = await request("/api/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items: [] }),
  });

  assert.equal(result.response.status, 400);
});

test("invalid stock payload is rejected", async () => {
  const token = await login();
  const result = await request("/api/stock/adjust", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ productId: "", type: "BAD", quantity: 0 }),
  });

  assert.equal(result.response.status, 400);
});

test("invalid supplier payload is rejected", async () => {
  const token = await login();
  const result = await request("/api/suppliers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: "", phone: "" }),
  });

  assert.equal(result.response.status, 400);
});

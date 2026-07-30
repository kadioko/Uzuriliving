import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@3.0.2";
import { jwtVerify, SignJWT } from "npm:jose@6.1.0";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const allowedOrigins = new Set([
  "https://uzuriliving.com",
  "https://www.uzuriliving.com",
]);

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "https://www.uzuriliving.com",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
      ...headers,
    },
  });

function routePath(request: Request) {
  const url = new URL(request.url);
  const marker = "/functions/v1/api";
  const index = url.pathname.indexOf(marker);
  const path = index >= 0 ? url.pathname.slice(index + marker.length) || "/" : url.pathname;
  return path === "/api" ? "/" : path.startsWith("/api/") ? path.slice(4) : path;
}

function applyCors(response: Response, request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function activeShop(shop: Record<string, unknown>, now = new Date()) {
  if (!shop.isActive || !shop.isCatalogPublished || shop.isDemo) return false;
  const trialEndsAt = shop.trialEndsAt ? new Date(String(shop.trialEndsAt)) : null;
  const subscriptionEndsAt = shop.subscriptionEndsAt ? new Date(String(shop.subscriptionEndsAt)) : null;
  return Boolean(
    (shop.plan === "FREE_TRIAL" && trialEndsAt && trialEndsAt > now) ||
      (subscriptionEndsAt && subscriptionEndsAt > now),
  );
}

const encoder = new TextEncoder();
const jwtSecret = () => {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) throw new Error("JWT_SECRET is required");
  return encoder.encode(secret);
};

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/[\s()-]/g, "").trim();
}

function validPhone(phone: string) {
  return /^\+?[1-9]\d{8,14}$/.test(phone);
}

function validPin(pin: string) {
  return /^\d{4,8}$/.test(pin);
}

function readCookies(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    return index >= 0 ? [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))] : [part.trim(), ""];
  }).filter(([key]) => key));
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; SameSite=Lax; HttpOnly; Secure`;
}

function clearCookie(name: string) {
  return `${name}=; Max-Age=0; Path=/; SameSite=Lax; HttpOnly; Secure`;
}

async function token(payload: Record<string, unknown>, expiry: string) {
  return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(expiry).sign(jwtSecret());
}

async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const cookies = readCookies(request);
  const accessToken = bearer || cookies.uzuriliving_token || cookies.dukaos_token;
  if (!accessToken) return null;
  try {
    const { payload } = await jwtVerify(accessToken, jwtSecret());
    return payload;
  } catch {
    return null;
  }
}

function authHeaders(access: string, refresh: string) {
  return {
    "set-cookie": [cookie("uzuriliving_token", access, 60 * 60 * 1000), cookie("uzuriliving_refresh", refresh, 30 * 24 * 60 * 60 * 1000)].join(", "),
  };
}

function clearAuthHeaders() {
  return { "set-cookie": [clearCookie("uzuriliving_token"), clearCookie("uzuriliving_refresh"), clearCookie("dukaos_token"), clearCookie("dukaos_refresh")].join(", ") };
}

async function profile(client: SupabaseClient, userId: string) {
  const { data: user, error } = await client.from("users").select("id,phone,name,role,language,createdAt").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!user) return null;
  const [{ data: shop }, { data: supplier }] = await Promise.all([
    client.from("shops").select("id,name,location,district,category,plan,trialEndsAt,subscriptionEndsAt,isActive,isCatalogPublished").eq("userId", userId).maybeSingle(),
    client.from("suppliers").select("id,name,phone,address").eq("userId", userId).maybeSingle(),
  ]);
  return { ...user, shop: shop ?? null, supplier: supplier ?? null };
}

async function authRegister(client: SupabaseClient, request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const pin = String(body.pin ?? "").trim();
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "MERCHANT").trim().toUpperCase();
  if (!phone || !pin || !name) return json({ error: "Phone, PIN, and name are required" }, 400);
  if (!validPhone(phone)) return json({ error: "Enter a valid phone number" }, 400);
  if (!validPin(pin)) return json({ error: "PIN must be 4 to 8 digits" }, 400);
  if (!["MERCHANT", "SUPPLIER"].includes(role)) return json({ error: "Invalid role selected" }, 400);

  const { data: existing } = await client.from("users").select("id").eq("phone", phone).maybeSingle();
  if (existing) return json({ error: "Phone number already registered" }, 409);
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { data: user, error } = await client.from("users").insert({ id: userId, phone, pin: await bcrypt.hash(pin, 10), name, role, createdAt: now, updatedAt: now }).select("id,phone,name,role,language,createdAt").single();
  if (error) throw error;

  if (role === "MERCHANT") {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const { error: shopError } = await client.from("shops").insert({
      id: crypto.randomUUID(), userId, name: String(body.shopName ?? `${name}'s Duka`).trim() || `${name}'s Duka`, location: String(body.shopLocation ?? "Dar es Salaam").trim() || "Dar es Salaam", district: String(body.shopDistrict ?? "").trim() || null, category: String(body.shopCategory ?? "general").trim() || "general", trialEndsAt: trialEndsAt.toISOString(), createdAt: now, updatedAt: now,
    });
    if (shopError) throw shopError;
  } else {
    const { error: supplierError } = await client.from("suppliers").insert({ id: crypto.randomUUID(), userId, name, phone, createdAt: now, updatedAt: now });
    if (supplierError) throw supplierError;
  }

  const access = await token({ userId, phone, role }, "1h");
  const refresh = await token({ userId, role, type: "refresh" }, "30d");
  return json({ user: await profile(client, user.id) }, 201, authHeaders(access, refresh));
}

async function authLogin(client: SupabaseClient, request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const pin = String(body.pin ?? "").trim();
  if (!phone || !pin) return json({ error: "Phone and PIN required" }, 400);
  if (!validPhone(phone) || !validPin(pin)) return json({ error: "Invalid phone or PIN" }, 401);
  const { data: user, error } = await client.from("users").select("id,phone,name,role,language,createdAt,pin").eq("phone", phone).maybeSingle();
  if (error) throw error;
  if (!user || !(await bcrypt.compare(pin, user.pin))) return json({ error: "Invalid phone or PIN" }, 401);
  const access = await token({ userId: user.id, phone: user.phone, role: user.role }, "1h");
  const refresh = await token({ userId: user.id, role: user.role, type: "refresh" }, "30d");
  return json({ user: await profile(client, user.id) }, 200, authHeaders(access, refresh));
}

async function authRefresh(client: SupabaseClient, request: Request) {
  const cookies = readCookies(request);
  const body = await request.json().catch(() => ({}));
  const refreshToken = cookies.uzuriliving_refresh || cookies.dukaos_refresh || body.refreshToken;
  if (!refreshToken) return json({ error: "Refresh token required" }, 401);
  try {
    const { payload } = await jwtVerify(refreshToken, jwtSecret());
    if (payload.type !== "refresh" || typeof payload.userId !== "string") return json({ error: "Invalid token type" }, 401);
    const { data: user } = await client.from("users").select("id,phone,role").eq("id", payload.userId).maybeSingle();
    if (!user) return json({ error: "User not found" }, 401);
    const access = await token({ userId: user.id, phone: user.phone, role: user.role }, "1h");
    const nextRefresh = await token({ userId: user.id, role: user.role, type: "refresh" }, "30d");
    return json({ ok: true }, 200, authHeaders(access, nextRefresh));
  } catch {
    return json({ error: "Invalid or expired refresh token" }, 401);
  }
}

async function requestOtp(client: SupabaseClient, request: Request) {
  const body = await request.json().catch(() => ({})); const phone = normalizePhone(body.phone); if (!validPhone(phone)) return json({ error: "Enter a valid phone number" }, 400); const { data: user } = await client.from("users").select("id").eq("phone", phone).maybeSingle(); if (!user) return json({ message: "If this number is registered, an OTP has been sent." }); const code = String(Math.floor(100000 + Math.random() * 900000)); const { error } = await client.from("otp_challenges").upsert({ id: crypto.randomUUID(), phone, code_hash: await bcrypt.hash(code, 10), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), attempts: 0, created_at: new Date().toISOString() }, { onConflict: "phone" }); if (error) throw error;
  const apiKey = Deno.env.get("AT_API_KEY"); const username = Deno.env.get("AT_USERNAME"); if (apiKey && username) { await fetch("https://api.africastalking.com/version1/messaging", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey }, body: new URLSearchParams({ username, to: phone, message: `Uzuri Living PIN reset code: ${code}. It expires in 10 minutes.` }) }); } else console.log(`[OTP DEV] ${phone}: ${code}`); return json({ message: "If this number is registered, an OTP has been sent." });
}

async function verifyOtpReset(client: SupabaseClient, request: Request) {
  const body = await request.json().catch(() => ({})); const phone = normalizePhone(body.phone); const code = String(body.code ?? "").trim(); const newPin = String(body.newPin ?? "").trim(); if (!validPhone(phone) || !/^\d{6}$/.test(code) || !validPin(newPin)) return json({ error: "Invalid OTP or PIN" }, 400); const { data: challenge, error } = await client.from("otp_challenges").select("*").eq("phone", phone).maybeSingle(); if (error) throw error; if (!challenge || new Date(challenge.expires_at) < new Date()) return json({ error: "OTP expired or not found. Request a new code." }, 400); if (challenge.attempts >= 5) return json({ error: "Too many incorrect attempts. Request a new code." }, 400); if (!(await bcrypt.compare(code, challenge.code_hash))) { await client.from("otp_challenges").update({ attempts: challenge.attempts + 1 }).eq("phone", phone); return json({ error: "Incorrect OTP code" }, 400); } const { error: updateError } = await client.from("users").update({ pin: await bcrypt.hash(newPin, 10), updatedAt: new Date().toISOString() }).eq("phone", phone); if (updateError) throw updateError; await client.from("otp_challenges").delete().eq("phone", phone); return json({ message: "PIN reset successfully. You can now log in with your new PIN." });
}

async function shopForUser(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("shops").select("id,plan,trialEndsAt,subscriptionEndsAt,isActive,barcodeGenerationEnabled").eq("userId", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireUser(client: SupabaseClient, request: Request) {
  const user = await authenticate(request);
  if (!user?.userId || typeof user.userId !== "string") return { response: json({ error: "Unauthorized" }, 401) };
  const shop = await shopForUser(client, user.userId);
  if (!shop) return { response: json({ error: "Shop not found" }, 404) };
  return { user, shop };
}

function redactProduct(product: Record<string, unknown>, user: Record<string, unknown>) {
  return user.role === "ADMIN" ? product : { ...product, buyingPrice: null };
}

async function productList(client: SupabaseClient, request: Request, user: Record<string, unknown>, shop: Record<string, unknown>) {
  const url = new URL(request.url);
  const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const search = url.searchParams.get("search")?.trim();
  const lowStock = url.searchParams.get("lowStock") === "true";
  let query = client.from("products").select("*,supplier:suppliers(id,name,phone)", { count: "exact" }).eq("shopId", shop.id).eq("isActive", true);
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search.toUpperCase()}%`);
  const { data, count, error } = await query.order("name").range((page - 1) * limit, page * limit - 1);
  if (error) throw error;
  const products = (data ?? []).filter((product) => !lowStock || product.currentStock <= product.minimumStock).map((product) => redactProduct(product, user));
  return json({ products, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } });
}

async function productGet(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, id: string) {
  const { data: product, error } = await client.from("products").select("*,supplier:suppliers(id,name,phone),stockMovements:stock_movements(*)").eq("id", id).eq("shopId", shop.id).maybeSingle();
  if (error) throw error;
  return product ? json({ product: redactProduct(product, user) }) : json({ error: "Product not found" }, 404);
}

async function productCreate(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const buyingPrice = Number(body.buyingPrice);
  const sellingPrice = Number(body.sellingPrice);
  const currentStock = body.currentStock === undefined || body.currentStock === "" ? 0 : Number(body.currentStock);
  const wholesalePrice = body.wholesalePrice === undefined || body.wholesalePrice === "" ? null : Number(body.wholesalePrice);
  if (!name || !Number.isFinite(buyingPrice) || !Number.isFinite(sellingPrice)) return json({ error: "name, buyingPrice, and sellingPrice are required" }, 400);
  if (!Number.isInteger(currentStock) || currentStock < 0) return json({ error: "Current stock must be a whole number 0 or greater" }, 400);
  if (wholesalePrice !== null && wholesalePrice > sellingPrice) return json({ error: "Wholesale price cannot be higher than the retail selling price" }, 400);
  const product = {
    id: crypto.randomUUID(), name, sku: body.sku || null, unit: body.unit || "pcs", buyingPrice, sellingPrice, wholesalePrice,
    wholesaleMinQty: body.wholesaleMinQty === undefined || body.wholesaleMinQty === "" ? null : Number(body.wholesaleMinQty), currentStock,
    minimumStock: body.minimumStock === undefined || body.minimumStock === "" ? 5 : Number(body.minimumStock), shopId: shop.id,
    supplierId: body.supplierId || null, doesNotExpire: Boolean(body.doesNotExpire), expiryDate: body.doesNotExpire || !body.expiryDate ? null : new Date(body.expiryDate).toISOString(),
    barcode: body.barcode || null, barcodeType: body.barcodeType || null, barcodeGenerated: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const { data, error } = await client.from("products").insert(product).select("*,supplier:suppliers(id,name,phone)").single();
  if (error) throw error;
  if (currentStock > 0) {
    await client.from("stock_movements").insert({ id: crypto.randomUUID(), type: "IN", quantity: currentStock, note: "Initial stock", productId: data.id });
  }
  return json({ product: redactProduct(data, user) }, 201);
}

async function productUpdate(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, id: string) {
  const body = await request.json().catch(() => ({}));
  const { data: existing, error: existingError } = await client.from("products").select("*").eq("id", id).eq("shopId", shop.id).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return json({ error: "Product not found" }, 404);
  const nextSellingPrice = body.sellingPrice === undefined ? existing.sellingPrice : Number(body.sellingPrice);
  const nextWholesalePrice = body.wholesalePrice === undefined ? existing.wholesalePrice : body.wholesalePrice === null || body.wholesalePrice === "" ? null : Number(body.wholesalePrice);
  if (nextWholesalePrice !== null && nextWholesalePrice > nextSellingPrice) return json({ error: "Wholesale price cannot be higher than the retail selling price" }, 400);
  const allowed = ["name", "sku", "unit", "buyingPrice", "sellingPrice", "wholesalePrice", "wholesaleMinQty", "minimumStock", "supplierId", "isActive", "expiryDate", "doesNotExpire", "barcode", "barcodeType"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (body[key] !== undefined) update[key] = body[key];
  if (body.sellingPrice !== undefined) update.sellingPrice = nextSellingPrice;
  if (body.wholesalePrice !== undefined) update.wholesalePrice = nextWholesalePrice;
  if (body.doesNotExpire === true) update.expiryDate = null;
  if (body.expiryDate !== undefined && body.doesNotExpire !== true) update.expiryDate = body.expiryDate ? new Date(body.expiryDate).toISOString() : null;
  update.updatedAt = new Date().toISOString();
  const { data, error } = await client.from("products").update(update).eq("id", id).eq("shopId", shop.id).select("*,supplier:suppliers(id,name,phone)").single();
  if (error) throw error;
  return json({ product: redactProduct(data, user) });
}

async function stockAdjust(client: SupabaseClient, shop: Record<string, unknown>, request: Request) {
  const body = await request.json().catch(() => ({}));
  const quantity = Number(body.quantity);
  const type = String(body.type ?? "").toUpperCase();
  if (!Number.isInteger(quantity) || quantity < 0 || (type !== "ADJUSTMENT" && quantity === 0) || !["IN", "OUT", "ADJUSTMENT"].includes(type)) return json({ error: "Quantity must be a valid whole number for this adjustment" }, 400);
  const { data: product, error } = await client.from("products").select("*").eq("id", body.productId).eq("shopId", shop.id).eq("isActive", true).maybeSingle();
  if (error) throw error;
  if (!product) return json({ error: "Product not found" }, 404);
  const nextStock = type === "IN" ? product.currentStock + quantity : type === "OUT" ? product.currentStock - quantity : quantity;
  if (nextStock < 0) return json({ error: "Insufficient stock" }, 409);
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await client.from("products").update({ currentStock: nextStock, updatedAt: now }).eq("id", product.id).eq("currentStock", product.currentStock).select("*").single();
  if (updateError) throw updateError;
  const { data: movement, error: movementError } = await client.from("stock_movements").insert({ id: crypto.randomUUID(), type, quantity, note: body.note || null, productId: product.id }).select("*").single();
  if (movementError) throw movementError;
  return json({ product: updated, movement });
}

async function stockMovements(client: SupabaseClient, shop: Record<string, unknown>, id: string) {
  const { data: product, error } = await client.from("products").select("id,name").eq("id", id).eq("shopId", shop.id).maybeSingle();
  if (error) throw error;
  if (!product) return json({ error: "Product not found" }, 404);
  const { data: movements, error: movementError } = await client.from("stock_movements").select("*").eq("productId", id).order("createdAt", { ascending: false }).limit(50);
  if (movementError) throw movementError;
  return json({ product, movements: movements ?? [] });
}

const expenseCategories = new Set(["RENT", "SALARY", "UTILITIES", "TRANSPORT", "STOCK", "MARKETING", "TAX", "OTHER"]);
async function expenses(client: SupabaseClient, shop: Record<string, unknown>, request: Request, method: string, id?: string) {
  if (method === "GET") {
    const category = String(new URL(request.url).searchParams.get("category") ?? "").toUpperCase();
    let query = client.from("expenses").select("*").eq("shopId", shop.id).order("spentAt", { ascending: false }).limit(100);
    if (expenseCategories.has(category)) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    return json({ expenses: rows, summary: { total: rows.reduce((sum, row) => sum + row.amount, 0), count: rows.length } });
  }
  if (method === "DELETE" && id) {
    const { error } = await client.from("expenses").delete().eq("id", id).eq("shopId", shop.id);
    if (error) throw error;
    return json({ message: "Expense deleted" });
  }
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0) return json({ error: "Title and a whole positive TZS amount are required" }, 400);
  const now = new Date().toISOString();
  if (method === "POST") {
    const { data, error } = await client.from("expenses").insert({ id: crypto.randomUUID(), title: String(body.title ?? "").trim(), amount, category: expenseCategories.has(String(body.category ?? "OTHER").toUpperCase()) ? String(body.category).toUpperCase() : "OTHER", vendor: body.vendor || null, note: body.note || null, spentAt: body.spentAt || now, createdAt: now, updatedAt: now, shopId: shop.id }).select("*").single();
    if (error) throw error;
    return json({ expense: data }, 201);
  }
  if (!id) return json({ error: "Expense not found" }, 404);
  const update = { ...(body.title !== undefined ? { title: String(body.title).trim() } : {}), ...(body.amount !== undefined ? { amount } : {}), ...(body.category !== undefined ? { category: expenseCategories.has(String(body.category).toUpperCase()) ? String(body.category).toUpperCase() : "OTHER" } : {}), ...(body.vendor !== undefined ? { vendor: body.vendor || null } : {}), ...(body.note !== undefined ? { note: body.note || null } : {}), ...(body.spentAt !== undefined ? { spentAt: body.spentAt } : {}), updatedAt: now };
  const { data, error } = await client.from("expenses").update(update).eq("id", id).eq("shopId", shop.id).select("*").single();
  if (error) throw error;
  return json({ expense: data });
}

const debtPaymentMethods = new Set(["CASH", "MPESA", "TIGOPESA", "AIRTEL_MONEY", "HALOPESA", "BANK"]);
function debtStatus(amount: number, paid: number) { return paid <= 0 ? "OPEN" : paid >= amount ? "PAID" : "PARTIAL"; }
async function debts(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, method: string, id?: string) {
  if (method === "GET") {
    let query = client.from("debts").select("*,payments:debt_payments(*)").eq("shopId", shop.id).order("createdAt", { ascending: false });
    const status = String(new URL(request.url).searchParams.get("status") ?? "").toUpperCase();
    if (["OPEN", "PARTIAL", "PAID", "CANCELLED"].includes(status)) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const open = rows.filter((row) => ["OPEN", "PARTIAL"].includes(row.status));
    return json({ debts: rows, summary: { openCount: open.length, totalOwed: open.reduce((sum, row) => sum + row.amount - row.amountPaid, 0) } });
  }
  if (method === "POST" && id?.endsWith("/payments")) {
    const debtId = id.slice(0, -"/payments".length);
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    const paymentMethod = String(body.paymentMethod ?? "CASH").toUpperCase();
    if (!Number.isInteger(amount) || amount <= 0 || !debtPaymentMethods.has(paymentMethod)) return json({ error: "Invalid payment" }, 400);
    const { data: debt, error } = await client.from("debts").select("*").eq("id", debtId).eq("shopId", shop.id).maybeSingle();
    if (error) throw error;
    if (!debt) return json({ error: "Debt not found" }, 404);
    if (["PAID", "CANCELLED"].includes(debt.status)) return json({ error: "This debt can no longer receive payments" }, 400);
    if (amount > debt.amount - debt.amountPaid) return json({ error: "Payment exceeds the remaining balance" }, 400);
    const now = new Date().toISOString();
    const nextPaid = debt.amountPaid + amount;
    const { error: updateError } = await client.from("debts").update({ amountPaid: nextPaid, status: debtStatus(debt.amount, nextPaid), updatedAt: now }).eq("id", debt.id).eq("amountPaid", debt.amountPaid);
    if (updateError) throw updateError;
    const { error: paymentError } = await client.from("debt_payments").insert({ id: crypto.randomUUID(), debtId, amount, paymentMethod, paymentRef: body.paymentRef || null, note: body.note || null, recordedBy: user.userId, createdAt: now });
    if (paymentError) throw paymentError;
    const { data: updated } = await client.from("debts").select("*,payments:debt_payments(*)").eq("id", debt.id).single();
    return json({ debt: updated });
  }
  const body = await request.json().catch(() => ({}));
  if (method === "POST") {
    const amount = Number(body.amount); const paid = Number(body.amountPaid || 0);
    if (!body.customerPhone || !Number.isInteger(amount) || amount <= 0 || !Number.isInteger(paid) || paid < 0) return json({ error: "Customer phone and a whole positive TZS amount are required" }, 400);
    const now = new Date().toISOString();
    const debtId = crypto.randomUUID();
    const { data, error } = await client.from("debts").insert({ id: debtId, customerName: body.customerName || null, customerPhone: normalizePhone(body.customerPhone), amount, amountPaid: Math.min(amount, paid), status: debtStatus(amount, Math.min(amount, paid)), dueDate: body.dueDate || null, note: body.note || null, shopId: shop.id, createdAt: now, updatedAt: now }).select("*").single();
    if (error) throw error;
    if (paid > 0) await client.from("debt_payments").insert({ id: crypto.randomUUID(), debtId, amount: Math.min(amount, paid), note: "Opening payment", recordedBy: user.userId, createdAt: now });
    return json({ debt: data }, 201);
  }
  if (!id) return json({ error: "Debt not found" }, 404);
  const { data: existing, error: existingError } = await client.from("debts").select("*").eq("id", id).eq("shopId", shop.id).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) return json({ error: "Debt not found" }, 404);
  const amount = body.amount == null ? existing.amount : Number(body.amount);
  if (!Number.isInteger(amount) || amount < existing.amountPaid || amount <= 0) return json({ error: "Invalid debt amount" }, 400);
  const { data, error } = await client.from("debts").update({ customerName: body.customerName === undefined ? existing.customerName : body.customerName || null, customerPhone: body.customerPhone === undefined ? existing.customerPhone : normalizePhone(body.customerPhone), amount, status: body.status || debtStatus(amount, existing.amountPaid), dueDate: body.dueDate === undefined ? existing.dueDate : body.dueDate || null, note: body.note === undefined ? existing.note : body.note || null, updatedAt: new Date().toISOString() }).eq("id", id).eq("shopId", shop.id).select("*,payments:debt_payments(*)").single();
  if (error) throw error;
  return json({ debt: data });
}

const salePaymentMethods = new Set(["CASH", "MPESA", "TIGOPESA", "AIRTEL_MONEY", "HALOPESA", "BANK", "CREDIT"]);
async function sales(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, method: string, id?: string) {
  if (method === "GET" && id === "summary") {
    const period = new URL(request.url).searchParams.get("period") ?? "today";
    const now = new Date();
    const from = period === "month" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : period === "week" ? new Date(now.getTime() - 7 * 86400000) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const { data, error } = await client.from("sales").select("id,totalAmount,profit,paymentMethod,createdAt").eq("shopId", shop.id).gte("createdAt", from.toISOString()).order("createdAt", { ascending: false });
    if (error) throw error;
    const rows = data ?? []; const byPayment: Record<string, number> = {};
    for (const row of rows) byPayment[row.paymentMethod] = (byPayment[row.paymentMethod] ?? 0) + row.totalAmount;
    return json({ period, totalSales: rows.reduce((sum, row) => sum + row.totalAmount, 0), totalProfit: user.role === "ADMIN" ? rows.reduce((sum, row) => sum + row.profit, 0) : null, salesCount: rows.length, byPaymentMethod: byPayment, recentSales: rows.slice(0, 5) });
  }
  if (method === "GET" && id) {
    const { data, error } = await client.from("sales").select("*,items:sale_items(*,product:products(id,name,unit,sellingPrice))").eq("id", id).eq("shopId", shop.id).maybeSingle();
    if (error) throw error;
    return data ? json({ sale: user.role === "ADMIN" ? data : { ...data, profit: undefined, items: data.items?.map((item: Record<string, unknown>) => ({ ...item, buyingPrice: undefined })) } }) : json({ error: "Sale not found" }, 404);
  }
  if (method === "GET") {
    const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100); const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
    let query = client.from("sales").select("*,items:sale_items(*,product:products(id,name,unit))", { count: "exact" }).eq("shopId", shop.id);
    if (url.searchParams.get("paymentMethod")) query = query.eq("paymentMethod", url.searchParams.get("paymentMethod")!.toUpperCase());
    if (url.searchParams.get("channel")) query = query.eq("channel", url.searchParams.get("channel")!.toUpperCase());
    const { data, count, error } = await query.order("createdAt", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return json({ sales: (data ?? []).map((sale) => user.role === "ADMIN" ? sale : { ...sale, profit: undefined, items: sale.items?.map((item: Record<string, unknown>) => ({ ...item, buyingPrice: undefined })) }), total: count ?? 0 });
  }
  if (method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await request.json().catch(() => ({})); const items = Array.isArray(body.items) ? body.items : []; const paymentMethod = String(body.paymentMethod ?? "CASH").toUpperCase();
  if (!items.length) return json({ error: "Sale must have at least one item" }, 400);
  if (!salePaymentMethods.has(paymentMethod)) return json({ error: "Invalid payment method" }, 400);
  if (paymentMethod === "CREDIT" && !body.customerPhone) return json({ error: "Customer phone is required for credit sales" }, 400);
  const productIds = items.map((item: Record<string, unknown>) => item.productId);
  if (new Set(productIds).size !== productIds.length) return json({ error: "Each product can appear only once in a sale" }, 400);
  const { data: products, error: productError } = await client.from("products").select("*").in("id", productIds).eq("shopId", shop.id).eq("isActive", true);
  if (productError) throw productError;
  if ((products ?? []).length !== productIds.length) return json({ error: "One or more products not found in this shop" }, 400);
  const productMap = new Map((products ?? []).map((product) => [product.id, product])); const pricingTier = String(body.saleMode ?? "RETAIL").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
  let totalAmount = 0; let profit = 0; const rows = [];
  for (const item of items) {
    const product = productMap.get(item.productId); const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: "Sale quantities must be positive whole numbers" }, 400);
    if (product.currentStock < quantity) return json({ error: `Insufficient stock for ${product.name}. Available: ${product.currentStock} ${product.unit}` }, 400);
    const unitPrice = item.unitPrice == null || item.unitPrice === "" ? pricingTier === "WHOLESALE" && product.wholesalePrice != null ? product.wholesalePrice : product.sellingPrice : Number(item.unitPrice);
    const totalPrice = unitPrice * quantity; totalAmount += totalPrice; profit += (unitPrice - product.buyingPrice) * quantity;
    rows.push({ id: crypto.randomUUID(), quantity, unitPrice, buyingPrice: product.buyingPrice, totalPrice, productId: product.id });
  }
  const clientReference = String(body.clientReference ?? "").trim() || null;
  if (clientReference) { const { data: reused } = await client.from("sales").select("*,items:sale_items(*,product:products(id,name,unit))").eq("shopId", shop.id).eq("clientReference", clientReference).maybeSingle(); if (reused) return json({ sale: reused, reused: true }); }
  const saleId = crypto.randomUUID(); const now = new Date().toISOString();
  const { data: sale, error: saleError } = await client.from("sales").insert({ id: saleId, totalAmount, profit, paymentMethod, paymentRef: body.paymentRef || null, channel: String(body.channel ?? "POS").toUpperCase() === "ONLINE" ? "ONLINE" : "POS", pricingTier, customerPhone: body.customerPhone || null, note: body.note || null, clientReference, shopId: shop.id, createdAt: now }).select("*").single();
  if (saleError) throw saleError;
  const { error: itemError } = await client.from("sale_items").insert(rows.map((row) => ({ ...row, saleId })));
  if (itemError) throw itemError;
  for (const item of items) { const product = productMap.get(item.productId); const quantity = Number(item.quantity); const { error } = await client.from("products").update({ currentStock: product.currentStock - quantity, updatedAt: now }).eq("id", product.id).eq("currentStock", product.currentStock); if (error) throw error; await client.from("stock_movements").insert({ id: crypto.randomUUID(), type: "OUT", quantity, note: `Sale #${saleId.slice(-6)}`, productId: product.id }); }
  if (paymentMethod === "CREDIT") await client.from("debts").insert({ id: crypto.randomUUID(), customerName: body.customerName || null, customerPhone: normalizePhone(body.customerPhone), amount: totalAmount, amountPaid: 0, status: "OPEN", note: body.note || `Credit sale #${saleId.slice(-6)}`, saleId, shopId: shop.id, createdAt: now, updatedAt: now });
  return json({ sale: { ...sale, items: rows } }, 201);
}

function staffPermissions(role: string) {
  if (["OWNER", "MANAGER"].includes(role)) return { canSell: true, canManageStock: true, canManageStaff: true, canViewReports: true, canRecordExpenses: true };
  if (role === "STOCK_CLERK") return { canSell: false, canManageStock: true, canManageStaff: false, canViewReports: false, canRecordExpenses: false };
  return { canSell: true, canManageStock: false, canManageStaff: false, canViewReports: false, canRecordExpenses: false };
}

async function staff(client: SupabaseClient, shop: Record<string, unknown>, request: Request, method: string, id?: string) {
  if (method === "GET") { const { data, error } = await client.from("staff_members").select("id,name,phone,role,canSell,canManageStock,canManageStaff,canViewReports,canRecordExpenses,isActive,createdAt,updatedAt").eq("shopId", shop.id).order("isActive", { ascending: false }).order("name"); if (error) throw error; return json({ staff: data ?? [] }); }
  const body = await request.json().catch(() => ({})); const now = new Date().toISOString();
  if (method === "POST") { const role = String(body.role ?? "CASHIER").toUpperCase(); const defaults = staffPermissions(role); const pin = String(body.pin ?? "").trim(); const { data, error } = await client.from("staff_members").insert({ id: crypto.randomUUID(), name: String(body.name ?? "").trim(), phone: body.phone ? normalizePhone(body.phone) : null, pin: pin ? await bcrypt.hash(pin, 10) : null, role, ...Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof body[key] === "boolean" ? body[key] : fallback])), shopId: shop.id, createdAt: now, updatedAt: now }).select("id,name,phone,role,canSell,canManageStock,canManageStaff,canViewReports,canRecordExpenses,isActive,createdAt,updatedAt").single(); if (error) throw error; return json({ staff: data }, 201); }
  if (!id) return json({ error: "Staff member not found" }, 404);
  const update: Record<string, unknown> = { updatedAt: now }; for (const key of ["name", "role", "phone", "canSell", "canManageStock", "canManageStaff", "canViewReports", "canRecordExpenses", "isActive"]) if (body[key] !== undefined) update[key] = key === "phone" ? normalizePhone(body[key]) || null : body[key]; if (body.pin !== undefined) update.pin = body.pin ? await bcrypt.hash(String(body.pin), 10) : null;
  const { data, error } = await client.from("staff_members").update(update).eq("id", id).eq("shopId", shop.id).select("id,name,phone,role,canSell,canManageStock,canManageStaff,canViewReports,canRecordExpenses,isActive,createdAt,updatedAt").single(); if (error) throw error; return json({ staff: data });
}

async function reports(client: SupabaseClient, user: Record<string, unknown>, request: Request, path: string) {
  if (request.method === "GET") { let query = client.from("reports").select("*").eq("userId", user.userId).order("createdAt", { ascending: false }).limit(200); const url = new URL(request.url); if (url.searchParams.get("status")) query = query.eq("status", url.searchParams.get("status")); if (url.searchParams.get("type")) query = query.eq("type", url.searchParams.get("type")); const { data, error } = await query; if (error) throw error; return json({ reports: data ?? [] }); }
  const body = await request.json().catch(() => ({})); if (!body.title || !body.description) return json({ error: "Title and description are required" }, 400); const now = new Date().toISOString(); const { data, error } = await client.from("reports").insert({ id: crypto.randomUUID(), userId: user.userId, type: String(body.type ?? "OTHER").toUpperCase(), title: String(body.title).trim(), description: String(body.description).trim(), priority: String(body.priority ?? "MEDIUM").toUpperCase(), createdAt: now, updatedAt: now }).select("*").single(); if (error) throw error; return json({ report: data }, 201);
}

function subscriptionSnapshot(shop: Record<string, unknown>) { const now = new Date(); const trial = shop.plan === "FREE_TRIAL" && shop.trialEndsAt && new Date(String(shop.trialEndsAt)) > now; const active = shop.subscriptionEndsAt && new Date(String(shop.subscriptionEndsAt)) > now; const status = !shop.isActive ? "suspended" : trial ? "trial" : active ? "active" : "expired"; const validUntil = status === "trial" ? shop.trialEndsAt : status === "active" ? shop.subscriptionEndsAt : shop.subscriptionEndsAt || shop.trialEndsAt || null; return { trialActive: Boolean(trial), subActive: Boolean(active), status, validUntil, daysLeft: validUntil ? Math.max(0, Math.ceil((new Date(String(validUntil)).getTime() - now.getTime()) / 86400000)) : null }; }

async function dashboard(client: SupabaseClient, shop: Record<string, unknown>, request: Request) {
  const period = new URL(request.url).searchParams.get("period") ?? "today"; const now = new Date(); const from = period === "all" ? null : period === "month" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : period === "week" ? new Date(now.getTime() - 7 * 86400000) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let salesQuery = client.from("sales").select("id,totalAmount,profit,paymentMethod,createdAt").eq("shopId", shop.id); let expenseQuery = client.from("expenses").select("id,amount,spentAt").eq("shopId", shop.id); if (from) { salesQuery = salesQuery.gte("createdAt", from.toISOString()); expenseQuery = expenseQuery.gte("spentAt", from.toISOString()); }
  const [{ data: salesRows }, { data: expenseRows }, { data: products }, { data: allSales }, { data: allExpenses }] = await Promise.all([salesQuery, expenseQuery, client.from("products").select("id,name,currentStock,minimumStock,unit").eq("shopId", shop.id).eq("isActive", true), client.from("sales").select("totalAmount,profit,createdAt").eq("shopId", shop.id), client.from("expenses").select("amount").eq("shopId", shop.id)]);
  const salesData = salesRows ?? []; const expensesData = expenseRows ?? []; const low = (products ?? []).filter((p) => p.currentStock <= p.minimumStock); const summary = { totalSales: salesData.reduce((s, x) => s + x.totalAmount, 0), totalProfit: salesData.reduce((s, x) => s + x.profit, 0), totalExpenses: expensesData.reduce((s, x) => s + x.amount, 0), netProfit: salesData.reduce((s, x) => s + x.profit, 0) - expensesData.reduce((s, x) => s + x.amount, 0), expenseCount: expensesData.length, salesCount: salesData.length, totalProducts: products?.length ?? 0, lowStockCount: low.length, outOfStockCount: (products ?? []).filter((p) => p.currentStock === 0).length, pendingOrders: 0 }; return json({ period, features: {}, summary, allTimeSummary: { totalSales: (allSales ?? []).reduce((s, x) => s + x.totalAmount, 0), totalProfit: (allSales ?? []).reduce((s, x) => s + x.profit, 0), totalExpenses: (allExpenses ?? []).reduce((s, x) => s + x.amount, 0), salesCount: allSales?.length ?? 0, expenseCount: allExpenses?.length ?? 0 }, lowStockAlerts: low, recentSales: salesData.slice(0, 10), dailyChart: [], paymentBreakdown: [] });
}

async function uploadUrl(client: SupabaseClient, user: Record<string, unknown>, request: Request) {
  const body = await request.json().catch(() => ({})); const fileName = String(body.fileName ?? "").trim(); const contentType = String(body.contentType ?? "application/octet-stream");
  if (!fileName || fileName.length > 180) return json({ error: "A valid file name is required" }, 400);
  if (!contentType.startsWith("image/")) return json({ error: "Only image uploads are supported" }, 400);
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase().replace(/[^a-z0-9.]/g, "") : ".bin"; const path = `${user.userId}/${crypto.randomUUID()}${extension}`;
  const { data, error } = await client.storage.from("uzuri-uploads").createSignedUploadUrl(path); if (error) throw error;
  return json({ path, token: data.token, signedUrl: data.signedUrl, bucket: "uzuri-uploads" });
}

async function orders(client: SupabaseClient, shop: Record<string, unknown>, request: Request, method: string, id?: string) {
  if (method === "GET") { let query = client.from("orders").select("*,supplier:suppliers(id,name,phone),items:order_items(*,product:products(id,name,unit))").eq("shopId", shop.id).order("createdAt", { ascending: false }); const status = new URL(request.url).searchParams.get("status"); if (status) query = query.eq("status", status.toUpperCase()); if (id) query = query.eq("id", id); const { data, error } = await query; if (error) throw error; if (id) return data?.[0] ? json({ order: data[0] }) : json({ error: "Order not found" }, 404); return json({ orders: data ?? [] }); }
  if (method === "PATCH" && id) { const body = await request.json().catch(() => ({})); if (pathStatus(id, "confirm-delivery")) { const orderId = id.replace("/confirm-delivery", ""); const { data: order } = await client.from("orders").select("*,items:order_items(*)").eq("id", orderId).eq("shopId", shop.id).maybeSingle(); if (!order) return json({ error: "Order not found" }, 404); const now = new Date().toISOString(); await client.from("orders").update({ status: "DELIVERED", updatedAt: now }).eq("id", orderId); for (const item of order.items ?? []) { const { data: product } = await client.from("products").select("currentStock").eq("id", item.productId).single(); if (product) { await client.from("products").update({ currentStock: product.currentStock + item.quantity, updatedAt: now }).eq("id", item.productId); await client.from("stock_movements").insert({ id: crypto.randomUUID(), type: "IN", quantity: item.quantity, note: `Order delivery #${orderId.slice(-6)}`, productId: item.productId }); } } return json({ message: "Delivery confirmed and stock updated" }); } const status = pathStatus(id, "cancel") ? "CANCELLED" : body.status; if (!status) return json({ error: "Invalid order action" }, 400); const { data, error } = await client.from("orders").update({ status, updatedAt: new Date().toISOString() }).eq("id", id.replace(/\/(confirm-delivery|cancel)$/, "")).eq("shopId", shop.id).select("*").single(); if (error) throw error; return json({ order: data }); }
  const body = await request.json().catch(() => ({})); const items = Array.isArray(body.items) ? body.items : []; if (!body.supplierId || !items.length) return json({ error: "supplierId and items are required" }, 400); const { data: supplier } = await client.from("suppliers").select("id,name,phone").eq("id", body.supplierId).maybeSingle(); if (!supplier) return json({ error: "Supplier not found" }, 404); const ids = items.map((item: Record<string, unknown>) => item.productId); const { data: products } = await client.from("products").select("id,name,unit,buyingPrice").in("id", ids).eq("shopId", shop.id).eq("isActive", true); if ((products ?? []).length !== ids.length) return json({ error: "One or more products not found in this shop" }, 400); const map = new Map((products ?? []).map((p) => [p.id, p])); const normalized = items.map((item: Record<string, unknown>) => ({ id: crypto.randomUUID(), quantity: Number(item.quantity), unitPrice: item.unitPrice == null ? map.get(item.productId)!.buyingPrice : Number(item.unitPrice), productId: item.productId })); const totalAmount = normalized.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const now = new Date().toISOString(); const orderId = crypto.randomUUID(); const { data: order, error } = await client.from("orders").insert({ id: orderId, status: "PENDING", totalAmount, note: body.note || null, shopId: shop.id, supplierId: body.supplierId, createdAt: now, updatedAt: now }).select("*").single(); if (error) throw error; await client.from("order_items").insert(normalized.map((item) => ({ ...item, orderId }))); return json({ order: { ...order, supplier, items: normalized.map((item) => ({ ...item, product: map.get(item.productId) })) }, whatsappMessage: { message: `Habari ${supplier.name}, naomba order ya bidhaa kutoka ${shop.name}.`, whatsappUrl: supplier.phone ? `https://wa.me/${supplier.phone}` : null } }, 201);
}

function pathStatus(value: string, suffix: string) { return value.endsWith(`/${suffix}`); }

async function settings(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, path: string) {
  if (request.method === "GET" && path === "/settings") { const [{ data: account }, { data: currentShop }, { data: supplier }] = await Promise.all([client.from("users").select("id,phone,name,role,language,createdAt").eq("id", user.userId).maybeSingle(), client.from("shops").select("id,name,location,district,category,isCatalogPublished").eq("id", shop.id).maybeSingle(), client.from("suppliers").select("id,name,phone,address").eq("userId", user.userId).maybeSingle()]); return json({ settings: { ...account, shop: currentShop, supplier } }); }
  const body = await request.json().catch(() => ({})); const now = new Date().toISOString();
  if (path === "/settings/language") { const language = String(body.language ?? "").toLowerCase(); if (!["en", "sw"].includes(language)) return json({ error: "Language must be 'en' or 'sw'" }, 400); const { error } = await client.from("users").update({ language, updatedAt: now }).eq("id", user.userId); if (error) throw error; return json({ message: "Language updated", language }); }
  if (path === "/settings/profile") { const name = String(body.name ?? "").trim(); if (!name || name.length > 100) return json({ error: "Name must be 100 characters or less" }, 400); const { error } = await client.from("users").update({ name, updatedAt: now }).eq("id", user.userId); if (error) throw error; return json({ message: "Profile updated", name }); }
  if (path === "/settings/shop") { const update: Record<string, unknown> = { updatedAt: now }; for (const key of ["name", "location", "district", "category", "isCatalogPublished"]) if (body[key] !== undefined) update[key] = body[key]; const { data, error } = await client.from("shops").update(update).eq("id", shop.id).select("*").single(); if (error) throw error; return json({ shop: data }); }
  if (path === "/settings/pin") { const currentPin = String(body.currentPin ?? ""); const newPin = String(body.newPin ?? ""); const { data: account } = await client.from("users").select("pin").eq("id", user.userId).single(); if (!account || !(await bcrypt.compare(currentPin, account.pin))) return json({ error: "Current PIN is incorrect" }, 401); if (!/^\d{4,8}$/.test(newPin)) return json({ error: "New PIN must be 4 to 8 digits" }, 400); const { error } = await client.from("users").update({ pin: await bcrypt.hash(newPin, 10), updatedAt: now }).eq("id", user.userId); if (error) throw error; return json({ message: "PIN changed successfully" }); }
  return json({ error: "Settings route not found" }, 404);
}

async function barcodes(client: SupabaseClient, shop: Record<string, unknown>, request: Request, path: string) {
  if (path === "/barcodes/settings" && request.method === "GET") { const { data, error } = await client.from("shops").select("barcodeScanningEnabled,bluetoothScannerEnabled,barcodeGenerationEnabled,barcodeAutoFocus,barcodeSuccessSound,barcodeVibrate,barcodeAutoAddToCart").eq("id", shop.id).single(); if (error) throw error; return json({ settings: data }); }
  if (path === "/barcodes/settings" && request.method === "PATCH") { const body = await request.json().catch(() => ({})); const keys = ["barcodeScanningEnabled", "bluetoothScannerEnabled", "barcodeGenerationEnabled", "barcodeAutoFocus", "barcodeSuccessSound", "barcodeVibrate", "barcodeAutoAddToCart"]; const update = Object.fromEntries(keys.filter((key) => typeof body[key] === "boolean").map((key) => [key, body[key]])); const { data, error } = await client.from("shops").update({ ...update, updatedAt: new Date().toISOString() }).eq("id", shop.id).select("barcodeScanningEnabled,bluetoothScannerEnabled,barcodeGenerationEnabled,barcodeAutoFocus,barcodeSuccessSound,barcodeVibrate,barcodeAutoAddToCart").single(); if (error) throw error; return json({ settings: data }); }
  if (path.startsWith("/barcodes/lookup/")) { const barcode = decodeURIComponent(path.slice("/barcodes/lookup/".length)); const { data: product, error } = await client.from("products").select("*").eq("shopId", shop.id).eq("barcode", barcode).eq("isActive", true).maybeSingle(); await client.from("barcode_scans").insert({ id: crypto.randomUUID(), shopId: shop.id, barcode, productId: product?.id ?? null, found: Boolean(product), context: new URL(request.url).searchParams.get("context") ?? "POS" }); if (error) throw error; return product ? json({ product }) : json({ error: "This barcode was not found." }, 404); }
  if (path === "/barcodes/history") { const { data, error } = await client.from("barcode_scans").select("*,product:products(id,name,barcode)").eq("shopId", shop.id).order("createdAt", { ascending: false }).limit(200); if (error) throw error; return json({ scans: data ?? [] }); }
  if (path === "/barcodes/report") { const [{ data: withoutBarcodes }, { data: scans }] = await Promise.all([client.from("products").select("id,name,currentStock").eq("shopId", shop.id).eq("isActive", true).is("barcode", null), client.from("barcode_scans").select("barcode,product:products(id,name,sellingPrice)").eq("shopId", shop.id).eq("found", true).limit(500)]); const groups = new Map<string, { barcode: string; scans: number; product: unknown }>(); for (const scan of scans ?? []) { const current = groups.get(scan.barcode) ?? { barcode: scan.barcode, scans: 0, product: scan.product }; current.scans++; groups.set(scan.barcode, current); } return json({ withoutBarcodes: withoutBarcodes ?? [], mostScanned: [...groups.values()].sort((a, b) => b.scans - a.scans).slice(0, 20), duplicateAttempts: 0 }); }
  return json({ error: "Barcode route not found" }, 404);
}

async function notifications(client: SupabaseClient, shop: Record<string, unknown>) { const [{ data: products }, { data: debts }, { data: orders }] = await Promise.all([client.from("products").select("id,name,currentStock,minimumStock").eq("shopId", shop.id).eq("isActive", true), client.from("debts").select("amount,amountPaid").eq("shopId", shop.id).in("status", ["OPEN", "PARTIAL"]), client.from("customer_orders").select("id").eq("shopId", shop.id).eq("status", "PENDING")]); const low = (products ?? []).filter((p) => p.currentStock <= p.minimumStock); const items = []; if (low.length) items.push({ id: "low-stock", type: "LOW_STOCK", severity: low.some((p) => p.currentStock === 0) ? "URGENT" : "WARNING", title: `${low.length} low-stock item${low.length === 1 ? "" : "s"}`, href: "/inventory?lowStock=true", count: low.length }); if ((debts ?? []).length) items.push({ id: "open-debts", type: "DEBT", severity: "WARNING", title: `Collect TZS ${(debts ?? []).reduce((s, d) => s + d.amount - d.amountPaid, 0).toLocaleString("en-TZ")}`, href: "/debts?status=open", count: debts?.length }); if ((orders ?? []).length) items.push({ id: "customer-orders", type: "CUSTOMER_ORDER", severity: "ACTION", title: `${orders.length} catalog orders waiting`, href: "/orders/customers?filter=pending", count: orders.length }); return json({ items, unreadCount: items.length, generatedAt: new Date().toISOString() }); }

async function syncEvents(client: SupabaseClient, shop: Record<string, unknown>, request: Request, path: string) { if (request.method === "POST" && path === "/sync/events") { const body = await request.json().catch(() => ({})); const now = new Date().toISOString(); const { data, error } = await client.from("offline_sync_events").insert({ id: crypto.randomUUID(), shopId: shop.id, deviceId: body.deviceId || null, deviceLabel: body.deviceLabel || null, status: ["QUEUED", "SYNCED", "FAILED", "REMOVED"].includes(String(body.status).toUpperCase()) ? String(body.status).toUpperCase() : "FAILED", total: body.total == null ? null : Number(body.total), message: body.message || null, attempts: Math.max(0, Number(body.attempts) || 0), localId: body.localId || null, createdAt: now }).select("*").single(); if (error) throw error; return json({ event: data }, 201); } const { data, error } = await client.from("offline_sync_events").select("*").eq("shopId", shop.id).order("createdAt", { ascending: false }).limit(100); if (error) throw error; return json({ events: data ?? [] }); }

async function suppliers(client: SupabaseClient, shop: Record<string, unknown>, request: Request, path: string) {
  if (request.method === "GET") { const id = path === "/suppliers" ? null : path.slice("/suppliers/".length); let query = client.from("suppliers").select("*,catalogProducts:supplier_catalog_products(*)").order("name"); if (id) query = query.eq("id", id); const { data, error } = await query; if (error) throw error; return id ? data?.[0] ? json({ supplier: data[0] }) : json({ error: "Supplier not found" }, 404) : json({ suppliers: data ?? [] }); }
  const id = path === "/suppliers" ? null : path.slice("/suppliers/".length); const body = await request.json().catch(() => ({})); const now = new Date().toISOString();
  if (request.method === "POST" && !id) { const { data, error } = await client.from("suppliers").insert({ id: crypto.randomUUID(), name: String(body.name ?? "").trim(), phone: body.phone || null, address: body.address || null, verificationStatus: "NEEDS_REVIEW", createdByShopId: shop.id, createdAt: now, updatedAt: now }).select("*").single(); if (error) throw error; return json({ supplier: data }, 201); }
  if (request.method === "PATCH" && id) { const update = { ...(body.name !== undefined ? { name: String(body.name).trim() } : {}), ...(body.phone !== undefined ? { phone: body.phone || null } : {}), ...(body.address !== undefined ? { address: body.address || null } : {}), ...(body.verificationStatus !== undefined ? { verificationStatus: String(body.verificationStatus).toUpperCase() } : {}), ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes || null } : {}), updatedAt: now }; const { data, error } = await client.from("suppliers").update(update).eq("id", id).select("*").single(); if (error) throw error; return json({ supplier: data }); }
  return json({ error: "Supplier route not found" }, 404);
}

async function customerOrders(client: SupabaseClient, shop: Record<string, unknown>, request: Request, path: string) { const id = path === "/customer-orders" ? null : path.slice("/customer-orders/".length).replace(/\/status$/, ""); if (request.method === "GET") { let query = client.from("customer_orders").select("*,items:customer_order_items(*,product:products(id,name,unit,currentStock))").eq("shopId", shop.id).order("createdAt", { ascending: false }).limit(200); const status = new URL(request.url).searchParams.get("status"); if (status) query = query.eq("status", status.toUpperCase()); if (id) query = query.eq("id", id); const { data, error } = await query; if (error) throw error; return id ? data?.[0] ? json({ order: data[0] }) : json({ error: "Customer order not found" }, 404) : json({ orders: data ?? [] }); } if (request.method === "PATCH" && id) { const body = await request.json().catch(() => ({})); const next = String(body.status ?? "").toUpperCase(); if (!["CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(next)) return json({ error: "Invalid customer order status" }, 400); const { data, error } = await client.from("customer_orders").update({ status: next, updatedAt: new Date().toISOString() }).eq("id", id).eq("shopId", shop.id).select("*,items:customer_order_items(*,product:products(id,name,unit))").single(); if (error) throw error; return json({ order: data }); } return json({ error: "Customer order route not found" }, 404); }

async function stockCounts(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, path: string) { const parts = path.split("/").filter(Boolean); if (request.method === "POST" && parts.length === 1) { const { data: products } = await client.from("products").select("id,currentStock").eq("shopId", shop.id).eq("isActive", true); const now = new Date().toISOString(); const countId = crypto.randomUUID(); const { error } = await client.from("stock_counts").insert({ id: countId, shopId: shop.id, createdById: user.userId, status: "OPEN", createdAt: now, updatedAt: now }); if (error) throw error; await client.from("stock_count_items").insert((products ?? []).map((p) => ({ id: crypto.randomUUID(), stockCountId: countId, productId: p.id, expected: p.currentStock, counted: 0, createdAt: now, updatedAt: now }))); return stockCountRead(client, shop.id, countId, 201); } const id = parts[1]; if (request.method === "GET") return stockCountRead(client, shop.id, id); if (request.method === "POST" && parts[2] === "scan") { const body = await request.json().catch(() => ({})); const barcode = String(body.barcode ?? "").trim(); const { data: count } = await client.from("stock_counts").select("id,status").eq("id", id).eq("shopId", shop.id).maybeSingle(); if (!count || count.status !== "OPEN") return json({ error: "Open stock count not found" }, 404); const { data: product } = await client.from("products").select("id,name,barcode,unit").eq("shopId", shop.id).eq("barcode", barcode).eq("isActive", true).maybeSingle(); if (!product) return json({ error: "This barcode was not found." }, 404); const { data: item, error } = await client.from("stock_count_items").update({ counted: 1, updatedAt: new Date().toISOString() }).eq("stockCountId", id).eq("productId", product.id).select("*,product:products(id,name,barcode,unit)").single(); if (error) throw error; return json({ item }); } if (request.method === "POST" && parts[2] === "finish") { const body = await request.json().catch(() => ({})); const { data: items } = await client.from("stock_count_items").select("*").eq("stockCountId", id); if (body.applyAdjustments) for (const item of items ?? []) if (item.counted !== item.expected) { await client.from("products").update({ currentStock: item.counted, updatedAt: new Date().toISOString() }).eq("id", item.productId); await client.from("stock_movements").insert({ id: crypto.randomUUID(), type: "ADJUSTMENT", quantity: item.counted, note: `Stock count ${id}`, productId: item.productId }); } await client.from("stock_counts").update({ status: "COMPLETED", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", id).eq("shopId", shop.id); return stockCountRead(client, shop.id, id); } return json({ error: "Stock count route not found" }, 404); }
async function stockCountRead(client: SupabaseClient, shopId: string, id: string, status = 200) { const { data, error } = await client.from("stock_counts").select("*,items:stock_count_items(*,product:products(id,name,barcode,unit,currentStock))").eq("id", id).eq("shopId", shopId).maybeSingle(); if (error) throw error; return data ? json({ count: data }, status) : json({ error: "Stock count not found" }, 404); }

async function assistant(client: SupabaseClient, shop: Record<string, unknown>, request: Request, path: string) { if (request.method === "GET") { const { data, error } = await client.from("assistant_actions").select("*").eq("shopId", shop.id).order("updatedAt", { ascending: false }).limit(200); if (error) throw error; return json({ actions: data ?? [] }); } const body = await request.json().catch(() => ({})); if (!body.actionKey || !body.title || !body.href) return json({ error: "actionKey, title, and href are required" }, 400); const now = new Date().toISOString(); const { data, error } = await client.from("assistant_actions").upsert({ id: crypto.randomUUID(), shopId: shop.id, actionKey: String(body.actionKey), title: String(body.title), href: String(body.href), status: String(body.status ?? "OPEN").toUpperCase(), updatedAt: now, createdAt: now }, { onConflict: "shopId,actionKey" }).select("*").single(); if (error) throw error; return json({ action: data }, 201); }

async function publicOrder(client: SupabaseClient, request: Request) { const body = await request.json().catch(() => ({})); if (!body.shopId || !body.customerName || !body.customerPhone || !Array.isArray(body.items) || !body.items.length) return json({ error: "shopId, customerName, customerPhone, and items are required" }, 400); const { data: shop } = await client.from("shops").select("id,name,plan,trialEndsAt,subscriptionEndsAt,isActive,isCatalogPublished,isDemo").eq("id", body.shopId).maybeSingle(); if (!shop || !activeShop(shop)) return json({ error: "This shop is not currently accepting catalog orders" }, 402); const ids = body.items.map((item: Record<string, unknown>) => item.productId); const { data: products } = await client.from("products").select("id,name,unit,sellingPrice,wholesalePrice,currentStock").in("id", ids).eq("shopId", shop.id).eq("isActive", true); if ((products ?? []).length !== ids.length) return json({ error: "One or more products not available" }, 400); const map = new Map((products ?? []).map((p) => [p.id, p])); const rows = body.items.map((item: Record<string, unknown>) => { const product = map.get(item.productId)!; const quantity = Number(item.quantity); const tier = String(item.pricingTier ?? "RETAIL").toUpperCase() === "WHOLESALE" ? "WHOLESALE" : "RETAIL"; return { id: crypto.randomUUID(), quantity, unitPrice: tier === "WHOLESALE" && product.wholesalePrice != null ? product.wholesalePrice : product.sellingPrice, pricingTier: tier, productId: product.id }; }); const totalAmount = rows.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const now = new Date().toISOString(); const orderId = crypto.randomUUID(); const { error } = await client.from("customer_orders").insert({ id: orderId, customerName: body.customerName, customerPhone: normalizePhone(body.customerPhone), note: body.note || null, status: "PENDING", totalAmount, shopId: shop.id, createdAt: now, updatedAt: now }); if (error) throw error; await client.from("customer_order_items").insert(rows.map((r) => ({ ...r, orderId }))); return json({ order: { id: orderId, totalAmount }, shopWhatsAppUrl: null }, 201); }

async function push(client: SupabaseClient, user: Record<string, unknown>, shop: Record<string, unknown>, request: Request, path: string) { if (path === "/push/config") return json({ enabled: Boolean(Deno.env.get("VAPID_PUBLIC_KEY")), publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || null }); if (path === "/push/preferences" && request.method === "GET") { const { data: preferences } = await client.from("notification_preferences").upsert({ id: crypto.randomUUID(), shopId: shop.id, createdAt: new Date().toISOString() }, { onConflict: "shopId" }).select("*").single(); const { data: subscriptions } = await client.from("push_subscriptions").select("id,deviceId,deviceLabel,isActive,lastSeenAt").eq("shopId", shop.id); return json({ preferences, subscriptions: subscriptions ?? [], pushConfigured: Boolean(Deno.env.get("VAPID_PUBLIC_KEY")) }); } if (path === "/push/preferences" && request.method === "PATCH") { const body = await request.json().catch(() => ({})); const fields = ["lowStock", "debtDue", "subscriptionExpiry", "dailyAssistant"]; const update = Object.fromEntries(fields.filter((key) => typeof body[key] === "boolean").map((key) => [key, body[key]])); const { data, error } = await client.from("notification_preferences").upsert({ id: crypto.randomUUID(), shopId: shop.id, ...update, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, { onConflict: "shopId" }).select("*").single(); if (error) throw error; return json({ preferences: data }); } if (path === "/push/subscribe" && request.method === "POST") { const body = await request.json().catch(() => ({})); if (!String(body.endpoint ?? "").startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth || !body.deviceId) return json({ error: "A valid device subscription is required" }, 400); const now = new Date().toISOString(); const { error } = await client.from("push_subscriptions").upsert({ id: crypto.randomUUID(), shopId: shop.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, deviceId: body.deviceId, deviceLabel: body.deviceLabel || null, userId: user.userId, isActive: true, failureCount: 0, lastSeenAt: now, createdAt: now, updatedAt: now }, { onConflict: "shopId,deviceId" }); if (error) throw error; return json({ message: "Device alerts enabled" }, 201); } if (path === "/push/unsubscribe" && request.method === "POST") { const body = await request.json().catch(() => ({})); const { error } = await client.from("push_subscriptions").update({ isActive: false, updatedAt: new Date().toISOString() }).eq("shopId", shop.id).eq("deviceId", body.deviceId); if (error) throw error; return json({ message: "Device alerts disabled" }); } if (path === "/push/deliveries") { const { data, error } = await client.from("push_deliveries").select("*").eq("shopId", shop.id).order("createdAt", { ascending: false }).limit(100); if (error) throw error; return json({ deliveries: data ?? [] }); } return json({ error: "Push route not found" }, 404); }

async function supplierPortal(client: SupabaseClient, user: Record<string, unknown>, request: Request, path: string) { const { data: supplier } = await client.from("suppliers").select("*").eq("userId", user.userId).maybeSingle(); if (!supplier) return json({ error: "Supplier profile not found" }, 404); if (path === "/suppliers/portal/dashboard") { const { data: orders } = await client.from("orders").select("status").eq("supplierId", supplier.id); const ordersByStatus: Record<string, number> = {}; for (const order of orders ?? []) ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1; return json({ ordersByStatus, pendingOrders: [], topMerchantIds: [] }); } if (path === "/suppliers/portal/orders" || path.startsWith("/suppliers/portal/orders/")) { const orderId = path === "/suppliers/portal/orders" ? null : path.split("/").pop(); if (request.method === "GET") { let query = client.from("orders").select("*,shop:shops(id,name,location,district),items:order_items(*,product:products(id,name,unit))").eq("supplierId", supplier.id).order("createdAt", { ascending: false }); if (orderId) query = query.eq("id", orderId); const { data, error } = await query; if (error) throw error; return orderId ? data?.[0] ? json({ order: data[0] }) : json({ error: "Order not found" }, 404) : json({ orders: data ?? [], total: data?.length ?? 0, limit: 100, offset: 0 }); } const body = await request.json().catch(() => ({})); const { data, error } = await client.from("orders").update({ status: String(body.status ?? "").toUpperCase(), updatedAt: new Date().toISOString() }).eq("id", orderId).eq("supplierId", supplier.id).select("*").single(); if (error) throw error; return json({ order: data }); } if (path === "/suppliers/portal/products" || path.startsWith("/suppliers/portal/products/")) { const productId = path === "/suppliers/portal/products" ? null : path.split("/").pop(); if (request.method === "GET") { const { data, error } = await client.from("supplier_catalog_products").select("*").eq("supplierId", supplier.id).order("name"); if (error) throw error; return json({ products: data ?? [] }); } const body = await request.json().catch(() => ({})); if (request.method === "DELETE" && productId) { const { data, error } = await client.from("supplier_catalog_products").update({ isAvailable: false, updatedAt: new Date().toISOString() }).eq("id", productId).eq("supplierId", supplier.id).select("*").single(); if (error) throw error; return json({ product: data, message: "Supplier product marked unavailable" }); } const update = { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.sku !== undefined ? { sku: body.sku || null } : {}), ...(body.unit !== undefined ? { unit: body.unit || "pcs" } : {}), ...(body.price !== undefined ? { price: Number(body.price) } : {}), ...(body.minOrderQty !== undefined ? { minOrderQty: Math.max(1, Number(body.minOrderQty)) } : {}), ...(body.note !== undefined ? { note: body.note || null } : {}), ...(body.isAvailable !== undefined ? { isAvailable: Boolean(body.isAvailable) } : {}), updatedAt: new Date().toISOString() }; const { data, error } = productId ? await client.from("supplier_catalog_products").update(update).eq("id", productId).eq("supplierId", supplier.id).select("*").single() : await client.from("supplier_catalog_products").insert({ id: crypto.randomUUID(), supplierId: supplier.id, name: body.name, sku: body.sku || null, unit: body.unit || "pcs", price: Number(body.price), minOrderQty: Math.max(1, Number(body.minOrderQty) || 1), note: body.note || null, isAvailable: body.isAvailable !== false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).select("*").single(); if (error) throw error; return json({ product: data }, productId ? 200 : 201); } return json({ error: "Supplier portal route not found" }, 404); }

async function admin(client: SupabaseClient, user: Record<string, unknown>, request: Request, path: string) { if (user.role !== "ADMIN") return json({ error: "Forbidden" }, 403); if (path === "/admin/users") { const { data, error } = await client.from("users").select("id,phone,name,role,language,createdAt").order("createdAt", { ascending: false }).limit(200); if (error) throw error; return json({ users: data ?? [] }); } if (path === "/admin/users/search") { const phone = new URL(request.url).searchParams.get("phone") ?? ""; const { data, error } = await client.from("users").select("id,phone,name,role,language,createdAt").ilike("phone", `%${phone}%`).limit(10); if (error) throw error; return json({ users: data ?? [] }); } if (path === "/admin/staff/search") { const phone = new URL(request.url).searchParams.get("phone") ?? ""; const { data, error } = await client.from("staff_members").select("id,name,phone,role,isActive,shopId").ilike("phone", `%${phone}%`).limit(10); if (error) throw error; return json({ staff: data?.[0] ?? null }); } if (path === "/admin/audit-logs") { const { data, error } = await client.from("audit_logs").select("*").order("createdAt", { ascending: false }).limit(100); if (error) throw error; return json({ logs: data ?? [] }); } if (path === "/admin/overview") { const tables = ["users", "shops", "products", "sales", "orders", "debts", "expenses"]; const counts: Record<string, number> = {}; for (const table of tables) { const { count } = await client.from(table).select("id", { count: "exact", head: true }); counts[table] = count ?? 0; } return json({ summary: { users: counts.users, shops: counts.shops, products: counts.products, sales: counts.sales, orders: counts.orders, debts: counts.debts, expenses: counts.expenses } }); } if (request.method === "POST" && path.startsWith("/admin/users/") && path.endsWith("/reset-pin")) { const id = path.split("/")[3]; const body = await request.json().catch(() => ({})); if (!validPin(String(body.newPin ?? ""))) return json({ error: "New PIN must be 4 to 8 digits" }, 400); const { error } = await client.from("users").update({ pin: await bcrypt.hash(String(body.newPin), 10), updatedAt: new Date().toISOString() }).eq("id", id); if (error) throw error; return json({ message: "PIN reset successfully" }); } return json({ error: "Admin route not found" }, 404); }

async function publicShops(client: SupabaseClient) {
  const { data: shops, error } = await client
    .from("shops")
    .select("id,name,location,district,category,plan,trialEndsAt,subscriptionEndsAt,isActive,isCatalogPublished,isDemo")
    .eq("isActive", true)
    .eq("isCatalogPublished", true)
    .eq("isDemo", false)
    .order("name", { ascending: true });

  if (error) throw error;
  const { data: products, error: productError } = await client
    .from("products")
    .select("shopId")
    .eq("isActive", true)
    .gt("currentStock", 0);

  if (productError) throw productError;
  const counts = new Map<string, number>();
  for (const product of products ?? []) counts.set(product.shopId, (counts.get(product.shopId) ?? 0) + 1);

  return (shops ?? [])
    .filter((shop) => activeShop(shop) && (counts.get(shop.id) ?? 0) > 0)
    .map((shop) => ({
      id: shop.id,
      name: shop.name,
      location: shop.location,
      district: shop.district,
      category: shop.category,
      productCount: counts.get(shop.id) ?? 0,
    }));
}

async function publicProducts(client: SupabaseClient, request: Request) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shopId");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 60, 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  let query = client
    .from("products")
    .select("id,name,unit,sellingPrice,wholesalePrice,wholesaleMinQty,currentStock,shopId", { count: "exact" })
    .eq("isActive", true)
    .gt("currentStock", 0);
  if (shopId) query = query.eq("shopId", shopId);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data: products, count, error } = await query.order("name").range(offset, offset + limit - 1);
  if (error) throw error;

  const shopIds = [...new Set((products ?? []).map((product) => product.shopId))];
  const { data: shops, error: shopError } = shopIds.length
    ? await client.from("shops").select("id,name,location,category,plan,trialEndsAt,subscriptionEndsAt,isActive,isCatalogPublished,isDemo").in("id", shopIds)
    : { data: [], error: null };
  if (shopError) throw shopError;
  const shopMap = new Map((shops ?? []).filter((shop) => activeShop(shop)).map((shop) => [shop.id, shop]));
  const visibleProducts = (products ?? []).filter((product) => shopMap.has(product.shopId)).map((product) => ({
    ...product,
    shop: shopMap.get(product.shopId),
  }));

  return {
    products: visibleProducts,
    pagination: { total: count ?? 0, limit, offset, hasMore: offset + visibleProducts.length < (count ?? 0) },
  };
}

async function handle(request: Request) {
  const path = routePath(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "https://www.uzuriliving.com", "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization, content-type, x-client-info, apikey", "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS" } });

  if (request.method === "GET" && path === "/health") {
    return json({ status: "ok", service: "Uzuri Living Supabase API", runtime: "supabase-edge-functions" });
  }

  if (request.method === "GET" && path === "/status") {
    const started = Date.now();
    const { error } = await db.from("shops").select("id", { head: true, count: "exact" });
    return json({
      status: error ? "degraded" : "ok",
      service: "Uzuri Living Supabase API",
      db: { status: error ? "error" : "ok", latencyMs: Date.now() - started },
      env: Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "development",
      timestamp: new Date().toISOString(),
    });
  }

  if (request.method === "GET" && path === "/public/shops") return json({ shops: await publicShops(db) });
  if (request.method === "GET" && path === "/public/products") return json(await publicProducts(db, request));

  if (request.method === "POST" && path === "/auth/register") return await authRegister(db, request);
  if (request.method === "POST" && path === "/auth/login") return await authLogin(db, request);
  if (request.method === "POST" && path === "/auth/refresh") return await authRefresh(db, request);
  if (request.method === "POST" && path === "/auth/logout") return json({ message: "Logged out" }, 200, clearAuthHeaders());
  if (request.method === "POST" && path === "/auth/otp/request") return await requestOtp(db, request);
  if (request.method === "POST" && path === "/auth/otp/verify-reset") return await verifyOtpReset(db, request);

  const user = await authenticate(request);
  if (request.method === "GET" && path === "/auth/me") {
    if (!user?.userId || typeof user.userId !== "string") return json({ error: "Unauthorized" }, 401);
    const currentProfile = await profile(db, user.userId);
    return currentProfile ? json({ user: currentProfile }) : json({ error: "User not found" }, 404);
  }

  if (request.method === "PATCH" && path === "/auth/language") {
    if (!user?.userId || typeof user.userId !== "string") return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const language = String(body.language ?? "").trim().toLowerCase();
    if (!["en", "sw"].includes(language)) return json({ error: "Language must be 'en' or 'sw'" }, 400);
    const { error } = await db.from("users").update({ language }).eq("id", user.userId);
    if (error) throw error;
    return json({ message: "Language updated" });
  }

  if (path === "/products" || path.startsWith("/products/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    const { user: productUser, shop } = access;
    const productId = path.startsWith("/products/") ? path.slice("/products/".length) : null;
    if (request.method === "GET" && productId === "low-stock") {
      const url = new URL(request.url);
      url.searchParams.set("lowStock", "true");
      return productList(db, new Request(url, request), productUser!, shop!);
    }
    if (request.method === "GET" && productId) return productGet(db, productUser!, shop!, productId);
    if (request.method === "GET") return productList(db, request, productUser!, shop!);
    if (request.method === "POST" && !productId) return productCreate(db, productUser!, shop!, request);
    if (request.method === "PATCH" && productId) return productUpdate(db, productUser!, shop!, request, productId);
    if (request.method === "DELETE" && productId) {
      const { error } = await db.from("products").update({ isActive: false }).eq("id", productId).eq("shopId", shop!.id);
      if (error) throw error;
      return json({ message: "Product deactivated" });
    }
  }

  if (path === "/stock/adjust" || (path.startsWith("/stock/") && path.endsWith("/movements"))) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    if (request.method === "POST" && path === "/stock/adjust") return stockAdjust(db, access.shop!, request);
    if (request.method === "GET" && path.endsWith("/movements")) return stockMovements(db, access.shop!, path.slice("/stock/".length, -"/movements".length));
  }

  if (path === "/expenses" || path.startsWith("/expenses/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return expenses(db, access.shop!, request, request.method, path === "/expenses" ? undefined : path.slice("/expenses/".length));
  }

  if (path === "/debts" || path.startsWith("/debts/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    const debtPath = path === "/debts" ? undefined : path.slice("/debts/".length);
    return debts(db, access.user!, access.shop!, request, request.method, debtPath);
  }

  if (path === "/sales" || path.startsWith("/sales/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    const salePath = path === "/sales" ? undefined : path.slice("/sales/".length);
    return sales(db, access.user!, access.shop!, request, request.method, salePath);
  }

  if (path === "/dashboard" || path === "/dashboard/profit") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return dashboard(db, access.shop!, request);
  }

  if (path === "/staff" || path.startsWith("/staff/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return staff(db, access.shop!, request, request.method, path === "/staff" ? undefined : path.slice("/staff/".length));
  }

  if (path === "/reports" || path === "/reports/my") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return reports(db, access.user!, request, path);
  }

  if (path === "/subscription/status") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return json({ ...access.shop, ...subscriptionSnapshot(access.shop!) });
  }

  if (path === "/storage/upload-url" && request.method === "POST") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return uploadUrl(db, access.user!, request);
  }

  if (path === "/orders" || path.startsWith("/orders/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return orders(db, access.shop!, request, request.method, path === "/orders" ? undefined : path.slice("/orders/".length));
  }

  if (path === "/settings" || path.startsWith("/settings/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return settings(db, access.user!, access.shop!, request, path);
  }

  if (path.startsWith("/barcodes/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return barcodes(db, access.shop!, request, path);
  }

  if (path === "/notifications") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return notifications(db, access.shop!);
  }

  if (path === "/sync/events") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return syncEvents(db, access.shop!, request, path);
  }

  if (path === "/suppliers" || path.startsWith("/suppliers/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    if (path.startsWith("/suppliers/portal/")) return supplierPortal(db, access.user!, request, path);
    return suppliers(db, access.shop!, request, path);
  }

  if (path === "/customer-orders" || path.startsWith("/customer-orders/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return customerOrders(db, access.shop!, request, path);
  }

  if (path === "/public/orders" && request.method === "POST") return publicOrder(db, request);

  if (path === "/stock-counts" || path.startsWith("/stock-counts/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return stockCounts(db, access.user!, access.shop!, request, path);
  }

  if (path === "/assistant/actions" || path === "/assistant/admin/analytics") {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return assistant(db, access.shop!, request, path);
  }

  if (path.startsWith("/admin/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return admin(db, access.user!, request, path);
  }

  if (path === "/push/config" || path.startsWith("/push/")) {
    const access = await requireUser(db, request);
    if (access.response) return access.response;
    return push(db, access.user!, access.shop!, request, path);
  }

  return json({ error: "Route not migrated to Supabase Edge Functions yet", path }, 501);
}

Deno.serve(async (request) => {
  try {
    return applyCors(await handle(request), request);
  } catch (error) {
    console.error(error);
    return applyCors(json({ error: "Internal server error" }, 500), request);
  }
});

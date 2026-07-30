require("dotenv").config();
const Sentry = require("./lib/sentry");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const saleRoutes = require("./routes/sale.routes");
const orderRoutes = require("./routes/order.routes");
const supplierRoutes = require("./routes/supplier.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const stockRoutes = require("./routes/stock.routes");
const adminRoutes = require("./routes/admin.routes");
const exportRoutes = require("./routes/export.routes");
const publicRoutes = require("./routes/public.routes");
const settingsRoutes = require("./routes/settings.routes");
const customerOrderRoutes = require("./routes/customerOrder.routes");
const reportRoutes = require("./routes/report.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const debtRoutes = require("./routes/debt.routes");
const expenseRoutes = require("./routes/expense.routes");
const staffRoutes = require("./routes/staff.routes");
const syncRoutes = require("./routes/sync.routes");
const assistantRoutes = require("./routes/assistant.routes");
const notificationRoutes = require("./routes/notification.routes");
const pushRoutes = require("./routes/push.routes");
const usageEventRoutes = require("./routes/usageEvent.routes");
const barcodeRoutes = require("./routes/barcode.routes");
const stockCountRoutes = require("./routes/stockCount.routes");
const { apiRateLimiter, publicRateLimiter } = require("./middleware/rateLimit");
const { auditTrail, setAuditContext } = require("./middleware/audit");
const prisma = require("./lib/prisma");

const app = express();

// Supabase terminates the public connection before this process. Trust exactly
// that proxy hop so req.ip cannot be forged through a client-supplied header.
app.set("trust proxy", 1);

function normalizeOrigin(origin) {
  return typeof origin === "string" ? origin.trim().replace(/\/$/, "") : "";
}

const allowedOrigins = new Set(
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.uzuriliving.com",
    "https://uzuriliving.com",
    "https://uzuriliving.vercel.app",
    process.env.FRONTEND_URL,
    process.env.VERCEL_FRONTEND_URL,
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    const error = new Error(`Origin ${normalizedOrigin} not allowed by CORS`);
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(helmet({
  // Allow same-origin framing for admin UI (change to false to block all iframes)
  frameguard: { action: "sameorigin" },
  // Next.js frontend handles its own CSP; skip it here to avoid double-config
  contentSecurityPolicy: false,
}));
app.use(cors(corsOptions));
app.options("/{*path}", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(setAuditContext);
app.use(auditTrail);

app.get("/health", (req, res) => res.json({ status: "ok", service: "Uzuri Living API" }));

const SERVICE_START = Date.now();
app.get("/status", async (req, res) => {
  let dbStatus = "ok";
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = "error";
  }
  res.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    service: "Uzuri Living API",
    version: process.env.npm_package_version || "1.0.0",
    uptimeSeconds: Math.floor((Date.now() - SERVICE_START) / 1000),
    db: { status: dbStatus, latencyMs: dbLatencyMs },
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", apiRateLimiter);
app.use("/api/public", publicRateLimiter, publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/customer-orders", customerOrderRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/debts", debtRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/usage-events", usageEventRoutes);
app.use("/api/barcodes", barcodeRoutes);
app.use("/api/stock-counts", stockCountRoutes);

if (Sentry.setupExpressErrorHandler) Sentry.setupExpressErrorHandler(app);

app.use((err, req, res, next) => {
  const status = Number(err.status) || 500;
  const message = status >= 500 ? "Internal server error" : err.message;

  console.error(err.stack || err.message || err);

  res.status(err.status || 500).json({
    error: message || "Internal server error",
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ðŸ›’ Uzuri Living API running on port ${PORT}`);
});

module.exports = app;

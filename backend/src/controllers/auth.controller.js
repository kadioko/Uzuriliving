const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { issueOtp, verifyOtp } = require("../services/otp.service");
const { activePlan, canUseFeature, featureSnapshot } = require("../lib/entitlements");

const VALID_ROLES = new Set(["MERCHANT", "SUPPLIER"]);
const VALID_LANGUAGES = new Set(["en", "sw"]);

// Access token: 1 hour. Refresh token: 30 days.
const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "30d";
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function normalizePhone(value) {
  return String(value || "").replace(/[\s()-]/g, "").trim();
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAttribution(value) {
  const source = value && typeof value === "object" ? value : {};
  const clean = (field) => normalizeText(source[field]).slice(0, 120) || null;
  return {
    acquisitionSource: clean("source"),
    acquisitionMedium: clean("medium"),
    acquisitionCampaign: clean("campaign"),
    acquisitionContent: clean("content"),
  };
}

function validatePhone(phone) {
  return /^\+?[1-9]\d{8,14}$/.test(phone);
}

function validatePin(pin) {
  return /^\d{4,8}$/.test(pin);
}

function getCookieOptions(maxAge) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  };
}

function setCookie(res, name, value, maxAge) {
  const options = getCookieOptions(maxAge);
  const cookie = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.floor(options.maxAge / 1000)}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.httpOnly ? "HttpOnly" : "",
    options.secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader("Set-Cookie", [...cookies, cookie]);
}

function clearCookie(res, name) {
  const options = getCookieOptions(0);
  const cookie = [
    `${name}=`,
    "Max-Age=0",
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    options.httpOnly ? "HttpOnly" : "",
    options.secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader("Set-Cookie", [...cookies, cookie]);
}

function setAuthCookies(res, accessToken, refreshToken) {
  setCookie(res, "uzuriliving_token", accessToken, 60 * 60 * 1000); // 1h
  setCookie(res, "uzuriliving_refresh", refreshToken, REFRESH_TOKEN_EXPIRY_MS); // 30d
  clearCookie(res, "dukaos_token");
  clearCookie(res, "dukaos_refresh");
}

function clearAuthCookies(res) {
  clearCookie(res, "uzuriliving_token");
  clearCookie(res, "uzuriliving_refresh");
  clearCookie(res, "dukaos_token");
  clearCookie(res, "dukaos_refresh");
}

// Legacy alias for code that only sets one cookie
function setAuthCookie(res, token) {
  setAuthCookies(res, token, token);
}

function clearAuthCookie(res) {
  clearAuthCookies(res);
}

function staffPermissions(staff) {
  if (!staff) return null;
  return {
    canSell: Boolean(staff.canSell),
    canManageStock: Boolean(staff.canManageStock),
    canManageStaff: Boolean(staff.canManageStaff),
    canViewReports: Boolean(staff.canViewReports),
    canRecordExpenses: Boolean(staff.canRecordExpenses),
  };
}

function issueAccessToken(user, staff = null) {
  return jwt.sign(
    {
      userId: user.id,
      phone: staff?.phone || user.phone,
      role: user.role,
      staffId: staff?.id,
      staffRole: staff?.role,
      permissions: staffPermissions(staff),
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function issueRefreshToken(user, staff = null) {
  return jwt.sign(
    { userId: user.id, staffId: staff?.id, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

// Keep legacy issueToken for any other callers
function issueToken(user) {
  return issueAccessToken(user);
}

const register = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin || "").trim();
  const name = normalizeText(req.body.name);
  const role = normalizeText(req.body.role || "MERCHANT").toUpperCase();
  const shopName = normalizeText(req.body.shopName);
  const shopLocation = normalizeText(req.body.shopLocation);
  const shopCategory = normalizeText(req.body.shopCategory);
  const shopDistrict = normalizeText(req.body.shopDistrict);
  const attribution = normalizeAttribution(req.body.acquisition);

  if (!phone || !pin || !name) {
    return res.status(400).json({ error: "Phone, PIN, and name are required" });
  }

  if (!validatePhone(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  if (!validatePin(pin)) {
    return res.status(400).json({ error: "PIN must be 4 to 8 digits" });
  }

  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: "Invalid role selected" });
  }

  const [existing, existingStaff] = await Promise.all([
    prisma.user.findUnique({ where: { phone } }),
    prisma.staffMember.findUnique({ where: { phone } }),
  ]);
  if (existing || existingStaff) {
    return res.status(409).json({ error: "Phone number already registered" });
  }

  const hashedPin = await bcrypt.hash(pin, 10);

  const user = await prisma.user.create({
    data: {
      phone,
      pin: hashedPin,
      name,
      role,
    },
  });

  if (role === "MERCHANT") {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await prisma.shop.create({
      data: {
        name: shopName || `${name}'s Duka`,
        location: shopLocation || "Dar es Salaam",
        district: shopDistrict || null,
        category: shopCategory || "general",
        trialEndsAt,
        userId: user.id,
        ...attribution,
      },
    });
  }

  if (role === "SUPPLIER") {
    await prisma.supplier.create({
      data: {
        name,
        phone,
        userId: user.id,
      },
    });
  }

  const accessToken = issueAccessToken(user);
  const refreshToken = issueRefreshToken(user);
  const profile = await getProfile(user.id);
  setAuthCookies(res, accessToken, refreshToken);
  req.audit = { action: "auth.register", resourceType: "user", resourceId: user.id, metadata: { role: user.role } };
  res.status(201).json({ user: profile });
});

const login = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin || "").trim();

  if (!phone || !pin) {
    return res.status(400).json({ error: "Phone and PIN required" });
  }

  if (!validatePhone(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  if (!validatePin(pin)) {
    return res.status(400).json({ error: "PIN must be 4 to 8 digits" });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  let staff = null;
  let accountUser = user;

  if (user) {
    const match = await bcrypt.compare(pin, user.pin);
    if (!match) return res.status(401).json({ error: "Invalid phone or PIN" });
  } else {
    staff = await prisma.staffMember.findUnique({
      where: { phone },
      include: { shop: { include: { user: true } } },
    });
    if (!staff || !staff.isActive || !staff.pin) return res.status(401).json({ error: "Invalid phone or PIN" });
    const match = await bcrypt.compare(pin, staff.pin);
    if (!match) return res.status(401).json({ error: "Invalid phone or PIN" });
    if (!activePlan(staff.shop)) {
      return res.status(402).json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" });
    }
    if (!canUseFeature(staff.shop, "STAFF")) {
      return res.status(403).json({ error: "Staff login requires Uzuri Living Pro", code: "PLAN_UPGRADE_REQUIRED" });
    }
    accountUser = staff.shop.user;
  }

  const accessToken = issueAccessToken(accountUser, staff);
  const refreshToken = issueRefreshToken(accountUser, staff);
  const profile = staff ? await getStaffProfile(staff.id) : await getProfile(accountUser.id);
  setAuthCookies(res, accessToken, refreshToken);
  req.audit = { action: "auth.login", resourceType: staff ? "staff" : "user", resourceId: staff?.id || accountUser.id, metadata: { role: accountUser.role, staffRole: staff?.role } };
  res.json({ user: profile });
});

const me = asyncHandler(async (req, res) => {
  const profile = req.user.staffId ? await getStaffProfile(req.user.staffId) : await getProfile(req.user.userId);
  if (!profile) return res.status(404).json({ error: "User not found" });
  res.json({ user: profile });
});

const updateLanguage = asyncHandler(async (req, res) => {
  const language = normalizeText(req.body.language).toLowerCase();

  if (!VALID_LANGUAGES.has(language)) {
    return res.status(400).json({ error: "Language must be 'en' or 'sw'" });
  }

  if (req.user.staffId) {
    await prisma.staffMember.update({ where: { id: req.user.staffId }, data: { language } });
  } else {
    await prisma.user.update({ where: { id: req.user.userId }, data: { language } });
  }
  req.audit = { action: "auth.language.update", resourceType: req.user.staffId ? "staff" : "user", resourceId: req.user.staffId || req.user.userId, metadata: { language } };
  res.json({ message: "Language updated" });
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookies(res);
  req.audit = { action: "auth.logout", resourceType: "session", resourceId: req.user?.userId || null };
  res.json({ message: "Logged out" });
});

// POST /api/auth/refresh â€” issue new access token from refresh token cookie or body
const refresh = asyncHandler(async (req, res) => {
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((p) => {
      const idx = p.indexOf("=");
      return idx >= 0 ? [p.slice(0, idx).trim(), decodeURIComponent(p.slice(idx + 1))] : [p.trim(), ""];
    })
  );

  const refreshToken = cookies.uzuriliving_refresh || cookies.dukaos_refresh || req.body?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  if (payload.type !== "refresh") {
    return res.status(401).json({ error: "Invalid token type" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return res.status(401).json({ error: "User not found" });

  let staff = null;
  if (payload.staffId) {
    staff = await prisma.staffMember.findFirst({ where: { id: payload.staffId, isActive: true } });
    if (!staff) return res.status(401).json({ error: "Staff access expired" });
  }

  const newAccessToken = issueAccessToken(user, staff);
  setCookie(res, "uzuriliving_token", newAccessToken, 60 * 60 * 1000);
  clearCookie(res, "dukaos_token");
  res.json({ message: "Session refreshed" });
});

// POST /api/auth/otp/request â€” send OTP to phone for PIN recovery
const requestOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);

  if (!validatePhone(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  // Don't reveal whether phone exists â€” always return success
  if (user) {
    try {
      await issueOtp(phone);
    } catch (err) {
      console.error("OTP send error:", err.message);
      // Don't expose internal error to client
    }
  }

  res.json({ message: "If this number is registered, an OTP has been sent." });
});

// POST /api/auth/otp/verify-reset â€” verify OTP and reset PIN
const verifyOtpAndResetPin = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const code = String(req.body.code || "").trim();
  const newPin = String(req.body.newPin || "").trim();

  if (!phone || !code || !newPin) {
    return res.status(400).json({ error: "phone, code, and newPin are required" });
  }

  if (!validatePhone(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  if (!validatePin(newPin)) {
    return res.status(400).json({ error: "New PIN must be 4 to 8 digits" });
  }

  // verifyOtp throws synchronously on failure -- catch to return 400
  try {
    verifyOtp(phone, code);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Invalid or expired OTP" });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const hashedPin = await bcrypt.hash(newPin, 10);
  await prisma.user.update({ where: { id: user.id }, data: { pin: hashedPin } });

  req.audit = { action: "auth.pin.resetViaOtp", resourceType: "user", resourceId: user.id };
  res.json({ message: "PIN reset successfully. You can now log in with your new PIN." });
});

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      language: true,
      shop: { select: { id: true, name: true, location: true, district: true, category: true, plan: true, trialEndsAt: true, subscriptionEndsAt: true, isActive: true, isCatalogPublished: true } },
      supplier: { select: { id: true, name: true, phone: true, address: true } },
      createdAt: true,
    },
  });
  if (!user) return user;
  const withFeatures = user.shop ? { ...user, features: featureSnapshot(user.shop) } : user;
  if (user.supplier || user.role !== "ADMIN") return withFeatures;

  const userDigits = String(user.phone || "").replace(/\D/g, "");
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, phone: true, address: true },
    take: 500,
  });
  const supplier = suppliers.find((item) => {
    const supplierDigits = String(item.phone || "").replace(/\D/g, "");
    return supplierDigits && (supplierDigits === userDigits || supplierDigits.endsWith(userDigits.slice(-9)) || userDigits.endsWith(supplierDigits.slice(-9)));
  });

  return supplier ? { ...withFeatures, supplier } : withFeatures;
}

async function getStaffProfile(staffId) {
  const staff = await prisma.staffMember.findUnique({
    where: { id: staffId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          location: true,
          district: true,
          category: true,
          plan: true,
          trialEndsAt: true,
          subscriptionEndsAt: true,
          isActive: true,
          isCatalogPublished: true,
          user: { select: { id: true, phone: true, name: true, role: true, language: true, createdAt: true } },
        },
      },
    },
  });
  if (!staff || !staff.isActive) return null;
  return {
    id: staff.shop.user.id,
    phone: staff.phone || staff.shop.user.phone,
    name: staff.name,
    role: staff.shop.user.role,
    language: staff.language || staff.shop.user.language,
    shop: {
      id: staff.shop.id,
      name: staff.shop.name,
      location: staff.shop.location,
      district: staff.shop.district,
      category: staff.shop.category,
    },
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      permissions: staffPermissions(staff),
    },
    features: featureSnapshot(staff.shop),
    createdAt: staff.shop.user.createdAt,
  };
}

module.exports = { register, login, me, updateLanguage, logout, refresh, requestOtp, verifyOtpAndResetPin, issueToken, setAuthCookie, clearAuthCookie };

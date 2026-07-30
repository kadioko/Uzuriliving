const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

function readCookieToken(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index >= 0 ? [part.slice(0, index), decodeURIComponent(part.slice(index + 1))] : [part, ""];
      })
  );

  return cookies.uzuriliving_token || cookies.dukaos_token || null;
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const bearerToken = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = readCookieToken(req);
  const token = bearerToken || cookieToken;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // Supports a smooth move away from browser-stored bearer tokens: if an
    // older client sends a stale bearer token, its valid HttpOnly cookie wins.
    if (!bearerToken || !cookieToken) return res.status(401).json({ error: "Invalid or expired token" });
    try {
      payload = jwt.verify(cookieToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  }

  try {
    if (payload.staffId) {
      const staff = await prisma.staffMember.findFirst({
        where: { id: payload.staffId, isActive: true },
        select: {
          id: true,
          role: true,
          shopId: true,
          canSell: true,
          canManageStock: true,
          canManageStaff: true,
          canViewReports: true,
          canRecordExpenses: true,
          shop: { select: { userId: true } },
        },
      });
      if (!staff || staff.shop.userId !== payload.userId) {
        return res.status(401).json({ error: "Staff access expired" });
      }
      payload.shopId = staff.shopId;
      payload.staffRole = staff.role;
      payload.permissions = {
        canSell: staff.canSell,
        canManageStock: staff.canManageStock,
        canManageStaff: staff.canManageStaff,
        canViewReports: staff.canViewReports,
        canRecordExpenses: staff.canRecordExpenses,
      };
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user.role === "ADMIN") return next();
    if (!req.user.staffId) return next();

    const permissions = req.user.permissions || {};
    if (!permissions[permission]) {
      return res.status(403).json({ error: "You do not have permission for this action" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requirePermission, readCookieToken };

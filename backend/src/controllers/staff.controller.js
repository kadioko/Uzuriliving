const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");
const { getShopIdForUser } = require("../lib/shopAccess");

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const ROLES = new Set(["OWNER", "MANAGER", "CASHIER", "STOCK_CLERK"]);
const SAFE_STAFF_SELECT = {
  id: true,
  name: true,
  phone: true,
  role: true,
  canSell: true,
  canManageStock: true,
  canManageStaff: true,
  canViewReports: true,
  canRecordExpenses: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function permissionsFor(role) {
  if (role === "OWNER") return { canSell: true, canManageStock: true, canManageStaff: true, canViewReports: true, canRecordExpenses: true };
  if (role === "MANAGER") return { canSell: true, canManageStock: true, canManageStaff: true, canViewReports: true, canRecordExpenses: true };
  if (role === "STOCK_CLERK") return { canSell: false, canManageStock: true, canManageStaff: false, canViewReports: false, canRecordExpenses: false };
  return { canSell: true, canManageStock: false, canManageStaff: false, canViewReports: false, canRecordExpenses: false };
}

function boolValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePhone(value) {
  return String(value || "").replace(/[\s()-]/g, "").trim();
}

function validatePin(pin) {
  return /^\d{4,8}$/.test(String(pin || "").trim());
}

async function phoneConflict(phone, excludeStaffId = null) {
  if (!phone) return false;
  const [user, staff] = await Promise.all([
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
    prisma.staffMember.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  return Boolean(user || (staff && staff.id !== excludeStaffId));
}

const list = asyncHandler(async (req, res) => {
  const shopId = await getShopIdForUser(req.user);
  const staff = await prisma.staffMember.findMany({
    where: { shopId },
    select: SAFE_STAFF_SELECT,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ staff });
});

const create = asyncHandler(async (req, res) => {
  const shopId = await getShopIdForUser(req.user);
  const name = String(req.body.name || "").trim();
  const role = String(req.body.role || "CASHIER").toUpperCase();
  const phone = normalizePhone(req.body.phone);
  const pin = String(req.body.pin || "").trim();
  if (!name) return res.status(400).json({ error: "Staff name is required" });
  if (!ROLES.has(role)) return res.status(400).json({ error: "Invalid staff role" });
  if (pin && (!phone || !validatePin(pin))) return res.status(400).json({ error: "Staff login requires a phone and 4 to 8 digit PIN" });
  if (await phoneConflict(phone)) return res.status(409).json({ error: "This phone number already belongs to another Uzuri Living login" });

  const defaults = permissionsFor(role);
  const staff = await prisma.staffMember.create({
    data: {
      name,
      phone: phone || null,
      pin: pin ? await bcrypt.hash(pin, 10) : null,
      role,
      canSell: boolValue(req.body.canSell, defaults.canSell),
      canManageStock: boolValue(req.body.canManageStock, defaults.canManageStock),
      canManageStaff: boolValue(req.body.canManageStaff, defaults.canManageStaff),
      canViewReports: boolValue(req.body.canViewReports, defaults.canViewReports),
      canRecordExpenses: boolValue(req.body.canRecordExpenses, defaults.canRecordExpenses),
      shopId,
    },
    select: SAFE_STAFF_SELECT,
  });

  req.audit = { action: "staff.create", resourceType: "staff", resourceId: staff.id };
  res.status(201).json({ staff });
});

const update = asyncHandler(async (req, res) => {
  const shopId = await getShopIdForUser(req.user);
  const existing = await prisma.staffMember.findFirst({ where: { id: req.params.id, shopId } });
  if (!existing) return res.status(404).json({ error: "Staff member not found" });

  const role = String(req.body.role || existing.role).toUpperCase();
  const pin = req.body.pin === undefined ? undefined : String(req.body.pin || "").trim();
  if (!ROLES.has(role)) return res.status(400).json({ error: "Invalid staff role" });
  const nextPhone = req.body.phone === undefined ? existing.phone : normalizePhone(req.body.phone);
  if (pin !== undefined && pin && (!nextPhone || !validatePin(pin))) {
    return res.status(400).json({ error: "Staff login requires a phone and 4 to 8 digit PIN" });
  }
  if (nextPhone && nextPhone !== existing.phone && await phoneConflict(nextPhone, existing.id)) {
    return res.status(409).json({ error: "This phone number already belongs to another Uzuri Living login" });
  }

  const staff = await prisma.staffMember.update({
    where: { id: existing.id },
    data: {
      name: req.body.name === undefined ? existing.name : String(req.body.name || "").trim(),
      phone: req.body.phone === undefined ? existing.phone : nextPhone || null,
      ...(pin !== undefined ? { pin: pin ? await bcrypt.hash(pin, 10) : null } : {}),
      role,
      canSell: boolValue(req.body.canSell, existing.canSell),
      canManageStock: boolValue(req.body.canManageStock, existing.canManageStock),
      canManageStaff: boolValue(req.body.canManageStaff, existing.canManageStaff),
      canViewReports: boolValue(req.body.canViewReports, existing.canViewReports),
      canRecordExpenses: boolValue(req.body.canRecordExpenses, existing.canRecordExpenses),
      isActive: boolValue(req.body.isActive, existing.isActive),
    },
    select: SAFE_STAFF_SELECT,
  });

  req.audit = { action: "staff.update", resourceType: "staff", resourceId: staff.id };
  res.json({ staff });
});

module.exports = { list, create, update };

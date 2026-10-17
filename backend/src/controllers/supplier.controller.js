const prisma = require("../lib/prisma");
const { getShopIdForUser } = require("../lib/shopAccess");

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function getPortalSupplier(user) {
  const linked = await prisma.supplier.findUnique({ where: { userId: user.userId } });
  if (linked) return linked;
  if (user.role !== "ADMIN" || !user.phone) return null;

  const userDigits = String(user.phone || "").replace(/\D/g, "");
  const suppliers = await prisma.supplier.findMany({ take: 500 });
  return suppliers.find((supplier) => {
    const supplierDigits = String(supplier.phone || "").replace(/\D/g, "");
    return supplierDigits && (supplierDigits === userDigits || supplierDigits.endsWith(userDigits.slice(-9)) || userDigits.endsWith(supplierDigits.slice(-9)));
  }) || null;
}

// Merchant: manage their supplier relationships
const list = asyncHandler(async (req, res) => {
  const shopId = req.user.role === "MERCHANT" ? await getShopIdForUser(req.user) : null;
  const suppliers = await prisma.supplier.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      verificationStatus: true,
      verifiedAt: true,
      adminNotes: true,
      createdByShopId: true,
      _count: { select: { products: true, orders: true, catalogProducts: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json({
    suppliers: suppliers.map((supplier) => ({
      ...supplier,
      // Shared suppliers can be browsed by every merchant, but only an admin
      // or the shop that created a private entry can change its details.
      canEdit: req.user.role === "ADMIN" || Boolean(shopId && supplier.createdByShopId === shopId),
    })),
  });
});

const get = asyncHandler(async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      catalogProducts: {
        where: { isAvailable: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, sku: true, unit: true, price: true, minOrderQty: true, note: true, isAvailable: true },
      },
      products: {
        where: { isActive: true },
        select: { id: true, name: true, unit: true, sellingPrice: true },
      },
    },
  });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });
  res.json({ supplier });
});

const create = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;
  const createdByShopId = req.user.role === "MERCHANT" ? await getShopIdForUser(req.user) : null;
  const supplier = await prisma.supplier.create({
    data: { name, phone, address, verificationStatus: "NEEDS_REVIEW", createdByShopId },
  });
  req.audit = { action: "supplier.create", resourceType: "supplier", resourceId: supplier.id };
  res.status(201).json({ supplier });
});

const update = asyncHandler(async (req, res) => {
  const { name, phone, address, verificationStatus, adminNotes } = req.body;
  const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Supplier not found" });

  if (req.user.role !== "ADMIN") {
    const shopId = await getShopIdForUser(req.user);
    if (existing.createdByShopId !== shopId) {
      return res.status(403).json({ error: "Only the shop that added this supplier can edit it" });
    }
  }

  const adminVerificationPatch = {};
  if (req.user.role === "ADMIN") {
    const nextStatus = verificationStatus ? String(verificationStatus).toUpperCase() : undefined;
    if (nextStatus) {
      adminVerificationPatch.verificationStatus = nextStatus;
      adminVerificationPatch.verifiedAt = nextStatus === "VERIFIED" ? new Date() : null;
    }
    if (adminNotes !== undefined) adminVerificationPatch.adminNotes = String(adminNotes || "").trim() || null;
  }
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(address !== undefined && { address }),
      ...adminVerificationPatch,
    },
  });
  req.audit = { action: "supplier.update", resourceType: "supplier", resourceId: supplier.id };
  res.json({ supplier });
});

const importCatalogProduct = asyncHandler(async (req, res) => {
  const shopId = await getShopIdForUser(req.user);
  const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  const isOwnSupplier = supplier.createdByShopId === shopId;
  if (supplier.verificationStatus !== "VERIFIED" && !isOwnSupplier) {
    return res.status(403).json({ error: "This supplier must be verified before catalog products can be imported" });
  }

  const catalogProduct = await prisma.supplierCatalogProduct.findFirst({
    where: { id: req.params.catalogProductId, supplierId: supplier.id, isAvailable: true },
  });
  if (!catalogProduct) return res.status(404).json({ error: "Supplier catalog product not found" });

  const sellingPrice = Number(req.body.sellingPrice);
  const minimumStock = req.body.minimumStock == null ? 5 : Number(req.body.minimumStock);
  if (!Number.isInteger(sellingPrice) || sellingPrice < 0) {
    return res.status(400).json({ error: "Selling price must be a whole TZS amount of 0 or greater" });
  }
  if (!Number.isInteger(minimumStock) || minimumStock < 0) {
    return res.status(400).json({ error: "Minimum stock must be a whole number of 0 or greater" });
  }

  const existing = await prisma.product.findFirst({
    where: { shopId, supplierCatalogProductId: catalogProduct.id },
    include: { supplier: { select: { id: true, name: true, phone: true } } },
  });

  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: { buyingPrice: catalogProduct.price, sellingPrice, minimumStock, supplierId: supplier.id, isActive: true },
        include: { supplier: { select: { id: true, name: true, phone: true } } },
      })
    : await prisma.product.create({
        data: {
          name: catalogProduct.name,
          sku: catalogProduct.sku,
          unit: catalogProduct.unit,
          buyingPrice: catalogProduct.price,
          sellingPrice,
          minimumStock,
          currentStock: 0,
          supplierId: supplier.id,
          supplierCatalogProductId: catalogProduct.id,
          shopId,
        },
        include: { supplier: { select: { id: true, name: true, phone: true } } },
      });

  req.audit = {
    action: existing ? "supplier.catalog.importRefreshed" : "supplier.catalog.imported",
    resourceType: "product",
    resourceId: product.id,
    metadata: { supplierId: supplier.id, catalogProductId: catalogProduct.id },
  };
  res.status(existing ? 200 : 201).json({ product, reused: Boolean(existing) });
});

const remove = asyncHandler(async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      phone: true,
      userId: true,
      _count: { select: { products: true, orders: true } },
    },
  });
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  if (supplier._count.orders > 0) {
    return res.status(400).json({
      error: "This supplier has order history. Reject or archive the supplier instead of deleting it.",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({
      where: { supplierId: supplier.id },
      data: { supplierId: null },
    });
    await tx.supplier.delete({ where: { id: supplier.id } });
    if (supplier.userId) {
      await tx.user.delete({ where: { id: supplier.userId } });
    }
  });

  req.audit = {
    action: "admin.supplier.delete",
    resourceType: "supplier",
    resourceId: supplier.id,
    metadata: {
      adminId: req.user.userId,
      supplier: {
        name: supplier.name,
        phone: supplier.phone,
        productsDetached: supplier._count.products,
        linkedUserDeleted: Boolean(supplier.userId),
      },
    },
  };

  res.json({ message: "Supplier removed", deletedSupplier: supplier });
});

// Supplier portal: orders assigned to this supplier
const myOrders = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const { status, limit = 100, offset = 0 } = req.query;
  const where = { supplierId: supplierRecord.id };
  if (status) where.status = status.toUpperCase();

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        shop: { select: { id: true, name: true, location: true, district: true } },
        items: {
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit), 200),
      skip: Number(offset),
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total, limit: Math.min(Number(limit), 200), offset: Number(offset) });
});

const listPortalProducts = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const products = await prisma.supplierCatalogProduct.findMany({
    where: { supplierId: supplierRecord.id },
    orderBy: [{ isAvailable: "desc" }, { name: "asc" }],
  });
  res.json({ products });
});

const createPortalProduct = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const name = String(req.body.name || "").trim();
  const sku = String(req.body.sku || "").trim() || null;
  const unit = String(req.body.unit || "pcs").trim() || "pcs";
  const price = Number(req.body.price);
  const minOrderQty = Math.max(1, Number(req.body.minOrderQty) || 1);
  const note = String(req.body.note || "").trim() || null;

  if (!name) return res.status(400).json({ error: "Product name is required" });
  if (!Number.isInteger(price) || price < 0) return res.status(400).json({ error: "Price must be a whole TZS amount of 0 or greater" });

  const product = await prisma.supplierCatalogProduct.create({
    data: { supplierId: supplierRecord.id, name, sku, unit, price, minOrderQty, note, isAvailable: req.body.isAvailable !== false },
  });

  req.audit = { action: "supplier.catalog.create", resourceType: "supplier_catalog_product", resourceId: product.id };
  res.status(201).json({ product });
});

const updatePortalProduct = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const existing = await prisma.supplierCatalogProduct.findFirst({
    where: { id: req.params.productId, supplierId: supplierRecord.id },
  });
  if (!existing) return res.status(404).json({ error: "Supplier product not found" });

  const data = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Product name cannot be empty" });
    data.name = name;
  }
  if (req.body.sku !== undefined) data.sku = String(req.body.sku || "").trim() || null;
  if (req.body.unit !== undefined) data.unit = String(req.body.unit || "pcs").trim() || "pcs";
  if (req.body.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isInteger(price) || price < 0) return res.status(400).json({ error: "Price must be a whole TZS amount of 0 or greater" });
    data.price = price;
  }
  if (req.body.minOrderQty !== undefined) data.minOrderQty = Math.max(1, Number(req.body.minOrderQty) || 1);
  if (req.body.note !== undefined) data.note = String(req.body.note || "").trim() || null;
  if (req.body.isAvailable !== undefined) data.isAvailable = Boolean(req.body.isAvailable);

  const product = await prisma.supplierCatalogProduct.update({
    where: { id: existing.id },
    data,
  });

  req.audit = { action: "supplier.catalog.update", resourceType: "supplier_catalog_product", resourceId: product.id };
  res.json({ product });
});

const removePortalProduct = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const existing = await prisma.supplierCatalogProduct.findFirst({
    where: { id: req.params.productId, supplierId: supplierRecord.id },
  });
  if (!existing) return res.status(404).json({ error: "Supplier product not found" });

  const product = await prisma.supplierCatalogProduct.update({
    where: { id: existing.id },
    data: { isAvailable: false },
  });

  req.audit = { action: "supplier.catalog.remove", resourceType: "supplier_catalog_product", resourceId: product.id };
  res.json({ product, message: "Supplier product marked unavailable" });
});

// Supplier dashboard: sales/demand data for their customers
const supplierDashboard = asyncHandler(async (req, res) => {
  const supplierRecord = await getPortalSupplier(req.user);
  if (!supplierRecord) return res.status(404).json({ error: "Supplier profile not found" });

  const [orderStats, pendingOrders, topMerchants] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { supplierId: supplierRecord.id },
      _count: { id: true },
    }),
    prisma.order.findMany({
      where: { supplierId: supplierRecord.id, status: "PENDING" },
      include: {
        shop: { select: { name: true, location: true, district: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.order.groupBy({
      by: ["shopId"],
      where: { supplierId: supplierRecord.id, status: "DELIVERED" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  res.json({
    ordersByStatus: Object.fromEntries(orderStats.map((s) => [s.status, s._count.id])),
    pendingOrders,
    topMerchantIds: topMerchants.map((m) => m.shopId),
  });
});

module.exports = { list, get, create, update, importCatalogProduct, remove, myOrders, listPortalProducts, createPortalProduct, updatePortalProduct, removePortalProduct, supplierDashboard };

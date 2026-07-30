const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL,
  max: 3,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pin1234 = await bcrypt.hash("1234", 10);
  const adminSeedPin = process.env.SEED_ADMIN_PIN || process.env.ADMIN_PIN || "1234";
  const adminPinHash = await bcrypt.hash(adminSeedPin, 10);

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // ADMIN
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  await prisma.user.upsert({
    where: { phone: "+255743910580" },
    update: { pin: adminPinHash, role: "ADMIN", name: "Admin Uzuri Living" },
    create: { phone: "+255743910580", pin: adminPinHash, name: "Admin Uzuri Living", role: "ADMIN", language: "sw" },
  });
  await prisma.user.upsert({
    where: { phone: "+255713712057" },
    update: { pin: adminPinHash, role: "ADMIN", name: "Admin Uzuri Living 2" },
    create: { phone: "+255713712057", pin: adminPinHash, name: "Admin Uzuri Living 2", role: "ADMIN", language: "sw" },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER 1 â€” Jumla Traders Ltd  â˜… FEATURED SUPPLIER (all order statuses)
  //   Portal shows: PENDING order from Amina, CONFIRMED from Hassan,
  //   OUT_FOR_DELIVERY from Salum, DELIVERED (historical), CANCELLED
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const supplierUser = await prisma.user.upsert({
    where: { phone: "+255700000001" },
    update: {},
    create: { phone: "+255700000001", pin: pin1234, name: "Jumla Traders", role: "SUPPLIER", language: "sw" },
  });
  const supplier = await prisma.supplier.upsert({
    where: { userId: supplierUser.id },
    update: {},
    create: { name: "Jumla Traders Ltd", phone: "+255700000001", address: "Kariakoo, Dar es Salaam", userId: supplierUser.id },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER 2 â€” Rafiki Beverages Ltd (beverages wholesaler)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const supplierUser2 = await prisma.user.upsert({
    where: { phone: "+255700000006" },
    update: {},
    create: { phone: "+255700000006", pin: pin1234, name: "Rafiki Beverages", role: "SUPPLIER", language: "sw" },
  });
  const supplier2 = await prisma.supplier.upsert({
    where: { userId: supplierUser2.id },
    update: {},
    create: { name: "Rafiki Beverages Ltd", phone: "+255700000006", address: "Posta / Kisutu, Dar es Salaam", userId: supplierUser2.id },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER 3 â€” Beauty Supplies TZ (cosmetics wholesaler)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const supplierUser3 = await prisma.user.upsert({
    where: { phone: "+255700000007" },
    update: {},
    create: { phone: "+255700000007", pin: pin1234, name: "Beauty Supplies TZ", role: "SUPPLIER", language: "en" },
  });
  const supplier3 = await prisma.supplier.upsert({
    where: { userId: supplierUser3.id },
    update: {},
    create: { name: "Beauty Supplies TZ", phone: "+255700000007", address: "Ilala, Dar es Salaam", userId: supplierUser3.id },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // MERCHANT 1 â€” Duka la Amina  â˜… FEATURED MERCHANT (every scenario)
  //   Products   : good stock Â· low stock Â· out of stock Â· expiring soon Â·
  //                urgent expiry Â· doesNotExpire Â· wholesale price Â· high margin
  //   Sales      : all 7 payment methods Â· RETAIL + WHOLESALE pricing Â·
  //                POS + ONLINE channels Â· multi-item + single-item Â·
  //                today / week / older history
  //   Sup orders : PENDING Â· CONFIRMED Â· OUT_FOR_DELIVERY Â· DELIVERED Â· CANCELLED
  //   Cust orders: PENDING Â· CONFIRMED Â· OUT_FOR_DELIVERY Â· DELIVERED Â· CANCELLED
  //   Stock mvts : IN (delivery) Â· OUT (sale) Â· ADJUSTMENT (manual correction)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const merchantUser = await prisma.user.upsert({
    where: { phone: "+255700000002" },
    update: {},
    create: { phone: "+255700000002", pin: pin1234, name: "Mama Amina", role: "MERCHANT", language: "sw" },
  });
  const shop = await prisma.shop.upsert({
    where: { userId: merchantUser.id },
    update: {},
    create: { name: "Duka la Amina", location: "Mbagala", district: "Temeke", category: "grocery", userId: merchantUser.id, trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), plan: "FREE_TRIAL", isActive: true },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // MERCHANT 2 â€” Salum Pharmacy
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const merchantUser2 = await prisma.user.upsert({
    where: { phone: "+255700000003" },
    update: {},
    create: { phone: "+255700000003", pin: pin1234, name: "Bwana Salum", role: "MERCHANT", language: "en" },
  });
  const shop2 = await prisma.shop.upsert({
    where: { userId: merchantUser2.id },
    update: {},
    create: { name: "Salum Pharmacy", location: "Sinza", district: "Kinondoni", category: "pharmacy", userId: merchantUser2.id, trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), plan: "FREE_TRIAL", isActive: true },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // MERCHANT 3 â€” Hassan Bar & Wines (wholesale sales, bar category)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const merchantUser3 = await prisma.user.upsert({
    where: { phone: "+255700000004" },
    update: {},
    create: { phone: "+255700000004", pin: pin1234, name: "Hassan Juma", role: "MERCHANT", language: "sw" },
  });
  const shop3 = await prisma.shop.upsert({
    where: { userId: merchantUser3.id },
    update: {},
    create: { name: "Hassan Bar & Wines", location: "Buguruni", district: "Ilala", category: "bar", userId: merchantUser3.id, trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), plan: "FREE_TRIAL", isActive: true },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // MERCHANT 4 â€” Fatuma Beauty Shop (online channel, out-of-stock scenario)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const merchantUser4 = await prisma.user.upsert({
    where: { phone: "+255700000005" },
    update: {},
    create: { phone: "+255700000005", pin: pin1234, name: "Fatuma Ally", role: "MERCHANT", language: "sw" },
  });
  const shop4 = await prisma.shop.upsert({
    where: { userId: merchantUser4.id },
    update: {},
    create: { name: "Fatuma Beauty Shop", location: "Tegeta", district: "Kinondoni", category: "beauty", userId: merchantUser4.id, trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), plan: "FREE_TRIAL", isActive: true },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // DATE HELPERS
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  const daysAgo     = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  const expiryUrgent = daysFromNow(5);   // 5 days  â€” very urgent
  const expirySoon   = daysFromNow(14);  // 14 days â€” dashboard warning
  const expiryFar    = daysFromNow(180); // 6 months â€” healthy

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // PRODUCTS â€” Duka la Amina  (every stock/expiry scenario)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const productDefs = [
    // [0] GOOD STOCK Â· wholesale price Â· doesNotExpire
    { name: "Unga wa Sembe (2kg)", sku: "UNG001", unit: "bag",
      buyingPrice: 2800, sellingPrice: 3200, wholesalePrice: 2950, wholesaleMinQty: 10,
      currentStock: 30, minimumStock: 10, doesNotExpire: true },
    // [1] LOW STOCK (4 < min 10) Â· wholesale Â· doesNotExpire
    { name: "Mchele (1kg)", sku: "MCH001", unit: "kg",
      buyingPrice: 1800, sellingPrice: 2200, wholesalePrice: 1950, wholesaleMinQty: 5,
      currentStock: 4, minimumStock: 10, doesNotExpire: true },
    // [2] GOOD STOCK Â· expiry 6 months Â· no wholesale
    { name: "Mafuta ya Kupikia (1L)", sku: "MAF001", unit: "litre",
      buyingPrice: 3500, sellingPrice: 4000,
      currentStock: 12, minimumStock: 5, expiryDate: expiryFar },
    // [3] LOW STOCK (3 < min 8) Â· wholesale Â· doesNotExpire
    { name: "Sukari (1kg)", sku: "SUK001", unit: "kg",
      buyingPrice: 2200, sellingPrice: 2600, wholesalePrice: 2300, wholesaleMinQty: 5,
      currentStock: 3, minimumStock: 8, doesNotExpire: true },
    // [4] GOOD STOCK Â· doesNotExpire Â· no wholesale
    { name: "Sabuni ya Kufulia (bar)", sku: "SAB001", unit: "bar",
      buyingPrice: 600, sellingPrice: 800,
      currentStock: 25, minimumStock: 10, doesNotExpire: true },
    // [5] GOOD STOCK Â· doesNotExpire Â· no wholesale
    { name: "Chumvi (500g)", sku: "CHU001", unit: "pkt",
      buyingPrice: 300, sellingPrice: 500,
      currentStock: 20, minimumStock: 10, doesNotExpire: true },
    // [6] EXPIRING SOON (14 days) Â· no wholesale
    { name: "Maziwa Freshi (500ml)", sku: "MAZ001", unit: "pcs",
      buyingPrice: 1000, sellingPrice: 1300,
      currentStock: 8, minimumStock: 5, expiryDate: expirySoon },
    // [7] GOOD STOCK Â· wholesale (bulk buyer) Â· doesNotExpire
    { name: "Soda (Fanta 300ml)", sku: "SOD001", unit: "pcs",
      buyingPrice: 700, sellingPrice: 1000, wholesalePrice: 750, wholesaleMinQty: 24,
      currentStock: 48, minimumStock: 12, doesNotExpire: true },
    // [8] GOOD STOCK Â· wholesale Â· doesNotExpire (eggs tray â€” doesNotExpire edge case)
    { name: "Mayai (tray 30)", sku: "MAY001", unit: "tray",
      buyingPrice: 7500, sellingPrice: 9000, wholesalePrice: 8000, wholesaleMinQty: 5,
      currentStock: 10, minimumStock: 3, doesNotExpire: true },
    // [9] URGENT EXPIRY (5 days) Â· fresh produce Â· no wholesale
    { name: "Nyanya (kg)", sku: "NYA001", unit: "kg",
      buyingPrice: 1000, sellingPrice: 1500,
      currentStock: 15, minimumStock: 5, expiryDate: expiryUrgent },
    // [10] OUT OF STOCK (0) Â· no wholesale â€” depleted scenario
    { name: "Uji wa Mtoto (500g)", sku: "UJI001", unit: "pkt",
      buyingPrice: 1800, sellingPrice: 2500,
      currentStock: 0, minimumStock: 10, expiryDate: expiryFar },
    // [11] HIGH MARGIN (100%+) Â· good stock Â· doesNotExpire
    { name: "Siagi (Blue Band 250g)", sku: "SIA001", unit: "pcs",
      buyingPrice: 2000, sellingPrice: 4200,
      currentStock: 18, minimumStock: 5, doesNotExpire: true },
  ];

  const products = [];
  for (const def of productDefs) {
    const p = await prisma.product.upsert({
      where: { id: `seed-${def.sku}` },
      update: {},
      create: { id: `seed-${def.sku}`, shopId: shop.id, supplierId: supplier.id, ...def },
    });
    products.push(p);
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // PRODUCTS â€” Salum Pharmacy
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const pharmDefs = [
    { name: "Panadol (tab x 10)", sku: "PAN001", unit: "pkt",
      buyingPrice: 500, sellingPrice: 800, currentStock: 50, minimumStock: 20, expiryDate: expiryFar },
    { name: "ORS Sachet", sku: "ORS001", unit: "pcs",
      buyingPrice: 200, sellingPrice: 400, currentStock: 100, minimumStock: 30, expiryDate: expiryFar },
    { name: "Vitamin C 500mg", sku: "VTC001", unit: "pcs",
      buyingPrice: 800, sellingPrice: 1200, currentStock: 2, minimumStock: 10, expiryDate: expiryFar },
    { name: "Malaria Test Kit (RDT)", sku: "MLR001", unit: "pcs",
      buyingPrice: 1500, sellingPrice: 3500, currentStock: 30, minimumStock: 10, expiryDate: expiryFar },
    { name: "Bandage Roll (5cm)", sku: "BND001", unit: "pcs",
      buyingPrice: 700, sellingPrice: 1200, currentStock: 0, minimumStock: 15, expiryDate: expiryFar },
  ];
  const pharmProducts = [];
  for (const def of pharmDefs) {
    const p = await prisma.product.upsert({
      where: { id: `seed-${def.sku}` },
      update: {},
      create: { id: `seed-${def.sku}`, shopId: shop2.id, supplierId: supplier.id, ...def },
    });
    pharmProducts.push(p);
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // PRODUCTS â€” Hassan Bar & Wines
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const barDefs = [
    { name: "Safari Lager (crate 24)", sku: "BEE001", unit: "crate",
      buyingPrice: 28000, sellingPrice: 36000, wholesalePrice: 30000, wholesaleMinQty: 3,
      currentStock: 15, minimumStock: 5, doesNotExpire: true },
    { name: "Konyagi (350ml)", sku: "KON001", unit: "pcs",
      buyingPrice: 3500, sellingPrice: 5500, wholesalePrice: 4000, wholesaleMinQty: 12,
      currentStock: 40, minimumStock: 10, doesNotExpire: true },
    { name: "Coca-Cola (crate 24)", sku: "COK001", unit: "crate",
      buyingPrice: 22000, sellingPrice: 28800, wholesalePrice: 24000, wholesaleMinQty: 3,
      currentStock: 2, minimumStock: 5, doesNotExpire: true },
    { name: "Chips (Pringles 150g)", sku: "CHI001", unit: "pcs",
      buyingPrice: 3000, sellingPrice: 4500, currentStock: 20, minimumStock: 8, expiryDate: expirySoon },
  ];
  const barProducts = [];
  for (const def of barDefs) {
    const p = await prisma.product.upsert({
      where: { id: `seed-${def.sku}` },
      update: {},
      create: { id: `seed-${def.sku}`, shopId: shop3.id, supplierId: supplier2.id, ...def },
    });
    barProducts.push(p);
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // PRODUCTS â€” Fatuma Beauty Shop
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const beautyDefs = [
    { name: "Dark & Lovely Relaxer Kit", sku: "RLX001", unit: "pcs",
      buyingPrice: 6500, sellingPrice: 9500, wholesalePrice: 7500, wholesaleMinQty: 6,
      currentStock: 12, minimumStock: 5, expiryDate: expiryFar },
    { name: "Vaseline Body Lotion (400ml)", sku: "LOT001", unit: "pcs",
      buyingPrice: 4000, sellingPrice: 6000, currentStock: 3, minimumStock: 10, expiryDate: expiryFar },
    { name: "Nivea Lip Balm", sku: "LIP001", unit: "pcs",
      buyingPrice: 1500, sellingPrice: 2500, currentStock: 0, minimumStock: 10, expiryDate: expiryFar },
    { name: "Nail Polish (OPI 15ml)", sku: "NAL001", unit: "pcs",
      buyingPrice: 3500, sellingPrice: 6000, currentStock: 18, minimumStock: 5, doesNotExpire: true },
  ];
  const beautyProducts = [];
  for (const def of beautyDefs) {
    const p = await prisma.product.upsert({
      where: { id: `seed-${def.sku}` },
      update: {},
      create: { id: `seed-${def.sku}`, shopId: shop4.id, supplierId: supplier3.id, ...def },
    });
    beautyProducts.push(p);
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SALES â€” Duka la Amina  (all 7 payment methods, both pricing tiers, both channels)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  const salesData = [
    // 13 days ago â€” CASH Â· RETAIL Â· POS Â· single item (old history)
    { createdAt: daysAgo(13), paymentMethod: "CASH", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[4], qty: 5 }] },
    // 10 days ago â€” BANK Â· WHOLESALE Â· POS Â· multi-item (bulk buyer, two weeks back)
    { createdAt: daysAgo(10), paymentMethod: "BANK", pricingTier: "WHOLESALE", channel: "POS",
      items: [{ product: products[0], qty: 15 }, { product: products[7], qty: 48 }] },
    // 8 days ago â€” CREDIT Â· RETAIL Â· POS (credit sale scenario)
    { createdAt: daysAgo(8), paymentMethod: "CREDIT", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[2], qty: 2 }, { product: products[5], qty: 10 }] },
    // 6 days ago â€” CASH Â· RETAIL Â· POS
    { createdAt: daysAgo(6), paymentMethod: "CASH", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[0], qty: 2 }, { product: products[3], qty: 1 }] },
    // 5 days ago â€” MPESA Â· RETAIL Â· POS
    { createdAt: daysAgo(5), paymentMethod: "MPESA", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[2], qty: 1 }, { product: products[4], qty: 3 }] },
    // 4 days ago â€” TIGOPESA Â· RETAIL Â· POS
    { createdAt: daysAgo(4), paymentMethod: "TIGOPESA", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[5], qty: 5 }, { product: products[1], qty: 2 }] },
    // 3 days ago â€” AIRTEL_MONEY Â· RETAIL Â· ONLINE (customer placed order online)
    { createdAt: daysAgo(3), paymentMethod: "AIRTEL_MONEY", pricingTier: "RETAIL", channel: "ONLINE",
      items: [{ product: products[8], qty: 1 }, { product: products[11], qty: 2 }] },
    // 2 days ago â€” HALOPESA Â· RETAIL Â· POS (CRDB mobile money)
    { createdAt: daysAgo(2), paymentMethod: "HALOPESA", pricingTier: "RETAIL", channel: "POS",
      items: [{ product: products[6], qty: 2 }, { product: products[9], qty: 3 }] },
    // yesterday â€” BANK Â· WHOLESALE Â· POS (second wholesale, different items)
    { createdAt: daysAgo(1), paymentMethod: "BANK", pricingTier: "WHOLESALE", channel: "POS",
      items: [{ product: products[0], qty: 10 }, { product: products[3], qty: 5 }] },
    // today â€” MPESA Â· RETAIL Â· ONLINE (online channel, high-margin product)
    { createdAt: daysAgo(0), paymentMethod: "MPESA", pricingTier: "RETAIL", channel: "ONLINE",
      items: [{ product: products[11], qty: 1 }, { product: products[8], qty: 2 }, { product: products[0], qty: 1 }] },
  ];

  for (const s of salesData) {
    const pricingTier = s.pricingTier || "RETAIL";
    let totalAmount = 0;
    let profit = 0;
    const items = s.items.map(({ product, qty }) => {
      const unitPrice = pricingTier === "WHOLESALE" && product.wholesalePrice
        ? product.wholesalePrice : product.sellingPrice;
      const total = unitPrice * qty;
      totalAmount += total;
      profit += (unitPrice - product.buyingPrice) * qty;
      return { quantity: qty, unitPrice, buyingPrice: product.buyingPrice, totalPrice: total, productId: product.id };
    });
    await prisma.sale.create({
      data: { shopId: shop.id, totalAmount, profit, paymentMethod: s.paymentMethod,
        channel: s.channel, pricingTier, createdAt: s.createdAt, items: { create: items } },
    });
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SALES â€” Hassan Bar & Wines (wholesale)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  for (const [wsItems, paymentMethod, note, daysBack] of [
    [[{ product: barProducts[0], qty: 4 }, { product: barProducts[1], qty: 24 }], "BANK",  "Minibar Buguruni â€” bulk order", 2],
    [[{ product: barProducts[0], qty: 3 }, { product: barProducts[2], qty: 2 }], "MPESA", "Resto Buguruni â€” vitu vya wiki",  0],
  ]) {
    let totalAmount = 0; let profit = 0;
    const items = wsItems.map(({ product, qty }) => {
      const unitPrice = product.wholesalePrice;
      const total = unitPrice * qty;
      totalAmount += total;
      profit += (unitPrice - product.buyingPrice) * qty;
      return { quantity: qty, unitPrice, buyingPrice: product.buyingPrice, totalPrice: total, productId: product.id };
    });
    await prisma.sale.create({
      data: { shopId: shop3.id, totalAmount, profit, paymentMethod, channel: "POS", pricingTier: "WHOLESALE",
        note, createdAt: daysAgo(daysBack), items: { create: items } },
    });
  }

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER ORDERS â€” Duka la Amina â†’ Jumla Traders  (ALL 5 statuses)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

  // 1. PENDING â€” rice + sugar urgent restock (low-stock products)
  await prisma.order.create({
    data: {
      shopId: shop.id, supplierId: supplier.id, status: "PENDING",
      totalAmount: 28000, note: "Haraka â€” mchele na sukari vimeisha karibu",
      createdAt: daysAgo(0),
      items: { create: [
        { productId: products[1].id, quantity: 20, unitPrice: 1800 }, // rice â€” low stock
        { productId: products[3].id, quantity: 10, unitPrice: 2200 }, // sugar â€” low stock
      ]},
    },
  });

  // 2. CONFIRMED â€” flour + soda confirmed by Jumla Traders, awaiting dispatch
  await prisma.order.create({
    data: {
      shopId: shop.id, supplierId: supplier.id, status: "CONFIRMED",
      totalAmount: 72000, note: "Agizo la wiki â€” Jumla wamethibitisha",
      createdAt: daysAgo(2),
      items: { create: [
        { productId: products[0].id, quantity: 20, unitPrice: 2800 }, // flour
        { productId: products[7].id, quantity: 24, unitPrice: 700  }, // soda
      ]},
    },
  });

  // 3. OUT_FOR_DELIVERY â€” cooking oil + salt on the way
  await prisma.order.create({
    data: {
      shopId: shop.id, supplierId: supplier.id, status: "OUT_FOR_DELIVERY",
      totalAmount: 53000, note: "Gari iko njiani â€” mafuta na chumvi",
      createdAt: daysAgo(4),
      items: { create: [
        { productId: products[2].id, quantity: 10, unitPrice: 3500 }, // cooking oil
        { productId: products[5].id, quantity: 30, unitPrice: 300  }, // salt
      ]},
    },
  });

  // 4. DELIVERED â€” soap + baby porridge received last week (also creates stock IN movements)
  const deliveredOrder = await prisma.order.create({
    data: {
      shopId: shop.id, supplierId: supplier.id, status: "DELIVERED",
      totalAmount: 19500, note: "Received â€” sabuni na uji",
      createdAt: daysAgo(9),
      items: { create: [
        { productId: products[4].id,  quantity: 15, unitPrice: 600  }, // soap
        { productId: products[10].id, quantity: 10, unitPrice: 1800 }, // baby porridge (now back in stock from this)
      ]},
    },
  });
  // Stock IN movements for the delivered order
  await prisma.stockMovement.create({
    data: { type: "IN", quantity: 15, productId: products[4].id,
      note: `Order delivery #${deliveredOrder.id.slice(-6)}` },
  });
  await prisma.stockMovement.create({
    data: { type: "IN", quantity: 10, productId: products[10].id,
      note: `Order delivery #${deliveredOrder.id.slice(-6)}` },
  });

  // 5. CANCELLED â€” old tomato order cancelled because supplier couldn't supply
  await prisma.order.create({
    data: {
      shopId: shop.id, supplierId: supplier.id, status: "CANCELLED",
      totalAmount: 15000, note: "Ilifutwa â€” msambazaji hakuwa na nyanya",
      createdAt: daysAgo(14),
      items: { create: [
        { productId: products[9].id, quantity: 15, unitPrice: 1000 }, // tomatoes
      ]},
    },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER ORDERS â€” other merchants â†’ Jumla Traders
  // (so Jumla's portal shows orders from multiple shops)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

  // Salum Pharmacy â†’ Jumla Traders â€” CONFIRMED (Panadol restock)
  await prisma.order.create({
    data: {
      shopId: shop2.id, supplierId: supplier.id, status: "CONFIRMED",
      totalAmount: 50000, note: "Panadol na ORS restock",
      createdAt: daysAgo(1),
      items: { create: [
        { productId: pharmProducts[0].id, quantity: 50, unitPrice: 500 },
        { productId: pharmProducts[1].id, quantity: 100, unitPrice: 200 },
      ]},
    },
  });

  // Salum Pharmacy â†’ Jumla Traders â€” OUT_FOR_DELIVERY (Vitamin C on the way)
  await prisma.order.create({
    data: {
      shopId: shop2.id, supplierId: supplier.id, status: "OUT_FOR_DELIVERY",
      totalAmount: 16000, note: "Vitamin C iko njiani",
      createdAt: daysAgo(3),
      items: { create: [
        { productId: pharmProducts[2].id, quantity: 20, unitPrice: 800 },
      ]},
    },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUPPLIER ORDERS â€” other merchants (Hassan, Fatuma) â†’ their own suppliers
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

  // Hassan Bar â†’ Rafiki Beverages â€” PENDING (urgent Coke restock)
  await prisma.order.create({
    data: {
      shopId: shop3.id, supplierId: supplier2.id, status: "PENDING",
      totalAmount: 130000, note: "Haraka â€” Coca-Cola imekwisha",
      createdAt: daysAgo(0),
      items: { create: [
        { productId: barProducts[0].id, quantity: 5,  unitPrice: 28000 },
        { productId: barProducts[2].id, quantity: 10, unitPrice: 22000 },
      ]},
    },
  });

  // Fatuma Beauty â†’ Beauty Supplies TZ â€” PENDING (lotion + lip balm out of stock)
  await prisma.order.create({
    data: {
      shopId: shop4.id, supplierId: supplier3.id, status: "PENDING",
      totalAmount: 81500, note: "Lotion na Lip Balm imekwisha â€” haraka",
      createdAt: daysAgo(0),
      items: { create: [
        { productId: beautyProducts[1].id, quantity: 20, unitPrice: 4000 },
        { productId: beautyProducts[2].id, quantity: 15, unitPrice: 1500 },
      ]},
    },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // CUSTOMER ORDERS â€” Duka la Amina  (ALL 5 statuses)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

  // 1. PENDING â€” new online order, not yet reviewed by Amina
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "Ali Hassan", customerPhone: "+255712000111",
      status: "PENDING", totalAmount: 8200,
      note: "Tuma Mbagala Rangi Tatu, duka la Mama Zena",
      createdAt: daysAgo(0),
      items: { create: [
        { productId: products[0].id, quantity: 2, unitPrice: 3200, pricingTier: "RETAIL" },
        { productId: products[5].id, quantity: 4, unitPrice: 500,  pricingTier: "RETAIL" },
      ]},
    },
  });

  // 2. CONFIRMED â€” Amina accepted, stock reserved, awaiting packing
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "John Mwangi", customerPhone: "+255712345678",
      status: "CONFIRMED", totalAmount: 9400,
      note: "Peleka Mbagala bus stand",
      createdAt: daysAgo(1),
      items: { create: [
        { productId: products[0].id, quantity: 2, unitPrice: 3200, pricingTier: "RETAIL" },
        { productId: products[2].id, quantity: 1, unitPrice: 4000, pricingTier: "RETAIL" },
      ]},
    },
  });

  // 3. CONFIRMED (second) â€” eggs + tomatoes fresh produce delivery order
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "Neema Shaban", customerPhone: "+255789001122",
      status: "CONFIRMED", totalAmount: 22500,
      note: "Peleka Mbagala Rangi Tatu, karibu na kanisa",
      createdAt: daysAgo(1),
      items: { create: [
        { productId: products[8].id, quantity: 2, unitPrice: 9000, pricingTier: "RETAIL" }, // eggs
        { productId: products[9].id, quantity: 3, unitPrice: 1500, pricingTier: "RETAIL" }, // tomatoes
      ]},
    },
  });

  // 4. OUT_FOR_DELIVERY â€” driver has picked up the order
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "Grace Mwacha", customerPhone: "+255754888777",
      status: "OUT_FOR_DELIVERY", totalAmount: 15600,
      note: "Mbagala Kwa Azizi â€” maziwa na sabuni",
      createdAt: daysAgo(2),
      items: { create: [
        { productId: products[6].id, quantity: 4, unitPrice: 1300, pricingTier: "RETAIL" }, // milk
        { productId: products[4].id, quantity: 9, unitPrice: 800,  pricingTier: "RETAIL" }, // soap
      ]},
    },
  });

  // 5. DELIVERED â€” completed wholesale online order
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "Jumanne Kipanga", customerPhone: "+255765444333",
      status: "DELIVERED", totalAmount: 42600,
      note: "Imetolewa â€” unga na soda kwa jumla",
      createdAt: daysAgo(5),
      items: { create: [
        { productId: products[0].id, quantity: 10, unitPrice: 2950, pricingTier: "WHOLESALE" }, // flour wholesale
        { productId: products[7].id, quantity: 24, unitPrice: 750,  pricingTier: "WHOLESALE" }, // soda wholesale
      ]},
    },
  });

  // 6. CANCELLED â€” customer changed their mind
  await prisma.customerOrder.create({
    data: {
      shopId: shop.id, customerName: "Said Othman", customerPhone: "+255700999888",
      status: "CANCELLED", totalAmount: 5400,
      note: "Ilifutwa â€” mteja alibadili mawazo",
      createdAt: daysAgo(7),
      items: { create: [
        { productId: products[1].id, quantity: 3, unitPrice: 2200, pricingTier: "RETAIL" }, // rice
      ]},
    },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // CUSTOMER ORDERS â€” Hassan Bar (CONFIRMED + PENDING)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  await prisma.customerOrder.create({
    data: {
      shopId: shop3.id, customerName: "Musa Omari", customerPhone: "+255765009988",
      status: "CONFIRMED", totalAmount: 13500,
      note: "Deliver to Buguruni Market, table 4",
      createdAt: daysAgo(0),
      items: { create: [
        { productId: barProducts[3].id, quantity: 2, unitPrice: 4500, pricingTier: "RETAIL" },
        { productId: barProducts[1].id, quantity: 2, unitPrice: 5500, pricingTier: "RETAIL" },
      ]},
    },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // STOCK MOVEMENTS â€” Duka la Amina  (IN Â· OUT Â· ADJUSTMENT)
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // These supplement the sale-generated OUT movements and delivery IN movements above.

  // ADJUSTMENT â€” counted flour during stocktake, found 2 bags more than recorded
  await prisma.stockMovement.create({
    data: { type: "ADJUSTMENT", quantity: 32, productId: products[0].id,
      note: "Uhesabuji wa bidhaa â€” zipatikane zaidi (2 magunia)" },
  });

  // OUT â€” 3 milks sold directly at counter (not via POS, manual record)
  await prisma.stockMovement.create({
    data: { type: "OUT", quantity: 3, productId: products[6].id,
      note: "Mauzo ya haraka â€” bila risiti" },
  });

  // IN â€” returned 5 soaps from a cancelled order (reshelved)
  await prisma.stockMovement.create({
    data: { type: "IN", quantity: 5, productId: products[4].id,
      note: "Bidhaa zilizorudishwa â€” agizo lililofutwa" },
  });

  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  // SUMMARY
  // â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
  console.log("Seed complete");
  console.log("+------------------------------------------------------------------+");
  console.log("|                   TEST LOGIN CREDENTIALS                        |");
  console.log("+------------------------------------------------------------------+");
  console.log("| ADMIN      credentials are intentionally not printed.             |");
  console.log("|                                                                  |");
  console.log("| MERCHANT   +255700000002  PIN: 1234   *** FEATURED MERCHANT ***  |");
  console.log("|  Duka la Amina (grocery, Temeke/Mbagala)                        |");
  console.log("|  12 products: good/low/out-of-stock, expiring-soon, urgent-     |");
  console.log("|    expiry, doesNotExpire, wholesale, high-margin                |");
  console.log("|  10 sales: all 7 payment methods, RETAIL+WHOLESALE, POS+ONLINE  |");
  console.log("|  5 supplier orders: PENDING/CONFIRMED/OUT_FOR_DELIVERY/         |");
  console.log("|    DELIVERED/CANCELLED                                          |");
  console.log("|  6 customer orders: PENDING/CONFIRMED(x2)/OUT_FOR_DELIVERY/     |");
  console.log("|    DELIVERED/CANCELLED                                          |");
  console.log("|  3 stock movements: IN/OUT/ADJUSTMENT                           |");
  console.log("|                                                                  |");
  console.log("| MERCHANT   +255700000003  PIN: 1234                              |");
  console.log("|  Salum Pharmacy (Kinondoni/Sinza) â€” 5 products                  |");
  console.log("|                                                                  |");
  console.log("| MERCHANT   +255700000004  PIN: 1234                              |");
  console.log("|  Hassan Bar & Wines (Ilala/Buguruni) â€” 4 products               |");
  console.log("|  2 wholesale sales | 1 PENDING order | 1 CONFIRMED customer ord  |");
  console.log("|                                                                  |");
  console.log("| MERCHANT   +255700000005  PIN: 1234                              |");
  console.log("|  Fatuma Beauty Shop (Kinondoni/Tegeta) â€” 4 products              |");
  console.log("|  1 PENDING restock order                                        |");
  console.log("|                                                                  |");
  console.log("| SUPPLIER   +255700000001  PIN: 1234   *** FEATURED SUPPLIER ***  |");
  console.log("|  Jumla Traders Ltd (Kariakoo)                                   |");
  console.log("|  Portal: orders from Amina (PENDING/CONFIRMED/OUT_FOR_DELIVERY/ |");
  console.log("|    DELIVERED/CANCELLED) + Salum (CONFIRMED/OUT_FOR_DELIVERY)    |");
  console.log("|                                                                  |");
  console.log("| SUPPLIER   +255700000006  PIN: 1234                              |");
  console.log("|  Rafiki Beverages Ltd (Posta) â€” Hassan's supplier               |");
  console.log("|                                                                  |");
  console.log("| SUPPLIER   +255700000007  PIN: 1234                              |");
  console.log("|  Beauty Supplies TZ (Ilala) â€” Fatuma's supplier                 |");
  console.log("+------------------------------------------------------------------+");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

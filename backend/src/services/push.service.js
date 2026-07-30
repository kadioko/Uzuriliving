const webpush = require("web-push");
const prisma = require("../lib/prisma");
const { isSubscriptionActive } = require("../middleware/subscription");

const DAY_MS = 24 * 60 * 60 * 1000;

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function configureWebPush() {
  if (!configured()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
}

function retryAt(attemptCount) {
  const minutes = Math.min(60 * 24, 2 ** Math.max(0, attemptCount - 1) * 5);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function queueForShop(shopId, kind, message) {
  const since = new Date(Date.now() - DAY_MS);
  const alreadyQueued = await prisma.pushDelivery.findFirst({
    where: { shopId, kind, createdAt: { gte: since }, status: { in: ["QUEUED", "RETRYING", "SENT"] } },
    select: { id: true },
  });
  if (alreadyQueued) return false;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { shopId, isActive: true },
    select: { id: true },
  });
  if (!subscriptions.length) return false;

  await prisma.pushDelivery.createMany({
    data: subscriptions.map((subscription) => ({ shopId, subscriptionId: subscription.id, kind, ...message })),
  });
  return true;
}

async function queueShopAlerts() {
  const shops = await prisma.shop.findMany({
    select: {
      id: true,
      plan: true,
      trialEndsAt: true,
      subscriptionEndsAt: true,
      isActive: true,
      notificationPreference: true,
      products: { where: { isActive: true }, select: { name: true, currentStock: true, minimumStock: true } },
      debts: { where: { status: { in: ["OPEN", "PARTIAL"] } }, select: { amount: true, amountPaid: true, dueDate: true } },
      assistantActions: { where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 1, select: { title: true, href: true } },
    },
  });
  let queued = 0;
  const now = new Date();
  const expiryWindow = new Date(now.getTime() + 7 * DAY_MS);

  for (const shop of shops) {
    const preference = shop.notificationPreference || { lowStock: true, debtDue: true, subscriptionExpiry: true, dailyAssistant: false };
    const lowStock = shop.products.filter((product) => product.currentStock <= product.minimumStock);
    if (preference.lowStock && lowStock.length) {
      queued += Number(await queueForShop(shop.id, "LOW_STOCK", {
        title: "Uzuri Living: stock needs attention",
        body: `${lowStock[0].name}${lowStock.length > 1 ? ` and ${lowStock.length - 1} more item${lowStock.length === 2 ? "" : "s"}` : ""} need restocking.`,
        href: "/inventory?lowStock=true",
      }));
    }

    const overdue = shop.debts.filter((debt) => debt.dueDate && debt.dueDate <= now);
    if (preference.debtDue && overdue.length) {
      const outstanding = overdue.reduce((total, debt) => total + debt.amount - debt.amountPaid, 0);
      queued += Number(await queueForShop(shop.id, "DEBT_DUE", {
        title: "Uzuri Living: collect customer debt",
        body: `TZS ${outstanding.toLocaleString("en-TZ")} is due from ${overdue.length} customer${overdue.length === 1 ? "" : "s"}.`,
        href: "/debts?status=open",
      }));
    }

    const expiry = shop.plan === "FREE_TRIAL" ? shop.trialEndsAt : shop.subscriptionEndsAt;
    if (preference.subscriptionExpiry && (!isSubscriptionActive(shop) || (expiry && expiry <= expiryWindow))) {
      queued += Number(await queueForShop(shop.id, "SUBSCRIPTION", {
        title: "Uzuri Living: subscription action needed",
        body: !isSubscriptionActive(shop) ? "Your shop needs reactivation to keep recording sales." : "Your plan ends soon. Send payment details to keep the shop active.",
        href: "/billing",
      }));
    }

    const action = shop.assistantActions[0];
    if (preference.dailyAssistant && action) {
      queued += Number(await queueForShop(shop.id, "DAILY_ASSISTANT", {
        title: "Uzuri Living AI priority",
        body: action.title,
        href: action.href || "/assistant",
      }));
    }
  }
  return queued;
}

async function processPushDeliveries(limit = 100) {
  if (!configureWebPush()) return { configured: false, processed: 0, sent: 0, failed: 0 };
  const now = new Date();
  const deliveries = await prisma.pushDelivery.findMany({
    where: {
      status: { in: ["QUEUED", "RETRYING"] },
      OR: [{ retryAt: null }, { retryAt: { lte: now } }],
    },
    include: { subscription: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(Number(limit) || 100, 1), 500),
  });
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const subscription = delivery.subscription;
    if (!subscription || !subscription.isActive) {
      await prisma.pushDelivery.update({ where: { id: delivery.id }, data: { status: "SKIPPED", lastError: "Inactive subscription" } });
      continue;
    }
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: delivery.title, body: delivery.body, href: delivery.href, tag: delivery.kind }));
      await prisma.$transaction([
        prisma.pushDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt: new Date(), attemptCount: { increment: 1 }, lastError: null } }),
        prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastSeenAt: new Date(), failureCount: 0 } }),
      ]);
      sent += 1;
    } catch (error) {
      const statusCode = Number(error.statusCode || error.status);
      const terminal = statusCode === 404 || statusCode === 410 || delivery.attemptCount >= 4;
      await prisma.$transaction([
        prisma.pushDelivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "RETRYING", attemptCount: { increment: 1 }, lastError: String(error.message || "Push delivery failed").slice(0, 500), retryAt: terminal ? null : retryAt(delivery.attemptCount + 1) } }),
        prisma.pushSubscription.update({ where: { id: subscription.id }, data: terminal ? { isActive: false, failureCount: { increment: 1 } } : { failureCount: { increment: 1 } } }),
      ]);
      failed += 1;
    }
  }
  return { configured: true, processed: deliveries.length, sent, failed };
}

module.exports = { configured, queueShopAlerts, processPushDeliveries };

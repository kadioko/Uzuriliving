const prisma = require("../lib/prisma");
const { getShopIdForUser } = require("../lib/shopAccess");

function isSubscriptionActive(shop) {
  const now = new Date();
  const trialActive = shop.plan === "FREE_TRIAL" && shop.trialEndsAt && shop.trialEndsAt > now;
  const subActive = shop.subscriptionEndsAt && shop.subscriptionEndsAt > now;
  return Boolean(shop.isActive && (trialActive || subActive));
}

function requireActiveSubscription(req, res, next) {
  if (req.user.role === "ADMIN") return next();
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) return next();

  Promise.resolve()
    .then(async () => {
      const shopId = await getShopIdForUser(req.user);
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, name: true, plan: true, trialEndsAt: true, subscriptionEndsAt: true, isActive: true },
      });
      if (!shop) return res.status(404).json({ error: "Shop not found" });
      if (isSubscriptionActive(shop)) return next();

      return res.status(402).json({
        error: "Subscription required",
        code: "SUBSCRIPTION_REQUIRED",
        message: "Your Uzuri Living trial or subscription has expired. Contact support on WhatsApp to reactivate your shop.",
        whatsapp: "https://wa.me/255743910580",
      });
    })
    .catch(next);
}

module.exports = { requireActiveSubscription, isSubscriptionActive };

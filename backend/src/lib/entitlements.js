const prisma = require("./prisma");
const { getShopIdForUser } = require("./shopAccess");

const PLAN_FEATURES = {
  BASIC: new Set(["CORE", "EXPORTS"]),
  PRO: new Set(["CORE", "EXPORTS", "STAFF", "ASSISTANT"]),
};

function activePlan(shop, now = new Date()) {
  if (!shop?.isActive) return null;
  if (shop.plan === "FREE_TRIAL" && shop.trialEndsAt && shop.trialEndsAt > now) return "FREE_TRIAL";
  if (shop.subscriptionEndsAt && shop.subscriptionEndsAt > now) return shop.plan;
  return null;
}

function canUseFeature(shop, feature, now = new Date()) {
  const plan = activePlan(shop, now);
  if (plan === "FREE_TRIAL") return true;
  return Boolean(plan && PLAN_FEATURES[plan]?.has(feature));
}

function featureSnapshot(shop) {
  return {
    staff: canUseFeature(shop, "STAFF"),
    assistant: canUseFeature(shop, "ASSISTANT"),
    exports: canUseFeature(shop, "EXPORTS"),
  };
}

function requireFeature(feature) {
  return async (req, res, next) => {
    if (req.user.role === "ADMIN") return next();
    try {
      const shopId = await getShopIdForUser(req.user);
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { plan: true, trialEndsAt: true, subscriptionEndsAt: true, isActive: true },
      });
      if (canUseFeature(shop, feature)) return next();
      return res.status(403).json({
        error: "Pro plan required",
        code: "PLAN_UPGRADE_REQUIRED",
        feature,
        message: "This feature is available on Uzuri Living Pro. Upgrade your plan or contact support.",
        whatsapp: "https://wa.me/255743910580",
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { activePlan, canUseFeature, featureSnapshot, requireFeature };

import type { MetadataRoute } from "next";

const SITE_URL = "https://www.uzuriliving.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/pricing",
          "/catalog",
          "/contact",
          "/help",
          "/demo",
          "/onboarding",
          "/privacy",
          "/terms",
          "/delete-account",
        ],
        disallow: [
          "/admin",
          "/assistant",
          "/billing",
          "/dashboard",
          "/debts",
          "/expenses",
          "/inventory",
          "/notifications",
          "/orders",
          "/reports",
          "/sales",
          "/settings",
          "/staff",
          "/supplier",
          "/suppliers",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";

const SITE_URL = "https://www.uzuriliving.com";

const publicRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.95, changeFrequency: "weekly" },
  { path: "/catalog", priority: 0.85, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
  { path: "/help", priority: 0.8, changeFrequency: "weekly" },
  { path: "/demo", priority: 0.75, changeFrequency: "monthly" },
  { path: "/onboarding", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.5, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.5, changeFrequency: "yearly" },
  { path: "/delete-account", priority: 0.45, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uzuri Living Onboarding - Set Up Your Shop, Products, Staff, and Catalog",
  description:
    "Start Uzuri Living with a guided shop setup checklist: shop details, first products, staff, first sale, catalog link, pricing, and billing support.",
  keywords: [
    "Uzuri Living onboarding",
    "set up shop POS Tanzania",
    "duka setup Tanzania",
    "inventory app onboarding",
    "programu ya duka",
  ],
  alternates: {
    canonical: "/onboarding",
  },
  openGraph: {
    title: "Start with Uzuri Living",
    description: "Follow a guided setup checklist for products, sales, staff, catalog, pricing, and billing.",
    url: "/onboarding",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living onboarding" }],
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

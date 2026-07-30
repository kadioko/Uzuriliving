import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uzuri Living Pricing - POS Tanzania, Inventory App, Mfumo wa Duka",
  description:
    "Simple Uzuri Living pricing for Tanzanian shops. POS Tanzania, inventory app Tanzania, duka stock management, debts, expenses, supplier orders, and programu ya stock in Kiswahili.",
  keywords: [
    "POS Tanzania",
    "inventory app Tanzania",
    "mfumo wa duka",
    "duka stock management",
    "programu ya stock",
    "Uzuri Living pricing",
    "shop management Tanzania",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Uzuri Living Pricing - POS and Inventory App Tanzania",
    description:
      "Track stock, sales, debts, expenses, and supplier orders for Tanzanian shops. Start free, then pay by M-Pesa.",
    url: "/pricing",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living pricing and dashboard" }],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Uzuri Living - WhatsApp Support for Tanzanian Shops",
  description:
    "Contact Uzuri Living support by WhatsApp, phone, or email for setup, subscription payment references, POS, inventory, catalog, staff, and AI assistant help.",
  keywords: [
    "contact Uzuri Living",
    "Uzuri Living support",
    "Uzuri Living WhatsApp",
    "POS Tanzania support",
    "inventory app Tanzania support",
    "support@uzuriliving.com",
  ],
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Uzuri Living Support",
    description: "Get WhatsApp support for setup, payments, stock, sales, staff, catalog, and AI Assistant.",
    url: "/contact",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living support" }],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

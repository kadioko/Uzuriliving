import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uzuri Living Terms of Service",
  description:
    "Read the Uzuri Living terms of service for using the POS, inventory, sales, debts, expenses, supplier orders, catalog, and AI assistant features.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Uzuri Living Terms of Service",
    description: "Terms for using Uzuri Living POS, inventory, catalog, supplier orders, and AI assistant features.",
    url: "/terms",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living dashboard" }],
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

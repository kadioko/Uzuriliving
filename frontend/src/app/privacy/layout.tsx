import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Uzuri Living Privacy Policy",
  description:
    "Read the Uzuri Living privacy policy for Tanzanian merchants, including account data, shop data, sales, inventory, support, and deletion requests.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Uzuri Living Privacy Policy",
    description: "How Uzuri Living handles merchant account, shop, sales, inventory, support, and deletion data.",
    url: "/privacy",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living dashboard" }],
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

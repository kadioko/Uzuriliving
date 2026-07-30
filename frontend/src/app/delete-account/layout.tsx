import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete Uzuri Living Account and Data",
  description:
    "Request deletion of a Uzuri Living account or associated shop data. Learn what data is deleted, what may be retained, and how to contact support.",
  alternates: {
    canonical: "/delete-account",
  },
  openGraph: {
    title: "Delete Uzuri Living Account and Data",
    description: "Request account or data deletion for Uzuri Living.",
    url: "/delete-account",
    siteName: "Uzuri Living",
    type: "website",
    images: [{ url: "/marketing/phone-dashboard.png", width: 1200, height: 630, alt: "Uzuri Living dashboard" }],
  },
};

export default function DeleteAccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}

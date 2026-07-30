import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import ServiceWorkerRegistrar from "@/components/ui/ServiceWorkerRegistrar";
import MarketingTracker from "@/components/marketing/MarketingTracker";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uzuriliving.com"),
  title: {
    default: "Uzuri Living - POS Tanzania, Inventory App, Mfumo wa Duka",
    template: "%s | Uzuri Living",
  },
  description:
    "Uzuri Living is an AI-powered POS and inventory app for Tanzanian shops. Track stock, sales, debts, expenses, supplier orders, and duka stock management in Kiswahili.",
  applicationName: "Uzuri Living",
  authors: [{ name: "Necuva Group Limited", url: "https://www.uzuriliving.com" }],
  creator: "Necuva Group Limited",
  publisher: "Necuva Group Limited",
  category: "Business Software",
  keywords: [
    "Uzuri Living",
    "Uzuri Living",
    "uzuriliving.com",
    "POS Tanzania",
    "inventory app Tanzania",
    "AI assistant for shops Tanzania",
    "mfumo wa duka",
    "duka stock management",
    "programu ya stock",
    "programu ya duka",
    "POS ya duka",
    "shop POS Tanzania",
    "stock management app Tanzania",
    "shop management Tanzania",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo/uzuriliving-logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/logo/uzuriliving-logo.svg", sizes: "any", type: "image/svg+xml" }],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Uzuri Living - POS and Inventory App for Tanzanian Shops",
    description:
      "AI-powered POS for Tanzanian shops. Track stock, sales, debts, expenses, supplier orders, and profit in Kiswahili from your phone.",
    url: "/",
    siteName: "Uzuri Living",
    type: "website",
    locale: "sw_TZ",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/marketing/phone-dashboard.png",
        width: 1200,
        height: 630,
        alt: "Uzuri Living dashboard for Tanzanian shop owners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Uzuri Living - POS Tanzania, Inventory App, Mfumo wa Duka",
    description:
      "AI-powered POS and inventory app for Tanzanian shops. Track stock, sales, debts, expenses, and supplier orders in Kiswahili.",
    images: ["/marketing/phone-dashboard.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#e99400",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Uzuri Living",
      legalName: "Necuva Group Limited",
      url: "https://www.uzuriliving.com",
      logo: "https://www.uzuriliving.com/logo/uzuriliving-logo.svg",
      email: "support@uzuriliving.com",
      telephone: "+255743910580",
      sameAs: ["https://www.instagram.com/uzuriliving/"],
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+255743910580",
          contactType: "customer support",
          areaServed: "TZ",
          availableLanguage: ["Swahili", "English"],
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Uzuri Living",
      alternateName: "Uzuri Living",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android",
      url: "https://www.uzuriliving.com",
      image: "https://www.uzuriliving.com/marketing/phone-dashboard.png",
      description:
        "AI-powered POS and inventory app for Tanzanian shops. Track stock, sales, debts, expenses, supplier orders, and profit in Kiswahili.",
      offers: [
        {
          "@type": "Offer",
          name: "Basic",
          price: "15000",
          priceCurrency: "TZS",
          url: "https://www.uzuriliving.com/pricing",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "35000",
          priceCurrency: "TZS",
          url: "https://www.uzuriliving.com/pricing",
        },
      ],
      publisher: {
        "@type": "Organization",
        name: "Necuva Group Limited",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Uzuri Living",
      alternateName: "Uzuri Living",
      url: "https://www.uzuriliving.com",
      inLanguage: ["sw-TZ", "en"],
      potentialAction: {
        "@type": "SearchAction",
        target: "https://www.uzuriliving.com/catalog?search={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <html lang="sw">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ToastProvider>
        <MarketingTracker />
        <ServiceWorkerRegistrar />
        {children}
      </ToastProvider>
      </body>
    </html>
  );
}

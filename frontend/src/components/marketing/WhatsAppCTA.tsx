"use client";

import { MessageCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { getAttribution, trackMarketingEvent } from "@/lib/marketing";

type Intent = "setup" | "pricing" | "demo" | "help" | "contact" | "about";

const messages: Record<Intent, { sw: string; en: string }> = {
  setup: {
    sw: "Habari Uzuri Living, nataka setup ya duka langu. Aina ya duka: ",
    en: "Hello Uzuri Living, I want help setting up my shop. Shop type: ",
  },
  pricing: {
    sw: "Habari Uzuri Living, nataka kujua plan inayofaa duka langu. Aina ya duka: ",
    en: "Hello Uzuri Living, I want help choosing a plan for my shop. Shop type: ",
  },
  demo: {
    sw: "Habari Uzuri Living, nimeona demo na nataka setup ya duka langu. Aina ya duka: ",
    en: "Hello Uzuri Living, I saw the demo and want setup help. Shop type: ",
  },
  help: {
    sw: "Habari Uzuri Living, nahitaji msaada. Swali langu ni: ",
    en: "Hello Uzuri Living, I need help. My question is: ",
  },
  contact: {
    sw: "Habari Uzuri Living, nataka kuongea kuhusu setup ya duka langu. Aina ya duka: ",
    en: "Hello Uzuri Living, I want to talk about setting up my shop. Shop type: ",
  },
  about: {
    sw: "Habari Uzuri Living, nataka kujua kama Uzuri Living inafaa duka langu. Aina ya duka: ",
    en: "Hello Uzuri Living, I want to know if Uzuri Living fits my shop. Shop type: ",
  },
};

export default function WhatsAppCTA({
  intent = "setup",
  label,
  variant = "primary",
  className = "",
}: {
  intent?: Intent;
  label?: string;
  variant?: "primary" | "secondary" | "light";
  className?: string;
}) {
  const lang = useLang();
  const href = `https://wa.me/255743910580?text=${encodeURIComponent(messages[intent][lang])}`;
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    secondary: "border border-brand-200 bg-white text-brand-800 hover:bg-brand-50",
    light: "border border-white/25 bg-white/10 text-white hover:bg-white/20",
  };

  return (
    <a
      href={href}
      onClick={(event) => {
        trackMarketingEvent("whatsapp_click", { intent });
        const attribution = getAttribution();
        if (!attribution.source || attribution.source === "direct") return;
        event.preventDefault();
        const context = [attribution.source, attribution.campaign].filter(Boolean).join(" / ");
        const message = `${messages[intent][lang]}\nChanzo: ${context}`;
        window.location.assign(`https://wa.me/255743910580?text=${encodeURIComponent(message)}`);
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors ${styles[variant]} ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      {label || (lang === "sw" ? "Panga setup WhatsApp" : "Set up on WhatsApp")}
    </a>
  );
}

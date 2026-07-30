"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  motion,
  type MotionValue,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";

interface InfiniteGridFeature {
  title: string;
  description: string;
}

interface InfiniteGridCta {
  href: string;
  label: string;
}

interface InfiniteGridProps {
  lang: "sw" | "en";
  headline?: string;
  body?: string;
  features?: InfiniteGridFeature[];
  primaryCta?: InfiniteGridCta;
  secondaryCta?: InfiniteGridCta;
  className?: string;
}

export function TheInfiniteGrid({
  lang,
  headline,
  body,
  features,
  primaryCta,
  secondaryCta,
  className,
}: InfiniteGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.35) % 40);
    gridOffsetY.set((gridOffsetY.get() + 0.35) % 40);
  });

  const maskImage = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, black, transparent)`;

  const resolvedHeadline = headline || (lang === "sw"
    ? "Uzuri Living inaona mwenendo wa duka lako"
    : "Uzuri Living sees the pattern in your shop");
  const resolvedBody = body || (lang === "sw"
    ? "Tunajenga Uzuri Living kwa wafanyabiashara wa Tanzania: bidhaa, mauzo, madeni, matumizi, wafanyakazi, supplier orders na AI inayokuambia hatua ya kufanya sasa."
    : "We are building Uzuri Living for Tanzanian shop owners: inventory, sales, debts, expenses, staff, supplier orders, and an AI assistant that tells you what to do next.");
  const resolvedFeatures = features || [
    [lang === "sw" ? "Mauzo" : "Sales", lang === "sw" ? "Rekodi mauzo ya cash, M-Pesa na credit." : "Record cash, M-Pesa, and credit sales."],
    [lang === "sw" ? "Stock" : "Stock", lang === "sw" ? "Jua kinachokwisha kabla hujakosa mauzo." : "Know what is running out before sales stop."],
    [lang === "sw" ? "Madeni" : "Debts", lang === "sw" ? "Fuatilia wateja wanaodaiwa na malipo ya sehemu." : "Track customer credit and partial payments."],
    [lang === "sw" ? "AI ya hatua" : "Action AI", lang === "sw" ? "Pata mapendekezo ya kufanya leo, si ripoti tu." : "Get today's next steps, not just reports."],
  ].map(([title, description]) => ({ title, description }));
  const resolvedPrimaryCta = primaryCta || {
    href: "/register",
    label: lang === "sw" ? "Anza kutumia Uzuri Living" : "Start using Uzuri Living",
  };
  const resolvedSecondaryCta = secondaryCta || {
    href: "https://wa.me/255743910580?text=Nataka%20kujua%20zaidi%20kuhusu%20Uzuri%20Living",
    label: "WhatsApp",
  };
  const primaryIsExternal = /^(https?:|mailto:|tel:)/.test(resolvedPrimaryCta.href);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn(
        "relative isolate flex min-h-[560px] w-full items-center justify-center overflow-hidden rounded-2xl border border-brand-100 bg-white px-5 py-16 shadow-sm sm:px-8",
        className
      )}
    >
      <div className="absolute inset-0 z-0 text-brand-900 opacity-[0.035]">
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>
      <motion.div
        className="absolute inset-0 z-0 text-brand-700 opacity-35"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-50/80 to-transparent" />

      <div className="relative z-10 mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="text-center lg:text-left">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm lg:mx-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black tracking-normal text-gray-950 sm:text-5xl">
            {resolvedHeadline}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
            {resolvedBody}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            {primaryIsExternal ? (
              <a
                href={resolvedPrimaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
              >
                {resolvedPrimaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Link
                href={resolvedPrimaryCta.href}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
              >
                {resolvedPrimaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a
              href={resolvedSecondaryCta.href}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-5 py-3 text-sm font-bold text-green-800 transition hover:bg-green-50"
            >
              <MessageCircle className="h-4 w-4" />
              {resolvedSecondaryCta.label}
            </a>
          </div>
        </div>

        <div className="grid gap-3">
          {resolvedFeatures.map(({ title, description }) => (
            <div key={title} className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-bold text-gray-950">{title}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GridPattern({
  offsetX,
  offsetY,
}: {
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
}) {
  return (
    <svg className="h-full w-full" aria-hidden="true">
      <defs>
        <motion.pattern
          id="uzuriliving-grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#uzuriliving-grid-pattern)" />
    </svg>
  );
}

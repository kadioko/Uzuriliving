-- Printer-independent label templates and printer profiles.
-- Hardware adapters use these records as configuration; the browser remains the default output.

CREATE TABLE "label_templates" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL DEFAULT 40,
    "heightMm" INTEGER NOT NULL DEFAULT 30,
    "fields" TEXT[] NOT NULL DEFAULT ARRAY['name', 'price', 'barcode'],
    "priceMode" TEXT NOT NULL DEFAULT 'RETAIL',
    "customText" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "label_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "printer_profiles" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'BROWSER',
    "connection" TEXT NOT NULL DEFAULT 'BROWSER',
    "model" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "printer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "label_templates_shopId_updatedAt_idx" ON "label_templates"("shopId", "updatedAt");
CREATE INDEX "printer_profiles_shopId_updatedAt_idx" ON "printer_profiles"("shopId", "updatedAt");

ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "printer_profiles" ADD CONSTRAINT "printer_profiles_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

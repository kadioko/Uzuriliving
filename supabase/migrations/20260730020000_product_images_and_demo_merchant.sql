ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  CREATE POLICY "Public read product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'product-images');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Demo account for product tours and screenshots.
INSERT INTO "users" ("id", "phone", "pin", "name", "role", "language", "createdAt", "updatedAt")
VALUES ('demo-user-uzuri-0001', '+255789123456', '$2b$10$OcqBT/YdlO0ycgqAIS9wXeH.lwTZ7nXj0CP9JQ/ok06caH19xG5l6', 'Amani Demo Merchant', 'MERCHANT', 'sw', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("phone") DO NOTHING;

INSERT INTO "shops" ("id", "name", "location", "district", "category", "userId", "plan", "trialEndsAt", "isActive", "isCatalogPublished", "isDemo", "onboardingStatus", "createdAt", "updatedAt")
VALUES ('demo-shop-uzuri-0001', 'Mwangaza Corner Market', 'Dar es Salaam', 'Kinondoni', 'general', 'demo-user-uzuri-0001', 'FREE_TRIAL', CURRENT_TIMESTAMP + INTERVAL '30 days', true, true, true, 'ACTIVATED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "suppliers" ("id", "name", "phone", "address", "verificationStatus", "createdByShopId", "createdAt", "updatedAt")
VALUES ('demo-supplier-uzuri-0001', 'Kariakoo Wholesale Hub', '+255754111222', 'Kariakoo, Dar es Salaam', 'VERIFIED', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "products" ("id", "name", "sku", "unit", "buyingPrice", "sellingPrice", "wholesalePrice", "wholesaleMinQty", "currentStock", "minimumStock", "doesNotExpire", "isActive", "shopId", "supplierId", "createdAt", "updatedAt")
VALUES
  ('demo-product-0001', 'Mchele wa Mbeya 5kg', 'MWB-5KG', 'bag', 11500, 14500, 13500, 5, 18, 6, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0002', 'Mafuta ya Kupikia 2L', 'MAF-2L', 'pcs', 7200, 9500, 8800, 6, 12, 5, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0003', 'Sukari 1kg', 'SUK-1KG', 'kg', 2500, 3200, 2950, 10, 31, 10, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0004', 'Unga wa Ngano 2kg', 'UNG-2KG', 'bag', 3800, 4800, 4500, 8, 7, 8, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0005', 'Sabuni ya Maji 500ml', 'SAB-500', 'pcs', 1800, 2800, 2500, 8, 24, 8, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0006', 'Maji ya Uhai 1.5L', 'MAJ-15L', 'pcs', 700, 1200, 1050, 12, 46, 15, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0007', 'Biskuti za Chai', 'BIS-CHAI', 'pkt', 900, 1500, 1300, 10, 4, 8, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0008', 'Chai ya Majani 250g', 'CHAI-250', 'pkt', 2600, 3600, 3300, 6, 16, 5, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0009', 'Mkaa wa Kupikia', 'MKAA-01', 'bag', 4500, 6000, 5500, 4, 9, 4, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('demo-product-0010', 'Dawa ya Meno 100ml', 'DAWA-100', 'pcs', 2100, 3200, 2900, 6, 13, 5, true, true, 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "sales" ("id", "totalAmount", "profit", "paymentMethod", "channel", "pricingTier", "customerPhone", "note", "clientReference", "shopId", "createdAt")
VALUES
  ('demo-sale-0001', 28900, 7900, 'CASH', 'POS', 'RETAIL', '+255712000001', 'Morning counter sales', 'DEMO-SALE-0001', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('demo-sale-0002', 17600, 5200, 'MPESA', 'POS', 'RETAIL', '+255712000002', 'M-Pesa customer', 'DEMO-SALE-0002', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('demo-sale-0003', 42500, 11200, 'CASH', 'POS', 'WHOLESALE', '+255712000003', 'Neighbourhood kiosk order', 'DEMO-SALE-0003', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('demo-sale-0004', 9600, 3000, 'TIGOPESA', 'ONLINE', 'RETAIL', '+255712000004', 'Customer order', 'DEMO-SALE-0004', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '7 days')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "sale_items" ("id", "quantity", "unitPrice", "buyingPrice", "totalPrice", "saleId", "productId")
VALUES
  ('demo-item-0001', 1, 14500, 11500, 14500, 'demo-sale-0001', 'demo-product-0001'),
  ('demo-item-0002', 1, 9500, 7200, 9500, 'demo-sale-0001', 'demo-product-0002'),
  ('demo-item-0003', 1, 3200, 2500, 3200, 'demo-sale-0001', 'demo-product-0003'),
  ('demo-item-0004', 2, 4800, 3800, 9600, 'demo-sale-0002', 'demo-product-0004'),
  ('demo-item-0005', 2, 2800, 1800, 5600, 'demo-sale-0002', 'demo-product-0005'),
  ('demo-item-0006', 5, 6000, 4500, 30000, 'demo-sale-0003', 'demo-product-0009'),
  ('demo-item-0007', 2, 3200, 2500, 6400, 'demo-sale-0003', 'demo-product-0003'),
  ('demo-item-0008', 8, 1200, 700, 9600, 'demo-sale-0004', 'demo-product-0006')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "expenses" ("id", "title", "amount", "category", "vendor", "note", "spentAt", "shopId", "createdAt", "updatedAt")
VALUES
  ('demo-expense-0001', 'Daily transport', 8500, 'TRANSPORT', 'Bodaboda', 'Supplier pickup', CURRENT_TIMESTAMP - INTERVAL '2 days', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP),
  ('demo-expense-0002', 'Shop electricity', 22000, 'UTILITIES', 'TANESCO', 'Weekly allocation', CURRENT_TIMESTAMP - INTERVAL '5 days', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "debts" ("id", "customerName", "customerPhone", "amount", "amountPaid", "dueDate", "note", "status", "shopId", "createdAt", "updatedAt")
VALUES
  ('demo-debt-0001', 'Neema Salon', '+255713000111', 28500, 10000, CURRENT_TIMESTAMP + INTERVAL '5 days', 'Restocking on credit', 'PARTIAL', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP),
  ('demo-debt-0002', 'Jirani Kiosk', '+255713000222', 14200, 0, CURRENT_TIMESTAMP + INTERVAL '8 days', 'Weekly grocery order', 'OPEN', 'demo-shop-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "orders" ("id", "status", "totalAmount", "note", "shopId", "supplierId", "createdAt", "updatedAt")
VALUES ('demo-order-0001', 'PENDING', 88500, 'Restock fast-moving essentials', 'demo-shop-uzuri-0001', 'demo-supplier-uzuri-0001', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "order_items" ("id", "quantity", "unitPrice", "productId", "orderId")
VALUES
  ('demo-order-item-0001', 10, 11500, 'demo-product-0001', 'demo-order-0001'),
  ('demo-order-item-0002', 5, 7200, 'demo-product-0002', 'demo-order-0001'),
  ('demo-order-item-0003', 10, 2500, 'demo-product-0003', 'demo-order-0001')
ON CONFLICT ("id") DO NOTHING;

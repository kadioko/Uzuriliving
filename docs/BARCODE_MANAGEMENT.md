# Barcode Management

Uzuri Living supports manufacturer EAN-13, UPC, and Code128 values plus generated internal Code128 labels (`DP00000001`, then the next available number).

## Shop workflow

1. In Inventory, enter, scan, leave blank, or choose **Generate Uzuri Living barcode** while creating a product.
2. In Sales, use the scan icon or scan with a USB/Bluetooth scanner. Keyboard scanners send the code followed by Enter and are added straight to the cart.
3. Use the print icon on a product to print its label. Browser print settings control the physical label sheet size.
4. Use `POST /api/stock-counts`, scan each item with `POST /api/stock-counts/:id/scan`, then finish the count. Applying adjustments writes normal stock-movement records.

## Safety and support

- Barcodes are normalized to uppercase and unique across Uzuri Living, preventing accidental duplicate labels.
- Camera scanning uses the browser BarcodeDetector API when available. A manual entry field remains available for Safari/older phones or denied camera permission.
- Scans are recorded with their POS or stock-count context. `/api/barcodes/report` lists products without barcodes, frequently scanned values, and duplicate-entry attempts; `/api/barcodes/history` provides the recent event log.
- Only shop owners/admins and staff with stock-management permission can generate labels, alter barcode settings, receive stock, or run stock counts. Cashiers can scan in POS.

## Rollout checklist

Run `npx prisma migrate deploy` before deploying. Test one existing manufacturer code and one generated `DP...` code on the shop's physical phone and scanner. Keep a short manual entry fallback during the first week.

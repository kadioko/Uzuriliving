# Uzuri Living barcode and label guide

This guide explains the safest day-to-day workflow for product codes, barcode scanning, label printing, and printer files in Uzuri Living.

## 1. Before you start

Use one barcode for one sellable product. If the same product is sold in different pack sizes, create separate products and give each one its own code. Do not reuse a code after changing a product into a different item.

Recommended product data:

- Product name: the name staff will recognise at the till.
- SKU / internal code: your shop's short reference, such as `MILK500`.
- Manufacturer barcode: the EAN-13 or UPC-A printed by the manufacturer.
- Unit: `pcs`, `kg`, `litre`, `box`, or the unit you actually sell.
- Buying price, selling price, and optional wholesale price.

Uzuri Living normalises entered barcodes by removing spaces and converting letters to uppercase. Barcodes must be 4–64 characters and may contain letters, numbers, dots, hyphens, and underscores. The barcode is unique across the system, so a duplicate is rejected instead of silently creating an ambiguous product.

## 2. Add or edit a product barcode

1. Open **Inventory** and choose **Add product** or edit an existing product.
2. Enter the SKU if your shop uses one.
3. Enter the manufacturer's barcode exactly as printed, or use **Scan** to read it with the phone camera.
4. Select **Generate Uzuri Living barcode** only when the product has no manufacturer code. Generated internal codes use the `DP00000001` style and are Code 128-compatible.
5. Save the product.

Only an owner, manager, or admin can generate internal barcodes or change barcode settings. Cashiers can scan and sell products according to their normal permissions.

If a product has an invalid EAN-13 or UPC-A value, the label preview will show an invalid-code warning. Fix the code before printing. A Code 128 value can contain letters and is appropriate for internal SKUs and generated Uzuri Living codes.

## 3. Sell by barcode

Uzuri Living supports three scanning methods:

1. **USB/Bluetooth keyboard-wedge scanner:** click somewhere on the POS page, scan, and let the scanner send its normal Enter suffix. The product is looked up and added to the cart.
2. **Phone camera:** choose the scan button in POS and point the camera at the barcode.
3. **Manual barcode entry:** use the camera dialog's manual field when the camera cannot focus or the scanner is unavailable.

The POS searches product name, SKU, and barcode. A successful scan gives a confirmation and adds one unit to the cart. Repeated scans increase the cart quantity up to available stock. If the code is not found, POS offers a manual search or a shortcut to add the product in Inventory.

For best results with a keyboard-wedge scanner:

- Configure the scanner to append Enter after each scan.
- Use a scanner that sends keystrokes quickly and consistently.
- Keep the barcode facing the reader and avoid scanning a wrinkled or low-contrast label.
- Do not type into a form while a scan is being triggered; use the manual search field for normal typing.

## 4. Print labels

Open **Barcode management → Labels**.

1. Search by product name, SKU, or barcode.
2. Tick the products to print and enter the number of copies for each product.
3. Choose a preset or custom label size. The default is **40 × 30 mm**.
4. Choose the content:
   - Product name + price + barcode
   - Product name + barcode
   - Product name + price
   - Barcode only
5. Use custom fields for SKU, unit, or short text such as a colour, pack size, or promotion note.
6. Choose retail or wholesale price when the price field is included.
7. Check the preview before printing.
8. Choose **Print** for browser printing or **Download printer file** for a saved ZPL, TSPL, or ESC/POS output file.

The browser workflow is the most compatible option. In the browser print dialog, select the correct paper or label roll, set scale to **100%**, disable headers and footers, and use zero or minimum margins. For a roll printer, choose the matching custom page size rather than A4.

The **Inventory → Print label** action is useful for one-off reprints. The Barcode management page is better for a batch because it supports search, copies, field selection, and preview.

## 5. Templates and printer profiles

Owners and managers can save a label template and a printer profile for the shop. Saving a template records the fields, dimensions, price mode, and custom text. Saving a printer profile records the intended output protocol and connection type.

Use:

- **Browser/PDF** for ordinary browser printing or Save as PDF.
- **ZPL download** for Zebra-compatible workflows and label bridges.
- **TSPL download** for Xprinter/TSC-compatible workflows that accept TSPL.
- **ESC/POS hex** for a local utility or integration that converts the hex stream to an ESC/POS printer connection.

Downloading a printer file does not send it directly to a USB, Bluetooth, or network printer from the browser. Send the file through the printer manufacturer's utility or an approved print bridge. This separation prevents the web app from gaining unsafe direct device access and keeps the same label template usable with different manufacturers.

## 6. Choosing label size

Start with 40 × 30 mm for small retail products. Use 48 × 30 mm or 62 × 30 mm when the product name is longer. Use 80 × 40 mm when staff need a large name, SKU, price, and barcode.

Always test one label before printing a full batch. The barcode needs a clear white quiet zone on both sides. Do not let a logo, border, or text touch the barcode. If a scanner struggles, increase the label width or barcode height before reducing the barcode size.

## 7. Receiving and stock counts

Use the same barcode on the product record, sales labels, and stock-count workflow. In a stock count, scanning the same product again increments its counted quantity. Finish the count only after checking the exception list and deciding whether adjustments should be applied.

If stock is already ordered, the Inventory and Sales screens can show **Ordered** or **On the way** beside the product. The barcode itself should still identify the product; it does not replace stock status.

## 8. Troubleshooting

### The label preview says “No barcode assigned”

The product has no barcode. Add a manufacturer code or generate an internal Uzuri Living code, then save the product and reload Barcode management.

### The label preview says “Invalid EAN13” or “Invalid UPC”

The digits do not match the selected symbology. Check for a missing digit, copied spaces, or a wrong barcode type. If the value is an internal alphanumeric code, use Code 128/internal generation instead.

### A scanner finds nothing

Check that the code is saved on the active product, that the product is active, and that the scanner sends the complete value followed by Enter. Try the camera dialog or manual entry to separate a scanner problem from a product-data problem.

### The browser prints a blank or badly sized page

Use the Barcode management page's **Print** button, confirm that the print preview contains labels, set scale to 100%, disable headers and footers, and choose the actual label size. For a single reprint, open the label from Inventory and print from the modal.

### A ZPL or TSPL file does not print

Confirm that the printer model accepts that language, that the label width and height match the media, and that the file is sent through the manufacturer's utility or a configured print bridge. Do not rename a TSPL file to ZPL or send raw text to an unknown printer.

### A label is cut off

Reduce the number of fields, choose a wider label, or increase the label height. Product names should be short enough for the selected size; use SKU or custom text for secondary details.

## 9. Recommended operating routine

1. Create the product once with a stable SKU and barcode.
2. Print one test label and scan it back into POS.
3. Print the batch only after the test sale/search succeeds.
4. Keep manufacturer barcodes unchanged; use generated internal codes only where no manufacturer code exists.
5. Review labels whenever a product's unit, pack size, or selling price changes.
6. Keep one saved browser profile and one saved raw-printer profile per printer language, not per individual product.

## Current support boundary

Uzuri Living currently provides browser/SVG label preview and printing plus downloadable ZPL, TSPL, and ESC/POS-oriented output files. Direct USB, Bluetooth, and network transmission still requires a local print bridge or manufacturer utility. Printer profiles are intentionally protocol-based so future adapters can be added without changing product data or label templates.

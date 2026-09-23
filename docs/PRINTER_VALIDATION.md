# Uzuri Living printer validation plan

This plan is used when the shop has the actual printer hardware. The Epson L3250 currently connected to the development computer is a general-purpose IPP printer; it is suitable for browser/PDF label sheets, but it is not a ZPL, TSPL, or ESC/POS label-printer test device.

## Test setup

Use one product with:

- Name: `Test Product`
- SKU: `TEST001`
- Code 128 barcode: `DP00000001`
- EAN-13 test value: a valid 13-digit manufacturer code
- UPC-A test value: a valid 12-digit manufacturer code
- Retail price: `TZS 15,000`

Print one copy first. Do not begin with a full batch.

## Browser/PDF test

1. Open **Barcode management → Labels**.
2. Select **Name + price + barcode** and 40 × 30 mm.
3. Select the browser profile and print one label.
4. Set scale to 100%, disable headers and footers, and choose the real media size.
5. Scan the printed label back into POS.

Pass criteria:

- The label is not clipped or scaled unexpectedly.
- The printed digits match the saved product barcode.
- The camera or keyboard scanner finds the product and adds it to the cart.

## Zebra / ZPL test

Required device: a Zebra printer or a ZPL-compatible label printer.

1. Save a printer profile with protocol **ZPL**.
2. Download one `.zpl` file from Barcode management.
3. Send it through Zebra Setup Utilities, ZebraDesigner, a raw TCP 9100 print utility, or the shop's approved print bridge.
4. Test Code 128, EAN-13, and UPC-A products separately.

Pass criteria:

- The printer feeds exactly one label per record.
- Text and barcode stay inside the 40 × 30 mm label.
- A scanner reads each printed code.
- The label is not rotated or shifted because of the printer's stored darkness, speed, or origin settings.

## Xprinter / TSC / TSPL test

Required device: a printer documented as accepting TSPL. Xprinter and TSC models vary, so confirm the model's command language first.

1. Save a printer profile with protocol **TSPL**.
2. Download one `.tspl` file.
3. Send it using the manufacturer's utility or an approved raw-print bridge.
4. Confirm the configured label width, height, gap, and sensor mode match the physical roll.

Pass criteria:

- One file produces the expected number of labels.
- The printer calibrates the gap or black mark correctly.
- The barcode scans from the physical label.
- Product names do not overlap the barcode.

## ESC/POS test

Required device: an ESC/POS-compatible printer and a bridge that accepts the generated hex stream. ESC/POS is usually used for receipt printers, so it is not a substitute for a 40 × 30 mm label printer unless the model supports the required media.

1. Save a printer profile with protocol **ESC/POS**.
2. Download the `.escpos.hex` file.
3. Convert the hex stream to bytes in the approved local utility or bridge.
4. Send it to the intended printer only after checking the model's barcode command support.

Pass criteria:

- The utility sends bytes, not the literal hexadecimal characters.
- The printer resets, prints the text, prints the barcode, and cuts or advances correctly.
- The barcode scans from the output.

## Failure recording

For every failed test record:

- Printer manufacturer and exact model
- Firmware version
- Command language and driver/utility version
- Label width, height, gap, and sensor type
- Downloaded file name
- A photo of the output and the printer settings
- Whether the same product scans successfully from the browser preview

## Direct bridge work still to be implemented

The web application currently downloads printer commands; it does not open raw USB, Bluetooth, or network sockets. The next bridge implementation should provide one local, authenticated adapter with:

1. `POST /print` accepting a printer profile and rendered payload.
2. A device allow-list so the browser cannot send arbitrary data to arbitrary printers.
3. Job IDs, retries, cancellation, and a visible print result.
4. Adapters for browser/PDF, ZPL over TCP 9100, TSPL through the same raw path, and ESC/POS through a byte-safe transport.
5. A QZ Tray or signed local-agent option for USB/Bluetooth access where the browser cannot connect directly.

Do not enable direct printing until the actual printer model, connection type, and command language have been confirmed.

# Uzuri Living printer validation plan

This plan is used when the shop has the actual printer hardware. The Epson L3250 currently connected to the development computer is a general-purpose IPP printer; it is suitable for browser/PDF label sheets, but it is not a ZPL, TSPL, or ESC/POS label-printer test device.

## Recommended hardware target

The first physical target is the **Xprinter XP-D281B with USB + Ethernet/LAN**. It is the preferred general-purpose choice for ordinary product labels because its 203-DPI output is sufficient for readable text and barcodes. The XP-D281E is the 300-DPI option for smaller or denser labels. Confirm the exact unit's ports, firmware, media sensor mode, and supported command languages with the seller before ordering.

The web app and label renderer are printer-independent. The physical printer is only responsible for receiving the selected output language and feeding the matching media. Physical certification is still required before claiming that a specific XP-D281B/D281E batch is supported.

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

## Direct bridge validation

The repository now includes `printer-bridge/`, a loopback local service that exposes `GET /health`, `GET /printers`, `POST /test`, and `POST /print`. It supports:

- Network/LAN raw TCP printing, normally port 9100.
- Windows USB through a RAW Windows printer queue.
- Windows Bluetooth through a paired serial/RFCOMM COM port.
- TSPL, ZPL, EPL, and ESC/POS payload validation.

Before calling a printer supported, run the following on the shop computer:

1. Copy `printer-bridge/.env.example` to `.env`.
2. Configure exactly one connection: `NETWORK`, `USB`, or `BLUETOOTH`.
3. Start the bridge with `npm start`.
4. Confirm `GET http://127.0.0.1:38100/health` reports the expected connection.
5. Use `POST /test` with matching media loaded.
6. Print one product label from Barcode management.
7. Scan the physical barcode back into POS.
8. Repeat with a batch of three labels and confirm there are no duplicate, blank, shifted, or extra feeds.

For USB, the Windows queue must accept RAW data rather than rasterizing the file. For Bluetooth, the exact printer module must expose a serial COM port and the baud rate must match its manual. LAN is the recommended first production connection.

The bridge code and simulator tests are complete, but physical certification still requires the actual XP-D281B/D281E, its firmware, its interface module, and its label media. Do not promise a hardware connection to customers until those tests pass.

## Android phone validation

The Android APK can receive a label job from the hosted web app and send it through one of three transports:

1. **LAN/Wi-Fi:** the phone and printer are on the same network and the printer accepts raw TCP, normally on port 9100.
2. **Bluetooth:** the printer is paired in Android settings and its Bluetooth address is saved in the printer profile.
3. **USB OTG:** the phone has USB host support, a compatible OTG adapter, and permission to access the printer's bulk output endpoint.

Test each transport with one 40 × 30 mm label, then three labels, then a mixed-product batch. Verify that Android version, printer firmware, interface module, media sensor mode, and the exact APK version are recorded with the result.

## iPhone and iPad validation boundary

Safari/PWA testing should cover login, product selection, label preview, PDF download, and browser printing. It should not be recorded as direct USB/Bluetooth printer certification. Direct iOS printing requires a native companion, supported printer SDK, or a tested network bridge and should be validated as a separate project.

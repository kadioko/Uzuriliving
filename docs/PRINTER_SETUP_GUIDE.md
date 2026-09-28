# Uzuri Living printer setup guide

This is the practical setup guide for shops buying a thermal label printer for Uzuri Living.

## Recommended purchase

Choose the **Xprinter XP-D281B with USB + Ethernet/LAN** when possible.

- XP-D281B: 203 DPI; the recommended option for normal product labels.
- XP-D281E: 300 DPI; useful for very small text or dense barcodes.
- Both are direct-thermal models: they use thermal labels, not ink or ribbon.
- Confirm the exact unit's ports, firmware, sensor mode, and TSPL/ZPL/EPL support with the seller.
- Buy label media that matches the template. Uzuri Living's default is approximately 40 × 30 mm.

LAN is the preferred first connection because it is easier to share between devices and avoids many Bluetooth pairing problems. USB is useful for a fixed computer. Bluetooth is useful for a compatible Android setup, but support depends on the printer's installed module.

## What Uzuri Living can print

From **Barcode management → Labels**, an owner or manager can select one or more products and print:

- Product name and price
- Product name and barcode
- Product name, price, SKU, and barcode
- Barcode only
- Custom fields such as unit, colour, pack size, or a short note
- Retail or wholesale price when the template includes a price field
- Multiple copies per product

Output options include browser/PDF printing and downloadable ZPL, TSPL, EPL, and ESC/POS-oriented files. The same product data and label template can be reused across compatible printers.

## Shop computer setup

For USB or LAN printing from a computer:

1. Install Node.js 20 or newer.
2. Set up the [Uzuri Living Print Bridge](../printer-bridge/README.md).
3. Connect the XP-D281B/D281E by LAN or USB.
4. Load matching thermal labels and calibrate the printer.
5. Start the bridge and confirm `GET http://127.0.0.1:38100/health`.
6. In Uzuri Living, open **Barcode management → Labels**.
7. Select the matching printer profile and run **Test bridge**.
8. Print one label, scan it back into POS, and only then print the batch.

## Android phone setup

The Android APK is a Trusted Web Activity connected to the same live Uzuri Living web app and Supabase backend. The web application can update without reinstalling the APK, but direct printer support requires the updated APK with the native print adapter.

In Barcode management:

1. Create or select a printer profile.
2. Choose **Android phone (LAN / Bluetooth / USB)**.
3. Select the matching transport:
   - **LAN:** enter the printer IP address and normally port 9100.
   - **Bluetooth:** pair the printer in Android settings and enter its Bluetooth address.
   - **USB:** connect the printer with a compatible USB OTG adapter and approve Android's USB permission prompt.
4. Select TSPL for the XP-D281B/D281E unless the exact device is configured for another supported language.
5. Print one test label and scan it into POS.

Keep mobile batches small while testing. Record the Android version, APK version, printer firmware, interface type, label size, and result.

## iPhone and iPad

iPhone and iPad users can use Uzuri Living through Safari or an installed PWA for login, inventory, product selection, label preview, PDF download, and browser printing.

Safari alone should not be treated as a raw printer adapter. Direct Bluetooth Classic, USB, and TCP printing requires a native iOS companion or a tested network bridge. AirPrint is not automatically compatible with raw TSPL/ZPL label commands.

## Daily workflow

1. Create the product with a stable SKU and manufacturer barcode, or generate an internal Code 128 barcode.
2. Choose the label fields and price mode.
3. Print one test label.
4. Scan the test label in POS.
5. Print the remaining copies.
6. Reprint labels whenever the price, pack size, unit, or barcode changes.

## Support boundary

The software integration, label renderer, browser/PDF output, printer profiles, desktop bridge, and Android adapter are implemented. Physical certification of the exact XP-D281B/D281E hardware, label stock, Bluetooth module, USB driver, and LAN configuration is still required. A signed production Android build also requires the release keystore to be available in the build environment.

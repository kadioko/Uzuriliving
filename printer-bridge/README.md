# Uzuri Living Print Bridge

The Print Bridge is a small local service that receives label commands from the hosted Uzuri Living web app and sends them to a network thermal printer. It keeps raw printer access out of the browser while allowing the same label template to work with different printer languages.

The web app remains the source of truth for products, prices, barcodes, label fields, and copies. The bridge only handles the final local transport to the configured printer.

## First supported setup

- Xprinter XP-D281B or XP-D281E with Ethernet/LAN
- TSPL output
- Raw TCP printing, normally port `9100`
- Windows, macOS, or Linux with Node.js 20+

Windows USB and paired Bluetooth COM-port adapters are also supported by the bridge. LAN remains the recommended first connection because it is easier to share and troubleshoot.

For a new shop, order the XP-D281B with USB + Ethernet/LAN if available. The 203-DPI model is normally enough for 40 × 30 mm product labels. Use the XP-D281E when very small text or dense barcodes justify 300 DPI. Always confirm the exact ports and TSPL support with the seller.

## Run it

1. Install Node.js 20 or newer on the computer that can reach the printer.
2. Copy `.env.example` to `.env` and set `UZURI_PRINTER_HOST` to the printer's LAN IP address.
3. Start the service:

```powershell
cd printer-bridge
npm start
```

The bridge listens on `http://127.0.0.1:38100` by default. It binds to loopback only; do not expose this port to the public internet.

### USB on Windows

Install the printer normally so it appears in **Windows Printers & scanners**, then set:

```text
UZURI_PRINTER_CONNECTION=USB
UZURI_PRINTER_QUEUE=the exact Windows printer queue name
```

The bridge sends RAW data through the Windows spooler. The printer driver must accept raw TSPL/ZPL/EPL data; a driver that rasterizes the job may not understand label commands.

### Bluetooth on Windows

Pair the printer in Windows and identify the outgoing COM port in Device Manager. Then set:

```text
UZURI_PRINTER_CONNECTION=BLUETOOTH
UZURI_PRINTER_SERIAL_PATH=COM3
UZURI_PRINTER_BAUD_RATE=9600
```

Bluetooth printing depends on the printer's module exposing a serial/RFCOMM port. Verify the port and baud rate from the exact hardware manual.

## Test it

Check the service:

```powershell
Invoke-RestMethod http://127.0.0.1:38100/health
```

Send one test label:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:38100/test
```

The test label is 50 × 30 mm. Load matching media before sending it.

## Use it from Uzuri Living

1. Start the bridge on the shop computer.
2. Open **Barcode management → Labels** in Uzuri Living.
3. Select products, fields, label size, and copies.
4. Save or select a printer profile using the matching protocol and **Local bridge (LAN)** connection.
5. Run **Test bridge**, print one label, and scan it back into POS before printing a batch.

The bridge accepts TSPL, ZPL, EPL, and ESC/POS-oriented payloads. The printer must support the selected language; do not send a TSPL file to a printer configured only for another language.

## Security

The service is loopback-only by default. If it is ever bound to another interface, set `UZURI_BRIDGE_TOKEN` and use a firewall rule that only permits the shop network. The bridge does not accept arbitrary shell commands; it accepts only validated printer-language payloads and sends them to the configured printer.

## Endpoints

- `GET /health` — bridge status and configured printer summary
- `GET /printers` — configured printer profiles
- `POST /test` — print a small test label
- `POST /print` — send `{ "printerId": "default", "protocol": "TSPL", "data": "..." }`

The web app should use `POST /print` for TSPL, ZPL, EPL, or ESC/POS output. For ESC/POS, `data` is a hexadecimal byte string.

## Mobile boundary

The Android Uzuri Living APK can send jobs directly through LAN, paired Bluetooth, or USB OTG without this desktop bridge. iPhone and iPad can use the web app for label preview, PDF, and browser printing, but Safari alone cannot reliably send raw TSPL/ZPL over USB or Bluetooth. Direct iOS printing needs a native companion or a tested network bridge.

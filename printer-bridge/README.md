# Uzuri Living Print Bridge

The Print Bridge is a small local service that receives label commands from the hosted Uzuri Living web app and sends them to a network thermal printer. It keeps raw printer access out of the browser while allowing the same label template to work with different printer languages.

## First supported setup

- Xprinter XP-D281B or XP-D281E with Ethernet/LAN
- TSPL output
- Raw TCP printing, normally port `9100`
- Windows, macOS, or Linux with Node.js 20+

USB and Bluetooth adapters are intentionally not enabled in this first bridge release. They require OS-specific/native handling and should be added without changing the web label engine.

## Run it

1. Install Node.js 20 or newer on the computer that can reach the printer.
2. Copy `.env.example` to `.env` and set `UZURI_PRINTER_HOST` to the printer's LAN IP address.
3. Start the service:

```powershell
cd printer-bridge
npm start
```

The bridge listens on `http://127.0.0.1:38100` by default. It binds to loopback only; do not expose this port to the public internet.

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

## Security

The service is loopback-only by default. If it is ever bound to another interface, set `UZURI_BRIDGE_TOKEN` and use a firewall rule that only permits the shop network. The bridge does not accept arbitrary shell commands; it accepts only validated printer-language payloads and sends them to the configured printer.

## Endpoints

- `GET /health` — bridge status and configured printer summary
- `GET /printers` — configured printer profiles
- `POST /test` — print a small test label
- `POST /print` — send `{ "printerId": "default", "protocol": "TSPL", "data": "..." }`

The web app should use `POST /print` for TSPL, ZPL, EPL, or ESC/POS output. For ESC/POS, `data` is a hexadecimal byte string.

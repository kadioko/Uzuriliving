import test from "node:test";
import assert from "node:assert/strict";
import { decodePayload, validatePrintRequest } from "../src/server.mjs";

test("decodes ESC/POS hexadecimal payloads", () => {
  assert.deepEqual(decodePayload("ESCPOS", "1b 40 0a"), Buffer.from([0x1b, 0x40, 0x0a]));
});

test("rejects malformed ESC/POS hexadecimal payloads", () => {
  assert.throws(() => decodePayload("ESCPOS", "not-hex"), /hexadecimal/);
});

test("rejects unsupported protocols", () => {
  assert.throws(() => validatePrintRequest({ protocol: "PDF", data: "x" }), /Unsupported printer protocol/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { decodePayload, validatePrintRequest, originAllowed } from "../src/server.mjs";

test("decodes ESC/POS hexadecimal payloads", () => {
  assert.deepEqual(decodePayload("ESCPOS", "1b 40 0a"), Buffer.from([0x1b, 0x40, 0x0a]));
});

test("rejects malformed ESC/POS hexadecimal payloads", () => {
  assert.throws(() => decodePayload("ESCPOS", "not-hex"), /hexadecimal/);
});

test("rejects unsupported protocols", () => {
  assert.throws(() => validatePrintRequest({ protocol: "PDF", data: "x" }), /Unsupported printer protocol/);
});

test("only the configured web app can call the local printer bridge", () => {
  assert.equal(originAllowed("https://uzuriliving.com"), true);
  assert.equal(originAllowed("https://www.uzuriliving.com"), true);
  assert.equal(originAllowed("https://uzuriliving.com.invalid.example"), false);
  assert.equal(originAllowed("null"), false);
  assert.equal(originAllowed(undefined), true);
});

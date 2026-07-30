const dns = require("node:dns").promises;

const DOMAIN = process.env.EMAIL_DOMAIN || "uzuriliving.com";
const MAILTRAP_DKIM_TARGETS = new Set(["rwmt1.dkim.smtp.mailtrap.live", "rwmt2.dkim.smtp.mailtrap.live"]);

function flattenTxt(records) {
  return records.map((parts) => parts.join(""));
}

function normalizeHost(value) {
  return String(value || "").trim().replace(/\.$/, "").toLowerCase();
}

function pass(label, detail) {
  console.log(`OK ${label}${detail ? ` - ${detail}` : ""}`);
}

function fail(label, detail) {
  throw new Error(`${label}${detail ? ` - ${detail}` : ""}`);
}

async function checkMx() {
  const records = await dns.resolveMx(DOMAIN);
  const mx = records
    .map((record) => ({ exchange: normalizeHost(record.exchange), priority: record.priority }))
    .sort((a, b) => a.priority - b.priority);

  const hasMx1 = mx.some((record) => record.exchange === "mx1.improvmx.com" && record.priority === 10);
  const hasMx2 = mx.some((record) => record.exchange === "mx2.improvmx.com" && record.priority === 20);

  if (!hasMx1 || !hasMx2) {
    fail("ImprovMX MX records", JSON.stringify(mx));
  }

  pass("ImprovMX MX records", "inbound forwarding is pointed at ImprovMX");
}

async function checkSpf() {
  const txt = flattenTxt(await dns.resolveTxt(DOMAIN));
  const spfRecords = txt.filter((value) => value.toLowerCase().startsWith("v=spf1"));

  if (spfRecords.length !== 1) {
    fail("single SPF record", `found ${spfRecords.length}`);
  }

  const spf = spfRecords[0].toLowerCase();
  if (!spf.includes("include:spf.improvmx.com")) {
    fail("SPF includes ImprovMX", spfRecords[0]);
  }
  if (!spf.includes("include:_spf.mailtrap.io")) {
    fail("SPF includes Mailtrap", spfRecords[0]);
  }

  pass("combined SPF record", spfRecords[0]);
}

async function checkMailtrapDkim() {
  const selectors = ["rwmt1", "rwmt2"];

  for (const selector of selectors) {
    const host = `${selector}._domainkey.${DOMAIN}`;
    const records = await dns.resolveCname(host);
    const targets = records.map(normalizeHost);
    const expected = `${selector}.dkim.smtp.mailtrap.live`;

    if (!targets.includes(expected) && !targets.some((target) => MAILTRAP_DKIM_TARGETS.has(target))) {
      fail(`Mailtrap DKIM ${selector}`, targets.join(", "));
    }

    pass(`Mailtrap DKIM ${selector}`, targets.join(", "));
  }
}

async function checkDmarc() {
  const records = flattenTxt(await dns.resolveTxt(`_dmarc.${DOMAIN}`));
  const dmarc = records.find((value) => value.toLowerCase().startsWith("v=dmarc1"));

  if (!dmarc) {
    fail("DMARC record", "missing");
  }

  pass("DMARC record", dmarc);
}

async function main() {
  console.log(`Checking email DNS for ${DOMAIN}`);
  await checkMx();
  await checkSpf();
  await checkMailtrapDkim();
  await checkDmarc();
  console.log("Email DNS check completed successfully.");
}

main().catch((error) => {
  console.error(`Email DNS check failed: ${error.message}`);
  process.exitCode = 1;
});

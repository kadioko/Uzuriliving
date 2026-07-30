/**
 * OTP Service â€” Africa's Talking SMS integration
 *
 * Required env vars:
 *   AT_API_KEY     â€” Africa's Talking API key
 *   AT_USERNAME    â€” Africa's Talking username (use 'sandbox' for testing)
 *   AT_SENDER_ID   â€” Short code or alphanumeric sender (optional, leave blank to use shared)
 *
 * If AT_API_KEY is not set, OTP codes are logged to console only (dev mode).
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory OTP store: phone -> { code, expiresAt, attempts }
// In production with multiple instances, replace with Redis.
const otpStore = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

function cleanExpired() {
  const now = Date.now();
  for (const [phone, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(phone);
  }
}

async function sendSms(phone, message) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || "sandbox";
  const senderId = process.env.AT_SENDER_ID || "";

  if (!apiKey) {
    console.log(`[OTP DEV] SMS to ${phone}: ${message}`);
    return { sent: false, reason: "AT_API_KEY not configured â€” OTP logged to console" };
  }

  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

  const body = new URLSearchParams({
    username,
    to: normalizedPhone,
    message,
  });
  if (senderId) body.set("from", senderId);

  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Africa's Talking API error: ${err}`);
  }

  const data = await response.json();
  const recipient = data.SMSMessageData?.Recipients?.[0];
  if (recipient?.status !== "Success") {
    throw new Error(`SMS delivery failed: ${recipient?.status || "unknown"}`);
  }

  return { sent: true, messageId: recipient.messageId };
}

/**
 * Issue and send an OTP to the given phone number.
 * Returns { sent, reason? } â€” reason only when not sent.
 */
async function issueOtp(phone) {
  cleanExpired();
  const code = generateCode();
  otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });

  const message = `Nambari yako ya Uzuri Living ni: ${code}. Inatumika kwa dakika 10. / Your Uzuri Living code: ${code}. Valid 10 mins.`;
  return sendSms(phone, message);
}

/**
 * Verify an OTP code for a phone.
 * Returns true on success, throws on failure.
 */
function verifyOtp(phone, code) {
  cleanExpired();
  const entry = otpStore.get(phone);

  if (!entry) throw Object.assign(new Error("OTP expired or not found. Request a new code."), { status: 400 });

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(phone);
    throw Object.assign(new Error("Too many incorrect attempts. Request a new code."), { status: 429 });
  }

  if (entry.code !== String(code).trim()) {
    throw Object.assign(new Error("Incorrect OTP code"), { status: 400 });
  }

  otpStore.delete(phone);
  return true;
}

module.exports = { issueOtp, verifyOtp };

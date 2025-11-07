const logger = require("./logger");

// Lazy init Twilio client to avoid requiring when not configured
let twilioClient = null;
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require("twilio");
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return twilioClient;
  } catch (err) {
    logger.warn("Twilio module not available:", err?.message || err);
    return null;
  }
}

// Normalize PH numbers: 09XXXXXXXXX -> +639XXXXXXXXX; keep +63 as-is
function normalizePhonePH(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^+\d]/g, "");
  if (digits.startsWith("+639") && digits.length === 13) return digits;
  if (digits.startsWith("09") && digits.length === 11) {
    return "+63" + digits.slice(1);
  }
  return digits; // fallback; provider may still accept
}

async function sendSms({ to, body }) {
  const enabled = process.env.SMS_ENABLED === "true";
  const from = process.env.TWILIO_FROM; // E.164, e.g., +15005550006 (trial) or your number
  const client = getTwilioClient();

  const normTo = normalizePhonePH(to);

  if (!enabled) {
    logger.info("[SMS] (disabled) Would send SMS", { to: normTo, body });
    return { skipped: true };
  }
  if (!client || !from) {
    logger.warn("[SMS] Missing configuration; skipping send", {
      hasClient: !!client,
      hasFrom: !!from,
    });
    return { skipped: true };
  }

  try {
    const resp = await client.messages.create({ to: normTo, from, body });
    logger.info("[SMS] Sent", { sid: resp.sid, to: normTo });
    return { success: true, sid: resp.sid };
  } catch (err) {
    logger.error("[SMS] Send failed", { error: err.message || String(err) });
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = {
  sendSms,
  normalizePhonePH,
};

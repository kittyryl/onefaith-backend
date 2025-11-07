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
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // optional alternative
  const client = getTwilioClient();

  const normTo = normalizePhonePH(to);

  if (!enabled) {
    logger.info("[SMS] (disabled) Would send SMS", {
      to: normTo,
      body,
      from,
      messagingServiceSid,
    });
    return { skipped: true };
  }
  if (!client) {
    logger.warn("[SMS] Missing Twilio client; skipping send");
    return { skipped: true };
  }
  if (!from && !messagingServiceSid) {
    logger.warn("[SMS] Missing configuration; provide TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID");
    return { skipped: true };
  }

  try {
    const payload = messagingServiceSid
      ? { to: normTo, messagingServiceSid, body }
      : { to: normTo, from, body };

    const resp = await client.messages.create(payload);
    logger.info("[SMS] Sent", { sid: resp.sid, to: normTo });
    return { success: true, sid: resp.sid };
  } catch (err) {
    const twilioError = {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      moreInfo: err?.moreInfo,
    };
    logger.error("[SMS] Send failed", twilioError);
    return { success: false, error: err?.message || String(err), details: twilioError };
  }
}

module.exports = {
  sendSms,
  normalizePhonePH,
};

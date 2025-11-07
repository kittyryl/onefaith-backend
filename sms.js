const logger = require("./logger");

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

// SMS Provider: IProg Tech (Philippine SMS)
async function sendViaIProg({ to, body }) {
  const apiToken = process.env.IPROG_API_TOKEN;

  if (!apiToken) {
    logger.warn("[SMS][IProg] Missing configuration");
    return { success: false, error: "Missing IProg API token" };
  }

  const normTo = normalizePhonePH(to);

  try {
    // IProg accepts 09XXXXXXXXX or 639XXXXXXXXX format
    const phoneNumber = normTo.startsWith("+63")
      ? normTo.slice(1) // Remove + for 639XXXXXXXXX
      : normTo.replace(/^0/, "63"); // Convert 09XX to 639XX

    const url = new URL("https://sms.iprogtech.com/api/v1/sms_messages");
    url.searchParams.append("api_token", apiToken);
    url.searchParams.append("phone_number", phoneNumber);
    url.searchParams.append("message", body);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    // IProg returns status 200 for success
    if (result.status === 200) {
      logger.info("[SMS][IProg] Sent successfully", {
        to: normTo,
        messageId: result.message_id,
      });
      return {
        success: true,
        provider: "iprog",
        messageId: result.message_id,
      };
    } else {
      logger.error("[SMS][IProg] Send failed", {
        to: normTo,
        status: result.status,
        message: result.message,
      });
      return {
        success: false,
        error: result.message || "Unknown error",
        status: result.status,
      };
    }
  } catch (err) {
    logger.error("[SMS][IProg] Request failed", {
      to: normTo,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

async function sendSms({ to, body }) {
  const enabled = process.env.SMS_ENABLED === "true";
  const normTo = normalizePhonePH(to);

  if (!enabled) {
    logger.info("[SMS] (disabled) Would send SMS", {
      to: normTo,
      body,
      provider: "iprog",
    });
    return { skipped: true };
  }

  // Single provider (IProg)
  logger.info("[SMS] Sending via IProg", { to: normTo });
  const result = await sendViaIProg({ to: normTo, body });
  return result;
}

module.exports = {
  sendSms,
  normalizePhonePH,
};

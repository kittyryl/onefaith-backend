const logger = require("./logger");

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
      ? normTo.slice(1)  // Remove + for 639XXXXXXXXX
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
        messageId: result.message_id 
      });
      return { 
        success: true, 
        provider: "iprog",
        messageId: result.message_id 
      };
    } else {
      logger.error("[SMS][IProg] Send failed", { 
        to: normTo, 
        status: result.status,
        message: result.message 
      });
      return { 
        success: false, 
        error: result.message || "Unknown error",
        status: result.status 
      };
    }
  } catch (err) {
    logger.error("[SMS][IProg] Request failed", { 
      to: normTo,
      error: err.message 
    });
    return { success: false, error: err.message };
  }
}

// SMS Provider: Itexmo (Philippine SMS)
async function sendViaItexmo({ to, body }) {
  const apiCode = process.env.ITEXMO_API_CODE;
  const password = process.env.ITEXMO_PASSWORD;

  if (!apiCode || !password) {
    logger.warn("[SMS][Itexmo] Missing configuration");
    return { success: false, error: "Missing Itexmo credentials" };
  }

  const normTo = normalizePhonePH(to);
  
  try {
    // Itexmo API expects 09XXXXXXXXX format (remove +63)
    const phoneNumber = normTo.startsWith("+63") 
      ? "0" + normTo.slice(3) 
      : normTo;

    const response = await fetch("https://www.itexmo.com/php_api/api.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        1: phoneNumber,
        2: body,
        3: apiCode,
        passwd: password,
      }),
    });

    const result = await response.text();
    
    // Itexmo returns "0" for success, error code for failure
    if (result === "0") {
      logger.info("[SMS][Itexmo] Sent successfully", { to: normTo });
      return { success: true, provider: "itexmo" };
    } else {
      const errorMessages = {
        "1": "Invalid API Code or Password",
        "2": "Incomplete Request Parameters",
        "3": "Invalid Phone Number",
        "4": "Maximum Message Limit Reached",
        "5": "Insufficient Credits",
        "10": "Network Error",
        "15": "Message Contains Invalid Characters",
      };
      const errorMsg = errorMessages[result] || `Unknown error code: ${result}`;
      logger.error("[SMS][Itexmo] Send failed", { 
        to: normTo, 
        errorCode: result,
        error: errorMsg 
      });
      return { success: false, error: errorMsg, errorCode: result };
    }
  } catch (err) {
    logger.error("[SMS][Itexmo] Request failed", { 
      to: normTo,
      error: err.message 
    });
    return { success: false, error: err.message };
  }
}

// SMS Provider: Twilio (International/Fallback)
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
    logger.warn("[SMS][Twilio] Module not available:", err?.message || err);
    return null;
  }
}

async function sendViaTwilio({ to, body }) {
  const from = process.env.TWILIO_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const client = getTwilioClient();

  const normTo = normalizePhonePH(to);

  if (!client) {
    logger.warn("[SMS][Twilio] Missing Twilio client");
    return { success: false, error: "Twilio client not available" };
  }
  if (!from && !messagingServiceSid) {
    logger.warn("[SMS][Twilio] Missing FROM or Messaging Service SID");
    return { success: false, error: "Missing Twilio configuration" };
  }

  try {
    const payload = messagingServiceSid
      ? { to: normTo, messagingServiceSid, body }
      : { to: normTo, from, body };

    const resp = await client.messages.create(payload);
    logger.info("[SMS][Twilio] Sent", { sid: resp.sid, to: normTo });
    return { success: true, sid: resp.sid, provider: "twilio" };
  } catch (err) {
    const twilioError = {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      moreInfo: err?.moreInfo,
    };
    logger.error("[SMS][Twilio] Send failed", twilioError);
    return { 
      success: false, 
      error: err?.message || String(err), 
      details: twilioError 
    };
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
  const provider = process.env.SMS_PROVIDER || "iprog"; // Default to IProg

  const normTo = normalizePhonePH(to);

  if (!enabled) {
    logger.info("[SMS] (disabled) Would send SMS", {
      to: normTo,
      body,
      provider,
    });
    return { skipped: true };
  }

  // Try primary provider
  let result;
  if (provider === "iprog") {
    logger.info("[SMS] Sending via IProg", { to: normTo });
    result = await sendViaIProg({ to: normTo, body });
  } else if (provider === "itexmo") {
    logger.info("[SMS] Sending via Itexmo", { to: normTo });
    result = await sendViaItexmo({ to: normTo, body });
  } else if (provider === "twilio") {
    logger.info("[SMS] Sending via Twilio", { to: normTo });
    result = await sendViaTwilio({ to: normTo, body });
  } else {
    logger.warn("[SMS] Unknown provider, defaulting to IProg", { provider });
    result = await sendViaIProg({ to: normTo, body });
  }

  // If primary fails and we have fallback enabled, try alternate provider
  if (!result.success && process.env.SMS_FALLBACK_ENABLED === "true") {
    logger.warn("[SMS] Primary provider failed, trying fallback", { 
      primaryProvider: provider,
      primaryError: result.error 
    });
    
    // Try fallback providers in order: iprog -> itexmo -> twilio
    const fallbackOrder = ["iprog", "itexmo", "twilio"].filter(p => p !== provider);
    
    for (const fallbackProvider of fallbackOrder) {
      logger.info("[SMS] Attempting fallback", { fallbackProvider });
      
      if (fallbackProvider === "iprog") {
        result = await sendViaIProg({ to: normTo, body });
      } else if (fallbackProvider === "itexmo") {
        result = await sendViaItexmo({ to: normTo, body });
      } else if (fallbackProvider === "twilio") {
        result = await sendViaTwilio({ to: normTo, body });
      }
      
      if (result.success) {
        logger.info("[SMS] Fallback succeeded", { provider: fallbackProvider });
        break;
      }
    }
  }

  return result;
}

module.exports = {
  sendSms,
  normalizePhonePH,
};

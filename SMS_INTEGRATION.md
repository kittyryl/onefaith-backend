# SMS Integration for Carwash Services (IProg-only)

## Overview

The system sends SMS notifications to customers when their carwash service is completed, using IProg Tech (Philippine SMS) as the sole provider.

## Features

- Automatic SMS notification when status changes from "in_progress" to "completed"
- Personalized message including customer name, vehicle type, and plate number
- Philippine phone number support: 09XXXXXXXXX and +639XXXXXXXXX (auto-normalized)
- Non-blocking send (SMS is sent asynchronously; the API responds immediately)
- Safe when disabled or when no phone is provided (logged and skipped)

## How It Works

When a service is completed, the backend:

1. Retrieves the ticket (including `customer_phone`)
2. Marks the service as `completed`
3. If a phone exists, sends an SMS via IProg
4. Logs success with a `messageId` (or logs the error if it fails)

### SMS Message Format

```
Hi [Customer Name]! Your carwash service for [Vehicle Type] ([Plate Number]) is now complete and ready for pickup. Thank you for choosing OneFaith Carwash!
```

Example:

```
Hi Juan Dela Cruz! Your carwash service for Sedan (ABC 1234) is now complete and ready for pickup. Thank you for choosing OneFaith Carwash!
```

## Configuration

Create a `.env` file in the `backend` directory with:

```bash
# Enable/disable SMS functionality
SMS_ENABLED=true

# IProg Tech API token
IPROG_API_TOKEN=your_api_token_here
```

### Getting an IProg API Token

1. Sign up at https://sms.iprogtech.com/
2. Purchase credits (₱1 per SMS typical)
3. Generate an API token in your account
4. Set `IPROG_API_TOKEN` in your backend `.env`

### Phone Number Format

The system normalizes Philippine numbers automatically:

- `09171234567` → `+639171234567`
- `+639171234567` → unchanged

## API Endpoint

Complete a carwash service:

```http
PUT /carwash/services/:id/complete
```

Response example:

```json
{
  "message": "Service completed",
  "service": {
    "order_id": "CW-001",
    "status": "completed",
    "completed_at": "2025-11-07T10:30:00.000Z",
    "customer_name": "Juan Dela Cruz",
    "customer_phone": "+639171234567"
  }
}
```

## Testing

### Dry-run (no SMS cost)

1. Set `SMS_ENABLED=false` in backend `.env`
2. Mark a service as complete
3. Check logs for: `[SMS] (disabled) Would send SMS` with the message payload

### Live test with IProg

1. Set `SMS_ENABLED=true` and ensure `IPROG_API_TOKEN` is set
2. Use a real PH mobile number (09XXXXXXXXX or +639XXXXXXXXX)
3. Complete a service and check logs for `[SMS][IProg] Sent successfully` and a `messageId`

## Error Handling & Logging

- Service completion is not blocked by SMS failures
- Logs:
  - `INFO` when SMS is sent (or when disabled/no phone)
  - `WARN` when provider configuration is missing
  - `ERROR` when the request fails or IProg returns an error

## Code Pointers

- `backend/carwash_routes.js` – triggers SMS on complete
- `backend/sms.js` – IProg-only implementation (`sendSms`, `normalizePhonePH`)

## Notes

- Only IProg is supported now (Twilio/Itexmo removed)
- PH numbers are auto-normalized; invalid formats may be rejected by the provider

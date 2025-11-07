# SMS Integration for Carwash Services

## Overview

The carwash service system now includes SMS notifications that are automatically sent to customers when their vehicle service is completed.

## Features

- Automatic SMS notification when service status changes from "in_progress" to "completed"
- Personalized messages including customer name, vehicle type, and plate number
- Philippine phone number format support (09XXXXXXXXX and +639XXXXXXXXX)
- Graceful fallback when SMS is disabled or phone number is not provided
- Non-blocking SMS sending (doesn't delay the API response)

## How It Works

### When a Service is Marked Complete

1. The system retrieves the service details including customer phone number
2. Updates the service status to "completed"
3. If a customer phone number exists, sends an SMS notification
4. Returns the API response immediately (SMS is sent asynchronously)

### SMS Message Format

```
Hi [Customer Name]! Your carwash service for [Vehicle Type] ([Plate Number]) is now complete and ready for pickup. Thank you for choosing OneFaith Carwash!
```

Example:

```
Hi Juan Dela Cruz! Your carwash service for Sedan (ABC 1234) is now complete and ready for pickup. Thank you for choosing OneFaith Carwash!
```

## Configuration

### Required Environment Variables

Create a `.env` file in the backend directory with the following variables:

```bash
# Enable/disable SMS functionality
SMS_ENABLED=true

# Twilio credentials
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM=+15005550006
```

### Getting Twilio Credentials

1. Sign up at [Twilio](https://www.twilio.com/try-twilio)
2. Get your Account SID and Auth Token from the [Twilio Console](https://www.twilio.com/console)
3. Get a phone number from Twilio or use their trial number: +15005550006
4. Add the credentials to your `.env` file

### Phone Number Format

The system automatically normalizes Philippine phone numbers:

- Input: `09171234567` → Output: `+639171234567`
- Input: `+639171234567` → Output: `+639171234567` (no change)

## API Endpoint

### Complete a Carwash Service

```http
PUT /carwash/services/:id/complete
```

**Parameters:**

- `:id` - The order ID of the carwash service

**Response:**

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

**SMS Behavior:**

- ✅ SMS sent if `customer_phone` exists and SMS is enabled
- ⚠️ SMS skipped if `SMS_ENABLED=false` (logged as info)
- ⚠️ SMS skipped if no phone number provided (logged as info)
- ❌ SMS failed but service still marked complete (logged as warning)

## Testing

### Test in Development Mode

1. Set `SMS_ENABLED=false` in your `.env` file
2. Complete a carwash service via the API
3. Check the logs - you'll see: `[SMS] (disabled) Would send SMS`
4. No actual SMS is sent, but you can verify the message content in logs

### Test with Twilio

1. Set `SMS_ENABLED=true`
2. Add valid Twilio credentials
3. Create a carwash service with a valid phone number
4. Mark the service as complete
5. The customer will receive an SMS

### Test Phone Numbers (Twilio Trial)

When using Twilio trial account, you can only send SMS to verified phone numbers. Use these test numbers:

- `+15005550006` - Valid test number
- Your own verified phone number

## Error Handling

### Service Completion Always Succeeds

- The service is marked as "completed" even if SMS fails
- SMS errors are logged but don't block the completion process
- This ensures business operations aren't disrupted by SMS issues

### Logging

All SMS operations are logged with appropriate levels:

- `INFO` - SMS sent successfully or skipped (disabled/no phone)
- `WARN` - SMS sending failed
- `ERROR` - Unexpected errors during SMS processing

### Common Issues

#### SMS Not Sending

1. Check `SMS_ENABLED=true` in `.env`
2. Verify Twilio credentials are correct
3. Check if phone number is in valid format
4. Review backend logs for error messages

#### Invalid Phone Number Format

The system validates phone numbers during service creation:

- Must match format: `+639XXXXXXXXX` or `09XXXXXXXXX`
- Spaces, dashes, and parentheses are automatically removed during validation

## Code Structure

### Files Modified

- `backend/carwash_routes.js` - Added SMS integration to completion endpoint
- `backend/sms.js` - Existing SMS utility (no changes needed)

### Key Functions

- `sendSms({ to, body })` - Sends SMS via Twilio
- `normalizePhonePH(phone)` - Converts PH phone numbers to international format

## Future Enhancements

Potential features to consider:

- SMS notification when service starts
- SMS confirmation when service is created
- Estimated completion time in SMS
- Custom SMS templates per service type
- SMS delivery status tracking
- Support for multiple SMS providers

## Security Notes

- Never commit `.env` file to version control
- Keep Twilio credentials secure
- Rotate credentials regularly
- Use environment-specific credentials (dev/staging/production)
- Consider rate limiting for SMS to prevent abuse

## Support

For issues or questions:

1. Check backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with SMS_ENABLED=false first to isolate issues
4. Review Twilio console for delivery status and errors

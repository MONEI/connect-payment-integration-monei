# MONEI Payment Processor

Backend service for the MONEI commercetools Connect payment integration.

## Overview

The processor handles all payment operations between commercetools and the MONEI Payments API:

- **Create payments**: Initiates MONEI payments from commercetools cart/checkout data
- **Capture**: Captures authorized payments (manual capture flow)
- **Refund**: Full and partial refunds
- **Cancel**: Void authorized payments before capture
- **Webhooks**: Receives MONEI webhook events and syncs payment status to commercetools

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/payment-methods` | List available payment methods |
| POST | `/payments` | Create a new payment |
| GET | `/payments/:id` | Get payment status |
| POST | `/payments/:id/capture` | Capture authorized payment |
| POST | `/payments/:id/cancel` | Cancel authorized payment |
| POST | `/payments/:id/refund` | Refund captured payment |
| POST | `/webhooks/monei` | MONEI webhook endpoint |

## Running locally

```bash
# Copy environment template
cp .env.template .env

# Install dependencies
npm install

# Start in development mode
npm run dev
```

## Required API Client scopes

The commercetools API client needs these scopes:

- `manage_payments`
- `manage_orders`
- `view_sessions`
- `view_api_clients`
- `manage_checkout_payment_intents`
- `introspect_oauth_tokens`
- `manage_types`
- `view_types`

## MONEI Payment Status Mapping

| MONEI Status | CT Transaction Type | CT Transaction State |
|-------------|--------------------|--------------------|
| PENDING | Charge | Pending |
| AUTHORIZED | Authorization | Success |
| SUCCEEDED | Charge | Success |
| FAILED | Charge | Failure |
| CANCELED | CancelAuthorization | Failure |
| REFUNDED | Refund | Success |
| PARTIALLY_REFUNDED | Refund | Success |
| EXPIRED | Charge | Failure |

## Webhook configuration

Configure your MONEI webhook URL in the MONEI Dashboard:
- **URL**: `https://<your-connector-url>/webhooks/monei`
- **Events**: All payment events
- **Secret**: Set `MONEI_WEBHOOK_SECRET` to the generated HMAC key

The processor verifies webhook signatures using HMAC-SHA256 before processing.

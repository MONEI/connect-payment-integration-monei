# MONEI payment connector — processor

Fastify service built on [commercetools' payment-integration template](https://github.com/commercetools/connect-payment-integration-template) and `@commercetools/connect-payments-sdk`. It is the server half of the connector: it creates commercetools Payments from the Checkout session, drives the MONEI Payments API, and keeps the Payment's transactions in sync with MONEI through signed webhooks.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /payments` | Checkout session (`X-Session-Id`) | Create the commercetools Payment from the session's cart and the MONEI payment. Returns `paymentReference`, `moneiPaymentId`, `status` and, for redirect methods, `redirectUrl`. |
| `GET /payments/:id` | Checkout session | Re-read MONEI and sync the Payment (polling fallback for the return page). |
| `POST /webhooks/monei` | `MONEI-Signature` (HMAC-SHA256 over the raw body) | MONEI callback. Applies the final status to the Payment. Idempotent. |
| `GET /operations/config` | Checkout session | Account id, environment, stored-methods flag for the enabler. |
| `GET /operations/status` | JWT | Health: commercetools scopes + MONEI credentials. |
| `GET /operations/payment-components` | JWT | Components the enabler may render (`MONEI_PAYMENT_METHODS_ENABLED`). |
| `POST /operations/payment-intents/:id` | OAuth2 (Checkout) | Capture / cancel / refund / reverse. |

## Payment flow

1. Enabler calls `POST /payments` with the method (and a MONEI.js `paymentToken` for cards/wallets).
2. Processor creates the commercetools Payment (`paymentInterface: monei`), attaches it to the cart, then creates the MONEI payment with `orderId = <ct payment id>`, `callbackUrl = <CONNECT_SERVICE_URL>/webhooks/monei` and the return URLs.
3. The MONEI status is mapped onto a transaction (`SUCCEEDED → Charge/Success`, `PENDING → Charge/Pending`, `AUTHORIZED → Authorization/Success`, …) and `interfaceId` is set to the MONEI payment id.
4. For Bizum and 3DS challenges the enabler redirects the shopper to `redirectUrl`. When the payment reaches a final state MONEI posts it to `/webhooks/monei`; the processor verifies the signature on the raw bytes, finds the Payment by `interfaceId` (falling back to `orderId`) and adds the resulting transaction unless it is already there.
5. Capture, cancel and refund come in through `/operations/payment-intents` and go out to MONEI before the Payment is updated; MONEI-side failures are recorded as `Failure` transactions and reported as `rejected`.

`transactionType: AUTH` is honoured for cards only; Bizum, wallets and SEPA are always immediate sales.

## Configuration

See `connect.yaml` at the repository root. MONEI-specific keys: `MONEI_API_KEY` (secured), `MONEI_ACCOUNT_ID`, `MONEI_ENVIRONMENT`, `MONEI_PAYMENT_METHODS_ENABLED`, optional `MONEI_WEBHOOK_SECRET`, `MONEI_WEBHOOK_TOLERANCE_SECONDS`, `MERCHANT_RETURN_URL`. `CONNECT_SERVICE_URL` is injected by Connect and used to build the callback URL.

## Development

```bash
npm install
npm test          # jest — 58 tests, no network
npm run lint
npm run build && npm start
```

# MONEI Payment Connector for commercetools

[![CI](https://github.com/MONEI/connect-payment-integration-monei/actions/workflows/ci.yml/badge.svg)](https://github.com/MONEI/connect-payment-integration-monei/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

This repository provides a [commercetools Connect](https://docs.commercetools.com/connect) payment integration connector for [MONEI](https://monei.com), enabling merchants to accept Bizum, card payments, Apple Pay, Google Pay, and SEPA Direct Debit through commercetools Composable Commerce.

## Overview

[MONEI](https://monei.com) is a Payment Institution licensed by the Banco de España (reg. #6911), providing API-first payment infrastructure for online and in-store commerce across Spain and Europe.

This connector follows the [commercetools payment integration template](https://docs.commercetools.com/connect/templates/payment-integration) pattern and is compatible with [commercetools Checkout](https://docs.commercetools.com/checkout).

### Supported payment methods

| Method | Type | Capture | Refund | Cancel |
|--------|------|---------|--------|--------|
| Card (Visa, Mastercard) | Web component | Manual / Auto | ✅ | ✅ |
| Bizum | Redirect | Auto | ✅ | ✅ |
| Apple Pay | Web component | Auto | ✅ | ✅ |
| Google Pay | Web component | Auto | ✅ | ✅ |
| SEPA Direct Debit | Form input | Auto | ✅ | N/A |

### Key features

- **Multi-acquirer routing** — intelligent routing across Comercia/CaixaBank, GetNet/Santander, and Shift4/Finaro for optimal authorization rates
- **Bizum** — the only commercetools connector offering native Bizum acquiring, Spain's dominant mobile payment method (28M+ users)
- **PCI DSS compliant** — card data handled via MONEI.js secure iframes, reducing merchant PCI scope

## Architecture

The connector contains two applications:

| Application | Type | Description |
|-------------|------|-------------|
| **Enabler** | `assets` | Frontend library wrapping MONEI payment UI components (card input, Bizum button, wallet buttons). Served as static assets to commercetools Checkout or custom frontends. |
| **Processor** | `service` | Backend service orchestrating payment operations with the [MONEI Payments API](https://docs.monei.com/api). Handles payment creation, capture, refund, cancellation, and webhook event processing. |

Both applications can be hosted on Connect or on alternative platforms, and can be used together with [Checkout](https://docs.commercetools.com/checkout) or in custom frontend applications.

## Prerequisites

### 1. MONEI account

[Sign up at monei.com](https://monei.com) and obtain your API Key and Account ID from [MONEI Dashboard → Settings → API Access](https://dashboard.monei.com/settings/api).

### 2. commercetools API client

Create an API client with the following scopes:

- `manage_payments`
- `manage_orders`
- `view_sessions`
- `view_api_clients`
- `manage_checkout_payment_intents`
- `introspect_oauth_tokens`
- `manage_types`
- `view_types`

### 3. commercetools platform URLs

The connector requires these URLs (defaults to `europe-west1.gcp`):

- `CTP_API_URL` — commercetools API URL
- `CTP_AUTH_URL` — commercetools Auth URL
- `CTP_SESSION_URL` — commercetools Session URL

## Getting started

### 1. Environment setup

```bash
cp processor/.env.template processor/.env
cp enabler/.env.template enabler/.env
```

Edit the `.env` files with your MONEI and commercetools credentials.

### 2. Local development

```bash
docker compose up
```

This starts three services:

1. **JWT Server** — local authentication for development
2. **Enabler** — frontend components at `http://localhost:3000`
3. **Processor** — backend API at `http://localhost:8080`

### 3. Run tests

```bash
cd processor && npm test
cd enabler && npm test
```

## Deployment configuration

The deployment configuration is specified in [`connect.yaml`](./connect.yaml). Below are the key MONEI-specific variables:

| Variable | Description | Required | Secured |
|----------|-------------|----------|---------|
| `MONEI_API_KEY` | MONEI API key from [Dashboard](https://dashboard.monei.com/settings/api) | Yes | Yes |
| `MONEI_ACCOUNT_ID` | MONEI merchant account ID | Yes | No |
| `MONEI_WEBHOOK_SECRET` | HMAC key for webhook signature verification | Yes | Yes |
| `MONEI_ENVIRONMENT` | `test` or `live` | Yes | No |
| `MONEI_PAYMENT_METHODS_ENABLED` | Comma-separated list: `bizum,card,applePay,googlePay,sepaDirectDebit` | No | No |

For the full list of commercetools configuration variables, see [`connect.yaml`](./connect.yaml).

## Webhook configuration

The processor exposes a webhook endpoint at `/webhooks/monei` for receiving payment status notifications from MONEI.

1. Go to [MONEI Dashboard → Settings → Webhooks](https://dashboard.monei.com/settings/webhooks)
2. Add the webhook URL: `https://<your-processor-url>/webhooks/monei`
3. Copy the HMAC signing key and set it as `MONEI_WEBHOOK_SECRET`

All incoming webhooks are verified using HMAC-SHA256 signatures before processing.

## Currencies

MONEI follows the [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) standard. commercetools provides monetary values in cent amounts (e.g., €1.50 = `150`). The connector handles conversion automatically using utilities from [connect-payments-sdk](https://github.com/commercetools/connect-payments-sdk).

## Deployment

Deploy the connector to commercetools Connect using the [Connect CLI](https://docs.commercetools.com/connect/cli):

```bash
npm install -g @commercetools-connect/cli
connect-cli connector create
connect-cli connector publish
```

## Documentation

- [MONEI API Reference](https://docs.monei.com/api)
- [MONEI.js Overview](https://docs.monei.com/docs/monei-js/overview)
- [commercetools Payment Integration Template](https://docs.commercetools.com/connect/templates/payment-integration)
- [commercetools Checkout](https://docs.commercetools.com/checkout)
- [MONEI commercetools Setup Guide](https://docs.monei.com/e-commerce/commercetools/)

## Creator

**MONEI Digital Payments, S.L.**
Passeig de Gràcia, 19, 08007 Barcelona, Spain
Banco de España reg. #6911

- Website: [monei.com](https://monei.com)
- API Docs: [docs.monei.com](https://docs.monei.com)
- Support: [support.monei.com](https://support.monei.com)
- LinkedIn: [MONEI Digital Payments](https://www.linkedin.com/company/monei-digital-payments/)

## License

[MIT](./LICENSE)

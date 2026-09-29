# MONEI Payment Connector for commercetools

[![CI](https://github.com/MONEI/connect-payment-integration-monei/actions/workflows/ci.yml/badge.svg)](https://github.com/MONEI/connect-payment-integration-monei/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

This repository provides a [commercetools Connect](https://docs.commercetools.com/connect) payment integration connector for [MONEI](https://monei.com), enabling merchants to accept Bizum, card payments, Apple Pay, Google Pay, and SEPA Direct Debit through commercetools Composable Commerce.

## Overview

[MONEI](https://monei.com) is a Payment Institution licensed by the Banco de España (reg. #6911), providing API-first payment infrastructure for online and in-store commerce across Spain and Europe.

The processor and enabler are built on the [commercetools payment integration template](https://docs.commercetools.com/connect/templates/payment-integration) (`@commercetools/connect-payments-sdk`, Checkout `Enabler` contract).

> [!WARNING]
> The connector is covered by unit tests only. It has not been verified end to end against a commercetools project, with [commercetools Checkout](https://docs.commercetools.com/checkout), or with live MONEI payments, and it is not certified on the Connect Marketplace. Deploy it from this repository with the Connect CLI.

### Supported payment methods

| Method | Enabler component | Authorize, then capture (`AUTH`) | Refund |
|--------|-------------------|----------------------------------|--------|
| Card (Visa, Mastercard) | MONEI.js card input | Yes | Yes |
| Bizum | MONEI.js Bizum button, or redirect | Yes | Yes |
| Apple Pay | MONEI.js payment request button | Yes | Yes |
| Google Pay | MONEI.js payment request button | Yes | Yes |
| SEPA Direct Debit | None (processor only) | No | Yes |

`MONEI_TRANSACTION_TYPE` sets `SALE` (charge at once, the default) or `AUTH` for the whole deployment. You cancel an authorization, or capture it, through `/operations/payment-intents/:id`.

### Key features

- **Multi-acquirer routing** — intelligent routing across Comercia/CaixaBank, GetNet/Santander, and Shift4/Finaro for optimal authorization rates
- **Bizum** — the only commercetools connector offering native Bizum acquiring, Spain's dominant mobile payment method (28M+ users)
- **PCI DSS compliant** — card data handled via MONEI.js secure iframes, reducing merchant PCI scope

## Architecture

The connector contains two applications:

| Application | Type | Description |
|-------------|------|-------------|
| **Enabler** | `assets` | Checkout `Enabler` implementation over MONEI.js: card (hosted iframes), Bizum (request-to-pay or redirect), Apple Pay / Google Pay, embedded drop-in. Bundle `monei-enabler.umd.js`, global `Enabler`. |
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
cd processor && npm install && npm run dev   # backend API at http://localhost:8080
cd enabler && npm install && npm run dev     # enabler test page at http://localhost:3000
```

The processor needs a real commercetools project and a MONEI test account: session routes check the session against the commercetools Session API.

### 3. Run tests

```bash
cd processor && npm run lint && npm test
cd enabler && npm run lint && npm test
```

## Deployment configuration

The deployment configuration is specified in [`connect.yaml`](./connect.yaml). Below are the key MONEI-specific variables:

| Variable | Description | Required | Secured |
|----------|-------------|----------|---------|
| `MONEI_API_KEY` | MONEI API key from [Dashboard](https://dashboard.monei.com/settings/api) | Yes | Yes |
| `MONEI_ACCOUNT_ID` | MONEI merchant account ID | Yes | No |
| `MONEI_ENVIRONMENT` | `test` or `live` | Yes | No |
| `MONEI_PAYMENT_METHODS_ENABLED` | Comma-separated list. Default `bizum,card,applePay,googlePay`. `sepaDirectDebit` is accepted by the processor, but the enabler has no SEPA component. | No | No |
| `MONEI_TRANSACTION_TYPE` | `SALE` (default) or `AUTH` | No | No |
| `MERCHANT_RETURN_URL` | Where the shopper returns after a redirect (Bizum, 3DS) when neither the enabler nor the commercetools session gives a return URL | No | No |
| `MONEI_WEBHOOK_TOLERANCE_SECONDS` | Maximum age of a webhook signature timestamp. `0` (default) disables the check, like the MONEI SDKs | No | No |

For the full list of commercetools configuration variables, see [`connect.yaml`](./connect.yaml).

## Webhook configuration

The processor receives MONEI payment updates at `/webhooks/monei`. It sets this URL as the `callbackUrl` of every payment it creates, so no Dashboard setup is needed.

MONEI signs each request with your API key. The processor verifies the `MONEI-Signature` header (HMAC-SHA256 over the raw body) with `MONEI_API_KEY` and rejects unsigned or tampered requests with `401`.

## Currencies

MONEI and commercetools both express amounts in the minor unit of an [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) currency (for example, €1.50 = `150`). The processor sends the commercetools cart amount to MONEI unchanged.

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

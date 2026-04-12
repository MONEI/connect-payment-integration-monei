# connect-payment-integration-monei

This repository provides a [commercetools Connect](https://docs.commercetools.com/connect) payment integration connector for [MONEI](https://monei.com), Spain's leading API-first payment platform.

## Overview

MONEI is a licensed Payment Institution (Banco de España #6911) processing toward €1B in annual transaction volume. This connector enables commercetools merchants to accept payments via:

- **Bizum** — Spain's dominant mobile payment method (28M+ users)
- **Cards** — Visa, Mastercard via multi-acquirer routing (Comercia/CaixaBank, GetNet/Santander, Shift4/Finaro)
- **Apple Pay** & **Google Pay** — Digital wallet payments
- **SEPA Direct Debit** — Recurring and one-time bank payments

### Unique capabilities

- **Multi-acquirer routing**: Intelligent routing across multiple acquirers for optimal authorization rates
- **AI-native payments**: First European PSP with a production [MCP Server](https://github.com/MONEI/MONEI-MCP-Server) for agentic commerce
- **Spanish market coverage**: Only connector offering native Bizum acquiring for commercetools

## Architecture

The connector follows the [commercetools payment integration template](https://docs.commercetools.com/connect/templates/payment-integration) pattern with two modules:

### Enabler

Frontend library that wraps MONEI's payment components (card input, Bizum button, wallet buttons) and exposes them to commercetools Checkout or custom frontends. Served as static assets.

### Processor

Backend service that:
- Creates and manages MONEI payments via the [MONEI Payments API](https://docs.monei.com/api)
- Handles payment lifecycle: authorize → capture → refund/cancel
- Listens for MONEI webhook events and syncs payment status to commercetools
- Manages sessions and JWT authentication via [connect-payments-sdk](https://github.com/commercetools/connect-payments-sdk)

## Prerequisites

### 1. MONEI account

Sign up at [monei.com](https://monei.com) and obtain your API key from the MONEI Dashboard.

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

## Getting started

### 1. Environment setup

```bash
# Processor
cp processor/.env.template processor/.env
# Edit processor/.env with your credentials

# Enabler
cp enabler/.env.template enabler/.env
```

### 2. Local development

```bash
docker compose up
```

This starts the JWT server, enabler, and processor services.

### 3. Run tests

```bash
cd processor && npm test
cd enabler && npm test
```

## Deployment configuration

See [connect.yaml](./connect.yaml) for all configuration variables.

| Variable | Description | Required |
|----------|-------------|----------|
| `MONEI_API_KEY` | MONEI API key (secured) | Yes |
| `MONEI_ACCOUNT_ID` | MONEI merchant account ID | Yes |
| `MONEI_WEBHOOK_SECRET` | Webhook signature verification secret (secured) | Yes |
| `MONEI_ENVIRONMENT` | `test` or `live` | Yes |
| `MONEI_PAYMENT_METHODS_ENABLED` | Comma-separated list of enabled methods | No |

## Supported payment methods

| Method | Type | Capture | Refund | Cancel |
|--------|------|---------|--------|--------|
| Bizum | Redirect | Auto | ✅ | ✅ |
| Card | Web component | Manual/Auto | ✅ | ✅ |
| Apple Pay | Web component | Auto | ✅ | ✅ |
| Google Pay | Web component | Auto | ✅ | ✅ |
| SEPA DD | Redirect | Auto | ✅ | N/A |

## Currencies

MONEI follows the [ISO 4217](https://en.wikipedia.org/wiki/ISO_4217) standard. commercetools provides monetary values in cent amounts (e.g., €1.50 = `150`). The connector handles conversion between commercetools cent amounts and MONEI's cent-based amounts automatically.

## Publishing

### Private use

```bash
# Install Connect CLI
npm install -g @commercetools-connect/cli

# Create and publish
connect-cli connector create
connect-cli connector publish --certification false
```

### Public marketplace

Follow the [certification process](https://docs.commercetools.com/connect/certification) for listing on the Connect marketplace.

## License

MIT

## About MONEI

[MONEI](https://monei.com) is a licensed Payment Institution regulated by the Banco de España (reg. #6911), headquartered in Barcelona. We provide API-first payment infrastructure for online and in-store commerce across Spain and Europe.

- Website: [monei.com](https://monei.com)
- API docs: [docs.monei.com](https://docs.monei.com)
- LinkedIn: [MONEI Digital Payments](https://www.linkedin.com/company/monei-digital-payments/)

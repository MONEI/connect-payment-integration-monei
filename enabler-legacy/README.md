# MONEI Payment Enabler

Frontend library for the MONEI commercetools Connect payment integration.

## Overview

The enabler wraps MONEI's payment UI components and exposes them to commercetools Checkout or custom frontend applications. It serves as static assets that Checkout loads when rendering payment methods.

## Components

| Component | Description | Type |
|-----------|-------------|------|
| `CardComponent` | PCI-compliant card input (number, expiry, CVC) via MONEI.js iframe | Web component |
| `BizumComponent` | "Pay with Bizum" button with redirect flow | Redirect |
| `GooglePayComponent` | Google Pay button via MONEI.js | Web component |
| `ApplePayComponent` | Apple Pay button (Safari/iOS only) | Web component |
| `SepaDirectDebitComponent` | IBAN input with mandate text | Form input |

## Usage with commercetools Checkout

The enabler is automatically loaded by Checkout based on merchant configuration. No additional setup is required on the frontend.

## Usage with custom frontend

```typescript
import MoneiPaymentEnabler from './monei-enabler';

const enabler = new MoneiPaymentEnabler();

// Initialize with processor URL and session
await enabler.init({
  processorUrl: 'https://your-processor-url.com',
  sessionId: 'session-token-from-checkout',
  locale: 'es',
});

// Create and mount a card component
const card = enabler.createComponent('card');
card.mount('#card-container');

// Create and mount Bizum
const bizum = enabler.createComponent('bizum');
bizum.mount('#bizum-container');

// Submit payment
const result = await card.submit();
if (result.redirectUrl) {
  window.location.href = result.redirectUrl;
} else if (result.isSuccess) {
  // Payment completed
}
```

## Development

```bash
cp .env.template .env
npm install
npm run dev
```

Opens at `http://localhost:3000` with a test page showing all payment components.

## Building

```bash
npm run build
```

Outputs `dist/monei-enabler.js` as a UMD bundle.

## Dependencies

- **MONEI.js** (`https://js.monei.com/v2/monei.js`): Secure payment components library loaded at runtime
- **@monei-js/components**: TypeScript types for MONEI.js components

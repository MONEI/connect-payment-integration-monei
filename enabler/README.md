# MONEI payment connector — enabler

Browser library for commercetools Checkout (and custom storefronts) built on the payment-integration template's `Enabler` contract: `createComponentBuilder`, `createDropinBuilder`, `isAvailable`, `submit`, `onComplete`. Bundles: `public/monei-enabler.umd.js` (global `Enabler`) and `public/monei-enabler.es.js`.

Card data is collected by **MONEI.js** inside MONEI-hosted iframes and never touches the page (SAQ A). MONEI.js is always loaded from `https://js.monei.com/v3/monei.js`, never bundled.

## Components

| Type | Renders | Submit | Flow |
|---|---|---|---|
| `card` | MONEI.js `CardInput` (iframe) | Checkout button or own button | tokenise in browser → `POST /payments` with token → 3DS challenge redirect if MONEI asks |
| `bizum` | MONEI.js `Bizum` request-to-pay button, or own "Pay with Bizum" button with `showPayButton` | own button / Checkout | token (RTP) or redirect; back on the return URL the enabler confirms with the processor |
| `applePay` / `googlePay` | MONEI.js `PaymentRequest` | the wallet sheet (`componentHasSubmit=false`) | wallet token → `POST /payments` |
| drop-in `embedded` | card + Bizum in one block | Checkout | as above |

`isAvailable()` hides Bizum outside `ES`/`AD` when Checkout passes `countryCode`, and hides wallets the browser cannot show.

## How it talks to the processor

All calls carry `X-Session-Id`. The enabler never sees amounts from the page: `GET /payment-amount` returns the session cart's amount for the wallet / Bizum buttons, and `POST /payments` derives everything else server-side.

Return URL: the enabler sends the current page URL with `ctPaymentReference={paymentReference}`; the processor substitutes the commercetools Payment id before passing it to MONEI. On load, if that parameter is present, the enabler calls `GET /payments/:id`, which syncs the Payment with MONEI, and fires `onComplete`.

## Usage

```html
<script src="https://assets-<connector>.<region>.commercetools.app/monei-enabler.umd.js"></script>
<script>
  const enabler = new Enabler({
    processorUrl, sessionId, locale: 'es-ES', countryCode: 'ES',
    onComplete: ({ isSuccess, paymentReference }) => { /* create the Order server-side on webhook, not here */ },
    onError: (err) => console.error(err),
  });
  const bizum = (await enabler.createComponentBuilder('bizum')).build({ showPayButton: true });
  await bizum.mount('#bizum');
</script>
```

## Development

```bash
npm install
npm test        # jest, no DOM needed
npm run build   # tsc + vite → public/
```

Not yet supported: stored payment methods, express checkout, SEPA Direct Debit component.

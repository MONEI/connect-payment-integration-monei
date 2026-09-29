export const config = {
  // Required by Payment SDK
  projectKey: process.env.CTP_PROJECT_KEY || 'payment-integration',
  clientId: process.env.CTP_CLIENT_ID || 'xxx',
  clientSecret: process.env.CTP_CLIENT_SECRET || 'xxx',
  jwksUrl: process.env.CTP_JWKS_URL || 'https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json',
  jwtIssuer: process.env.CTP_JWT_ISSUER || 'https://mc-api.europe-west1.gcp.commercetools.com',
  authUrl: process.env.CTP_AUTH_URL || 'https://auth.europe-west1.gcp.commercetools.com',
  apiUrl: process.env.CTP_API_URL || 'https://api.europe-west1.gcp.commercetools.com',
  sessionUrl: process.env.CTP_SESSION_URL || 'https://session.europe-west1.gcp.commercetools.com/',
  checkoutUrl: process.env.CTP_CHECKOUT_URL || 'https://checkout.europe-west1.gcp.commercetools.com',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),

  // Required by logger
  loggerLevel: process.env.LOGGER_LEVEL || 'info',

  // MONEI
  moneiApiKey: process.env.MONEI_API_KEY || '',
  moneiAccountId: process.env.MONEI_ACCOUNT_ID || '',
  moneiEnvironment: (process.env.MONEI_ENVIRONMENT || 'test') as 'test' | 'live',
  moneiApiUrl: process.env.MONEI_API_URL || 'https://api.monei.com/v1',
  moneiPaymentMethodsEnabled: process.env.MONEI_PAYMENT_METHODS_ENABLED || 'bizum,card,applePay,googlePay',
  /** Seconds of clock skew tolerated on the `t=` part of MONEI-Signature. 0 = not enforced (MONEI SDK behaviour). */
  moneiWebhookToleranceSeconds: parseInt(process.env.MONEI_WEBHOOK_TOLERANCE_SECONDS || '0'),

  // Public URL of this processor. Connect injects CONNECT_SERVICE_URL at deploy time; it is used to
  // build the per-payment callbackUrl MONEI posts the final payment state to.
  connectServiceUrl: process.env.CONNECT_SERVICE_URL || '',

  // Where the shopper lands after a redirect method (Bizum, 3DS challenge, hosted page) when neither
  // the enabler nor the commercetools session provides a return URL.
  merchantReturnUrl: process.env.MERCHANT_RETURN_URL,

  // env variables related to stored payment methods feature
  storedPaymentMethodsEnabled: process.env.STORED_PAYMENT_METHODS_ENABLED || 'false',
  storedPaymentMethodsPaymentInterface: process.env.STORED_PAYMENT_METHODS_PAYMENT_INTERFACE || 'monei',
  storedPaymentMethodsInterfaceAccount: process.env.STORED_PAYMENT_METHODS_INTERFACE_ACCOUNT || undefined,
};

export const getConfig = () => {
  return config;
};

export const getEnabledPaymentMethods = (): string[] =>
  getConfig()
    .moneiPaymentMethodsEnabled.split(',')
    .map((m) => m.trim())
    .filter(Boolean);

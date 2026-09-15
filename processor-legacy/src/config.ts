import { z } from 'zod';

const envSchema = z.object({
  // commercetools
  CTP_PROJECT_KEY: z.string(),
  CTP_CLIENT_ID: z.string(),
  CTP_CLIENT_SECRET: z.string(),
  CTP_AUTH_URL: z.string().url().default('https://auth.europe-west1.gcp.commercetools.com'),
  CTP_API_URL: z.string().url().default('https://api.europe-west1.gcp.commercetools.com'),
  CTP_SESSION_URL: z.string().url().default('https://session.europe-west1.gcp.commercetools.com'),
  CTP_JWKS_URL: z.string().url().default('https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json'),
  CTP_JWT_ISSUER: z.string().default('https://mc-api.europe-west1.gcp.commercetools.com'),

  // MONEI
  MONEI_API_KEY: z.string(),
  MONEI_ACCOUNT_ID: z.string(),
  MONEI_WEBHOOK_SECRET: z.string(),
  MONEI_ENVIRONMENT: z.enum(['test', 'live']).default('test'),
  MONEI_PAYMENT_METHODS_ENABLED: z.string().default('bizum,card,applePay,googlePay'),

  // Stored payment methods
  STORED_PAYMENT_METHODS_ENABLED: z.string().default('false'),
  STORED_PAYMENT_METHODS_PAYMENT_INTERFACE: z.string().default('monei'),
  STORED_PAYMENT_METHODS_INTERFACE_ACCOUNT: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;

export function getConfig(): Config {
  if (!config) {
    config = envSchema.parse(process.env);
  }
  return config;
}

export function getMoneiBaseUrl(): string {
  const env = getConfig().MONEI_ENVIRONMENT;
  return env === 'live'
    ? 'https://api.monei.com/v1'
    : 'https://api.monei.com/v1'; // MONEI uses same URL, API key determines environment
}

export function getEnabledPaymentMethods(): string[] {
  return getConfig().MONEI_PAYMENT_METHODS_ENABLED.split(',').map((m) => m.trim());
}

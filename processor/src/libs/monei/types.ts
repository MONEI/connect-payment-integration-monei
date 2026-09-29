/** Subset of the MONEI Payments API (https://docs.monei.com/api) used by this connector. */

export type MoneiPaymentStatus =
  | 'PENDING'
  | 'PENDING_PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'AUTHORIZED'
  | 'EXPIRED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'PAID_OUT';

export type MoneiTransactionType = 'SALE' | 'AUTH';

export type MoneiPaymentMethodType = 'card' | 'bizum' | 'applePay' | 'googlePay' | 'sepa';

export interface MoneiAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface MoneiCreatePaymentRequest {
  amount: number; // integer, minor units
  currency: string; // ISO 4217
  orderId: string;
  description?: string;
  customer?: { email?: string; name?: string; phone?: string };
  billingDetails?: { name?: string; email?: string; phone?: string; address?: MoneiAddress };
  shippingDetails?: { name?: string; email?: string; phone?: string; address?: MoneiAddress };
  allowedPaymentMethods?: MoneiPaymentMethodType[];
  /** Token produced by MONEI.js components (cards, wallets) or a stored-method token. */
  paymentToken?: string;
  /** Required with paymentToken so MONEI can charge it. */
  sessionId?: string;
  /** Set when a MONEI.js-generated token must be kept for later use. */
  generatePaymentToken?: boolean;
  callbackUrl?: string;
  completeUrl?: string;
  cancelUrl?: string;
  failUrl?: string;
  transactionType?: MoneiTransactionType;
  metadata?: Record<string, string>;
}

export interface MoneiPayment {
  id: string;
  amount: number;
  currency: string;
  orderId: string;
  status: MoneiPaymentStatus;
  statusCode?: string;
  statusMessage?: string;
  transactionType?: MoneiTransactionType;
  refundedAmount?: number;
  nextAction?: { type: string; redirectUrl?: string; mustRedirect?: boolean };
  paymentMethod?: {
    type?: string;
    method?: string;
    card?: { brand?: string; last4?: string; expiration?: number; type?: string };
    bizum?: { phoneNumber?: string };
  };
  paymentToken?: string;
  livemode?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface MoneiRefundRequest {
  amount?: number;
  refundReason?: string;
}

export interface MoneiCaptureRequest {
  amount?: number;
}

/** Envelope MONEI sends for account-level webhooks; per-payment callbackUrl deliveries are a bare MoneiPayment. */
export interface MoneiEventEnvelope {
  id?: string;
  type: string;
  object: MoneiPayment;
  createdAt?: number;
}

export class MoneiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `MONEI API error ${status}`);
    this.name = 'MoneiApiError';
  }
}

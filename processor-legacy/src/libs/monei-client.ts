import { getConfig, getMoneiBaseUrl } from '../config';

export interface MoneiPaymentRequest {
  amount: number; // Amount in cents
  currency: string; // ISO 4217 currency code
  orderId: string;
  description?: string;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string; // ISO 3166-1 alpha-2
    };
  };
  shippingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
  };
  paymentMethod?: {
    type?: string; // card, bizum, applePay, googlePay, sepaDirectDebit
  };
  callbackUrl?: string;
  completeUrl?: string;
  cancelUrl?: string;
  sessionDetails?: Record<string, string>;
  transactionType?: 'SALE' | 'AUTH';
}

export interface MoneiPaymentResponse {
  id: string;
  amount: number;
  currency: string;
  orderId: string;
  status: MoneiPaymentStatus;
  statusCode?: string;
  statusMessage?: string;
  nextAction?: {
    type: string;
    redirectUrl?: string;
    mustRedirect?: boolean;
  };
  paymentMethod?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
    bizum?: {
      phoneNumber?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
  livemode: boolean;
}

export type MoneiPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'AUTHORIZED'
  | 'EXPIRED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface MoneiCaptureRequest {
  amount?: number; // Optional partial capture amount in cents
}

export interface MoneiRefundRequest {
  amount?: number; // Optional partial refund amount in cents
  reason?: string;
}

export interface MoneiRefundResponse {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  createdAt: string;
}

/**
 * MONEI API Client
 *
 * Handles all communication with the MONEI Payments API.
 * Uses MONEI REST API v1: https://docs.monei.com/api
 */
export class MoneiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.MONEI_API_KEY;
    this.baseUrl = getMoneiBaseUrl();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': this.apiKey,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = { method, headers };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `MONEI API error ${response.status}: ${errorBody}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 200ms, 400ms, 800ms
          await new Promise((resolve) =>
            setTimeout(resolve, 200 * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Create a new payment
   */
  async createPayment(
    params: MoneiPaymentRequest
  ): Promise<MoneiPaymentResponse> {
    return this.request<MoneiPaymentResponse>('POST', '/payments', params as unknown as Record<string, unknown>);
  }

  /**
   * Get payment details
   */
  async getPayment(paymentId: string): Promise<MoneiPaymentResponse> {
    return this.request<MoneiPaymentResponse>('GET', `/payments/${paymentId}`);
  }

  /**
   * Capture an authorized payment
   */
  async capturePayment(
    paymentId: string,
    params?: MoneiCaptureRequest
  ): Promise<MoneiPaymentResponse> {
    return this.request<MoneiPaymentResponse>(
      'POST',
      `/payments/${paymentId}/capture`,
      params as unknown as Record<string, unknown>
    );
  }

  /**
   * Cancel/void an authorized payment
   */
  async cancelPayment(paymentId: string): Promise<MoneiPaymentResponse> {
    return this.request<MoneiPaymentResponse>(
      'POST',
      `/payments/${paymentId}/cancel`
    );
  }

  /**
   * Refund a captured payment
   */
  async refundPayment(
    paymentId: string,
    params?: MoneiRefundRequest
  ): Promise<MoneiRefundResponse> {
    return this.request<MoneiRefundResponse>(
      'POST',
      `/payments/${paymentId}/refund`,
      params as unknown as Record<string, unknown>
    );
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    const config = getConfig();
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', config.MONEI_WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// Singleton instance
let moneiClient: MoneiClient;

export function getMoneiClient(): MoneiClient {
  if (!moneiClient) {
    moneiClient = new MoneiClient();
  }
  return moneiClient;
}

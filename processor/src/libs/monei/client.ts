import { getConfig } from '../../config/config';
import {
  MoneiApiError,
  MoneiCaptureRequest,
  MoneiCreatePaymentRequest,
  MoneiPayment,
  MoneiRefundRequest,
} from './types';

export interface MoneiClientOptions {
  apiKey?: string;
  apiUrl?: string;
  accountId?: string;
  fetchFn?: typeof fetch;
  userAgent?: string;
}

/**
 * Thin client over the MONEI REST API v1. One method per endpoint the connector needs; no retries
 * (Connect's platform retries idempotent operations and MONEI's create-payment is not idempotent).
 */
export class MoneiClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly accountId?: string;
  private readonly fetchFn: typeof fetch;
  private readonly userAgent: string;

  constructor(opts: MoneiClientOptions = {}) {
    const cfg = getConfig();
    this.apiKey = opts.apiKey ?? cfg.moneiApiKey;
    this.apiUrl = (opts.apiUrl ?? cfg.moneiApiUrl).replace(/\/$/, '');
    this.accountId = opts.accountId ?? cfg.moneiAccountId;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.userAgent = opts.userAgent ?? 'MONEI/commercetools-connect';
  }

  createPayment(body: MoneiCreatePaymentRequest, idempotencyKey?: string): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('POST', '/payments', body, idempotencyKey);
  }

  /** Confirms a payment created without a payment method, using a MONEI.js token. */
  confirmPayment(id: string, body: { paymentToken: string; sessionId?: string }): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('POST', `/payments/${encodeURIComponent(id)}/confirm`, body);
  }

  getPayment(id: string): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('GET', `/payments/${encodeURIComponent(id)}`);
  }

  capturePayment(id: string, body: MoneiCaptureRequest = {}): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('POST', `/payments/${encodeURIComponent(id)}/capture`, body);
  }

  cancelPayment(id: string): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('POST', `/payments/${encodeURIComponent(id)}/cancel`, {});
  }

  refundPayment(id: string, body: MoneiRefundRequest = {}): Promise<MoneiPayment> {
    return this.request<MoneiPayment>('POST', `/payments/${encodeURIComponent(id)}/refund`, body);
  }

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      Accept: 'application/json',
      'User-Agent': this.userAgent,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accountId) headers['MONEI-Account-ID'] = this.accountId;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await this.fetchFn(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : `MONEI API ${method} ${path} failed with ${res.status}`;
      throw new MoneiApiError(res.status, parsed, message);
    }
    return parsed as T;
  }
}

let defaultClient: MoneiClient | undefined;

export const getMoneiClient = (): MoneiClient => {
  if (!defaultClient) defaultClient = new MoneiClient();
  return defaultClient;
};

/** Test hook. */
export const setMoneiClient = (client: MoneiClient | undefined): void => {
  defaultClient = client;
};

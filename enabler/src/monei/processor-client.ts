/**
 * Typed client for the processor's enabler-facing routes. Every call carries the Checkout session id;
 * the processor derives cart, amount and customer from it, so nothing here is trusted server-side.
 */

export type ProcessorConfig = {
  clientKey: string; // MONEI Account ID
  environment: "test" | "live" | string;
  storedPaymentMethodsConfig?: { isEnabled: boolean };
};

export type PaymentAmount = { centAmount: number; currencyCode: string; fractionDigits: number };

export type CreatePaymentRequest = {
  paymentMethod: {
    type: "card" | "bizum" | "applePay" | "googlePay" | "sepaDirectDebit";
    paymentToken?: string;
    sessionId?: string;
    storePaymentMethod?: boolean;
  };
  returnUrl?: string;
  cancelUrl?: string;
  transactionType?: "SALE" | "AUTH";
};

export type CreatePaymentResponse = {
  paymentReference: string;
  moneiPaymentId: string;
  status: string;
  redirectUrl?: string;
};

export type PaymentStatusResponse = {
  paymentReference: string;
  moneiPaymentId: string;
  status: string;
};

export class ProcessorError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `Processor request failed with ${status}`);
    this.name = "ProcessorError";
  }
}

export class ProcessorClient {
  constructor(
    private readonly processorUrl: string,
    private readonly sessionId: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  getConfig(): Promise<ProcessorConfig> {
    return this.request<ProcessorConfig>("GET", "/operations/config");
  }

  getPaymentAmount(): Promise<PaymentAmount> {
    return this.request<PaymentAmount>("GET", "/payment-amount");
  }

  createPayment(body: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.request<CreatePaymentResponse>("POST", "/payments", body);
  }

  getPaymentStatus(paymentReference: string): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>("GET", `/payments/${encodeURIComponent(paymentReference)}`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`${this.processorUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const message =
        parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : undefined;
      throw new ProcessorError(res.status, parsed, message);
    }
    return parsed as T;
  }
}

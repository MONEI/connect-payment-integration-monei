/**
 * Types for MONEI Payment Enabler
 *
 * These types define the interface between the enabler (frontend components)
 * and commercetools Checkout / custom frontends.
 *
 * Reference: commercetools connect-payments-sdk enabler interface
 */

export interface PaymentEnabler {
  /** Initialize the enabler with processor URL and session */
  init(options: EnablerOptions): Promise<void>;
  /** Create a payment component for a given payment method */
  createComponent(type: PaymentMethodType): PaymentComponent | null;
  /** Get list of supported payment methods */
  getSupportedPaymentMethods(): PaymentMethodType[];
}

export interface EnablerOptions {
  /** URL of the processor application */
  processorUrl: string;
  /** Session ID for authenticated requests */
  sessionId: string;
  /** Locale for UI components (e.g., 'es', 'en', 'ca') */
  locale?: string;
  /** Callback when payment is completed */
  onComplete?: (result: PaymentResult) => void;
  /** Callback when payment encounters an error */
  onError?: (error: PaymentError) => void;
}

export type PaymentMethodType =
  | 'card'
  | 'bizum'
  | 'applePay'
  | 'googlePay'
  | 'sepaDirectDebit';

export interface PaymentComponent {
  /** Mount the component into a DOM element */
  mount(selector: string | HTMLElement): void;
  /** Unmount and clean up the component */
  unmount(): void;
  /** Submit the payment */
  submit(): Promise<PaymentResult>;
  /** Check if the component is ready/valid */
  isValid(): boolean;
}

export interface PaymentResult {
  isSuccess: boolean;
  paymentId?: string;
  redirectUrl?: string;
  error?: string;
}

export interface PaymentError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MoneiComponentOptions {
  /** MONEI Account ID */
  accountId: string;
  /** Payment amount in cents */
  amount: number;
  /** Currency code */
  currency: string;
  /** Session token from processor */
  sessionToken?: string;
  /** Language/locale */
  language?: string;
  /** Style customization */
  style?: Record<string, unknown>;
}

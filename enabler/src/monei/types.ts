/** Minimal typings for the parts of MONEI.js v3 the enabler uses. https://docs.monei.com/monei-js/reference */

export type MoneiSubmitResult = {
  token?: string;
  error?: string;
  paymentMethod?: string;
};

export interface MoneiComponent {
  render(container: string | HTMLElement): void;
  updateProps?(props: Record<string, unknown>): Promise<void>;
  destroy?(): void;
}

export interface MoneiCardInput extends MoneiComponent {
  submit(options?: { cardholderName?: string }): Promise<MoneiSubmitResult>;
}

export type MoneiCardInputOptions = {
  accountId: string;
  sessionId: string;
  language?: string;
  style?: Record<string, unknown>;
  onChange?: (event: { isTouched?: boolean; error?: string; complete?: boolean }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLoad?: () => void;
  onError?: (error: Error) => void;
};

export type MoneiButtonComponentOptions = {
  accountId: string;
  sessionId: string;
  amount: number;
  currency: string;
  language?: string;
  style?: Record<string, unknown>;
  onSubmit: (result: MoneiSubmitResult) => void;
  onError?: (error: Error) => void;
  onLoad?: () => void;
};

export interface MoneiSdk {
  CardInput(options: MoneiCardInputOptions): MoneiCardInput;
  Bizum(options: MoneiButtonComponentOptions): MoneiComponent;
  PaymentRequest(options: MoneiButtonComponentOptions): MoneiComponent;
}

declare global {
  interface Window {
    monei?: MoneiSdk;
  }
}

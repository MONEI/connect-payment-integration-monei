import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * Google Pay Payment Component
 *
 * Wraps MONEI's Google Pay integration, which renders the Google Pay
 * button and handles the Google Pay payment sheet flow.
 *
 * Flow:
 * 1. Render the wallet button via MONEI.js PaymentRequest
 * 2. Customer taps button → Google Pay sheet opens
 * 3. Customer selects card and authenticates
 * 4. Google Pay returns payment token
 * 5. submit() confirms the payment with that token
 *
 * PaymentRequest shows Apple Pay instead where the browser supports it.
 */
export class GooglePayComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private googlePayButton: any = null;
  // MONEI renders the wallet button, so the token arrives through onSubmit
  // when the customer approves in the wallet sheet, not on demand.
  private walletToken: Promise<{ token?: string; error?: string }> | null = null;
  private resolveWalletToken: ((result: { token?: string; error?: string }) => void) | null = null;

  constructor(options: MoneiComponentOptions, processorUrl: string) {
    this.options = options;
    this.processorUrl = processorUrl;
  }

  private resetWalletToken(): void {
    this.walletToken = new Promise((resolve) => {
      this.resolveWalletToken = resolve;
    });
  }

  mount(selector: string | HTMLElement): void {
    if (typeof selector === 'string') {
      this.container = document.querySelector(selector);
    } else {
      this.container = selector;
    }

    if (!this.container) {
      throw new Error(`MONEI Google Pay: Container not found: ${selector}`);
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'monei-google-pay';
    wrapper.classList.add('monei-googlepay-component');
    this.container.appendChild(wrapper);

    this.initGooglePay(wrapper);
  }

  private async initGooglePay(container: HTMLElement): Promise<void> {
    try {
      const monei = (window as any).monei;
      if (!monei) {
        console.error('MONEI.js not loaded');
        return;
      }

      this.resetWalletToken();

      // MONEI.js handles Google Pay button rendering and token exchange
      this.googlePayButton = monei.PaymentRequest({
        accountId: this.options.accountId,
        sessionId: this.options.sessionToken,
        amount: this.options.amount,
        currency: this.options.currency,
        language: this.options.language || 'es',
        style: {
          type: 'buy',
          color: 'black',
          height: '48px',
        },
        onSubmit: (result: { token?: string; error?: string }) => {
          this.resolveWalletToken?.(result);
        },
        onError: (error: any) => {
          this.resolveWalletToken?.({ error: error?.message || 'Google Pay failed' });
        },
      });

      this.googlePayButton.render(container);
    } catch (error) {
      console.error('Failed to initialize Google Pay:', error);
      // Hide container if Google Pay is not available
      container.style.display = 'none';
    }
  }

  unmount(): void {
    this.resolveWalletToken?.({ error: 'Google Pay unmounted' });
    this.walletToken = null;
    if (this.googlePayButton) {
      this.googlePayButton.destroy?.();
      this.googlePayButton = null;
    }
    if (this.container) {
      const el = this.container.querySelector('#monei-google-pay');
      if (el) el.remove();
    }
  }

  async submit(): Promise<PaymentResult> {
    if (!this.googlePayButton || !this.walletToken) {
      return { isSuccess: false, error: 'Google Pay not initialized' };
    }

    try {
      const { token, error } = await this.walletToken;
      this.resetWalletToken();
      if (error || !token) {
        return { isSuccess: false, error: error || 'Google Pay tokenization failed' };
      }

      const monei = (window as any).monei;
      const result = await monei.confirmPayment({
        paymentId: this.options.sessionToken,
        paymentToken: token,
      });

      if (result.status === 'SUCCEEDED') {
        return { isSuccess: true, paymentId: result.id };
      }

      return {
        isSuccess: false,
        error: result.statusMessage || 'Google Pay payment failed',
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Google Pay failed',
      };
    }
  }

  isValid(): boolean {
    return this.googlePayButton !== null;
  }
}

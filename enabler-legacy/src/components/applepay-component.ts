import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * Apple Pay Payment Component
 *
 * Wraps MONEI's Apple Pay integration. Apple Pay requires:
 * - Safari browser or iOS device
 * - HTTPS domain with Apple Pay merchant verification
 * - Domain registered in MONEI dashboard
 *
 * Flow:
 * 1. Render the wallet button via MONEI.js PaymentRequest
 * 2. onLoad reports whether the device supports the wallet
 * 3. Customer taps → Apple Pay sheet with Face/Touch ID
 * 4. MONEI handles merchant validation and token exchange
 * 5. submit() confirms the payment with that token
 *
 * PaymentRequest shows Google Pay instead where Apple Pay is not supported.
 */
export class ApplePayComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private applePayButton: any = null;
  private isAvailable = false;
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
      throw new Error(`MONEI Apple Pay: Container not found: ${selector}`);
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'monei-apple-pay';
    wrapper.classList.add('monei-applepay-component');
    this.container.appendChild(wrapper);

    this.initApplePay(wrapper);
  }

  private async initApplePay(container: HTMLElement): Promise<void> {
    try {
      const monei = (window as any).monei;
      if (!monei) {
        console.error('MONEI.js not loaded');
        return;
      }

      this.resetWalletToken();

      this.applePayButton = monei.PaymentRequest({
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
        // Fires with false when the device supports no wallet
        onLoad: (isSupported: boolean) => {
          this.isAvailable = isSupported;
          if (!isSupported) container.style.display = 'none';
        },
        onSubmit: (result: { token?: string; error?: string }) => {
          this.resolveWalletToken?.(result);
        },
        onError: (error: any) => {
          this.resolveWalletToken?.({ error: error?.message || 'Apple Pay failed' });
        },
      });

      this.applePayButton.render(container);
    } catch (error) {
      console.error('Failed to initialize Apple Pay:', error);
      container.style.display = 'none';
    }
  }

  unmount(): void {
    this.resolveWalletToken?.({ error: 'Apple Pay unmounted' });
    this.walletToken = null;
    if (this.applePayButton) {
      this.applePayButton.destroy?.();
      this.applePayButton = null;
    }
    if (this.container) {
      const el = this.container.querySelector('#monei-apple-pay');
      if (el) el.remove();
    }
    this.isAvailable = false;
  }

  async submit(): Promise<PaymentResult> {
    if (!this.applePayButton || !this.walletToken) {
      return { isSuccess: false, error: 'Apple Pay not initialized' };
    }

    try {
      const { token, error } = await this.walletToken;
      this.resetWalletToken();
      if (error || !token) {
        return { isSuccess: false, error: error || 'Apple Pay tokenization failed' };
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
        error: result.statusMessage || 'Apple Pay payment failed',
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Apple Pay failed',
      };
    }
  }

  isValid(): boolean {
    return this.isAvailable && this.applePayButton !== null;
  }
}

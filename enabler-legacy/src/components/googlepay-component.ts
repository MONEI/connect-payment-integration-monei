import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * Google Pay Payment Component
 *
 * Wraps MONEI's Google Pay integration, which renders the Google Pay
 * button and handles the Google Pay payment sheet flow.
 *
 * Flow:
 * 1. Render Google Pay button via MONEI.js
 * 2. Customer taps button → Google Pay sheet opens
 * 3. Customer selects card and authenticates
 * 4. Google Pay returns payment token
 * 5. Token sent to MONEI via processor for processing
 */
export class GooglePayComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private googlePayButton: any = null;

  constructor(options: MoneiComponentOptions, processorUrl: string) {
    this.options = options;
    this.processorUrl = processorUrl;
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

      // MONEI.js handles Google Pay button rendering and token exchange
      this.googlePayButton = monei.GooglePay({
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
      });

      this.googlePayButton.render(container);
    } catch (error) {
      console.error('Failed to initialize Google Pay:', error);
      // Hide container if Google Pay is not available
      container.style.display = 'none';
    }
  }

  unmount(): void {
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
    if (!this.googlePayButton) {
      return { isSuccess: false, error: 'Google Pay not initialized' };
    }

    try {
      const monei = (window as any).monei;
      const result = await monei.confirmPayment({
        paymentId: this.options.sessionToken,
        paymentToken: await this.googlePayButton.getToken(),
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

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
 * 1. Check Apple Pay availability via canMakePayments()
 * 2. Render Apple Pay button
 * 3. Customer taps → Apple Pay sheet with Face/Touch ID
 * 4. MONEI handles merchant validation and token exchange
 */
export class ApplePayComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private applePayButton: any = null;
  private isAvailable = false;

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

      // Check if Apple Pay is available on this device/browser
      const canPay = await monei.isApplePayAvailable?.();
      if (!canPay) {
        container.style.display = 'none';
        return;
      }

      this.isAvailable = true;

      this.applePayButton = monei.ApplePay({
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

      this.applePayButton.render(container);
    } catch (error) {
      console.error('Failed to initialize Apple Pay:', error);
      container.style.display = 'none';
    }
  }

  unmount(): void {
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
    if (!this.applePayButton) {
      return { isSuccess: false, error: 'Apple Pay not initialized' };
    }

    try {
      const monei = (window as any).monei;
      const result = await monei.confirmPayment({
        paymentId: this.options.sessionToken,
        paymentToken: await this.applePayButton.getToken(),
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

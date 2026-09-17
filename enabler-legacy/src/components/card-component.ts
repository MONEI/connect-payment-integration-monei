import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * Card Payment Component
 *
 * Wraps MONEI's card input component, which handles PCI-compliant
 * card data collection via a secure iframe. This ensures the merchant
 * frontend never touches raw card numbers.
 *
 * Uses MONEI.js CardInput component:
 * - Renders card number, expiry, and CVC fields
 * - Handles tokenization client-side
 * - Supports 3D Secure authentication flows
 */
export class CardComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private moneiCardInput: any = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private isReady = false;

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
      throw new Error(`MONEI Card: Container not found: ${selector}`);
    }

    // Create the card input wrapper
    const cardContainer = document.createElement('div');
    cardContainer.id = 'monei-card-input';
    cardContainer.classList.add('monei-card-component');
    this.container.appendChild(cardContainer);

    // Initialize MONEI CardInput
    // @monei-js/components provides the CardInput web component
    this.initMoneiCardInput(cardContainer);
  }

  private async initMoneiCardInput(container: HTMLElement): Promise<void> {
    try {
      // MONEI.js is loaded via the enabler's script tag
      // It provides monei.CardInput for secure card collection
      const monei = (window as any).monei;

      if (!monei) {
        console.error('MONEI.js not loaded. Ensure the MONEI script is included.');
        return;
      }

      this.moneiCardInput = monei.CardInput({
        accountId: this.options.accountId,
        sessionId: this.options.sessionToken,
        language: this.options.language || 'es',
        style: this.options.style || {
          base: {
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#1a1a1a',
            '::placeholder': { color: '#999' },
          },
          invalid: { color: '#e24b4a' },
        },
        onReady: () => {
          this.isReady = true;
        },
        onError: (error: any) => {
          console.error('MONEI Card error:', error);
        },
      });

      this.moneiCardInput.render(container);
    } catch (error) {
      console.error('Failed to initialize MONEI CardInput:', error);
    }
  }

  unmount(): void {
    if (this.moneiCardInput) {
      this.moneiCardInput.destroy?.();
      this.moneiCardInput = null;
    }
    if (this.container) {
      const cardEl = this.container.querySelector('#monei-card-input');
      if (cardEl) cardEl.remove();
    }
    this.isReady = false;
  }

  async submit(): Promise<PaymentResult> {
    if (!this.moneiCardInput) {
      return { isSuccess: false, error: 'Card component not initialized' };
    }

    try {
      // MONEI.js handles tokenization and 3DS
      const monei = (window as any).monei;
      const result = await monei.confirmPayment({
        paymentId: this.options.sessionToken,
        paymentToken: await this.moneiCardInput.getToken(),
      });

      if (result.status === 'SUCCEEDED' || result.status === 'AUTHORIZED') {
        return {
          isSuccess: true,
          paymentId: result.id,
        };
      }

      if (result.nextAction?.redirectUrl) {
        return {
          isSuccess: true,
          paymentId: result.id,
          redirectUrl: result.nextAction.redirectUrl,
        };
      }

      return {
        isSuccess: false,
        error: result.statusMessage || 'Payment failed',
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Payment submission failed',
      };
    }
  }

  isValid(): boolean {
    return this.isReady;
  }
}

import {
  PaymentEnabler,
  EnablerOptions,
  PaymentComponent,
  PaymentMethodType,
  MoneiComponentOptions,
} from './types';
import { CardComponent } from './components/card-component';
import { BizumComponent } from './components/bizum-component';
import { GooglePayComponent } from './components/googlepay-component';
import { ApplePayComponent } from './components/applepay-component';
import { SepaDirectDebitComponent } from './components/sepa-component';

/**
 * MONEI Payment Enabler
 *
 * Main entry point for the MONEI payment frontend integration with
 * commercetools Checkout. This enabler:
 *
 * 1. Loads MONEI.js (secure payment components library)
 * 2. Initializes session with the processor backend
 * 3. Provides factory methods for creating payment UI components
 *
 * Supported payment methods:
 * - card: PCI-compliant card input (number, expiry, CVC)
 * - bizum: Spain's mobile payment method (redirect-based)
 * - applePay: Apple Pay button (Safari/iOS only)
 * - googlePay: Google Pay button
 * - sepaDirectDebit: SEPA Direct Debit (redirect-based)
 *
 * Usage with commercetools Checkout:
 * The enabler is loaded as static assets and Checkout manages
 * when and which components to render based on merchant configuration.
 *
 * Usage with custom frontend:
 * ```typescript
 * const enabler = new MoneiPaymentEnabler();
 * await enabler.init({ processorUrl: '...', sessionId: '...' });
 * const card = enabler.createComponent('card');
 * card.mount('#payment-container');
 * const result = await card.submit();
 * ```
 */
export class MoneiPaymentEnabler implements PaymentEnabler {
  private options: EnablerOptions | null = null;
  private moneiScriptLoaded = false;
  private availableMethods: PaymentMethodType[] = [];
  private componentOptions: MoneiComponentOptions | null = null;

  /**
   * Initialize the enabler
   *
   * This loads MONEI.js and fetches available payment methods
   * from the processor backend.
   */
  async init(options: EnablerOptions): Promise<void> {
    this.options = options;

    // Load MONEI.js script
    await this.loadMoneiScript();

    // Fetch available payment methods from processor
    try {
      const response = await fetch(
        `${options.processorUrl}/payment-methods`,
        {
          headers: {
            'X-Session-Id': options.sessionId,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.availableMethods = data.paymentMethods || [];
      }
    } catch (error) {
      console.error('Failed to fetch MONEI payment methods:', error);
      // Default to card + bizum if fetch fails
      this.availableMethods = ['card', 'bizum'];
    }
  }

  /**
   * Load the MONEI.js library
   *
   * MONEI.js provides secure frontend components for card input,
   * wallet buttons, and payment confirmation.
   * See: https://docs.monei.com/docs/monei-js/overview
   */
  private loadMoneiScript(): Promise<void> {
    if (this.moneiScriptLoaded) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if ((window as any).monei) {
        this.moneiScriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.monei.com/v2/monei.js';
      script.async = true;

      script.onload = () => {
        this.moneiScriptLoaded = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load MONEI.js'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Create a payment component for the specified method
   */
  createComponent(type: PaymentMethodType): PaymentComponent | null {
    if (!this.options) {
      console.error('Enabler not initialized. Call init() first.');
      return null;
    }

    if (!this.availableMethods.includes(type)) {
      console.warn(`Payment method "${type}" is not available.`);
      return null;
    }

    const componentOptions: MoneiComponentOptions = {
      accountId: '', // Set from processor session
      amount: 0, // Set from cart/checkout context
      currency: 'EUR',
      sessionToken: this.options.sessionId,
      language: this.options.locale || 'es',
      ...this.componentOptions,
    };

    const processorUrl = this.options.processorUrl;

    switch (type) {
      case 'card':
        return new CardComponent(componentOptions, processorUrl);
      case 'bizum':
        return new BizumComponent(componentOptions, processorUrl);
      case 'googlePay':
        return new GooglePayComponent(componentOptions, processorUrl);
      case 'applePay':
        return new ApplePayComponent(componentOptions, processorUrl);
      case 'sepaDirectDebit':
        return new SepaDirectDebitComponent(componentOptions, processorUrl);
      default:
        console.warn(`Unknown payment method: ${type}`);
        return null;
    }
  }

  /**
   * Get list of supported payment methods
   */
  getSupportedPaymentMethods(): PaymentMethodType[] {
    return this.availableMethods;
  }

  /**
   * Update component options (e.g., when cart amount changes)
   */
  setComponentOptions(options: Partial<MoneiComponentOptions>): void {
    this.componentOptions = {
      ...(this.componentOptions || { accountId: '', amount: 0, currency: 'EUR' }),
      ...options,
    };
  }
}

// Export as default for commercetools Connect enabler pattern
export default MoneiPaymentEnabler;

// Also export types for consumers
export * from './types';
export { CardComponent } from './components/card-component';
export { BizumComponent } from './components/bizum-component';
export { GooglePayComponent } from './components/googlepay-component';
export { ApplePayComponent } from './components/applepay-component';
export { SepaDirectDebitComponent } from './components/sepa-component';

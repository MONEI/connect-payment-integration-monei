import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * Bizum Payment Component
 *
 * Bizum is a redirect-based payment method where the customer is
 * redirected to their banking app to approve the payment.
 *
 * Flow:
 * 1. Render a "Pay with Bizum" button
 * 2. On click, create payment via processor → MONEI API
 * 3. Redirect customer to Bizum authorization URL
 * 4. Customer approves in their banking app
 * 5. Redirect back to completeUrl
 * 6. Webhook confirms payment status
 */
export class BizumComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private button: HTMLButtonElement | null = null;

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
      throw new Error(`MONEI Bizum: Container not found: ${selector}`);
    }

    // Create Bizum button
    const wrapper = document.createElement('div');
    wrapper.classList.add('monei-bizum-component');

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.classList.add('monei-bizum-button');
    this.button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#05C3A5"/>
        <path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>Pagar con Bizum</span>
    `;

    // Apply default styling
    Object.assign(this.button.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: '100%',
      padding: '14px 24px',
      fontSize: '16px',
      fontWeight: '500',
      color: '#ffffff',
      backgroundColor: '#05C3A5',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    });

    this.button.addEventListener('mouseenter', () => {
      if (this.button) this.button.style.backgroundColor = '#04a88e';
    });
    this.button.addEventListener('mouseleave', () => {
      if (this.button) this.button.style.backgroundColor = '#05C3A5';
    });

    wrapper.appendChild(this.button);
    this.container.appendChild(wrapper);
  }

  unmount(): void {
    if (this.container) {
      const wrapper = this.container.querySelector('.monei-bizum-component');
      if (wrapper) wrapper.remove();
    }
    this.button = null;
  }

  async submit(): Promise<PaymentResult> {
    try {
      // Create payment with Bizum method via processor
      const response = await fetch(`${this.processorUrl}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: this.options.amount,
          currency: this.options.currency,
          paymentMethodType: 'bizum',
          sessionToken: this.options.sessionToken,
        }),
      });

      const result = await response.json();

      if (result.success && result.redirectUrl) {
        // Redirect to Bizum
        return {
          isSuccess: true,
          paymentId: result.moneiPaymentId,
          redirectUrl: result.redirectUrl,
        };
      }

      return {
        isSuccess: false,
        error: result.error || 'Failed to initiate Bizum payment',
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Bizum payment failed',
      };
    }
  }

  isValid(): boolean {
    return this.button !== null;
  }
}

import { PaymentComponent, PaymentResult, MoneiComponentOptions } from '../types';

/**
 * SEPA Direct Debit Payment Component
 *
 * Renders an IBAN input field for SEPA Direct Debit payments.
 * The customer enters their IBAN and the payment is processed
 * as a direct debit against their bank account.
 *
 * Flow:
 * 1. Render IBAN input with validation
 * 2. On submit, create SEPA DD payment via processor → MONEI API
 * 3. MONEI processes the direct debit (settlement takes 2-3 business days)
 * 4. Webhook confirms payment status
 *
 * Note: SEPA DD does not support cancellation after submission.
 * Refunds are available after successful collection.
 */
export class SepaDirectDebitComponent implements PaymentComponent {
  private container: HTMLElement | null = null;
  private options: MoneiComponentOptions;
  private processorUrl: string;
  private ibanInput: HTMLInputElement | null = null;
  private nameInput: HTMLInputElement | null = null;

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
      throw new Error(`MONEI SEPA DD: Container not found: ${selector}`);
    }

    const wrapper = document.createElement('div');
    wrapper.classList.add('monei-sepa-component');

    // Account holder name
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Titular de la cuenta';
    nameLabel.style.cssText = 'display:block;font-size:14px;color:#555;margin-bottom:4px;';

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Nombre completo';
    this.nameInput.autocomplete = 'off';
    this.nameInput.style.cssText =
      'width:100%;padding:12px;font-size:16px;border:1px solid #ddd;border-radius:8px;margin-bottom:12px;outline:none;transition:border-color 0.2s;';
    this.nameInput.addEventListener('focus', () => {
      if (this.nameInput) this.nameInput.style.borderColor = '#5469d4';
    });
    this.nameInput.addEventListener('blur', () => {
      if (this.nameInput) this.nameInput.style.borderColor = '#ddd';
    });

    // IBAN input
    const ibanLabel = document.createElement('label');
    ibanLabel.textContent = 'IBAN';
    ibanLabel.style.cssText = 'display:block;font-size:14px;color:#555;margin-bottom:4px;';

    this.ibanInput = document.createElement('input');
    this.ibanInput.type = 'text';
    this.ibanInput.placeholder = 'ES00 0000 0000 0000 0000 0000';
    this.ibanInput.autocomplete = 'off';
    this.ibanInput.style.cssText =
      'width:100%;padding:12px;font-size:16px;font-family:monospace;border:1px solid #ddd;border-radius:8px;margin-bottom:16px;outline:none;transition:border-color 0.2s;';
    this.ibanInput.addEventListener('focus', () => {
      if (this.ibanInput) this.ibanInput.style.borderColor = '#5469d4';
    });
    this.ibanInput.addEventListener('blur', () => {
      if (this.ibanInput) this.ibanInput.style.borderColor = '#ddd';
    });

    // Format IBAN as user types (groups of 4)
    this.ibanInput.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const raw = input.value.replace(/\s/g, '').toUpperCase();
      const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
      input.value = formatted;
    });

    // Mandate text
    const mandate = document.createElement('p');
    mandate.style.cssText = 'font-size:12px;color:#888;line-height:1.4;';
    mandate.textContent =
      'Al proporcionar su IBAN y confirmar este pago, usted autoriza a MONEI Digital Payments, S.L. ' +
      'a enviar instrucciones a su banco para debitar su cuenta conforme a estas instrucciones. ' +
      'Tiene derecho a un reembolso bajo los términos de su acuerdo con su banco.';

    wrapper.appendChild(nameLabel);
    wrapper.appendChild(this.nameInput);
    wrapper.appendChild(ibanLabel);
    wrapper.appendChild(this.ibanInput);
    wrapper.appendChild(mandate);
    this.container.appendChild(wrapper);
  }

  unmount(): void {
    if (this.container) {
      const wrapper = this.container.querySelector('.monei-sepa-component');
      if (wrapper) wrapper.remove();
    }
    this.ibanInput = null;
    this.nameInput = null;
  }

  async submit(): Promise<PaymentResult> {
    if (!this.ibanInput || !this.nameInput) {
      return { isSuccess: false, error: 'SEPA component not initialized' };
    }

    const iban = this.ibanInput.value.replace(/\s/g, '');
    const name = this.nameInput.value.trim();

    if (!this.validateIban(iban)) {
      return { isSuccess: false, error: 'IBAN no válido' };
    }

    if (!name) {
      return { isSuccess: false, error: 'Nombre del titular requerido' };
    }

    try {
      const response = await fetch(`${this.processorUrl}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: this.options.amount,
          currency: this.options.currency,
          paymentMethodType: 'sepaDirectDebit',
          sessionToken: this.options.sessionToken,
          sepaDetails: { iban, accountHolderName: name },
        }),
      });

      const result = await response.json();

      if (result.success) {
        return {
          isSuccess: true,
          paymentId: result.moneiPaymentId,
          redirectUrl: result.redirectUrl,
        };
      }

      return {
        isSuccess: false,
        error: result.error || 'Error al procesar domiciliación SEPA',
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: error instanceof Error ? error.message : 'SEPA payment failed',
      };
    }
  }

  isValid(): boolean {
    if (!this.ibanInput || !this.nameInput) return false;
    const iban = this.ibanInput.value.replace(/\s/g, '');
    const name = this.nameInput.value.trim();
    return this.validateIban(iban) && name.length > 0;
  }

  /**
   * Basic IBAN validation (length + country prefix)
   */
  private validateIban(iban: string): boolean {
    if (!iban || iban.length < 15 || iban.length > 34) return false;
    // Must start with 2 letter country code
    if (!/^[A-Z]{2}/.test(iban)) return false;
    // Must be alphanumeric
    if (!/^[A-Z0-9]+$/.test(iban)) return false;
    return true;
  }
}

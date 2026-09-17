import { ComponentOptions, PaymentComponent, PaymentComponentBuilder } from "../../../payment-enabler/payment-enabler";
import type { BaseOptions } from "../../../payment-enabler/payment-enabler-monei";
import type { MoneiCardInput } from "../../../monei/types";
import { BaseComponent } from "../../base";
import buttonStyles from "../../../style/button.module.scss";
import styles from "../../../style/style.module.scss";

export class CardBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}
  build(config: ComponentOptions): PaymentComponent {
    return new Card(this.baseOptions, config);
  }
}

/**
 * Card fields rendered by MONEI.js inside MONEI-hosted iframes (SAQ A). On submit the card is tokenised
 * in the browser and only the token travels to the processor, which creates the payment.
 */
export class Card extends BaseComponent {
  private cardInput?: MoneiCardInput;
  private complete = false;
  private lastError?: string;
  private errorEl?: HTMLElement;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super("card", baseOptions, componentOptions);
  }

  async mount(selector: string): Promise<void> {
    const container = this.resolveContainer(selector);
    container.insertAdjacentHTML(
      "afterbegin",
      `<div class="${styles.wrapper}">
         <div id="monei-card-input"></div>
         <div id="monei-card-error" class="${styles.hidden}" role="alert" aria-live="assertive"></div>
         ${this.showPayButton ? `<button type="button" id="monei-card-pay" class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}">Pay</button>` : ""}
       </div>`,
    );
    this.errorEl = container.querySelector<HTMLElement>("#monei-card-error") ?? undefined;

    this.cardInput = this.base.monei.CardInput({
      accountId: this.base.accountId,
      sessionId: this.base.sessionId,
      language: this.base.locale?.slice(0, 2),
      onChange: (event) => {
        this.complete = !!event.complete && !event.error;
        this.lastError = event.error;
        if (event.error && event.isTouched) this.showError(event.error);
        else this.hideError();
      },
      onError: (error) => this.base.onError(error),
    });
    this.cardInput.render(container.querySelector<HTMLElement>("#monei-card-input")!);

    container.querySelector("#monei-card-pay")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await this.submit(await this.beforeSubmit());
    });
  }

  async isValid(): Promise<boolean> {
    return this.complete;
  }

  async showValidation(): Promise<void> {
    if (!this.complete) this.showError(this.lastError ?? "Please complete your card details.");
  }

  async submit({ storePaymentDetails }: { storePaymentDetails?: boolean }): Promise<void> {
    if (!this.cardInput) throw new Error("Card component is not mounted");
    const result = await this.cardInput.submit();
    if (!result.token) {
      this.showError(result.error ?? "Invalid card details.");
      return;
    }
    await this.pay({
      paymentMethod: {
        type: "card",
        paymentToken: result.token,
        sessionId: this.base.sessionId,
        ...(storePaymentDetails ? { storePaymentMethod: true } : {}),
      },
    });
  }

  private showError(message: string): void {
    if (!this.errorEl) return;
    this.errorEl.textContent = message;
    this.errorEl.classList.remove(styles.hidden);
  }

  private hideError(): void {
    this.errorEl?.classList.add(styles.hidden);
  }
}

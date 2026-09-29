import { ComponentOptions, PaymentComponent, PaymentComponentBuilder } from "../../../payment-enabler/payment-enabler";
import type { BaseOptions } from "../../../payment-enabler/payment-enabler-monei";
import type { MoneiComponent } from "../../../monei/types";
import { BaseComponent } from "../../base";
import buttonStyles from "../../../style/button.module.scss";
import styles from "../../../style/style.module.scss";

export class BizumBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}
  build(config: ComponentOptions): PaymentComponent {
    return new Bizum(this.baseOptions, config);
  }
}

/**
 * Bizum. Two paths, same processor call:
 *  - request-to-pay: the MONEI.js Bizum button asks for the phone number and returns a token once the
 *    customer approves in their bank app; the token goes to the processor as for cards.
 *  - redirect: with showPayButton (Checkout's own button flow) the processor creates the payment and MONEI
 *    answers with a redirectUrl; the shopper comes back to the return URL and the enabler reports the outcome.
 */
export class Bizum extends BaseComponent {
  private button?: MoneiComponent;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super("bizum", baseOptions, componentOptions);
  }

  async isAvailable(): Promise<boolean> {
    // Bizum needs a Spanish bank account; hide it for other checkout countries when the host tells us one.
    return !this.base.countryCode || ["ES", "AD"].includes(this.base.countryCode.toUpperCase());
  }

  async mount(selector: string): Promise<void> {
    const container = this.resolveContainer(selector);
    container.insertAdjacentHTML(
      "afterbegin",
      `<div class="${styles.wrapper}">
         <div id="monei-bizum-button"></div>
         ${this.showPayButton ? `<button type="button" id="monei-bizum-pay" class="${buttonStyles.button} ${buttonStyles.fullWidth} ${styles.submitButton}">Pay with Bizum</button>` : ""}
       </div>`,
    );

    if (this.showPayButton) {
      container.querySelector("#monei-bizum-pay")?.addEventListener("click", async (e) => {
        e.preventDefault();
        await this.submit(await this.beforeSubmit());
      });
      return;
    }

    // Request-to-pay button rendered by MONEI.js; needs the amount up front.
    const amount = await this.base.processor.getPaymentAmount();
    this.button = this.base.monei.Bizum({
      accountId: this.base.accountId,
      sessionId: this.base.sessionId,
      amount: amount.centAmount,
      currency: amount.currencyCode,
      language: this.base.locale?.slice(0, 2),
      onSubmit: async (result) => {
        if (!result.token) {
          this.base.onError(new Error(result.error ?? "Bizum did not return a payment token"));
          return;
        }
        await this.pay({ paymentMethod: { type: "bizum", paymentToken: result.token, sessionId: this.base.sessionId } });
      },
      onError: (error) => this.base.onError(error),
    });
    this.button.render(container.querySelector<HTMLElement>("#monei-bizum-button")!);
  }

  /** Redirect flow: no token, the processor returns MONEI's redirectUrl. */
  async submit(_opts: { storePaymentDetails?: boolean } = {}): Promise<void> {
    await this.pay({ paymentMethod: { type: "bizum" } });
  }
}

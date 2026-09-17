import { ComponentOptions, PaymentComponent, PaymentComponentBuilder } from "../../../payment-enabler/payment-enabler";
import type { BaseOptions } from "../../../payment-enabler/payment-enabler-monei";
import type { MoneiComponent } from "../../../monei/types";
import { BaseComponent, MoneiMethod } from "../../base";
import styles from "../../../style/style.module.scss";

abstract class WalletBuilder implements PaymentComponentBuilder {
  /** The wallet sheet is the submit; Checkout must not render its own pay button for these. */
  public componentHasSubmit = false;
  protected abstract readonly method: "applePay" | "googlePay";
  constructor(protected baseOptions: BaseOptions) {}
  build(config: ComponentOptions): PaymentComponent {
    return new Wallet(this.method, this.baseOptions, config);
  }
}

export class ApplePayBuilder extends WalletBuilder {
  protected readonly method = "applePay" as const;
}
export class GooglePayBuilder extends WalletBuilder {
  protected readonly method = "googlePay" as const;
}

/**
 * Apple Pay / Google Pay through MONEI.js PaymentRequest. MONEI.js renders whichever wallet the browser
 * supports; the approved wallet token goes to the processor exactly like a card token.
 */
export class Wallet extends BaseComponent {
  private component?: MoneiComponent;

  constructor(method: MoneiMethod, baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(method, baseOptions, componentOptions);
  }

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (this.method === "applePay") {
      const ap = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
      return !!ap?.canMakePayments?.();
    }
    return !!(window as unknown as { PaymentRequest?: unknown }).PaymentRequest;
  }

  async mount(selector: string): Promise<void> {
    const container = this.resolveContainer(selector);
    container.insertAdjacentHTML("afterbegin", `<div class="${styles.wrapper}"><div id="monei-wallet-button"></div></div>`);
    const amount = await this.base.processor.getPaymentAmount();
    this.component = this.base.monei.PaymentRequest({
      accountId: this.base.accountId,
      sessionId: this.base.sessionId,
      amount: amount.centAmount,
      currency: amount.currencyCode,
      language: this.base.locale?.slice(0, 2),
      onSubmit: async (result) => {
        if (!result.token) {
          this.base.onError(new Error(result.error ?? "Wallet did not return a payment token"));
          return;
        }
        const type = result.paymentMethod === "googlePay" ? "googlePay" : result.paymentMethod === "applePay" ? "applePay" : this.method;
        await this.pay({ paymentMethod: { type: type as "applePay" | "googlePay", paymentToken: result.token, sessionId: this.base.sessionId } });
      },
      onError: (error) => this.base.onError(error),
    });
    this.component.render(container.querySelector<HTMLElement>("#monei-wallet-button")!);
  }

  async submit(_opts: { storePaymentDetails?: boolean } = {}): Promise<void> {
    // The wallet sheet drives submission; Checkout does not call submit() for componentHasSubmit=false.
  }
}

import { DropinComponent, DropinOptions, PaymentDropinBuilder } from "../payment-enabler/payment-enabler";
import type { BaseOptions } from "../payment-enabler/payment-enabler-monei";
import { Card } from "../components/payment-methods/card/card";
import { Bizum } from "../components/payment-methods/bizum/bizum";
import styles from "../style/style.module.scss";

export class DropinEmbeddedBuilder implements PaymentDropinBuilder {
  public dropinHasSubmit = true;
  constructor(private baseOptions: BaseOptions) {}
  build(config: DropinOptions): DropinComponent {
    const dropin = new MoneiDropin(this.baseOptions, config);
    config.onDropinReady?.();
    return dropin;
  }
}

/**
 * Minimal embedded drop-in: card fields plus a Bizum option. The MONEI.js PaymentRequest button is not
 * included here because wallets submit themselves; use the applePay/googlePay components for those.
 */
export class MoneiDropin implements DropinComponent {
  private card: Card;
  private bizum: Bizum;
  private selected: "card" | "bizum" = "card";

  constructor(
    private baseOptions: BaseOptions,
    private options: DropinOptions,
  ) {
    this.card = new Card(baseOptions, { showPayButton: false });
    this.bizum = new Bizum(baseOptions, { showPayButton: true });
  }

  async mount(selector: string): Promise<void> {
    const container = document.querySelector<HTMLElement>(selector);
    if (!container) throw new Error(`Mount target not found: ${selector}`);
    const bizumAvailable = await this.bizum.isAvailable();
    container.insertAdjacentHTML(
      "afterbegin",
      `<div class="${styles.wrapper}" id="monei-dropin">
         <label><input type="radio" name="monei-method" value="card" checked> Card</label>
         <div id="monei-dropin-card"></div>
         ${bizumAvailable ? `<label><input type="radio" name="monei-method" value="bizum"> Bizum</label><div id="monei-dropin-bizum" class="${styles.hidden}"></div>` : ""}
       </div>`,
    );
    await this.card.mount("#monei-dropin-card");
    if (bizumAvailable) await this.bizum.mount("#monei-dropin-bizum");
    container.querySelectorAll<HTMLInputElement>('input[name="monei-method"]').forEach((input) =>
      input.addEventListener("change", () => {
        this.selected = input.value as "card" | "bizum";
        container.querySelector("#monei-dropin-card")?.classList.toggle(styles.hidden, this.selected !== "card");
        container.querySelector("#monei-dropin-bizum")?.classList.toggle(styles.hidden, this.selected !== "bizum");
      }),
    );
  }

  async submit(): Promise<void> {
    await this.options.onPayButtonClick?.();
    if (this.selected === "card") {
      if (!(await this.card.isValid())) {
        await this.card.showValidation();
        return;
      }
      await this.card.submit({});
    } else {
      await this.bizum.submit({});
    }
    void this.baseOptions;
  }
}

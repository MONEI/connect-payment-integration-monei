import { ComponentOptions, PaymentComponent, PaymentComponentState, PaymentResult } from "../payment-enabler/payment-enabler";
import type { BaseOptions } from "../payment-enabler/payment-enabler-monei";
import type { CreatePaymentRequest, CreatePaymentResponse } from "../monei/processor-client";
import { buildReturnUrl, outcomeOf } from "../monei/outcome";

export type MoneiMethod = "card" | "bizum" | "applePay" | "googlePay";

/**
 * Shared plumbing for every MONEI component: create the payment through the processor, redirect when
 * MONEI asks for it, otherwise report the outcome to Checkout.
 */
export abstract class BaseComponent implements PaymentComponent {
  protected readonly base: BaseOptions;
  protected readonly showPayButton: boolean;
  protected readonly onPayButtonClick?: ComponentOptions["onPayButtonClick"];
  protected paymentReference?: string;

  constructor(
    protected readonly method: MoneiMethod,
    baseOptions: BaseOptions,
    componentOptions: ComponentOptions,
  ) {
    this.base = baseOptions;
    this.showPayButton = componentOptions?.showPayButton ?? false;
    this.onPayButtonClick = componentOptions?.onPayButtonClick;
  }

  abstract mount(selector: string): Promise<void>;
  abstract submit(opts: { storePaymentDetails?: boolean }): Promise<void>;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getState(): Promise<PaymentComponentState> {
    return {};
  }

  protected returnUrl(): string {
    return buildReturnUrl(window.location.href);
  }

  /** Creates the payment via the processor and handles redirect / completion uniformly. */
  protected async pay(request: Omit<CreatePaymentRequest, "returnUrl">): Promise<void> {
    let response: CreatePaymentResponse;
    try {
      response = await this.base.processor.createPayment({ ...request, returnUrl: this.returnUrl() });
    } catch (error) {
      this.base.onError(error);
      return;
    }
    this.paymentReference = response.paymentReference;

    if (response.redirectUrl) {
      await this.base.onActionRequired?.();
      window.location.assign(response.redirectUrl);
      return;
    }

    const outcome = outcomeOf(response.status);
    if (outcome === "pending") {
      // No redirect and not final: Checkout polls the payment intent; nothing more to do here.
      return;
    }
    this.base.onComplete({ isSuccess: outcome === "success", paymentReference: response.paymentReference } as PaymentResult);
  }

  protected resolveContainer(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`Mount target not found: ${selector}`);
    return el;
  }

  protected async beforeSubmit(): Promise<{ storePaymentDetails?: boolean }> {
    return (await this.onPayButtonClick?.()) ?? {};
  }
}

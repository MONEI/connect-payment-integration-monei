import { loadMonei } from "../monei/load-monei";
import { ProcessorClient } from "../monei/processor-client";
import type { MoneiSdk } from "../monei/types";
import { outcomeOf, readReturnedPaymentReference } from "../monei/outcome";
import { CardBuilder } from "../components/payment-methods/card/card";
import { BizumBuilder } from "../components/payment-methods/bizum/bizum";
import { ApplePayBuilder, GooglePayBuilder } from "../components/payment-methods/wallet/wallet";
import { DropinEmbeddedBuilder } from "../dropin/dropin-embedded";
import {
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentExpressBuilder,
  PaymentResult,
  StoredComponentBuilder,
} from "./payment-enabler";

export type BaseOptions = {
  monei: MoneiSdk;
  processor: ProcessorClient;
  processorUrl: string;
  sessionId: string;
  accountId: string;
  environment: string;
  locale?: string;
  countryCode?: string;
  onComplete: (result: PaymentResult) => void;
  onError: (error: unknown, context?: { paymentReference?: string }) => void;
  onActionRequired?: () => Promise<void>;
};

export const SUPPORTED_COMPONENTS = {
  card: CardBuilder,
  bizum: BizumBuilder,
  applePay: ApplePayBuilder,
  googlePay: GooglePayBuilder,
} as const;

/**
 * MONEI enabler for commercetools Checkout.
 *
 *   const enabler = new Enabler({ processorUrl, sessionId, onComplete, onError });
 *   const builder = await enabler.createComponentBuilder('bizum');
 *   builder.build({ showPayButton: true }).mount('#bizum');
 *
 * Card data is collected inside MONEI-hosted iframes (MONEI.js), so the storefront stays out of PCI scope.
 * Bizum and 3DS challenges redirect; on return the enabler reads the payment back from the processor and
 * calls onComplete, so the host page needs no extra code.
 */
export class MoneiPaymentEnabler implements PaymentEnabler {
  readonly setupData: Promise<{ baseOptions: BaseOptions }>;

  constructor(options: EnablerOptions, deps: { loadMonei?: typeof loadMonei; processor?: ProcessorClient } = {}) {
    this.setupData = MoneiPaymentEnabler.setup(options, deps);
  }

  private static async setup(
    options: EnablerOptions,
    deps: { loadMonei?: typeof loadMonei; processor?: ProcessorClient },
  ): Promise<{ baseOptions: BaseOptions }> {
    const processor = deps.processor ?? new ProcessorClient(options.processorUrl, options.sessionId);
    const [config, monei] = await Promise.all([processor.getConfig(), (deps.loadMonei ?? loadMonei)()]);

    const baseOptions: BaseOptions = {
      monei,
      processor,
      processorUrl: options.processorUrl,
      sessionId: options.sessionId,
      accountId: config.clientKey,
      environment: config.environment,
      locale: options.locale,
      countryCode: options.countryCode,
      onComplete: options.onComplete ?? (() => {}),
      onError: options.onError ?? (() => {}),
      onActionRequired: options.onActionRequired,
    };

    await MoneiPaymentEnabler.handleRedirectReturn(baseOptions);
    return { baseOptions };
  }

  /**
   * After a redirect method the shopper lands back on the checkout page with the CT payment reference in
   * the URL. Re-read the payment through the processor (which syncs it with MONEI) and report the outcome.
   */
  static async handleRedirectReturn(
    baseOptions: BaseOptions,
    href: string | undefined = typeof window !== "undefined" ? window.location.href : undefined,
  ): Promise<void> {
    const paymentReference = href ? readReturnedPaymentReference(href) : undefined;
    if (!paymentReference) return;
    try {
      const status = await baseOptions.processor.getPaymentStatus(paymentReference);
      const outcome = outcomeOf(status.status);
      if (outcome === "pending") return; // webhook not there yet; Checkout will poll the payment intent
      baseOptions.onComplete({ isSuccess: outcome === "success", paymentReference });
    } catch (error) {
      baseOptions.onError(error, { paymentReference });
    }
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder | never> {
    const { baseOptions } = await this.setupData;
    const Builder = (SUPPORTED_COMPONENTS as Record<string, new (o: BaseOptions) => PaymentComponentBuilder>)[type];
    if (!Builder) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(SUPPORTED_COMPONENTS).join(", ")}`,
      );
    }
    return new Builder(baseOptions);
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder | never> {
    const { baseOptions } = await this.setupData;
    if (type !== DropinType.embedded) {
      throw new Error(`Drop-in type not supported: ${type}. Supported types: embedded`);
    }
    return new DropinEmbeddedBuilder(baseOptions);
  }

  async createStoredPaymentMethodBuilder(type: string): Promise<StoredComponentBuilder | never> {
    throw new Error(`Stored payment methods are not supported yet (requested: ${type})`);
  }

  async createExpressBuilder(type: string): Promise<PaymentExpressBuilder | never> {
    throw new Error(`Express checkout is not supported yet (requested: ${type})`);
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    return false;
  }

  async getStoredPaymentMethods(): Promise<{ storedPaymentMethods?: never[] }> {
    return { storedPaymentMethods: [] };
  }

  setStorePaymentDetails(_enabled: boolean): void {
    // Tokenised stored methods are not offered yet.
  }
}

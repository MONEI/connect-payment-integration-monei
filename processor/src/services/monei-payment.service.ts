import {
  Cart,
  ErrorGeneral,
  ErrorInvalidField,
  ErrorInvalidOperation,
  healthCheckCommercetoolsPermissions,
  statusHandler,
  TransactionState,
  TransactionType,
} from '@commercetools/connect-payments-sdk';
import { Payment } from '@commercetools/platform-sdk';
import packageJSON from '../../package.json';
import { getConfig, getEnabledPaymentMethods } from '../config/config';
import { getStoredPaymentMethodsConfig } from '../config/stored-payment-methods.config';
import { PaymentMethodType, PaymentRequestSchemaDTO, PaymentResponseSchemaDTO } from '../dtos/monei-payment.dto';
import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import { TransactionDraftDTO, TransactionResponseDTO } from '../dtos/operations/transaction.dto';
import { getCartIdFromContext, getCheckoutTransactionItemIdFromContext } from '../libs/fastify/context/context';
import { log } from '../libs/logger';
import { getMoneiClient, MoneiClient } from '../libs/monei/client';
import { MoneiApiError, MoneiCreatePaymentRequest, MoneiPayment, MoneiPaymentMethodType } from '../libs/monei/types';
import { appLogger, paymentSDK } from '../payment-sdk';
import { AbstractPaymentService } from './abstract-payment.service';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';
import { CreatePaymentRequest, MoneiPaymentServiceOptions } from './types/monei-payment.type';

export const MONEI_PAYMENT_INTERFACE = 'monei';

/** Methods that can only be an immediate sale on MONEI: authorization/capture is not offered for them. */
const IMMEDIATE_ONLY_METHODS: ReadonlySet<string> = new Set<string>([
  PaymentMethodType.BIZUM,
  PaymentMethodType.APPLE_PAY,
  PaymentMethodType.GOOGLE_PAY,
  PaymentMethodType.SEPA_DIRECT_DEBIT,
]);

/** Statuses at which a MONEI payment will not change again on its own (no further webhook expected). */
export const FINAL_MONEI_STATUSES: ReadonlySet<string> = new Set([
  'SUCCEEDED',
  'AUTHORIZED',
  'FAILED',
  'CANCELED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export interface MoneiTransactionMapping {
  type: TransactionType;
  state: TransactionState;
}

/**
 * Maps a MONEI payment status onto the commercetools transaction it should produce.
 * `transactionType` is MONEI's SALE/AUTH intent for the payment; it decides whether a success is a
 * Charge or an Authorization. Returns undefined for statuses that should not touch the CT Payment.
 */
export function mapMoneiStatusToTransaction(
  status: string,
  transactionType: 'SALE' | 'AUTH' | undefined,
): MoneiTransactionMapping | undefined {
  const successType: TransactionType = transactionType === 'AUTH' ? 'Authorization' : 'Charge';
  switch (status) {
    case 'PENDING':
    case 'PENDING_PROCESSING':
      return { type: successType, state: 'Pending' };
    case 'AUTHORIZED':
      return { type: 'Authorization', state: 'Success' };
    case 'SUCCEEDED':
      return { type: successType, state: 'Success' };
    case 'FAILED':
    case 'EXPIRED':
      return { type: successType, state: 'Failure' };
    case 'CANCELED':
      return { type: 'CancelAuthorization', state: 'Success' };
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return { type: 'Refund', state: 'Success' };
    case 'PAID_OUT':
    default:
      return undefined;
  }
}

export class MoneiPaymentService extends AbstractPaymentService {
  private readonly moneiClient: MoneiClient;

  constructor(opts: MoneiPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService, opts.ctPaymentMethodService, opts.ctRecurringPaymentJobService);
    this.moneiClient = opts.moneiClient ?? getMoneiClient();
  }

  // ---------------------------------------------------------------------------------------------
  // Operations API (/operations/*)
  // ---------------------------------------------------------------------------------------------

  public async config(): Promise<ConfigResponse> {
    const config = getConfig();
    return {
      clientKey: config.moneiAccountId,
      environment: config.moneiEnvironment,
      storedPaymentMethodsConfig: {
        isEnabled: await this.isStoredPaymentMethodsEnabled(),
      },
    } as ConfigResponse;
  }

  public async status(): Promise<StatusResponse> {
    const requiredPermissions = [
      'manage_payments',
      'view_sessions',
      'view_api_clients',
      'manage_orders',
      'introspect_oauth_tokens',
      'manage_types',
      'manage_checkout_payment_intents',
    ];

    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions,
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          const cfg = getConfig();
          const missing = ['moneiApiKey', 'moneiAccountId'].filter((k) => !(cfg as Record<string, unknown>)[k]);
          if (missing.length) {
            return {
              name: 'MONEI API',
              status: 'DOWN',
              message: `Missing configuration: ${missing.join(', ')}`,
              details: {},
            };
          }
          return {
            name: 'MONEI API',
            status: 'UP',
            message: 'MONEI credentials configured',
            details: {
              environment: cfg.moneiEnvironment,
              paymentMethods: getEnabledPaymentMethods(),
            },
          };
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/connect-payments-sdk': packageJSON.dependencies['@commercetools/connect-payments-sdk'],
      }),
    })();

    return handler.body;
  }

  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    const enabled = getEnabledPaymentMethods();
    const known = Object.values(PaymentMethodType) as string[];
    return {
      dropins: [{ type: 'embedded' }],
      components: enabled.filter((m) => known.includes(m)).map((type) => ({ type })),
      express: [],
    };
  }

  public async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const moneiId = this.requireInterfaceId(request.payment);
    try {
      const result = await this.moneiClient.capturePayment(moneiId, { amount: request.amount.centAmount });
      await this.ctPaymentService.updatePayment({
        id: request.payment.id,
        transaction: {
          type: 'Charge',
          amount: request.amount,
          interactionId: result.id,
          state: result.status === 'SUCCEEDED' ? 'Success' : 'Pending',
        },
      });
      return { outcome: PaymentModificationStatus.APPROVED, pspReference: result.id };
    } catch (e) {
      return this.rejectedModification(request.payment, 'Charge', request.amount, e);
    }
  }

  public async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const moneiId = this.requireInterfaceId(request.payment);
    try {
      const result = await this.moneiClient.cancelPayment(moneiId);
      await this.ctPaymentService.updatePayment({
        id: request.payment.id,
        transaction: {
          type: 'CancelAuthorization',
          amount: request.payment.amountPlanned,
          interactionId: result.id,
          state: 'Success',
        },
      });
      return { outcome: PaymentModificationStatus.APPROVED, pspReference: result.id };
    } catch (e) {
      return this.rejectedModification(request.payment, 'CancelAuthorization', request.payment.amountPlanned, e);
    }
  }

  public async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    const moneiId = this.requireInterfaceId(request.payment);
    try {
      const result = await this.moneiClient.refundPayment(moneiId, { amount: request.amount.centAmount });
      await this.ctPaymentService.updatePayment({
        id: request.payment.id,
        transaction: {
          type: 'Refund',
          amount: request.amount,
          interactionId: result.id,
          state: 'Success',
        },
      });
      return { outcome: PaymentModificationStatus.APPROVED, pspReference: result.id };
    } catch (e) {
      return this.rejectedModification(request.payment, 'Refund', request.amount, e);
    }
  }

  public async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    const hasCharge = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Charge',
      states: ['Success'],
    });
    const hasRefund = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Refund',
      states: ['Success', 'Pending'],
    });
    const hasCancelAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'CancelAuthorization',
      states: ['Success', 'Pending'],
    });
    const wasReverted = hasRefund || hasCancelAuthorization;

    if (hasCharge && !wasReverted) {
      return this.refundPayment({
        payment: request.payment,
        merchantReference: request.merchantReference,
        amount: request.payment.amountPlanned,
      });
    }

    const hasAuthorization = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Authorization',
      states: ['Success'],
    });
    if (hasAuthorization && !wasReverted) {
      return this.cancelPayment({ payment: request.payment });
    }

    throw new ErrorInvalidOperation('There is no successful payment transaction to reverse.');
  }

  public async handleTransaction(transactionDraft: TransactionDraftDTO): Promise<TransactionResponseDTO> {
    throw new ErrorInvalidField(
      'type',
      transactionDraft.type || 'not-provided',
      'unsupported: this connector does not process Checkout-initiated transactions yet',
    );
  }

  // ---------------------------------------------------------------------------------------------
  // /payments — called by the enabler inside a Checkout session
  // ---------------------------------------------------------------------------------------------

  public async createPayment(request: CreatePaymentRequest): Promise<PaymentResponseSchemaDTO> {
    const data = request.data;
    this.validateMethod(data);

    const ctCart = await this.ctCartService.getCart({ id: getCartIdFromContext() });
    const amountPlanned = await this.ctCartService.getPaymentAmount({ cart: ctCart });

    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: MONEI_PAYMENT_INTERFACE,
        method: data.paymentMethod.type,
      },
      checkoutTransactionItemId: getCheckoutTransactionItemIdFromContext(),
      ...(ctCart.customerId && { customer: { typeId: 'customer', id: ctCart.customerId } }),
      ...(!ctCart.customerId && ctCart.anonymousId && { anonymousId: ctCart.anonymousId }),
    });

    await this.ctCartService.addPayment({
      resource: { id: ctCart.id, version: ctCart.version },
      paymentId: ctPayment.id,
    });

    const transactionType = this.resolveTransactionType(data);
    const moneiRequest = this.buildMoneiRequest({ ctCart, ctPayment, data, transactionType });

    let moneiPayment: MoneiPayment;
    try {
      moneiPayment = await this.moneiClient.createPayment(moneiRequest, ctPayment.id);
    } catch (e) {
      // The CT Payment exists; leave a Failure transaction so Checkout can show it and the shopper can retry.
      await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        paymentMethod: data.paymentMethod.type,
        transaction: {
          type: transactionType === 'AUTH' ? 'Authorization' : 'Charge',
          amount: amountPlanned,
          state: 'Failure',
        },
      });
      throw this.toConnectError(e, 'MONEI rejected the payment request');
    }

    const mapping = mapMoneiStatusToTransaction(moneiPayment.status, transactionType) ?? {
      type: transactionType === 'AUTH' ? 'Authorization' : 'Charge',
      state: 'Pending' as TransactionState,
    };

    await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: moneiPayment.id,
      paymentMethod: data.paymentMethod.type,
      transaction: {
        type: mapping.type,
        amount: amountPlanned,
        interactionId: moneiPayment.id,
        state: mapping.state,
      },
    });

    log.info('MONEI payment created', {
      ctPaymentId: ctPayment.id,
      moneiPaymentId: moneiPayment.id,
      status: moneiPayment.status,
      method: data.paymentMethod.type,
    });

    return {
      paymentReference: ctPayment.id,
      moneiPaymentId: moneiPayment.id,
      status: moneiPayment.status,
      ...(moneiPayment.nextAction?.redirectUrl &&
        moneiPayment.nextAction.type !== 'COMPLETE' && { redirectUrl: moneiPayment.nextAction.redirectUrl }),
    };
  }

  /** Polling fallback for the return page: re-reads MONEI and syncs the CT Payment if the webhook is late. */
  public async getPaymentStatus(ctPaymentId: string): Promise<{ moneiPaymentId: string; status: string }> {
    const ctPayment = await this.ctPaymentService.getPayment({ id: ctPaymentId });
    const moneiId = this.requireInterfaceId(ctPayment);
    const moneiPayment = await this.moneiClient.getPayment(moneiId);
    await this.applyMoneiPayment(moneiPayment, ctPayment);
    return { moneiPaymentId: moneiPayment.id, status: moneiPayment.status };
  }

  // ---------------------------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------------------------

  /**
   * Applies a MONEI payment (from a signed callback or a status poll) to its commercetools Payment.
   * Idempotent: a transaction already in the target state is not added again.
   */
  public async applyMoneiPayment(
    moneiPayment: MoneiPayment,
    knownCtPayment?: Payment,
  ): Promise<{ ctPaymentId?: string; applied: boolean }> {
    const ctPayment = knownCtPayment ?? (await this.findCtPayment(moneiPayment));
    if (!ctPayment) {
      log.warn('MONEI webhook for unknown payment', { moneiPaymentId: moneiPayment.id, orderId: moneiPayment.orderId });
      return { applied: false };
    }

    const mapping = mapMoneiStatusToTransaction(moneiPayment.status, moneiPayment.transactionType);
    if (!mapping) {
      return { ctPaymentId: ctPayment.id, applied: false };
    }

    const amount =
      mapping.type === 'Refund'
        ? {
            centAmount: this.refundDelta(moneiPayment, ctPayment),
            currencyCode: ctPayment.amountPlanned.currencyCode,
          }
        : ctPayment.amountPlanned;

    if (mapping.type === 'Refund' && amount.centAmount <= 0) {
      return { ctPaymentId: ctPayment.id, applied: false };
    }

    const alreadyThere = this.ctPaymentService.hasTransactionInState({
      payment: ctPayment,
      transactionType: mapping.type,
      states: [mapping.state],
    });
    if (alreadyThere && mapping.type !== 'Refund') {
      return { ctPaymentId: ctPayment.id, applied: false };
    }

    await this.ctPaymentService.updatePayment({
      id: ctPayment.id,
      pspReference: moneiPayment.id,
      transaction: {
        type: mapping.type,
        amount,
        interactionId: moneiPayment.id,
        state: mapping.state,
      },
    });

    log.info('MONEI payment applied to commercetools', {
      ctPaymentId: ctPayment.id,
      moneiPaymentId: moneiPayment.id,
      status: moneiPayment.status,
      transaction: mapping,
    });

    return { ctPaymentId: ctPayment.id, applied: true };
  }

  private async findCtPayment(moneiPayment: MoneiPayment): Promise<Payment | undefined> {
    const byInterfaceId = await this.ctPaymentService.findPaymentsByInterfaceId({ interfaceId: moneiPayment.id });
    if (byInterfaceId.length > 0) return byInterfaceId[0];
    // orderId is set to the CT Payment id at creation; fall back to it if the interfaceId was never persisted.
    if (moneiPayment.orderId) {
      try {
        return await this.ctPaymentService.getPayment({ id: moneiPayment.orderId });
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  /** Amount not yet reflected as a successful Refund transaction on the CT Payment. */
  private refundDelta(moneiPayment: MoneiPayment, ctPayment: Payment): number {
    const refundedAtMonei =
      moneiPayment.refundedAmount ?? (moneiPayment.status === 'REFUNDED' ? ctPayment.amountPlanned.centAmount : 0);
    const refundedInCt = ctPayment.transactions
      .filter((t) => t.type === 'Refund' && t.state === 'Success')
      .reduce((sum, t) => sum + t.amount.centAmount, 0);
    return refundedAtMonei - refundedInCt;
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------

  private async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    if (!getStoredPaymentMethodsConfig().enabled) return false;
    const ctCart = await this.ctCartService.getCart({ id: getCartIdFromContext() });
    return ctCart.customerId !== undefined;
  }

  private validateMethod(data: PaymentRequestSchemaDTO): void {
    const enabled = getEnabledPaymentMethods();
    if (!enabled.includes(data.paymentMethod.type)) {
      throw new ErrorInvalidField('paymentMethod.type', data.paymentMethod.type, enabled.join('|'));
    }
  }

  private resolveTransactionType(data: PaymentRequestSchemaDTO): 'SALE' | 'AUTH' {
    if (data.transactionType === 'AUTH' && !IMMEDIATE_ONLY_METHODS.has(data.paymentMethod.type)) return 'AUTH';
    return 'SALE';
  }

  private buildMoneiRequest(args: {
    ctCart: Cart;
    ctPayment: Payment;
    data: PaymentRequestSchemaDTO;
    transactionType: 'SALE' | 'AUTH';
  }): MoneiCreatePaymentRequest {
    const { ctCart, ctPayment, data, transactionType } = args;
    const cfg = getConfig();
    const billing = ctCart.billingAddress;
    const shipping = ctCart.shippingAddress;
    const name = [billing?.firstName, billing?.lastName].filter(Boolean).join(' ') || undefined;
    const callbackUrl = cfg.connectServiceUrl
      ? `${cfg.connectServiceUrl.replace(/\/$/, '')}/webhooks/monei`
      : undefined;

    return {
      amount: ctPayment.amountPlanned.centAmount,
      currency: ctPayment.amountPlanned.currencyCode,
      orderId: ctPayment.id,
      description: `commercetools cart ${ctCart.id}`,
      allowedPaymentMethods: [data.paymentMethod.type as MoneiPaymentMethodType],
      transactionType,
      ...(data.paymentMethod.paymentToken && {
        paymentToken: data.paymentMethod.paymentToken,
        ...(data.paymentMethod.sessionId && { sessionId: data.paymentMethod.sessionId }),
      }),
      customer: {
        email: ctCart.customerEmail ?? billing?.email,
        name,
        phone: billing?.phone ?? billing?.mobile,
      },
      ...(billing && {
        billingDetails: {
          name,
          email: billing.email,
          phone: billing.phone ?? billing.mobile,
          address: {
            line1: [billing.streetName, billing.streetNumber].filter(Boolean).join(' ') || undefined,
            line2: billing.additionalStreetInfo,
            city: billing.city,
            state: billing.region ?? billing.state,
            zip: billing.postalCode,
            country: billing.country,
          },
        },
      }),
      ...(shipping && {
        shippingDetails: {
          name: [shipping.firstName, shipping.lastName].filter(Boolean).join(' ') || undefined,
          address: {
            line1: [shipping.streetName, shipping.streetNumber].filter(Boolean).join(' ') || undefined,
            line2: shipping.additionalStreetInfo,
            city: shipping.city,
            state: shipping.region ?? shipping.state,
            zip: shipping.postalCode,
            country: shipping.country,
          },
        },
      }),
      ...(callbackUrl && { callbackUrl }),
      completeUrl: data.returnUrl ?? cfg.returnUrl,
      cancelUrl: data.cancelUrl ?? data.returnUrl ?? cfg.returnUrl,
      failUrl: data.returnUrl ?? cfg.returnUrl,
      metadata: {
        ctCartId: ctCart.id,
        ctPaymentId: ctPayment.id,
        ctProjectKey: cfg.projectKey,
      },
    };
  }

  private requireInterfaceId(payment: Payment): string {
    if (!payment.interfaceId) {
      throw new ErrorInvalidOperation(`Payment ${payment.id} has no MONEI payment id (interfaceId).`);
    }
    return payment.interfaceId;
  }

  private async rejectedModification(
    payment: Payment,
    type: TransactionType,
    amount: { centAmount: number; currencyCode: string },
    error: unknown,
  ): Promise<PaymentProviderModificationResponse> {
    log.error(`MONEI ${type} failed`, { ctPaymentId: payment.id, moneiPaymentId: payment.interfaceId, error });
    await this.ctPaymentService.updatePayment({
      id: payment.id,
      transaction: { type, amount, interactionId: payment.interfaceId, state: 'Failure' },
    });
    return { outcome: PaymentModificationStatus.REJECTED, pspReference: payment.interfaceId as string };
  }

  private toConnectError(e: unknown, fallback: string): Error {
    if (e instanceof MoneiApiError) {
      return new ErrorGeneral(e.message || fallback, {
        privateFields: { moneiStatus: e.status, moneiBody: e.body },
      });
    }
    return e instanceof Error ? e : new ErrorGeneral(fallback);
  }
}

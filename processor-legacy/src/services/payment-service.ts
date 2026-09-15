import {
  getMoneiClient,
  MoneiPaymentRequest,
  MoneiPaymentResponse,
  MoneiPaymentStatus,
} from '../libs/monei-client';
import { getEnabledPaymentMethods } from '../config';

/**
 * Maps commercetools payment method to MONEI payment method type
 */
function mapPaymentMethod(ctMethod: string): string | undefined {
  const mapping: Record<string, string> = {
    card: 'card',
    bizum: 'bizum',
    applePay: 'applePay',
    googlePay: 'googlePay',
    sepaDirectDebit: 'sepaDirectDebit',
  };
  return mapping[ctMethod];
}

/**
 * Maps MONEI payment status to commercetools transaction state
 */
export function mapMoneiStatusToCtTransactionState(
  status: MoneiPaymentStatus
): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'Success';
    case 'AUTHORIZED':
      return 'Success';
    case 'FAILED':
      return 'Failure';
    case 'CANCELED':
      return 'Failure';
    case 'EXPIRED':
      return 'Failure';
    case 'PENDING':
      return 'Pending';
    case 'REFUNDED':
      return 'Success';
    case 'PARTIALLY_REFUNDED':
      return 'Success';
    default:
      return 'Pending';
  }
}

/**
 * Maps MONEI payment status to commercetools transaction type
 */
export function mapMoneiStatusToCtTransactionType(
  status: MoneiPaymentStatus,
  transactionType: string
): string {
  if (status === 'AUTHORIZED') return 'Authorization';
  if (status === 'SUCCEEDED' && transactionType === 'SALE') return 'Charge';
  if (status === 'SUCCEEDED' && transactionType === 'AUTH') return 'Authorization';
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') return 'Refund';
  if (status === 'CANCELED') return 'CancelAuthorization';
  return 'Charge';
}

export interface CreatePaymentParams {
  amount: number; // commercetools cent amount
  currency: string;
  orderId: string;
  paymentMethodType?: string;
  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  billingAddress?: {
    streetName?: string;
    streetNumber?: string;
    additionalStreetInfo?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  shippingAddress?: {
    streetName?: string;
    streetNumber?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  completeUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  transactionType?: 'SALE' | 'AUTH';
}

export interface PaymentServiceResult {
  success: boolean;
  moneiPaymentId?: string;
  status?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Payment Service
 *
 * Orchestrates payment operations between commercetools and MONEI.
 * Handles mapping of data formats, currency conversion, and error handling.
 */
export class PaymentService {
  /**
   * Get list of available payment methods
   */
  getAvailablePaymentMethods(): string[] {
    return getEnabledPaymentMethods();
  }

  /**
   * Create a new MONEI payment from commercetools payment data
   */
  async createPayment(
    params: CreatePaymentParams
  ): Promise<PaymentServiceResult> {
    const client = getMoneiClient();

    const moneiRequest: MoneiPaymentRequest = {
      amount: params.amount, // Both use cent amounts
      currency: params.currency,
      orderId: params.orderId,
      transactionType: params.transactionType || 'SALE',
      completeUrl: params.completeUrl,
      cancelUrl: params.cancelUrl,
      callbackUrl: params.callbackUrl,
    };

    // Map payment method
    if (params.paymentMethodType) {
      const moneiMethod = mapPaymentMethod(params.paymentMethodType);
      if (moneiMethod) {
        moneiRequest.paymentMethod = { type: moneiMethod };
      }
    }

    // Map customer
    if (params.customer) {
      moneiRequest.customer = {
        email: params.customer.email,
        name: [params.customer.firstName, params.customer.lastName]
          .filter(Boolean)
          .join(' '),
        phone: params.customer.phone,
      };
    }

    // Map billing address
    if (params.billingAddress) {
      moneiRequest.billingDetails = {
        name: params.customer
          ? [params.customer.firstName, params.customer.lastName]
              .filter(Boolean)
              .join(' ')
          : undefined,
        email: params.customer?.email,
        address: {
          line1: [
            params.billingAddress.streetName,
            params.billingAddress.streetNumber,
          ]
            .filter(Boolean)
            .join(' '),
          line2: params.billingAddress.additionalStreetInfo,
          city: params.billingAddress.city,
          state: params.billingAddress.region,
          zip: params.billingAddress.postalCode,
          country: params.billingAddress.country,
        },
      };
    }

    // Map shipping address
    if (params.shippingAddress) {
      moneiRequest.shippingDetails = {
        address: {
          line1: [
            params.shippingAddress.streetName,
            params.shippingAddress.streetNumber,
          ]
            .filter(Boolean)
            .join(' '),
          city: params.shippingAddress.city,
          state: params.shippingAddress.region,
          zip: params.shippingAddress.postalCode,
          country: params.shippingAddress.country,
        },
      };
    }

    try {
      const response = await client.createPayment(moneiRequest);

      return {
        success: true,
        moneiPaymentId: response.id,
        status: response.status,
        redirectUrl: response.nextAction?.redirectUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating payment',
      };
    }
  }

  /**
   * Capture an authorized MONEI payment
   */
  async capturePayment(
    moneiPaymentId: string,
    amount?: number
  ): Promise<PaymentServiceResult> {
    const client = getMoneiClient();

    try {
      const response = await client.capturePayment(moneiPaymentId, {
        amount,
      });

      return {
        success: response.status === 'SUCCEEDED',
        moneiPaymentId: response.id,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error capturing payment',
      };
    }
  }

  /**
   * Cancel/void an authorized MONEI payment
   */
  async cancelPayment(
    moneiPaymentId: string
  ): Promise<PaymentServiceResult> {
    const client = getMoneiClient();

    try {
      const response = await client.cancelPayment(moneiPaymentId);

      return {
        success: response.status === 'CANCELED',
        moneiPaymentId: response.id,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error canceling payment',
      };
    }
  }

  /**
   * Refund a captured MONEI payment
   */
  async refundPayment(
    moneiPaymentId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentServiceResult> {
    const client = getMoneiClient();

    try {
      const response = await client.refundPayment(moneiPaymentId, {
        amount,
        reason,
      });

      return {
        success: true,
        moneiPaymentId: response.paymentId,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error refunding payment',
      };
    }
  }

  /**
   * Get MONEI payment details
   */
  async getPaymentDetails(
    moneiPaymentId: string
  ): Promise<MoneiPaymentResponse | null> {
    const client = getMoneiClient();

    try {
      return await client.getPayment(moneiPaymentId);
    } catch (error) {
      console.error('Error fetching MONEI payment:', error);
      return null;
    }
  }
}

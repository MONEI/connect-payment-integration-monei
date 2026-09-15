import { Static, Type } from '@sinclair/typebox';

export enum PaymentMethodType {
  CARD = 'card',
  BIZUM = 'bizum',
  APPLE_PAY = 'applePay',
  GOOGLE_PAY = 'googlePay',
  SEPA_DIRECT_DEBIT = 'sepaDirectDebit',
}

export const PaymentRequestSchema = Type.Object({
  paymentMethod: Type.Object({
    type: Type.Enum(PaymentMethodType),
    /** MONEI.js token for card / wallet components. Absent for redirect methods (Bizum) and hosted page. */
    paymentToken: Type.Optional(Type.String()),
    /** MONEI.js session id that accompanies a paymentToken. */
    sessionId: Type.Optional(Type.String()),
    storedPaymentMethodId: Type.Optional(Type.String()),
    storePaymentMethod: Type.Optional(Type.Boolean()),
  }),
  /** Where the shopper lands after a redirect (Bizum, 3DS challenge, hosted page). */
  returnUrl: Type.Optional(Type.String()),
  cancelUrl: Type.Optional(Type.String()),
  /** SALE (default) or AUTH. AUTH only applies to cards; ignored for other methods. */
  transactionType: Type.Optional(Type.Union([Type.Literal('SALE'), Type.Literal('AUTH')])),
});

export const PaymentResponseSchema = Type.Object({
  /** commercetools Payment id. */
  paymentReference: Type.String(),
  /** MONEI payment id (also stored as Payment.interfaceId). */
  moneiPaymentId: Type.String(),
  status: Type.String(),
  /** Present when the shopper must be redirected to finish the payment. */
  redirectUrl: Type.Optional(Type.String()),
});

export const PaymentStatusResponseSchema = Type.Object({
  paymentReference: Type.String(),
  moneiPaymentId: Type.String(),
  status: Type.String(),
});

export type PaymentRequestSchemaDTO = Static<typeof PaymentRequestSchema>;
export type PaymentResponseSchemaDTO = Static<typeof PaymentResponseSchema>;
export type PaymentStatusResponseSchemaDTO = Static<typeof PaymentStatusResponseSchema>;

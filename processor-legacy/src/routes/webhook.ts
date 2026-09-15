import { FastifyRequest, FastifyReply } from 'fastify';
import { getMoneiClient, MoneiPaymentResponse } from '../libs/monei-client';
import {
  mapMoneiStatusToCtTransactionState,
  mapMoneiStatusToCtTransactionType,
} from '../services/payment-service';

/**
 * MONEI Webhook Event Payload
 *
 * MONEI sends webhook notifications for payment status changes.
 * The payload contains the full payment object.
 * See: https://docs.monei.com/docs/guides/set-up-notifications
 */
type MoneiWebhookPayload = MoneiPaymentResponse;

/**
 * Handle incoming MONEI webhook events
 *
 * This handler:
 * 1. Verifies the webhook signature (HMAC-SHA256)
 * 2. Parses the payment event
 * 3. Updates the corresponding commercetools payment
 *
 * MONEI webhook events include:
 * - Payment authorized
 * - Payment succeeded (captured)
 * - Payment failed
 * - Payment canceled
 * - Payment refunded
 * - Payment expired
 */
export async function handleWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const signature = request.headers['monei-signature'] as string;

  if (!signature) {
    reply.status(400).send({ error: 'Missing MONEI-Signature header' });
    return;
  }

  // Verify webhook signature
  const client = getMoneiClient();
  const body = JSON.stringify(request.body);

  if (!client.verifyWebhookSignature(body, signature)) {
    reply.status(401).send({ error: 'Invalid webhook signature' });
    return;
  }

  const payment = request.body as MoneiWebhookPayload;

  console.log(
    `[MONEI Webhook] Payment ${payment.id} status: ${payment.status} (order: ${payment.orderId})`
  );

  try {
    // Map MONEI status to commercetools transaction
    const ctTransactionState = mapMoneiStatusToCtTransactionState(payment.status);
    const ctTransactionType = mapMoneiStatusToCtTransactionType(
      payment.status,
      'SALE' // TODO: determine from payment metadata
    );

    console.log(
      `[MONEI Webhook] Mapped to CT transaction: type=${ctTransactionType}, state=${ctTransactionState}`
    );

    // TODO: Use connect-payments-sdk to update commercetools payment

    // Store payment method info if available
    if (payment.paymentMethod) {
      console.log(
        `[MONEI Webhook] Payment method: ${payment.paymentMethod.type}`,
        payment.paymentMethod.card
          ? `(${payment.paymentMethod.card.brand} ****${payment.paymentMethod.card.last4})`
          : ''
      );
    }

    // Respond immediately with 200 to acknowledge receipt
    reply.status(200).send({ received: true });
  } catch (error) {
    console.error('[MONEI Webhook] Error processing webhook:', error);
    // Still return 200 to prevent retries for processing errors
    // The error should be handled via retry/recovery mechanisms
    reply.status(200).send({ received: true, processingError: true });
  }
}

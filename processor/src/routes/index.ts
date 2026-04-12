import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/payment-service';
import { handleWebhook } from './webhook';

const paymentService = new PaymentService();

/**
 * Register all payment routes
 *
 * These routes handle:
 * - GET  /payment-methods    — List available payment methods
 * - POST /payments           — Create a new payment
 * - POST /payments/:id/capture  — Capture an authorized payment
 * - POST /payments/:id/cancel   — Cancel an authorized payment
 * - POST /payments/:id/refund   — Refund a captured payment
 * - GET  /payments/:id          — Get payment status
 * - POST /webhooks/monei        — Handle MONEI webhook events
 * - GET  /health                — Health check
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      status: 'ok',
      connector: 'monei-payment-integration',
      version: '1.0.0',
    });
  });

  // List available payment methods
  app.get(
    '/payment-methods',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const methods = paymentService.getAvailablePaymentMethods();
      reply.status(200).send({ paymentMethods: methods });
    }
  );

  // Create payment
  app.post(
    '/payments',
    async (
      request: FastifyRequest<{
        Body: {
          amount: number;
          currency: string;
          orderId: string;
          paymentMethodType?: string;
          customer?: {
            email?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
          };
          billingAddress?: Record<string, string>;
          shippingAddress?: Record<string, string>;
          completeUrl: string;
          cancelUrl: string;
          transactionType?: 'SALE' | 'AUTH';
        };
      }>,
      reply: FastifyReply
    ) => {
      const { body } = request;

      // The callbackUrl is the webhook endpoint for this connector
      const callbackUrl = `${request.protocol}://${request.hostname}/webhooks/monei`;

      const result = await paymentService.createPayment({
        ...body,
        callbackUrl,
      });

      if (result.success) {
        reply.status(201).send(result);
      } else {
        reply.status(400).send({ error: result.error });
      }
    }
  );

  // Capture payment
  app.post(
    '/payments/:id/capture',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { amount?: number };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { amount } = request.body || {};

      const result = await paymentService.capturePayment(id, amount);

      if (result.success) {
        reply.status(200).send(result);
      } else {
        reply.status(400).send({ error: result.error });
      }
    }
  );

  // Cancel payment
  app.post(
    '/payments/:id/cancel',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const result = await paymentService.cancelPayment(id);

      if (result.success) {
        reply.status(200).send(result);
      } else {
        reply.status(400).send({ error: result.error });
      }
    }
  );

  // Refund payment
  app.post(
    '/payments/:id/refund',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { amount?: number; reason?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { amount, reason } = request.body || {};

      const result = await paymentService.refundPayment(id, amount, reason);

      if (result.success) {
        reply.status(200).send(result);
      } else {
        reply.status(400).send({ error: result.error });
      }
    }
  );

  // Get payment status
  app.get(
    '/payments/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const payment = await paymentService.getPaymentDetails(id);

      if (payment) {
        reply.status(200).send(payment);
      } else {
        reply.status(404).send({ error: 'Payment not found' });
      }
    }
  );

  // MONEI webhook endpoint
  app.post('/webhooks/monei', handleWebhook);
}

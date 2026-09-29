import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { paymentRoutes } from '../../routes/monei-payment.route';
import { webhookRoutes } from '../../routes/monei-webhook.route';
import { MoneiPaymentService } from '../../services/monei-payment.service';

export default async function (server: FastifyInstance) {
  const moneiPaymentService = new MoneiPaymentService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
    ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
    ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
  });

  await server.register(paymentRoutes, {
    paymentService: moneiPaymentService,
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
  });

  // Separate registration: the webhook route swaps the JSON parser for a raw-body parser in its own context.
  await server.register(webhookRoutes, { paymentService: moneiPaymentService });
}

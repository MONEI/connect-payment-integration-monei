import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getConfig } from '../config/config';
import { log } from '../libs/logger';
import { verifyMoneiSignature } from '../libs/monei/signature';
import { MoneiEventEnvelope, MoneiPayment } from '../libs/monei/types';
import { MoneiPaymentService } from '../services/monei-payment.service';

type WebhookRoutesOptions = {
  paymentService: MoneiPaymentService;
};

const RAW_JSON = 'application/json';

/**
 * Receives MONEI callbacks. Registered in its own Fastify context so the JSON parser can be replaced
 * by a raw-body parser for this route only: the signature is computed over the exact bytes MONEI sent,
 * and a re-serialised body would not verify.
 */
export const webhookRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & WebhookRoutesOptions) => {
  fastify.removeContentTypeParser(RAW_JSON);
  fastify.addContentTypeParser(RAW_JSON, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  fastify.post<{ Body: Buffer }>('/webhooks/monei', { config: { rawBody: true } }, async (request, reply) => {
    const cfg = getConfig();
    const header = request.headers['monei-signature'];
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body ?? ''), 'utf8');

    const valid = verifyMoneiSignature({
      rawBody,
      header: Array.isArray(header) ? header[0] : header,
      secrets: [cfg.moneiWebhookSecret, cfg.moneiApiKey],
      toleranceSeconds: cfg.moneiWebhookToleranceSeconds,
    });

    if (!valid) {
      log.warn('MONEI webhook rejected: invalid signature');
      return reply.status(401).send({ received: false, error: 'invalid signature' });
    }

    let payment: MoneiPayment;
    try {
      payment = unwrap(JSON.parse(rawBody.toString('utf8')));
    } catch {
      return reply.status(400).send({ received: false, error: 'malformed body' });
    }

    if (!payment?.id || !payment?.status) {
      return reply.status(400).send({ received: false, error: 'not a payment' });
    }

    try {
      const result = await opts.paymentService.applyMoneiPayment(payment);
      return reply.status(200).send({ received: true, ...result });
    } catch (error) {
      // A 5xx makes MONEI retry, which is what we want for transient commercetools errors.
      log.error('MONEI webhook processing failed', { moneiPaymentId: payment.id, error });
      return reply.status(500).send({ received: false });
    }
  });
};

/** Per-payment callbackUrl deliveries are a bare Payment; account webhooks wrap it in an event envelope. */
export function unwrap(body: unknown): MoneiPayment {
  const b = body as Partial<MoneiEventEnvelope> & Partial<MoneiPayment>;
  if (b && typeof b === 'object' && 'object' in b && b.object && typeof b.object === 'object') {
    return b.object as MoneiPayment;
  }
  return b as MoneiPayment;
}

import { SessionHeaderAuthenticationHook } from '@commercetools/connect-payments-sdk';
import { Type } from '@sinclair/typebox';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  PaymentRequestSchema,
  PaymentRequestSchemaDTO,
  PaymentResponseSchema,
  PaymentResponseSchemaDTO,
  PaymentStatusResponseSchema,
  PaymentStatusResponseSchemaDTO,
} from '../dtos/monei-payment.dto';
import { MoneiPaymentService } from '../services/monei-payment.service';

type PaymentRoutesOptions = {
  paymentService: MoneiPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
};

/**
 * Enabler-facing routes. Every route is authenticated with the Checkout session (X-Session-Id), so
 * the cart, the amount and the customer come from the session, never from the request body.
 */
export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: PaymentRequestSchemaDTO; Reply: PaymentResponseSchemaDTO }>(
    '/payments',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        body: PaymentRequestSchema,
        response: { 200: PaymentResponseSchema },
      },
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createPayment({ data: request.body });
      return reply.status(200).send(resp);
    },
  );

  fastify.get<{ Params: { id: string }; Reply: PaymentStatusResponseSchemaDTO }>(
    '/payments/:id',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate()],
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: { 200: PaymentStatusResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await opts.paymentService.getPaymentStatus(request.params.id);
      return reply.status(200).send({ paymentReference: request.params.id, ...result });
    },
  );
};

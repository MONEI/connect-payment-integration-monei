import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Payment } from '@commercetools/platform-sdk';
import { DefaultCartService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-cart.service';
import { DefaultPaymentService } from '@commercetools/connect-payments-sdk/dist/commercetools/services/ct-payment.service';
import * as Config from '../src/config/config';
import * as FastifyContext from '../src/libs/fastify/context/context';
import { MoneiClient } from '../src/libs/monei/client';
import { MoneiPayment } from '../src/libs/monei/types';
import { paymentSDK } from '../src/payment-sdk';
import { MoneiPaymentService } from '../src/services/monei-payment.service';
import { mockGetCartResult } from './utils/mock-cart-data';
import { mockGetPaymentResult, mockGetPaymentResultWithoutTransactions } from './utils/mock-payment-results';

const baseConfig = {
  ...Config.config,
  moneiApiKey: 'pk_test_key',
  moneiAccountId: 'acc_123',
  moneiEnvironment: 'test' as const,
  moneiPaymentMethodsEnabled: 'bizum,card,applePay',
  connectServiceUrl: 'https://processor.example.com',
  returnUrl: 'https://shop.example.com/return',
  storedPaymentMethodsEnabled: 'false',
};

const moneiPayment = (over: Partial<MoneiPayment> = {}): MoneiPayment => ({
  id: 'mp_1',
  amount: 150000,
  currency: 'EUR',
  orderId: '123456',
  status: 'PENDING',
  transactionType: 'SALE',
  ...over,
});

const fakeClient = () =>
  ({
    createPayment: jest.fn<MoneiClient['createPayment']>(),
    confirmPayment: jest.fn<MoneiClient['confirmPayment']>(),
    getPayment: jest.fn<MoneiClient['getPayment']>(),
    capturePayment: jest.fn<MoneiClient['capturePayment']>(),
    cancelPayment: jest.fn<MoneiClient['cancelPayment']>(),
    refundPayment: jest.fn<MoneiClient['refundPayment']>(),
  }) as unknown as jest.Mocked<MoneiClient>;

describe('MoneiPaymentService', () => {
  let client: jest.Mocked<MoneiClient>;
  let service: MoneiPaymentService;
  let createCtPayment: jest.SpiedFunction<DefaultPaymentService['createPayment']>;
  let updateCtPayment: jest.SpiedFunction<DefaultPaymentService['updatePayment']>;

  beforeEach(() => {
    jest.spyOn(Config, 'getConfig').mockReturnValue(baseConfig);
    jest.spyOn(FastifyContext, 'getCartIdFromContext').mockReturnValue('cart-1');
    jest.spyOn(FastifyContext, 'getCheckoutTransactionItemIdFromContext').mockReturnValue(undefined);
    jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResult());
    jest.spyOn(DefaultCartService.prototype, 'addPayment').mockResolvedValue(mockGetCartResult());
    jest
      .spyOn(DefaultCartService.prototype, 'getPaymentAmount')
      .mockResolvedValue({ centAmount: 150000, currencyCode: 'EUR', fractionDigits: 2 });
    createCtPayment = jest
      .spyOn(DefaultPaymentService.prototype, 'createPayment')
      .mockResolvedValue(mockGetPaymentResultWithoutTransactions);
    updateCtPayment = jest
      .spyOn(DefaultPaymentService.prototype, 'updatePayment')
      .mockResolvedValue(mockGetPaymentResult);

    client = fakeClient();
    service = new MoneiPaymentService({
      ctCartService: paymentSDK.ctCartService,
      ctPaymentService: paymentSDK.ctPaymentService,
      ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
      ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
      moneiClient: client,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPayment', () => {
    test('Bizum: creates the CT Payment, a PENDING Charge and returns the redirect URL', async () => {
      client.createPayment.mockResolvedValue(
        moneiPayment({
          nextAction: { type: 'BIZUM_CHALLENGE', redirectUrl: 'https://bizum/redirect', mustRedirect: true },
        }),
      );

      const res = await service.createPayment({
        data: { paymentMethod: { type: 'bizum' as never }, returnUrl: 'https://shop.example.com/return' },
      });

      expect(createCtPayment).toHaveBeenCalledTimes(1);
      const moneiReq = client.createPayment.mock.calls[0][0];
      // amount/currency come from the commercetools Payment that was just created, never from the request body
      expect(moneiReq).toMatchObject({
        amount: mockGetPaymentResultWithoutTransactions.amountPlanned.centAmount,
        currency: mockGetPaymentResultWithoutTransactions.amountPlanned.currencyCode,
        orderId: mockGetPaymentResultWithoutTransactions.id,
        allowedPaymentMethods: ['bizum'],
        transactionType: 'SALE',
        callbackUrl: 'https://processor.example.com/webhooks/monei',
        completeUrl: 'https://shop.example.com/return',
      });
      // idempotency key = CT payment id
      expect(client.createPayment.mock.calls[0][1]).toBe(mockGetPaymentResultWithoutTransactions.id);

      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          pspReference: 'mp_1',
          paymentMethod: 'bizum',
          transaction: expect.objectContaining({ type: 'Charge', state: 'Pending', interactionId: 'mp_1' }),
        }),
      );
      expect(res).toEqual({
        paymentReference: mockGetPaymentResultWithoutTransactions.id,
        moneiPaymentId: 'mp_1',
        status: 'PENDING',
        redirectUrl: 'https://bizum/redirect',
      });
    });

    test('card with MONEI.js token: forwards the token and records a successful Charge', async () => {
      client.createPayment.mockResolvedValue(moneiPayment({ status: 'SUCCEEDED', nextAction: { type: 'COMPLETE' } }));

      const res = await service.createPayment({
        data: { paymentMethod: { type: 'card' as never, paymentToken: 'tok_1', sessionId: 'sess_1' } },
      });

      expect(client.createPayment.mock.calls[0][0]).toMatchObject({ paymentToken: 'tok_1', sessionId: 'sess_1' });
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Charge', state: 'Success' }) }),
      );
      expect(res.redirectUrl).toBeUndefined();
      expect(res.status).toBe('SUCCEEDED');
    });

    test('AUTH is honoured for cards and silently downgraded to SALE for Bizum', async () => {
      client.createPayment.mockResolvedValue(moneiPayment({ status: 'AUTHORIZED', transactionType: 'AUTH' }));
      await service.createPayment({ data: { paymentMethod: { type: 'card' as never }, transactionType: 'AUTH' } });
      expect(client.createPayment.mock.calls[0][0].transactionType).toBe('AUTH');
      expect(updateCtPayment).toHaveBeenLastCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Authorization', state: 'Success' }) }),
      );

      client.createPayment.mockResolvedValue(moneiPayment());
      await service.createPayment({ data: { paymentMethod: { type: 'bizum' as never }, transactionType: 'AUTH' } });
      expect(client.createPayment.mock.calls[1][0].transactionType).toBe('SALE');
    });

    test('rejects a method that is not enabled on the connector', async () => {
      await expect(
        service.createPayment({ data: { paymentMethod: { type: 'sepaDirectDebit' as never } } }),
      ).rejects.toThrow(/paymentMethod.type/);
      expect(client.createPayment).not.toHaveBeenCalled();
    });

    test('when MONEI rejects the request, the CT Payment gets a Failure transaction and the error propagates', async () => {
      client.createPayment.mockRejectedValue(new Error('boom'));
      await expect(service.createPayment({ data: { paymentMethod: { type: 'card' as never } } })).rejects.toThrow(
        'boom',
      );
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Charge', state: 'Failure' }) }),
      );
    });
  });

  describe('modifications', () => {
    test('capture calls MONEI then records a Charge/Success', async () => {
      client.capturePayment.mockResolvedValue(moneiPayment({ status: 'SUCCEEDED' }));
      const res = await service.capturePayment({
        payment: mockGetPaymentResult,
        amount: { centAmount: 1000, currencyCode: 'GBP' },
        merchantReference: 'ref',
      });
      expect(client.capturePayment).toHaveBeenCalledWith(mockGetPaymentResult.interfaceId as string, { amount: 1000 });
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Charge', state: 'Success' }) }),
      );
      expect(res.outcome).toBe('approved');
    });

    test('refund failure at MONEI is recorded as a Refund/Failure and reported as rejected', async () => {
      client.refundPayment.mockRejectedValue(new Error('cannot refund'));
      const res = await service.refundPayment({
        payment: mockGetPaymentResult,
        amount: { centAmount: 500, currencyCode: 'GBP' },
        merchantReference: 'ref',
      });
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Refund', state: 'Failure' }) }),
      );
      expect(res.outcome).toBe('rejected');
    });

    test('cancel releases the authorization', async () => {
      client.cancelPayment.mockResolvedValue(moneiPayment({ status: 'CANCELED' }));
      const res = await service.cancelPayment({ payment: mockGetPaymentResult });
      expect(client.cancelPayment).toHaveBeenCalledWith(mockGetPaymentResult.interfaceId as string);
      expect(res.outcome).toBe('approved');
    });

    test('a payment without interfaceId cannot be modified', async () => {
      const noInterface = { ...mockGetPaymentResult, interfaceId: undefined } as Payment;
      await expect(service.cancelPayment({ payment: noInterface })).rejects.toThrow(/interfaceId/);
    });
  });

  describe('applyMoneiPayment (webhook / poll)', () => {
    const pendingCtPayment: Payment = {
      ...mockGetPaymentResultWithoutTransactions,
      interfaceId: 'mp_1',
      amountPlanned: { type: 'centPrecision', centAmount: 150000, currencyCode: 'EUR', fractionDigits: 2 },
      transactions: [
        {
          id: 't1',
          type: 'Charge',
          state: 'Pending',
          amount: { type: 'centPrecision', centAmount: 150000, currencyCode: 'EUR', fractionDigits: 2 },
        },
      ],
    };

    test('SUCCEEDED moves the CT Payment to Charge/Success, looked up by interfaceId', async () => {
      const find = jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([pendingCtPayment]);
      const res = await service.applyMoneiPayment(moneiPayment({ status: 'SUCCEEDED' }));
      expect(find).toHaveBeenCalledWith({ interfaceId: 'mp_1' });
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: pendingCtPayment.id,
          transaction: expect.objectContaining({ type: 'Charge', state: 'Success', interactionId: 'mp_1' }),
        }),
      );
      expect(res).toEqual({ ctPaymentId: pendingCtPayment.id, applied: true });
    });

    test('is idempotent: a state already on the Payment is not added twice', async () => {
      jest
        .spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId')
        .mockResolvedValue([
          { ...pendingCtPayment, transactions: [{ ...pendingCtPayment.transactions[0], state: 'Success' }] },
        ]);
      const res = await service.applyMoneiPayment(moneiPayment({ status: 'SUCCEEDED' }));
      expect(updateCtPayment).not.toHaveBeenCalled();
      expect(res.applied).toBe(false);
    });

    test('falls back to orderId (= CT payment id) when interfaceId lookup finds nothing', async () => {
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([]);
      const get = jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockResolvedValue(pendingCtPayment);
      const res = await service.applyMoneiPayment(moneiPayment({ status: 'FAILED', orderId: pendingCtPayment.id }));
      expect(get).toHaveBeenCalledWith({ id: pendingCtPayment.id });
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: expect.objectContaining({ type: 'Charge', state: 'Failure' }) }),
      );
      expect(res.applied).toBe(true);
    });

    test('unknown payments are acknowledged without touching commercetools', async () => {
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([]);
      jest.spyOn(DefaultPaymentService.prototype, 'getPayment').mockRejectedValue(new Error('404'));
      const res = await service.applyMoneiPayment(moneiPayment({ status: 'SUCCEEDED', orderId: 'nope' }));
      expect(updateCtPayment).not.toHaveBeenCalled();
      expect(res).toEqual({ applied: false });
    });

    test('partial refunds record only the delta not yet in commercetools', async () => {
      const paid: Payment = {
        ...pendingCtPayment,
        transactions: [
          { ...pendingCtPayment.transactions[0], state: 'Success' },
          {
            id: 't2',
            type: 'Refund',
            state: 'Success',
            amount: { type: 'centPrecision', centAmount: 20000, currencyCode: 'EUR', fractionDigits: 2 },
          },
        ],
      };
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([paid]);
      await service.applyMoneiPayment(moneiPayment({ status: 'PARTIALLY_REFUNDED', refundedAmount: 50000 }));
      expect(updateCtPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            type: 'Refund',
            state: 'Success',
            amount: { centAmount: 30000, currencyCode: 'EUR' },
          }),
        }),
      );
    });

    test('PAID_OUT is ignored', async () => {
      jest.spyOn(DefaultPaymentService.prototype, 'findPaymentsByInterfaceId').mockResolvedValue([pendingCtPayment]);
      const res = await service.applyMoneiPayment(moneiPayment({ status: 'PAID_OUT' }));
      expect(updateCtPayment).not.toHaveBeenCalled();
      expect(res.applied).toBe(false);
    });
  });

  describe('operations', () => {
    test('config exposes the account id and environment, never the API key', async () => {
      jest.spyOn(DefaultCartService.prototype, 'getCart').mockResolvedValue(mockGetCartResult());
      const cfg = await service.config();
      expect(cfg).toMatchObject({ clientKey: 'acc_123', environment: 'test' });
      expect(JSON.stringify(cfg)).not.toContain('pk_test_key');
    });

    test('supported components follow MONEI_PAYMENT_METHODS_ENABLED', async () => {
      const components = await service.getSupportedPaymentComponents();
      expect(components.components.map((c) => c.type)).toEqual(['bizum', 'card', 'applePay']);
      expect(components.dropins).toEqual([{ type: 'embedded' }]);
    });
  });
});

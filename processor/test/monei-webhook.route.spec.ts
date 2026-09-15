import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createHmac } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import * as Config from '../src/config/config';
import { unwrap, webhookRoutes } from '../src/routes/monei-webhook.route';
import { MoneiPaymentService } from '../src/services/monei-payment.service';

const KEY = 'pk_test_key';
const sign = (payload: string, key = KEY, t = 1700000000) =>
  `t=${t},v1=${createHmac('sha256', key).update(`${t}.${payload}`).digest('hex')}`;

describe('POST /webhooks/monei', () => {
  let app: FastifyInstance;
  let apply: jest.Mock<MoneiPaymentService['applyMoneiPayment']>;

  beforeEach(async () => {
    jest.spyOn(Config, 'getConfig').mockReturnValue({
      ...Config.config,
      moneiApiKey: KEY,
      moneiWebhookSecret: '',
      moneiWebhookToleranceSeconds: 0,
    });
    apply = jest
      .fn<MoneiPaymentService['applyMoneiPayment']>()
      .mockResolvedValue({ ctPaymentId: 'ct1', applied: true });
    app = Fastify();
    await app.register(webhookRoutes, {
      paymentService: { applyMoneiPayment: apply } as unknown as MoneiPaymentService,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  const post = (payload: string, headers: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/webhooks/monei',
      payload,
      headers: { 'content-type': 'application/json', ...headers },
    });

  test('accepts a correctly signed bare Payment and applies it', async () => {
    const body = JSON.stringify({ id: 'mp_1', status: 'SUCCEEDED', orderId: 'ct1' });
    const res = await post(body, { 'MONEI-Signature': sign(body) });
    expect(res.statusCode).toBe(200);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ id: 'mp_1', status: 'SUCCEEDED' }));
    expect(res.json()).toEqual({ received: true, ctPaymentId: 'ct1', applied: true });
  });

  test('verifies over the raw bytes (pretty-printed payload signed as sent still verifies)', async () => {
    const body = JSON.stringify({ id: 'mp_2', status: 'FAILED' }, null, 2);
    const res = await post(body, { 'monei-signature': sign(body) });
    expect(res.statusCode).toBe(200);
  });

  test('unwraps an account-webhook event envelope', async () => {
    const body = JSON.stringify({ type: 'charge.succeeded', object: { id: 'mp_3', status: 'SUCCEEDED' } });
    const res = await post(body, { 'MONEI-Signature': sign(body) });
    expect(res.statusCode).toBe(200);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ id: 'mp_3' }));
  });

  test('rejects a bad signature with 401 and does not touch commercetools', async () => {
    const body = JSON.stringify({ id: 'mp_1', status: 'SUCCEEDED' });
    expect((await post(body, { 'MONEI-Signature': sign(body, 'wrong') })).statusCode).toBe(401);
    expect((await post(body, { 'MONEI-Signature': 'deadbeef' })).statusCode).toBe(401);
    expect((await post(body, {})).statusCode).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  test('rejects a tampered body', async () => {
    const body = JSON.stringify({ id: 'mp_1', status: 'FAILED' });
    const res = await post(body.replace('FAILED', 'SUCCEEDED'), { 'MONEI-Signature': sign(body) });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 for a signed body that is not a payment', async () => {
    const body = JSON.stringify({ hello: 'world' });
    expect((await post(body, { 'MONEI-Signature': sign(body) })).statusCode).toBe(400);
  });

  test('returns 500 so MONEI retries when commercetools fails', async () => {
    apply.mockRejectedValue(new Error('ct down'));
    const body = JSON.stringify({ id: 'mp_1', status: 'SUCCEEDED' });
    expect((await post(body, { 'MONEI-Signature': sign(body) })).statusCode).toBe(500);
  });

  test('unwrap handles both shapes', () => {
    expect(unwrap({ id: 'a', status: 'SUCCEEDED' })).toEqual({ id: 'a', status: 'SUCCEEDED' });
    expect(unwrap({ type: 'x', object: { id: 'b', status: 'FAILED' } })).toEqual({ id: 'b', status: 'FAILED' });
  });
});

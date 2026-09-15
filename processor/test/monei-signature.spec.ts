import { describe, expect, test } from '@jest/globals';
import { createHmac } from 'crypto';
import { parseMoneiSignature, verifyMoneiSignature } from '../src/libs/monei/signature';

const KEY = 'pk_test_1234567890';
const body = JSON.stringify({ id: 'pay_1', status: 'SUCCEEDED', amount: 499 });

const sign = (t: number, payload: string, key = KEY) =>
  `t=${t},v1=${createHmac('sha256', key).update(`${t}.${payload}`).digest('hex')}`;

describe('MONEI-Signature parsing', () => {
  test('parses t and v1', () => {
    expect(parseMoneiSignature('t=1492774577,v1=abcd')).toEqual({ timestamp: 1492774577, v1: ['abcd'] });
  });
  test('ignores unknown schemes but keeps v1', () => {
    expect(parseMoneiSignature('t=1,v0=zzz,v1=AB')).toEqual({ timestamp: 1, v1: ['ab'] });
  });
  test('rejects a bare digest (the legacy connector compared this directly)', () => {
    expect(parseMoneiSignature('5257a869e7ecebeda32affa62cdca3fa')).toBeNull();
    expect(parseMoneiSignature(undefined)).toBeNull();
    expect(parseMoneiSignature('t=abc,v1=ff')).toBeNull();
  });
});

describe('verifyMoneiSignature', () => {
  const t = 1700000000;

  test('accepts a signature computed with the API key over the raw body', () => {
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: KEY })).toBe(true);
  });

  test('accepts the raw body as a Buffer', () => {
    expect(verifyMoneiSignature({ rawBody: Buffer.from(body), header: sign(t, body), secrets: [KEY] })).toBe(true);
  });

  test('tries every provided secret (dedicated signing key, then API key)', () => {
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: ['other', KEY] })).toBe(true);
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: ['', KEY] })).toBe(true);
  });

  test('rejects a re-serialised body that differs by whitespace', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyMoneiSignature({ rawBody: pretty, header: sign(t, body), secrets: KEY })).toBe(false);
  });

  test('rejects the wrong key, a tampered body and a tampered timestamp', () => {
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body, 'nope'), secrets: KEY })).toBe(false);
    expect(verifyMoneiSignature({ rawBody: body.replace('499', '1'), header: sign(t, body), secrets: KEY })).toBe(
      false,
    );
    const header = sign(t, body).replace(`t=${t}`, `t=${t + 1}`);
    expect(verifyMoneiSignature({ rawBody: body, header, secrets: KEY })).toBe(false);
  });

  test('rejects when no secret is configured', () => {
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: [] })).toBe(false);
  });

  test('does not enforce timestamp tolerance by default, enforces it when asked', () => {
    const now = () => (t + 3600) * 1000;
    expect(verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: KEY, now })).toBe(true);
    expect(
      verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: KEY, now, toleranceSeconds: 300 }),
    ).toBe(false);
    expect(
      verifyMoneiSignature({ rawBody: body, header: sign(t, body), secrets: KEY, now, toleranceSeconds: 7200 }),
    ).toBe(true);
  });
});

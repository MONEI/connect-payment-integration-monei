import { createHmac, timingSafeEqual } from 'crypto';

export interface ParsedMoneiSignature {
  timestamp: number;
  v1: string[];
}

/**
 * Parses a `MONEI-Signature` header of the form `t=<unix-seconds>,v1=<hex>[,v1=<hex>]`.
 * Returns null if the header is missing or malformed. Unknown schemes are ignored.
 */
export function parseMoneiSignature(header: string | undefined | null): ParsedMoneiSignature | null {
  if (!header) return null;
  let timestamp: number | undefined;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') {
      const n = Number(value);
      if (Number.isFinite(n)) timestamp = n;
    } else if (key === 'v1' && value) {
      v1.push(value.toLowerCase());
    }
  }
  if (timestamp === undefined || v1.length === 0) return null;
  return { timestamp, v1 };
}

export interface VerifyMoneiSignatureOptions {
  /** Raw request body bytes exactly as received. Never a re-serialised object. */
  rawBody: Buffer | string;
  header: string | undefined | null;
  /** MONEI API key; MONEI signs webhooks with it. */
  apiKey: string;
  /** Allowed clock skew in seconds. 0 disables the check, matching MONEI's official SDKs (the default). */
  toleranceSeconds?: number;
  now?: () => number;
}

/**
 * Verifies a MONEI webhook signature. The signed payload is `${t}.${rawBody}`, HMAC-SHA256 keyed with the
 * account API key, hex-encoded, compared in constant time. This is the scheme documented at https://docs.monei.com/guides/verify-signature and implemented by @monei-js/node-sdk.
 */
export function verifyMoneiSignature(opts: VerifyMoneiSignatureOptions): boolean {
  const parsed = parseMoneiSignature(opts.header);
  if (!parsed || !opts.apiKey) return false;

  const tolerance = opts.toleranceSeconds ?? 0;
  if (tolerance > 0) {
    const nowSeconds = Math.floor((opts.now ?? Date.now)() / 1000);
    if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) return false;
  }

  const body = Buffer.isBuffer(opts.rawBody) ? opts.rawBody : Buffer.from(opts.rawBody, 'utf8');

  const expected = createHmac('sha256', opts.apiKey).update(`${parsed.timestamp}.`).update(body).digest();
  return parsed.v1.some((candidate) => {
    if (!/^[0-9a-f]+$/i.test(candidate) || candidate.length % 2 !== 0) return false;
    const candidateBuf = Buffer.from(candidate, 'hex');
    return candidateBuf.length === expected.length && timingSafeEqual(candidateBuf, expected);
  });
}

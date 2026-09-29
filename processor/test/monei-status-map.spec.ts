import { describe, expect, test } from '@jest/globals';
import { mapMoneiStatusToTransaction } from '../src/services/monei-payment.service';

describe('MONEI status → commercetools transaction', () => {
  test.each([
    ['PENDING', 'SALE', 'Charge', 'Pending'],
    ['PENDING', 'AUTH', 'Authorization', 'Pending'],
    ['SUCCEEDED', 'SALE', 'Charge', 'Success'],
    ['SUCCEEDED', 'AUTH', 'Authorization', 'Success'],
    ['SUCCEEDED', undefined, 'Charge', 'Success'],
    ['AUTHORIZED', 'AUTH', 'Authorization', 'Success'],
    ['FAILED', 'SALE', 'Charge', 'Failure'],
    ['EXPIRED', 'SALE', 'Charge', 'Failure'],
    ['CANCELED', 'AUTH', 'CancelAuthorization', 'Success'],
    ['REFUNDED', 'SALE', 'Refund', 'Success'],
    ['PARTIALLY_REFUNDED', 'SALE', 'Refund', 'Success'],
  ] as const)('%s (%s) → %s/%s', (status, tt, type, state) => {
    expect(mapMoneiStatusToTransaction(status, tt as 'SALE' | 'AUTH' | undefined)).toEqual({ type, state });
  });

  test('PAID_OUT and unknown statuses do not touch the Payment', () => {
    expect(mapMoneiStatusToTransaction('PAID_OUT', 'SALE')).toBeUndefined();
    expect(mapMoneiStatusToTransaction('SOMETHING_NEW', 'SALE')).toBeUndefined();
  });
});

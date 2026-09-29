import { paymentSDK } from '../payment-sdk';
import { MoneiPaymentService } from '../services/monei-payment.service';

const paymentService = new MoneiPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
});

export const app = {
  services: {
    paymentService,
  },
};

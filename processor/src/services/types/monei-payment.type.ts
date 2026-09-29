import {
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  CommercetoolsRecurringPaymentJobService,
} from '@commercetools/connect-payments-sdk';
import { PaymentRequestSchemaDTO } from '../../dtos/monei-payment.dto';
import { MoneiClient } from '../../libs/monei/client';

export type MoneiPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
  ctRecurringPaymentJobService: CommercetoolsRecurringPaymentJobService;
  moneiClient?: MoneiClient;
};

export type CreatePaymentRequest = {
  data: PaymentRequestSchemaDTO;
};

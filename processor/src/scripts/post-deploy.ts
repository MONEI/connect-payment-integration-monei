/**
 * Post-deploy script
 *
 * Runs after the connector is deployed on commercetools Connect.
 * Creates necessary custom types for storing MONEI-specific payment data
 * on commercetools payment objects.
 *
 * Custom types created:
 * - monei-payment-type: Stores MONEI payment ID and method details
 * - monei-transaction-type: Stores MONEI transaction metadata
 */

async function postDeploy(): Promise<void> {

  console.log('[MONEI Post-Deploy] Setting up custom types...');

  // TODO: Implement using commercetools SDK
  // 1. Create API client with the configured credentials
  // 2. Check if custom types already exist
  // 3. Create/update custom types:
  //    - monei-payment-type with fields:
  //      - moneiPaymentId (String)
  //      - moneiPaymentMethod (String)
  //      - moneiPaymentStatus (String)
  //      - moneiAccountId (String)
  //    - monei-transaction-interaction-type with fields:
  //      - moneiTransactionId (String)
  //      - moneiWebhookId (String)
  //      - moneiStatusCode (String)

  console.log('[MONEI Post-Deploy] Custom types configured successfully.');

  // Example implementation:
  //
  // const ctpClient = createCtpClient(config);
  // const apiRoot = createApiBuilderFromCtpClient(ctpClient)
  //   .withProjectKey({ projectKey: config.CTP_PROJECT_KEY });
  //
  // const paymentType = {
  //   key: 'monei-payment-type',
  //   name: { en: 'MONEI Payment Custom Fields' },
  //   resourceTypeIds: ['payment'],
  //   fieldDefinitions: [
  //     {
  //       name: 'moneiPaymentId',
  //       label: { en: 'MONEI Payment ID' },
  //       type: { name: 'String' },
  //       required: false,
  //     },
  //     {
  //       name: 'moneiPaymentMethod',
  //       label: { en: 'MONEI Payment Method' },
  //       type: { name: 'String' },
  //       required: false,
  //     },
  //   ],
  // };
  //
  // await apiRoot.types().post({ body: paymentType }).execute();
}

postDeploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[MONEI Post-Deploy] Error:', error);
    process.exit(1);
  });

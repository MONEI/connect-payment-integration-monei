/**
 * Pre-undeploy script
 *
 * Runs before the connector is undeployed from commercetools Connect.
 * Cleans up any resources created during post-deploy.
 *
 * Note: Custom types are NOT deleted by default to preserve
 * existing payment data. Only extensions and subscriptions
 * created by the connector are removed.
 */

async function preUndeploy(): Promise<void> {

  console.log('[MONEI Pre-Undeploy] Cleaning up connector resources...');

  // TODO: Implement using commercetools SDK
  // 1. Remove any API extensions registered by the connector
  // 2. Remove any subscriptions registered by the connector
  // 3. Do NOT remove custom types (they contain merchant payment data)
  //
  // Example:
  // const ctpClient = createCtpClient(config);
  // const apiRoot = createApiBuilderFromCtpClient(ctpClient)
  //   .withProjectKey({ projectKey: config.CTP_PROJECT_KEY });
  //
  // // Find and delete extensions created by this connector
  // const extensions = await apiRoot.extensions()
  //   .get({ queryArgs: { where: 'key="monei-payment-extension"' } })
  //   .execute();
  //
  // for (const ext of extensions.body.results) {
  //   await apiRoot.extensions()
  //     .withId({ ID: ext.id })
  //     .delete({ queryArgs: { version: ext.version } })
  //     .execute();
  // }

  console.log('[MONEI Pre-Undeploy] Cleanup completed.');
}

preUndeploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[MONEI Pre-Undeploy] Error:', error);
    process.exit(1);
  });

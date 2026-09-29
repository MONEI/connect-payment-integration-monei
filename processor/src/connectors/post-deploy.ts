async function postDeploy() {
  // The connector needs no commercetools resources beyond what Connect provisions.
}

async function run() {
  try {
    await postDeploy();
  } catch (error) {
    if (error instanceof Error) {
      process.stderr.write(`Post-deploy failed: ${error.message}\n`);
    }
    process.exitCode = 1;
  }
}
run();

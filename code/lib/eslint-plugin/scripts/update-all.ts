async function run() {
  await import('./update-configs');
  await import('./update-rules-list');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

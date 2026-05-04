async function run() {
  await import('./update-configs.ts');
  await import('./update-rules-list.ts');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

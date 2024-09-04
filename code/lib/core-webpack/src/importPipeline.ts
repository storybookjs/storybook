type ModuleExports = Record<string, any>;

// If an import is in flight when another import arrives, block it until the first completes.
// This is to avoid a situation where webpack kicks off a second compilation whilst the
// first is still completing, cf: https://github.com/webpack/webpack/issues/15541#issuecomment-1143138832
// Note the way this code works if N further `import()`s occur while the first is in flight,
// they will all be kicked off in the same tick and not block each other. This is by design,
// Webpack can handle multiple invalidations simultaneously, just not in quick succession.

export function importPipeline() {
  let importGate: Promise<void> = Promise.resolve();

  return async (importFn: () => Promise<ModuleExports>) => {
    await importGate;

    const moduleExportsPromise = importFn();
    importGate = importGate.then(async () => {
      await moduleExportsPromise;
    });
    return moduleExportsPromise;
  };
}

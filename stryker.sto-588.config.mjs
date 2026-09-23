export default {
  mutate: ['code/core/src/test/index.ts:14-32'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.sto-588.config.ts',
  },
  coverageAnalysis: 'perTest',
  concurrency: 4,
  disableTypeChecks: false,
  cleanTempDir: 'always',
  reporters: ['clear-text', 'json'],
  jsonReporter: {
    fileName: 'reports/mutation/sto-588.json',
  },
  thresholds: {
    high: 100,
    low: 100,
    break: 100,
  },
};

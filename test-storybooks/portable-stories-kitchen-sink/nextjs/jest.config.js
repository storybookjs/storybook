const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: __dirname,
})

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
/** @returns {Promise<import('jest').Config>} */
module.exports = async () => {
  const { getPackageAliases } = import('@storybook/nextjs/export-mocks');

  /** @type {import('jest').Config} */
  const customJestConfig = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    // Add more setup options before each test is run
    setupFilesAfterEnv: ['./jest.setup.ts'],
    moduleNameMapper: getPackageAliases(),
  };


  return createJestConfig(customJestConfig);
}
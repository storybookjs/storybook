const nextJest = require('next/jest.js');
const { getPackageAliases } = require('@storybook/nextjs/export-mocks');
 
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: __dirname,
})
 
/** @type {import('jest').Config} */
const customJestConfig = {
  coverageProvider: 'v8',
  testEnvironment: '@happy-dom/jest-environment',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    ...getPackageAliases()
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
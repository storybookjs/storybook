module.exports = {
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
  },
  testEnvironment: 'jsdom',
};

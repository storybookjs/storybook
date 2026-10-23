import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, expect, it, vi } from 'vitest';

import { getHasNextCustomWebpack } from './get-has-next-custom-webpack.ts';

vi.mock(import('node:fs'), { spy: true });

const projectRoot = '/project';

const mockNextConfig = (fileName: string, content: string) => {
  vi.mocked(existsSync).mockImplementation((path) => path === join(projectRoot, fileName));
  vi.mocked(readFileSync).mockReturnValue(content);
};

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(false);
});

it('detects a webpack function property in next.config.js', () => {
  mockNextConfig('next.config.js', 'module.exports = { webpack: (config) => config };');
  expect(getHasNextCustomWebpack(projectRoot)).toBe(true);
});

it('detects a webpack method in next.config.ts', () => {
  mockNextConfig(
    'next.config.ts',
    'const config = { webpack(config) { return config; } };\nexport default config;'
  );
  expect(getHasNextCustomWebpack(projectRoot)).toBe(true);
});

it('detects a quoted webpack key', () => {
  mockNextConfig('next.config.mjs', `export default { 'webpack': (config) => config };`);
  expect(getHasNextCustomWebpack(projectRoot)).toBe(true);
});

it('returns false for a next.config without a webpack option', () => {
  mockNextConfig('next.config.mjs', 'export default { reactStrictMode: true };');
  expect(getHasNextCustomWebpack(projectRoot)).toBe(false);
});

it('does not match identifiers merely containing webpack', () => {
  mockNextConfig('next.config.js', 'const useWebpack = false;\nmodule.exports = {};');
  expect(getHasNextCustomWebpack(projectRoot)).toBe(false);
});

it('returns false when no next.config file exists', () => {
  expect(getHasNextCustomWebpack(projectRoot)).toBe(false);
});

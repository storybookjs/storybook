import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, it } from 'vitest';

import { getHasNextCustomWebpack } from './get-has-next-custom-webpack.ts';

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'sb-telemetry-next-config-'));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

it('detects a webpack function property in next.config.js', () => {
  writeFileSync(
    join(projectDir, 'next.config.js'),
    'module.exports = { webpack: (config) => config };'
  );
  expect(getHasNextCustomWebpack(projectDir)).toBe(true);
});

it('detects a webpack method in next.config.ts', () => {
  writeFileSync(
    join(projectDir, 'next.config.ts'),
    'const config = { webpack(config) { return config; } };\nexport default config;'
  );
  expect(getHasNextCustomWebpack(projectDir)).toBe(true);
});

it('returns false for a next.config without a webpack option', () => {
  writeFileSync(join(projectDir, 'next.config.mjs'), 'export default { reactStrictMode: true };');
  expect(getHasNextCustomWebpack(projectDir)).toBe(false);
});

it('returns false when no next.config file exists', () => {
  expect(getHasNextCustomWebpack(projectDir)).toBe(false);
});

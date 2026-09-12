import { afterEach, describe, expect, test } from 'vitest';

import type { AutoblockOptions } from './types.ts';

import { blocker } from './block-node-version.ts';

const originalNodeVersion = process.versions.node;

const stubNodeVersion = (version: string) =>
  Object.defineProperty(process.versions, 'node', { value: version, configurable: true });

describe('minimumNode22 blocker', () => {
  afterEach(() => {
    stubNodeVersion(originalNodeVersion);
  });

  test.each(['20.19.0', '21.7.3', '22.11.0'])('blocks Node.js %s', async (version) => {
    stubNodeVersion(version);
    const options = {} as AutoblockOptions;
    await expect(blocker.check(options)).resolves.toEqual({ nodeVersion: version });
  });

  test.each(['22.12.0', '24.1.0'])('does not block Node.js %s', async (version) => {
    stubNodeVersion(version);
    const options = {} as AutoblockOptions;
    await expect(blocker.check(options)).resolves.toBe(false);
  });

  test('renders the requirement from the shared version constant', async () => {
    stubNodeVersion('20.19.0');
    const options = {} as AutoblockOptions;
    const result = await blocker.check(options);
    const log = blocker.log(result as { nodeVersion: string });
    expect(log.title).toBe('Node.js 22.12 or higher required');
    expect(log.message).toContain('22.12+');
    expect(log.link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nodejs-2212-or-higher'
    );
  });
});

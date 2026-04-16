import { describe, expect, it } from 'vitest';

import { getPublicPackageManagerEnv } from './environment';

describe('getPublicPackageManagerEnv', () => {
  it('forces the public npm registry and removes other npm_config values', () => {
    process.env.npm_config_registry = 'http://localhost:6002';
    process.env.npm_config_userconfig = '/tmp/local-npmrc';
    process.env.npm_config_cache = '/tmp/cache';

    const env = getPublicPackageManagerEnv({
      CI: '1',
    });

    expect(env.npm_config_registry).toBe('https://registry.npmjs.org/');
    expect(env.npm_config_userconfig).toBeUndefined();
    expect(env.npm_config_cache).toBeUndefined();
    expect(env.CI).toBe('1');
    expect(env.YARN_ENABLE_IMMUTABLE_INSTALLS).toBe('false');
  });
});

import { describe, expect, it } from 'vitest';

import { dropInheritedPnpmConfig } from './package-manager-env.ts';

describe('dropInheritedPnpmConfig', () => {
  it('removes the configuration pnpm exports to scripts, keeping the user agent', () => {
    const env: NodeJS.ProcessEnv = {
      npm_config_user_agent: 'pnpm/10.34.9 npm/? node/v22.22.3 darwin arm64',
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config_minimum_release_age: '10080',
      NPM_CONFIG_CACHE: '/set/by/the/user',
      PATH: '/usr/bin',
    };

    dropInheritedPnpmConfig(env);

    expect(env).toEqual({
      npm_config_user_agent: 'pnpm/10.34.9 npm/? node/v22.22.3 darwin arm64',
      NPM_CONFIG_CACHE: '/set/by/the/user',
      PATH: '/usr/bin',
    });
  });

  it('leaves the environment alone when not running under pnpm', () => {
    const env: NodeJS.ProcessEnv = {
      npm_config_user_agent: 'npm/11.6.2 node/v22.22.3 darwin arm64',
      npm_config_registry: 'http://localhost:6001/',
    };

    dropInheritedPnpmConfig(env);

    expect(env.npm_config_registry).toBe('http://localhost:6001/');
  });
});

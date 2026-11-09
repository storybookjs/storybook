import { delimiter, join, resolve } from 'node:path';

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

  it("removes the monorepo's virtual store that pnpm's bin shims put on NODE_PATH", () => {
    const store = join(resolve('repo'), 'node_modules', '.pnpm');
    const env: NodeJS.ProcessEnv = {
      npm_config_user_agent: 'pnpm/10.34.9 npm/? node/v22.22.3 darwin arm64',
      NODE_PATH: [
        join(store, 'jiti@2.6.1', 'node_modules', 'jiti', 'bin', 'node_modules'),
        join(store, 'node_modules'),
        resolve('set', 'by', 'the', 'user'),
      ].join(delimiter),
    };

    dropInheritedPnpmConfig(env);

    expect(env.NODE_PATH).toBe(resolve('set', 'by', 'the', 'user'));
  });

  it('drops NODE_PATH when only the virtual store was on it', () => {
    const env: NodeJS.ProcessEnv = {
      npm_config_user_agent: 'pnpm/10.34.9 npm/? node/v22.22.3 darwin arm64',
      NODE_PATH: join(resolve('repo'), 'node_modules', '.pnpm', 'node_modules'),
    };

    dropInheritedPnpmConfig(env);

    expect(env).not.toHaveProperty('NODE_PATH');
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

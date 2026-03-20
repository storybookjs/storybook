import { describe, it, expect } from 'vitest';

import { filterNodeEnvFromDefinePlugins } from './filter-node-env-from-define-plugins';

// Simulate webpack's DefinePlugin with the same constructor name
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class DefinePlugin {
  constructor(public definitions: Record<string, unknown>) {}
}

describe('filterNodeEnvFromDefinePlugins', () => {
  it('should remove process.env.NODE_ENV from DefinePlugin definitions (flat form)', () => {
    const plugin = new DefinePlugin({
      'process.env.NODE_ENV': '"development"',
      OTHER_VAR: '"some-value"',
    });

    filterNodeEnvFromDefinePlugins([plugin as unknown as import('webpack').WebpackPluginInstance]);

    expect(plugin.definitions['process.env.NODE_ENV']).toBeUndefined();
  });

  it('should remove NODE_ENV from nested process.env object form', () => {
    const plugin = new DefinePlugin({
      'process.env': { NODE_ENV: '"development"', API_URL: '"https://example.com"' },
    });

    filterNodeEnvFromDefinePlugins([plugin as unknown as import('webpack').WebpackPluginInstance]);

    const processEnv = plugin.definitions['process.env'] as Record<string, unknown>;
    expect(processEnv['NODE_ENV']).toBeUndefined();
    expect(processEnv['API_URL']).toBe('"https://example.com"');
  });

  it('should preserve other definitions in the DefinePlugin', () => {
    const plugin = new DefinePlugin({
      'process.env.NODE_ENV': '"development"',
      OTHER_VAR: '"some-value"',
      'process.env.API_URL': '"https://example.com"',
    });

    filterNodeEnvFromDefinePlugins([plugin as unknown as import('webpack').WebpackPluginInstance]);

    expect(plugin.definitions['OTHER_VAR']).toBe('"some-value"');
    expect(plugin.definitions['process.env.API_URL']).toBe('"https://example.com"');
  });

  it('should handle multiple DefinePlugin instances and remove process.env.NODE_ENV from all', () => {
    const plugin1 = new DefinePlugin({
      'process.env.NODE_ENV': '"development"',
    });
    const plugin2 = new DefinePlugin({
      'process.env.NODE_ENV': '"production"',
      FOO: '"bar"',
    });

    filterNodeEnvFromDefinePlugins([
      plugin1 as unknown as import('webpack').WebpackPluginInstance,
      plugin2 as unknown as import('webpack').WebpackPluginInstance,
    ]);

    expect(plugin1.definitions['process.env.NODE_ENV']).toBeUndefined();
    expect(plugin2.definitions['process.env.NODE_ENV']).toBeUndefined();
    expect(plugin2.definitions['FOO']).toBe('"bar"');
  });

  it('should not fail when a DefinePlugin does not have process.env.NODE_ENV', () => {
    const plugin = new DefinePlugin({
      OTHER_VAR: '"some-value"',
    });

    expect(() =>
      filterNodeEnvFromDefinePlugins([plugin as unknown as import('webpack').WebpackPluginInstance])
    ).not.toThrow();
    expect(plugin.definitions['OTHER_VAR']).toBe('"some-value"');
  });

  it('should not fail when the plugins array is empty', () => {
    expect(() => filterNodeEnvFromDefinePlugins([])).not.toThrow();
  });

  it('should skip non-DefinePlugin instances', () => {
    const notADefinePlugin = {
      constructor: { name: 'OtherPlugin' },
      definitions: { 'process.env.NODE_ENV': '"test"' },
    };

    filterNodeEnvFromDefinePlugins([notADefinePlugin as unknown as import('webpack').WebpackPluginInstance]);

    // Should not modify a non-DefinePlugin's definitions
    expect(notADefinePlugin.definitions['process.env.NODE_ENV']).toBe('"test"');
  });

  it('should handle null and undefined entries in the array', () => {
    const plugin = new DefinePlugin({
      'process.env.NODE_ENV': '"development"',
    });

    expect(() => filterNodeEnvFromDefinePlugins([null, undefined, plugin as unknown as import('webpack').WebpackPluginInstance])).not.toThrow();
    expect(plugin.definitions['process.env.NODE_ENV']).toBeUndefined();
  });

  it('should return the same plugins array (for composability)', () => {
    const plugins = [new DefinePlugin({ OTHER: '"val"' }) as unknown as import('webpack').WebpackPluginInstance];
    const result = filterNodeEnvFromDefinePlugins(plugins);
    expect(result).toBe(plugins);
  });
});

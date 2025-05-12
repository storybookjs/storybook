import { describe, expect, it } from 'vitest';

import { hasVitePlugins } from './has-vite-plugins';

describe('hasVitePlugins', () => {
  describe('should return true for', () => {
    it('plugin in root', async () => {
      const plugins = [{ name: 'vite-plugin-to-find' }, { name: 'vite-plugin-other' }];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
    it('plugin in nested array', async () => {
      const plugins = [[{ name: 'vite-plugin-to-find' }], { name: 'vite-plugin-other' }];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
    it('plugin in nested async array', async () => {
      const plugins = [
        { name: 'vite-plugin-other' },
        Promise.resolve([{ name: 'vite-plugin-to-find' }]),
      ];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });

    it('async plugin in root', async () => {
      const plugins = [
        Promise.resolve({ name: 'vite-plugin-to-find' }),
        { name: 'vite-plugin-other' },
      ];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
    it('async plugin in nested array', async () => {
      const plugins = [
        [Promise.resolve({ name: 'vite-plugin-to-find' })],
        { name: 'vite-plugin-other' },
      ];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
    it('async plugin in nested async array', async () => {
      const plugins = [
        { name: 'vite-plugin-other' },
        Promise.resolve([Promise.resolve({ name: 'vite-plugin-to-find' })]),
      ];
      const names = ['vite-plugin-to-find'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
    it('multiple plugins in root', async () => {
      const plugins = [
        { name: 'vite-plugin-other' },
        { name: 'vite-plugin-to-find-first' },
        { name: 'vite-plugin-to-find-second' },
      ];
      const names = ['vite-plugin-to-find-first', 'vite-plugin-to-find-second'];
      expect(await hasVitePlugins(plugins, names)).toBeTruthy();
    });
  });
  it('should return false with all types of plugin structures', async () => {
    const plugins = [
      { name: 'vite-plugin-root' },
      [{ name: 'vite-plugin-in-nested-array' }],
      Promise.resolve({ name: 'vite-plugin-async-root' }),
      Promise.resolve([{ name: 'vite-plugin-in-nested-async-array' }]),
      Promise.resolve([Promise.resolve({ name: 'vite-plugin-async-in-nested-async-array' })]),
    ];
    const names = ['vite-plugin-to-find-first', 'vite-plugin-to-find-second'];
    expect(await hasVitePlugins(plugins, names)).toBeFalsy();
  });
});

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { SupportedRenderer } from 'storybook/internal/types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStorybookInfo } from './get-storybook-info.ts';
import { loadMainConfig } from './load-main-config.ts';

vi.mock('./load-main-config.ts', { spy: true });

describe('getStorybookInfo React Native framework inference', () => {
  let dir: string;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('infers @storybook/react-native when framework is missing in .rnstorybook', async () => {
    dir = join(tmpdir(), `sb-rn-info-${Date.now()}`);
    mkdirSync(join(dir, '.rnstorybook'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'rn-app',
        private: true,
        devDependencies: { '@storybook/react-native': '10.5.1', storybook: '10.5.3' },
      })
    );
    writeFileSync(
      join(dir, '.rnstorybook/main.js'),
      `module.exports = { stories: ['**/*.stories.tsx'], deviceAddons: [] };`
    );

    const info = await getStorybookInfo(join(dir, '.rnstorybook'), dir);

    expect(info.frameworkPackage).toBe('@storybook/react-native');
    expect(info.rendererPackage).toBe('@storybook/react-native');
    expect(info.renderer).toBe(SupportedRenderer.REACT_NATIVE);
  });

  it('does not infer RN framework for a plain .storybook without framework', async () => {
    dir = join(tmpdir(), `sb-web-info-${Date.now()}`);
    mkdirSync(join(dir, '.storybook'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'web-app',
        private: true,
        devDependencies: { storybook: '10.5.3' },
      })
    );
    writeFileSync(join(dir, '.storybook/main.js'), `module.exports = { stories: [] };`);

    const info = await getStorybookInfo(join(dir, '.storybook'), dir);

    expect(info.frameworkPackage).toBeUndefined();
  });
});

describe('getStorybookInfo with framework @storybook/react-native in main', () => {
  beforeEach(() => {
    vi.mocked(loadMainConfig).mockResolvedValue({
      stories: [],
      framework: '@storybook/react-native',
    });
  });

  afterEach(() => {
    vi.mocked(loadMainConfig).mockReset();
  });

  it('resolves the React Native renderer', async () => {
    const info = await getStorybookInfo(join(tmpdir(), '.storybook'));

    expect(info.frameworkPackage).toBe('@storybook/react-native');
    expect(info.rendererPackage).toBe('@storybook/react-native');
    expect(info.renderer).toBe(SupportedRenderer.REACT_NATIVE);
  });
});

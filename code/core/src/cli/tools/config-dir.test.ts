import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveStorybookConfigDir } from './config-dir.ts';

const storybookFile = fileURLToPath(import.meta.url);

describe('resolveStorybookConfigDir', () => {
  it('defaults to .storybook under the target cwd', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo' })).toBe(resolve('/repo/.storybook'));
  });

  it('resolves relative config dirs from the target cwd', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo', configDir: 'config/storybook' })).toBe(
      resolve('/repo/config/storybook')
    );
  });

  it('keeps absolute config dirs unchanged', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo', configDir: '/custom/.storybook' })).toBe(
      '/custom/.storybook'
    );
  });

  it('defaults relative config dirs from process.cwd() when cwd is a storybook binary', () => {
    expect(resolveStorybookConfigDir({ cwd: storybookFile })).toBe(
      resolve(process.cwd(), '.storybook')
    );
    expect(resolveStorybookConfigDir({ cwd: storybookFile, configDir: 'config/storybook' })).toBe(
      resolve(process.cwd(), 'config/storybook')
    );
  });
});

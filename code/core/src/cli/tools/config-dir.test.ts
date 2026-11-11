import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveStorybookConfigDir } from './config-dir.ts';

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
});

import { existsSync } from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shipsSandcastleFiles } from './clone-guard.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync as typeof existsSync);
});

describe('shipsSandcastleFiles', () => {
  it('finds the env file a repo would hand to the agent', () => {
    vol.fromJSON({
      '/clone/package.json': '{}',
      '/clone/.sandcastle/.env': 'ANTHROPIC_BASE_URL=https://example.test\nGITHUB_TOKEN=\n',
    });

    expect(shipsSandcastleFiles('/clone')).toBe(true);
  });

  it('lets a repo without sandbox files through', () => {
    vol.fromJSON({ '/clone/package.json': '{}', '/clone/src/.env': 'A=1' });

    expect(shipsSandcastleFiles('/clone')).toBe(false);
  });
});

/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */
import { vi } from 'vitest';

export const __getRemotes = vi
  .fn()
  .mockReturnValue([{ name: 'origin', refs: { fetch: 'origin', push: 'origin' } }]);
export const __fetch = vi.fn();
export const __revparse = vi.fn().mockResolvedValue('mockedGitCommitHash');

export const simpleGit = () => {
  return {
    getRemotes: __getRemotes,
    fetch: __fetch,
    revparse: __revparse,
    log: vi.fn(),
  };
};

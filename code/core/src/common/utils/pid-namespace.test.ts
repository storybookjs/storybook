import { readlinkSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isAnotherPidNamespace } from './pid-namespace.ts';

vi.mock('node:fs', { spy: true });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isAnotherPidNamespace', () => {
  it('tells a namespace from the one of this process', () => {
    vi.mocked(readlinkSync).mockReturnValue('pid:[2]');

    expect(isAnotherPidNamespace('pid:[1]')).toBe(true);
    expect(isAnotherPidNamespace('pid:[2]')).toBe(false);
  });

  it('does not know for a record without a namespace', () => {
    vi.mocked(readlinkSync).mockReturnValue('pid:[2]');

    expect(isAnotherPidNamespace(undefined)).toBe(false);
  });

  it('does not know on a system without process namespaces', () => {
    vi.mocked(readlinkSync).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    expect(isAnotherPidNamespace('pid:[1]')).toBe(false);
  });
});

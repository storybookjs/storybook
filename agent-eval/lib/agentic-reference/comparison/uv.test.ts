import { describe, expect, it, vi } from 'vitest';

const execFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFileSync }));

import { findUv } from './uv.ts';

describe('findUv', () => {
  it('returns "uv" when the binary is on PATH', () => {
    execFileSync.mockImplementation(() => Buffer.from('uv 0.9.0'));
    expect(findUv()).toBe('uv');
  });

  it('falls back to ~/.local/bin/uv, then null', () => {
    execFileSync.mockImplementation((cmd: string) => {
      if (cmd === 'uv') throw Object.assign(new Error('nope'), { code: 'ENOENT' });
      return Buffer.from('uv 0.9.0');
    });
    expect(findUv()).toMatch(/\.local\/bin\/uv$/);

    execFileSync.mockImplementation(() => {
      throw Object.assign(new Error('nope'), { code: 'ENOENT' });
    });
    expect(findUv()).toBeNull();
  });
});

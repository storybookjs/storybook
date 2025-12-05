import type { ChildProcess } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import spawn from 'cross-spawn';
import open from 'open';

import { openBrowser } from '../opener';

vi.mock('open', () => ({ default: vi.fn() }));
vi.mock('cross-spawn', () => ({ default: vi.fn() }));

describe('openBrowser BROWSER script handling', () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, BROWSER: '/tmp/browser.sh' };
    process.argv = ['node', 'test'];
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(open).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof open>>);
    const child = { on: vi.fn() } as unknown as ChildProcess;
    vi.mocked(spawn).mockReturnValue(child);
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('executes a shell script specified via BROWSER instead of falling back to default opener', () => {
    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });
});

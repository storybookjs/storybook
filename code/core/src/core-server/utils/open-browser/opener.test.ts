import type { ChildProcess } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import spawn from 'cross-spawn';
import open from 'open';

import { openBrowser } from './opener';

vi.mock('open', { spy: true });
vi.mock('cross-spawn', { spy: true });

describe('openBrowser BROWSER script handling', () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    process.argv = ['node', 'test'];
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(open).mockImplementation(() => {
      return Promise.resolve({} as unknown as Awaited<ReturnType<typeof open>>);
    });
    const child = { on: vi.fn() } as unknown as ChildProcess;
    vi.mocked(spawn).mockImplementation(() => child);
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('executes a node script when BROWSER points to a JS file', () => {
    process.env.BROWSER = '/tmp/browser.js';

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.js', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a node script when BROWSER points to a MJS file', () => {
    process.env.BROWSER = '/tmp/browser.mjs';

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.mjs', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a node script when BROWSER points to a CJS file', () => {
    process.env.BROWSER = '/tmp/browser.cjs';

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.cjs', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('falls back to opening the browser when BROWSER points to a shell script', () => {
    process.env.BROWSER = '/tmp/browser.sh';

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
      app: '/tmp/browser.sh',
      wait: false,
      url: true,
    });
  });
});

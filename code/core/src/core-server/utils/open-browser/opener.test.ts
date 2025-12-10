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
  let platformSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    process.env = { ...originalEnv };
    process.argv = ['node', 'test'];

    vi.mocked(open).mockImplementation(() => {
      return Promise.resolve({} as unknown as Awaited<ReturnType<typeof open>>);
    });
    const child = { on: vi.fn() } as unknown as ChildProcess;
    vi.mocked(spawn).mockImplementation(() => child);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    process.argv = originalArgv;
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

  it('falls back to opening the browser when BROWSER points to a shell script on Windows', () => {
    process.env.BROWSER = '/tmp/customBrowser.sh';
    platformSpy.mockReturnValue('win32');
    delete process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_INTEROP;

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
      app: '/tmp/customBrowser.sh',
      wait: false,
      url: true,
    });
  });

  it('executes a shell script on Linux', () => {
    process.env.BROWSER = '/tmp/findAHandler.sh';
    platformSpy.mockReturnValue('linux');
    delete process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_INTEROP;

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      '/bin/sh',
      ['/tmp/findAHandler.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a shell script on WSL testing for env var WSL_DISTRO_NAME', () => {
    process.env.BROWSER = '/tmp/findAHandler.sh';
    platformSpy.mockReturnValue('linux');
    process.env.WSL_DISTRO_NAME = 'AnyDistro';
    delete process.env.WSL_INTEROP;

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      '/bin/sh',
      ['/tmp/findAHandler.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a shell script on WSL testing for env var WSL_INTEROP', () => {
    process.env.BROWSER = '/tmp/findAHandler.sh';
    platformSpy.mockReturnValue('linux');
    process.env.WSL_INTEROP = '/run/WSL';
    delete process.env.WSL_DISTRO_NAME;

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      '/bin/sh',
      ['/tmp/findAHandler.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });
});

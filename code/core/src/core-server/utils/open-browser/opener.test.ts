import type { ChildProcess } from 'node:child_process';
import { accessSync } from 'node:fs';
import { release } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import spawn from 'cross-spawn';
import open from 'open';

import { BrowserEnvError, openBrowser } from './opener.ts';

vi.mock('open', { spy: true });
vi.mock('cross-spawn', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('node:os', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

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
    vi.mocked(accessSync).mockImplementation(() => {});
    vi.mocked(release).mockReturnValue('6.8.0-45-generic');
    vi.mocked(logger.warn).mockImplementation(() => {});
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

    expect(() => openBrowser('http://localhost:6006/')).toThrow(BrowserEnvError);
  });

  it('executes a shell script on Linux when BROWSER is a shell script', () => {
    process.env.BROWSER = '/tmp/findAHandler.sh';
    platformSpy.mockReturnValue('linux');

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'sh',
      ['/tmp/findAHandler.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('starts browser process on Linux when BROWSER is not a shell script', () => {
    process.env.BROWSER = 'google chrome';
    process.env.BROWSER_ARGS = '--incognito';
    platformSpy.mockReturnValue('linux');

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
      app: { name: 'google chrome', arguments: ['--incognito'] },
      wait: false,
      url: true,
    });
  });

  describe('without a system xdg-open on Linux', () => {
    beforeEach(() => {
      platformSpy.mockReturnValue('linux');
      process.env.PATH = '/usr/local/bin:/usr/bin';
      vi.mocked(accessSync).mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });
    });

    it('warns instead of letting the bundled open crash on a missing xdg-open', () => {
      expect(openBrowser('http://localhost:6006/')).toBe(true);

      expect(vi.mocked(open)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('xdg-open is not installed')
      );
    });

    it('still opens a browser named in BROWSER, which does not need xdg-open', () => {
      process.env.BROWSER = 'firefox';

      openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).toHaveBeenCalledWith(
        'http://localhost:6006/',
        expect.objectContaining({ app: { name: 'firefox', arguments: [] } })
      );
    });

    it('still opens the browser on WSL, where open uses PowerShell', () => {
      vi.mocked(release).mockReturnValue('5.15.167.4-microsoft-standard-WSL2');

      openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).toHaveBeenCalled();
    });
  });

  it('opens the browser on Linux when xdg-open is on the PATH', () => {
    platformSpy.mockReturnValue('linux');
    process.env.PATH = '/usr/bin';

    openBrowser('http://localhost:6006/');

    expect(vi.mocked(accessSync)).toHaveBeenCalledWith(
      expect.stringContaining('xdg-open'),
      expect.any(Number)
    );
    expect(vi.mocked(open)).toHaveBeenCalled();
  });
});

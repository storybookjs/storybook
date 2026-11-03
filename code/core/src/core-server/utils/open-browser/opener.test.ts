import { execSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { accessSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import spawn from 'cross-spawn';
import isInsideContainer from 'is-inside-container';
import open from 'open';

import { resolvePackageDir } from '../../../common/index.ts';
import { BrowserEnvError, openBrowser, openSafely } from './opener.ts';

const wsl = vi.hoisted(() => ({ isWsl: false }));

vi.mock('open', { spy: true });
vi.mock('cross-spawn', { spy: true });
vi.mock('is-inside-container', { spy: true });
vi.mock('wsl-utils', () => ({
  get isWsl() {
    return wsl.isWsl;
  },
}));
vi.mock('node:child_process', { spy: true });
vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../../../common/index.ts', { spy: true });

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
    vi.mocked(isInsideContainer).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation(() => Buffer.from(''));
    vi.mocked(logger.warn).mockImplementation(() => {});
    wsl.isWsl = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it('executes a node script when BROWSER points to a JS file', async () => {
    process.env.BROWSER = '/tmp/browser.js';

    await openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.js', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a node script when BROWSER points to a MJS file', async () => {
    process.env.BROWSER = '/tmp/browser.mjs';

    await openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.mjs', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('executes a node script when BROWSER points to a CJS file', async () => {
    process.env.BROWSER = '/tmp/browser.cjs';

    await openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      process.execPath,
      ['/tmp/browser.cjs', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('falls back to opening the browser when BROWSER points to a shell script on Windows', async () => {
    process.env.BROWSER = '/tmp/customBrowser.sh';
    platformSpy.mockReturnValue('win32');

    expect(() => openBrowser('http://localhost:6006/')).toThrow(BrowserEnvError);
  });

  it('executes a shell script on Linux when BROWSER is a shell script', async () => {
    process.env.BROWSER = '/tmp/findAHandler.sh';
    platformSpy.mockReturnValue('linux');

    await openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).toHaveBeenCalledWith(
      'sh',
      ['/tmp/findAHandler.sh', 'http://localhost:6006/'],
      { stdio: 'inherit' }
    );
    expect(vi.mocked(open)).not.toHaveBeenCalled();
  });

  it('starts browser process on Linux when BROWSER is not a shell script', async () => {
    process.env.BROWSER = 'google chrome';
    process.env.BROWSER_ARGS = '--incognito';
    platformSpy.mockReturnValue('linux');

    await openBrowser('http://localhost:6006/');

    expect(vi.mocked(spawn)).not.toHaveBeenCalled();
    expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
      app: { name: 'google chrome', arguments: ['--incognito'] },
      wait: false,
      url: true,
    });
  });

  describe('on Linux, where the bundled open would crash on a missing command', () => {
    const missing = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };

    beforeEach(() => {
      process.env.PATH = '/usr/local/bin:/usr/bin';
    });

    it('opens the default browser through xdg-open when it is on the PATH', async () => {
      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(accessSync)).toHaveBeenCalledWith(
        '/usr/local/bin/xdg-open',
        expect.any(Number)
      );
      expect(vi.mocked(open)).toHaveBeenCalled();
    });

    it('warns instead of calling open when xdg-open is missing', async () => {
      vi.mocked(accessSync).mockImplementation(missing);

      expect(await openBrowser('http://localhost:6006/')).toBe(true);

      expect(vi.mocked(open)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        'Could not open http://localhost:6006/ in a browser, because "xdg-open" was not found. Install xdg-utils, or set the BROWSER environment variable.'
      );
    });

    it('warns instead of calling open when the BROWSER command is missing', async () => {
      process.env.BROWSER = 'firefox-typo';
      vi.mocked(accessSync).mockImplementation(missing);

      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        'Could not open http://localhost:6006/ in a browser, because "firefox-typo" was not found. Check the BROWSER environment variable.'
      );
    });

    it('checks a BROWSER path directly instead of searching the PATH', async () => {
      process.env.BROWSER = '/opt/firefox/firefox';

      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(accessSync)).toHaveBeenCalledWith(
        '/opt/firefox/firefox',
        expect.any(Number)
      );
      expect(vi.mocked(open)).toHaveBeenCalled();
    });

    it('lets open use PowerShell on WSL, without needing xdg-open', async () => {
      wsl.isWsl = true;
      vi.mocked(accessSync).mockImplementation(missing);

      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    });

    it('needs xdg-open in a container on WSL, such as Docker Desktop on Windows', async () => {
      wsl.isWsl = true;
      vi.mocked(isInsideContainer).mockReturnValue(true);
      vi.mocked(accessSync).mockImplementation(missing);

      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).not.toHaveBeenCalled();
      expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    });
  });

  describe('on macOS', () => {
    const appleScriptCalls = () =>
      vi.mocked(execSync).mock.calls.filter(([command]) => String(command).startsWith('osascript'));

    beforeEach(() => {
      platformSpy.mockReturnValue('darwin');
      vi.mocked(resolvePackageDir).mockReturnValue('/node_modules/storybook');
    });

    it('reuses a tab in the first running Chromium browser, whatever the default browser is', async () => {
      vi.mocked(execSync).mockImplementation((command) => {
        if (String(command).startsWith('ps cax') && !String(command).includes('"Brave Browser"')) {
          throw new Error('not running');
        }
        return Buffer.from('');
      });

      expect(await openBrowser('http://localhost:6006/')).toBe(true);

      expect(appleScriptCalls()).toHaveLength(1);
      expect(String(appleScriptCalls()[0][0])).toContain('"Brave Browser"');
      expect(vi.mocked(open)).not.toHaveBeenCalled();
    });

    it('opens the default browser with open when no Chromium browser is running', async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not running');
      });

      await openBrowser('http://localhost:6006/');

      expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
        app: undefined,
        wait: false,
        url: true,
      });
    });
  });

  describe('openSafely', () => {
    it('warns instead of crashing when the spawned command fails', async () => {
      const child = new EventEmitter();
      vi.mocked(open).mockResolvedValue(child as unknown as Awaited<ReturnType<typeof open>>);

      await openSafely('http://localhost:6006/');
      child.emit('error', new Error('spawn powershell.exe ENOENT'));

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        'Could not open http://localhost:6006/ in a browser: spawn powershell.exe ENOENT'
      );
    });
  });
});

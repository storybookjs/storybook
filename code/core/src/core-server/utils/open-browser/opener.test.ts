import type { ChildProcess } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import spawn from 'cross-spawn';
import open from 'open';

import { BrowserEnvError, openBrowser } from './opener.ts';

vi.mock('open', { spy: true });
vi.mock('cross-spawn', { spy: true });

// eslint-disable-next-line no-var
var mockExecSync: ReturnType<typeof vi.fn>;
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  mockExecSync = vi.fn();
  return { ...actual, execSync: mockExecSync };
});
vi.mock('../../../common/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../common/index.ts')>();
  return { ...actual, resolvePackageDir: () => '/mock/storybook' };
});

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
});

describe('openBrowser macOS Chromium probing', () => {
  const originalEnv = { ...process.env };
  let platformSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    process.env = { ...originalEnv };
    delete process.env.BROWSER;

    vi.mocked(open).mockImplementation(() => {
      return Promise.resolve({} as unknown as Awaited<ReturnType<typeof open>>);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('does not probe for Microsoft Edge via ps or osascript on default macOS path', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    openBrowser('http://localhost:6006/');

    const psCalls = mockExecSync.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('Microsoft Edge')
    );
    expect(psCalls).toHaveLength(0);
  });

  it('uses AppleScript for a running Chromium browser (Google Chrome) on macOS', () => {
    mockExecSync.mockImplementation((...args: any[]) => {
      const cmd = args[0] as string;
      if (cmd === 'ps cax | grep "Google Chrome"') {
        return Buffer.from('');
      }
      if (cmd.startsWith('osascript')) {
        return Buffer.from('');
      }
      throw new Error('not found');
    });

    const result = openBrowser('http://localhost:6006/');

    expect(result).toBe(true);
    const osascriptCalls = mockExecSync.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].startsWith('osascript')
    );
    expect(osascriptCalls).toHaveLength(1);
    expect(osascriptCalls[0][0]).toContain('Google Chrome');
  });

  it('falls back to open when no probed browser is running on macOS', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    const result = openBrowser('http://localhost:6006/');

    expect(result).toBe(true);
    expect(vi.mocked(open)).toHaveBeenCalledWith('http://localhost:6006/', {
      app: undefined,
      wait: false,
      url: true,
    });
  });
});

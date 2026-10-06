import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProcessAncestry } from './process-ancestry.ts';

const { execSyncMock, platformMock } = vi.hoisted(() => ({
  execSyncMock: vi.fn(),
  platformMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: execSyncMock,
}));

vi.mock('node:os', () => ({
  default: { platform: platformMock },
  platform: platformMock,
}));

describe('getProcessAncestry', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
    platformMock.mockReset();
  });

  it('throws for invalid pids', () => {
    platformMock.mockReturnValue('linux');

    expect(() => getProcessAncestry(0)).toThrow('PID must be a positive integer');
    expect(() => getProcessAncestry(-5)).toThrow('PID must be a positive integer');
    expect(() => getProcessAncestry(1.5)).toThrow('PID must be a positive integer');
  });

  it('walks the unix ancestry and pins child stdio so stderr cannot leak', () => {
    platformMock.mockReturnValue('linux');
    execSyncMock
      .mockReturnValueOnce(' 123  456 node /cli/storybook.js \n')
      .mockReturnValueOnce(' 456  1 yarn start \n');

    const result = getProcessAncestry(123);

    expect(result).toEqual([{ pid: 123, ppid: 456, command: 'node /cli/storybook.js' }]);
    expect(execSyncMock).toHaveBeenCalledTimes(2);
    for (const call of execSyncMock.mock.calls) {
      expect(call[1]).toMatchObject({
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    }
  });

  it('stops the unix walk at init (ppid 1)', () => {
    platformMock.mockReturnValue('linux');
    execSyncMock.mockReturnValue(' 123  1 orphaned-process \n');

    expect(getProcessAncestry(123)).toEqual([]);
  });

  it('parses wmic CSV output on Windows and suppresses its stderr', () => {
    platformMock.mockReturnValue('win32');
    execSyncMock
      .mockReturnValueOnce(
        'Node,CommandLine,ParentProcessId,ProcessId\r\nHOST,cmd.exe /c yarn,2064,4700\r\n'
      )
      .mockReturnValueOnce(
        'Node,CommandLine,ParentProcessId,ProcessId\r\nHOST,powershell,1,2064\r\n'
      )
      .mockReturnValueOnce('');

    const result = getProcessAncestry(4700);

    expect(result).toEqual([
      { pid: 4700, ppid: 2064, command: 'cmd.exe /c yarn' },
      { pid: 2064, ppid: 1, command: 'powershell' },
    ]);
    const [command, options] = execSyncMock.mock.calls[0];
    expect(command).toContain('wmic process where (ProcessId=4700)');
    expect(options).toMatchObject({
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  });

  it('returns an empty ancestry when the lookup yields nothing (benign stderr case)', () => {
    platformMock.mockReturnValue('win32');
    // wmic prints "No Instance(s) Available." to stderr (now discarded) and
    // nothing to stdout when the queried PID no longer exists
    execSyncMock.mockReturnValue('');

    expect(getProcessAncestry(9999)).toEqual([]);
  });

  it('breaks on cycles in the process tree', () => {
    platformMock.mockReturnValue('linux');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    execSyncMock.mockReturnValue(' 5  5 looping-process \n');

    getProcessAncestry(5);

    expect(warn).toHaveBeenCalledWith('Detected cycle in process tree at PID 5');
    warn.mockRestore();
  });
});

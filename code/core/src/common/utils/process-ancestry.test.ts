import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileSyncMock, platformMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  platformMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));

vi.mock('node:os', () => ({
  default: { platform: platformMock },
  platform: platformMock,
}));

vi.unmock('./process-ancestry.ts');

const self = process.pid;

const psOutput = (rows: [number, number, string][]) =>
  rows
    .map(
      ([pid, ppid, command]) => `${String(pid).padStart(6)} ${String(ppid).padStart(6)} ${command}`
    )
    .join('\n') + '\n';

const cimOutput = (rows: [number, number, string | null][]) =>
  JSON.stringify(
    rows.map(([ProcessId, ParentProcessId, CommandLine]) => ({
      ProcessId,
      ParentProcessId,
      CommandLine,
    }))
  );

describe('getProcessAncestry', () => {
  let getProcessAncestry: typeof import('./process-ancestry.ts').getProcessAncestry;

  beforeEach(async () => {
    execFileSyncMock.mockReset();
    platformMock.mockReset();
    // The result is cached per module instance
    vi.resetModules();
    ({ getProcessAncestry } = await import('./process-ancestry.ts'));
  });

  it('reads the process table once per process', () => {
    platformMock.mockReturnValue('linux');
    execFileSyncMock.mockReturnValue(psOutput([[self, 456, 'node storybook.js']]));

    expect(getProcessAncestry()).toBe(getProcessAncestry());
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('walks the unix ancestry from one ps snapshot, with stderr discarded', () => {
    platformMock.mockReturnValue('linux');
    execFileSyncMock.mockReturnValue(
      psOutput([
        [1, 0, '/sbin/init'],
        [456, 1, 'yarn start'],
        [self, 456, 'node /cli/storybook.js --flag=a,b'],
        [999, 456, 'unrelated'],
      ])
    );

    expect(getProcessAncestry()).toEqual([
      { pid: self, ppid: 456, command: 'node /cli/storybook.js --flag=a,b' },
    ]);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    expect(execFileSyncMock).toHaveBeenCalledWith(
      'ps',
      ['-A', '-o', 'pid=,ppid=,args='],
      expect.objectContaining({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    );
  });

  it('walks the Windows ancestry from one CIM snapshot, keeping commas in command lines', () => {
    platformMock.mockReturnValue('win32');
    execFileSyncMock.mockReturnValue(
      cimOutput([
        [4, 0, null],
        [2064, 4, 'powershell'],
        [4700, 2064, 'cmd.exe /c "yarn storybook, now"'],
        [self, 4700, 'node storybook.js'],
      ])
    );

    expect(getProcessAncestry()).toEqual([
      { pid: self, ppid: 4700, command: 'node storybook.js' },
      { pid: 4700, ppid: 2064, command: 'cmd.exe /c "yarn storybook, now"' },
    ]);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const [file, args, options] = execFileSyncMock.mock.calls[0];
    expect(file).toBe('powershell.exe');
    expect(args.at(-1)).toContain('Get-CimInstance Win32_Process');
    expect(options).toMatchObject({ stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  });

  it('accepts a single CIM object, which ConvertTo-Json does not wrap in an array', () => {
    platformMock.mockReturnValue('win32');
    execFileSyncMock.mockReturnValue(
      JSON.stringify({ ProcessId: self, ParentProcessId: 9, CommandLine: null })
    );

    expect(getProcessAncestry()).toEqual([{ pid: self, ppid: 9, command: undefined }]);
  });

  it('returns an empty ancestry when the process table cannot be read', () => {
    platformMock.mockReturnValue('win32');
    execFileSyncMock.mockImplementation(() => {
      throw new Error('spawnSync powershell.exe ETIMEDOUT');
    });

    expect(getProcessAncestry()).toEqual([]);
  });

  it('caches a failed read instead of spawning again', () => {
    platformMock.mockReturnValue('linux');
    execFileSyncMock.mockImplementation(() => {
      throw new Error('spawnSync ps ENOENT');
    });

    expect(getProcessAncestry()).toEqual([]);
    expect(getProcessAncestry()).toEqual([]);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty ancestry when the current process is missing from the table', () => {
    platformMock.mockReturnValue('linux');
    execFileSyncMock.mockReturnValue(
      psOutput([
        [1, 0, '/sbin/init'],
        [456, 1, 'yarn start'],
      ])
    );

    expect(getProcessAncestry()).toEqual([]);
  });

  it('returns an empty ancestry for unparseable output', () => {
    platformMock.mockReturnValue('win32');
    execFileSyncMock.mockReturnValue('');

    expect(getProcessAncestry()).toEqual([]);
  });

  it('stops on a self-referencing process', () => {
    platformMock.mockReturnValue('linux');
    execFileSyncMock.mockReturnValue(psOutput([[self, self, 'looping-process']]));

    expect(getProcessAncestry()).toEqual([{ pid: self, ppid: self, command: 'looping-process' }]);
  });

  it('stops on cycles in the process tree', () => {
    platformMock.mockReturnValue('win32');
    execFileSyncMock.mockReturnValue(
      cimOutput([
        [self, 20, 'node child.js'],
        [20, self, 'cmd.exe'],
      ])
    );

    expect(getProcessAncestry()).toEqual([
      { pid: self, ppid: 20, command: 'node child.js' },
      { pid: 20, ppid: self, command: 'cmd.exe' },
    ]);
  });
});

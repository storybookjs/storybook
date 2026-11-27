import { execFileSync } from 'node:child_process';
import os from 'node:os';

export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Parent Process ID */
  ppid: number;
  /** Command line or executable name */
  command?: string;
}

// `Get-CimInstance` works on every supported Windows version; `wmic` is gone from Windows 11 25H2.
const WINDOWS_PROCESS_LIST = [
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  'Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CommandLine' +
    ' | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress',
].join('; ');

// stderr is discarded so benign `ps` and PowerShell noise stays out of the CLI's own stderr.
const run = (file: string, args: string[]) =>
  execFileSync(file, args, {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });

function listProcessesWindows(): ProcessInfo[] {
  const output = run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    WINDOWS_PROCESS_LIST,
  ]);
  const rows: { ProcessId: number; ParentProcessId: number; CommandLine: string | null }[] = [
    JSON.parse(output),
  ].flat();
  return rows.map((row) => ({
    pid: row.ProcessId,
    ppid: row.ParentProcessId,
    command: row.CommandLine?.trim() || undefined,
  }));
}

function listProcessesUnix(): ProcessInfo[] {
  return run('ps', ['-A', '-o', 'pid=,ppid=,args='])
    .split('\n')
    .flatMap((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s?(.*)$/);
      return match
        ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3].trim() || undefined }]
        : [];
    });
}

function readAncestry(): ProcessInfo[] {
  const isWindows = os.platform() === 'win32';
  let processes: Map<number, ProcessInfo>;
  try {
    const list = isWindows ? listProcessesWindows() : listProcessesUnix();
    processes = new Map(list.map((info) => [info.pid, info]));
  } catch {
    return [];
  }

  const rootPpids = isWindows ? [0, 4] : [0, 1];
  const ancestry: ProcessInfo[] = [];
  let info = processes.get(process.pid);
  // Windows reuses PIDs without reparenting orphans, so a cycle here is expected.
  while (info && !rootPpids.includes(info.ppid) && !ancestry.includes(info)) {
    ancestry.push(info);
    info = processes.get(info.ppid);
  }
  return ancestry;
}

let cachedAncestry: readonly ProcessInfo[] | undefined;

/**
 * Returns the ancestry of the current process, starting with the process itself, from one
 * snapshot of the process table, read once per process. On Windows, PID 0 (System Idle Process)
 * and PID 4 (System) end the walk; on other platforms, PID 0 and PID 1 (init) do. Returns `[]` when
 * the table cannot be read.
 */
export const getProcessAncestry = (): readonly ProcessInfo[] => (cachedAncestry ??= readAncestry());

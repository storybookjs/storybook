/*
 * Process-ancestry lookup used to enrich CLI commands with their parent process
 * information (version specifiers, CLI integration detection).
 *
 * Vendored from the `process-ancestry` package so the child-process calls can
 * pin their stdio: the upstream implementation lets benign stderr noise leak
 * into the CLI's own stderr (e.g. wmic's "No Instance(s) Available." on
 * Windows, whenever a queried PID no longer exists). Unlike a Yarn patch, a
 * local module also survives being published — patch descriptors reference a
 * patch file path that does not exist inside consuming projects, which breaks
 * `yarn install` for every sandbox created from the published packages.
 */

import { execSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import os from 'node:os';

export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Parent Process ID */
  ppid: number;
  /** Command line or executable name */
  command?: string;
}

const UNIX_TIMEOUT = 5_000;
// 10 second timeout (wmic can be slower)
const WINDOWS_TIMEOUT = 10_000;
const MAX_DEPTH = 1_000;
// stdin ignored, stdout piped for parsing, stderr discarded so benign child
// process noise never reaches the CLI's own stderr
const EXEC_STDIO: StdioOptions = ['ignore', 'pipe', 'ignore'];

function getProcessInfoUnix(pid: number): ProcessInfo | null {
  try {
    const output = execSync(`ps -p ${pid} -o pid=,ppid=,command=`, {
      encoding: 'utf8',
      timeout: UNIX_TIMEOUT,
      stdio: EXEC_STDIO,
    }).trim();

    if (!output) {
      return null;
    }

    const [pidStr, ppidStr, ...commandParts] = output.split(/\s+/);
    const parsedPid = pidStr ? parseInt(pidStr, 10) : NaN;
    const parsedPpid = ppidStr ? parseInt(ppidStr, 10) : NaN;

    if (Number.isNaN(parsedPid) || Number.isNaN(parsedPpid)) {
      return null;
    }

    return {
      pid: parsedPid,
      ppid: parsedPpid,
      command: commandParts.join(' ') || undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn(`Process lookup timed out for PID ${pid}`);
    }
    return null;
  }
}

function getProcessInfoWindows(pid: number): ProcessInfo | null {
  try {
    const output = execSync(
      `wmic process where (ProcessId=${pid}) get ProcessId,ParentProcessId,CommandLine /format:csv`,
      {
        encoding: 'utf8',
        timeout: WINDOWS_TIMEOUT,
        stdio: EXEC_STDIO,
      }
    );

    if (!output) {
      return null;
    }

    const lines = output.split('\n').filter((line) => line.trim() && !line.startsWith('Node'));
    const fields = lines.pop()?.split(',');

    if (!fields || fields.length < 4) {
      return null;
    }

    const [_node, commandLine, parentPid, thisPid] = fields;
    const parsedPid = thisPid ? parseInt(thisPid.trim(), 10) : NaN;
    const parsedPpid = parentPid ? parseInt(parentPid.trim(), 10) : NaN;

    if (Number.isNaN(parsedPid) || Number.isNaN(parsedPpid)) {
      return null;
    }

    return {
      pid: parsedPid,
      ppid: parsedPpid,
      command: commandLine?.trim() || undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn(`Process lookup timed out for PID ${pid}`);
    }
    return null;
  }
}

function walkAncestry(
  startPid: number,
  getProcessInfo: (pid: number) => ProcessInfo | null,
  isRootPpid: (ppid: number) => boolean
): ProcessInfo[] {
  const result: ProcessInfo[] = [];
  const visited = new Set<number>();
  let currentPid: number | null = startPid;
  let maxDepth = MAX_DEPTH;

  while (currentPid && maxDepth > 0) {
    if (visited.has(currentPid)) {
      console.warn(`Detected cycle in process tree at PID ${currentPid}`);
      break;
    }
    visited.add(currentPid);

    const info = getProcessInfo(currentPid);
    if (!info || isRootPpid(info.ppid)) {
      break;
    }

    result.push(info);
    currentPid = info.ppid;
    maxDepth -= 1;
  }

  if (maxDepth === 0) {
    console.warn(`Reached maximum depth limit while traversing process tree from PID ${startPid}`);
  }

  return result;
}

/**
 * Returns the ancestry of the given process (defaults to the current process),
 * walking parent by parent until the process tree ends. On Windows, PID 0
 * (System Idle Process) and PID 4 (System) terminate the walk; on other
 * platforms, PID 0 and PID 1 (init) do.
 */
export function getProcessAncestry(pid = process.pid): ProcessInfo[] {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    throw new Error('PID must be a positive integer');
  }

  if (os.platform() === 'win32') {
    return walkAncestry(pid, getProcessInfoWindows, (ppid) => ppid === 0 || ppid === 4);
  }

  return walkAncestry(pid, getProcessInfoUnix, (ppid) => ppid === 0 || ppid === 1);
}

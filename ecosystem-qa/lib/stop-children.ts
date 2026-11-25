import { spawnSync } from 'node:child_process';

const childrenOf = (pid: number): number[] => {
  const listed =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { $_.ProcessId }`,
          ],
          { encoding: 'utf8' }
        )
      : spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' });
  return (listed.stdout ?? '')
    .split(/\s+/)
    .filter((entry) => /^\d+$/.test(entry))
    .map(Number)
    .filter((child) => child !== listed.pid);
};

const stopTree = (pid: number): void => {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }
  for (const child of childrenOf(pid)) {
    stopTree(child);
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // It ended on its own in the same moment.
  }
};

// Stop every process this one started, with everything they started, and return how many there were.
//
// A run without a sandbox has nothing else that ends the agent: Sandcastle does not stop the process
// when a run is aborted there, and closing that "sandbox" does nothing. An agent left running would
// keep writing evidence and commits after the result is written and the credentials are redacted.
export const stopChildren = (): number => {
  const children = childrenOf(process.pid);
  for (const child of children) {
    stopTree(child);
  }
  return children.length;
};

import { readlinkSync } from 'node:fs';

// The process namespace of this process on Linux, such as `pid:[4026531836]`. A pid can only be
// checked from the namespace that issued it: a sandbox or container with its own namespace does
// not see the processes outside it.
export function getPidNamespace(): string | undefined {
  try {
    return readlinkSync('/proc/self/ns/pid');
  } catch {
    return undefined;
  }
}

export function isAnotherPidNamespace(pidNamespace: string | undefined): boolean {
  const own = getPidNamespace();
  return pidNamespace != null && own != null && pidNamespace !== own;
}

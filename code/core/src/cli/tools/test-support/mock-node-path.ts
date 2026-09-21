import * as path from 'node:path';
import { posix, win32 } from 'node:path';

import { vi } from 'vitest';

export function mockNodePath(kind: 'win32' | 'posix'): void {
  const impl = kind === 'win32' ? win32 : posix;
  if (path.sep === impl.sep) {
    // Host `path.resolve` is this impl (`posix.resolve === resolve` on POSIX); mocking it recurses.
    return;
  }
  vi.mocked(path.resolve).mockImplementation((...args) => impl.resolve(...args));
  vi.spyOn(path, 'sep', 'get').mockReturnValue(impl.sep);
}

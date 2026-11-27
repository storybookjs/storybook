import { tmpdir } from 'node:os';

import { postEvent } from './post-event.ts';
import type { TelemetryEvent } from './types.ts';

// A process inside the project directory would block deleting it on Windows.
try {
  process.chdir(tmpdir());
} catch {
  // The temp directory can be gone. The events still have to be posted.
}

process.on('message', (event: TelemetryEvent) => {
  postEvent(event).catch(() => {});
});

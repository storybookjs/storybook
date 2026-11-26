import { tmpdir } from 'node:os';

import { postEvent } from './post-event.ts';
import type { TelemetryEvent } from './types.ts';

// A process inside the project directory would block deleting it on Windows.
process.chdir(tmpdir());

process.on('message', (event: TelemetryEvent) => {
  postEvent(event).catch(() => {});
});

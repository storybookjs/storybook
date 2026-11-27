import { parse } from 'pathe';

import { postEvent } from './post-event.ts';
import type { TelemetryEvent } from './types.ts';

// Windows cannot delete the directory a process is in, and this process outlives the command.
// Elsewhere it stays where it is, so a relative path in the environment still resolves, such as
// the one in NODE_EXTRA_CA_CERTS.
if (process.platform === 'win32') {
  process.chdir(parse(process.execPath).root);
}

process.on('message', (event: TelemetryEvent) => {
  postEvent(event).catch(() => {});
});

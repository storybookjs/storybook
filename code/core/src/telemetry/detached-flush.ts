import { tmpdir } from 'node:os';

import { flushEventsFile } from './flush-events-file.ts';

// A process inside the project directory would block deleting it on Windows.
process.chdir(tmpdir());

await flushEventsFile(process.argv[2]);

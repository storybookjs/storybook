import { flushEventsFile } from './flush-events-file.ts';

await flushEventsFile(process.argv[2]);

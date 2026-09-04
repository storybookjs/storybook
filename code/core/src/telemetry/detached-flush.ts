import { flushEventsFile } from './flush-events-file.ts';

const file = process.argv[2];
if (!file) {
  throw new Error('detached-flush expects the path of the events file as its only argument');
}

await flushEventsFile(file);

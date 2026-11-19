import { existsSync } from 'node:fs';

import { redactTree } from './lib/redact.ts';

const HELP = `Usage: node ecosystem-qa/redact.ts <dir>

Redacts credentials in every text file under <dir>, in place. run.ts does the same when it reaches
its end; this is for the output of a run that did not.`;

const [dir] = process.argv.slice(2);
if (!dir || dir === '--help') {
  console.log(HELP);
  process.exit(dir ? 0 : 1);
}
if (existsSync(dir)) {
  redactTree(dir);
}

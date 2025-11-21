import fs from 'node:fs/promises';
import { join } from 'node:path';

import yml from 'yaml';

import { data } from './data';

console.log('Generating CircleCI config...');
console.log('--------------------------------');

const dirname = import.meta.dirname;

const existing = await yml.parse(
  await fs.readFile(join(dirname, '../../.circleci/config.original.yml'), 'utf-8')
);

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.json'),
  JSON.stringify(existing, null, 2)
);

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.yml'),
  yml.stringify(data, null, { lineWidth: 1200, indent: 4 })
);

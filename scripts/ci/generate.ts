import fs from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
import yml from 'yaml';

import generateConfig from './data';

console.log('Generating CircleCI config...');
console.log('--------------------------------');

const dirname = import.meta.dirname;

program
  .description('Generate CircleCI config')
  .requiredOption('-w, --workflow <string>', 'Workflow to generate config for')
  .parse(process.argv);

await fs.writeFile(
  join(dirname, '../../.circleci/config.generated.yml'),
  yml.stringify(generateConfig(program.opts().workflow), null, {
    lineWidth: 1200,
    indent: 4,
  })
);

import { join } from 'node:path';

import { program } from 'commander';

import { SANDBOX_DIRECTORY } from './utils/constants';
import { esMain } from './utils/esmain';

type RunOptions = {
  template?: string;
};

// Get sandbox directory from template name
// replace '/' by a '-'
async function run({ template }: RunOptions) {
  console.log(join(SANDBOX_DIRECTORY, template.replace('/', '-')));
}

if (esMain(import.meta.url)) {
  program
    .description('Retrieve the sandbox directory for template name')
    .requiredOption('--template <template>', 'Template name');

  program.parse(process.argv);

  const options = program.opts() as RunOptions;

  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

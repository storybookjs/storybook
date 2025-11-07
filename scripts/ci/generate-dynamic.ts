import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import a from '@ndelangen/circleci-config-parser';
import { Config, Workflow, orb } from '@ndelangen/circleci-config-sdk';
import { program } from 'commander';
import yml from 'yaml';

program
  .description('Generate CircleCI config')
  .requiredOption('-w, --workflow <string>', 'Workflow to generate config for')
  .parse(process.argv);

const { workflow: workflowName } = program.opts();

const dirname = import.meta.dirname;

console.log('Generating CircleCI config for workflow:', workflowName);
console.log('--------------------------------');

const templates = await import(join(dirname, '../../code/lib/cli-storybook/src/sandbox-templates'));
const orbyml = await readFile(join(dirname, '../tmp.yml'), 'utf-8');
const orbData = yml.parse(orbyml);

const config = new Config();
config.importOrb(
  new orb.OrbImport('git-shallow-clone', 'guitarrapc', 'git-shallow-clone', '2.8.0')
);
config.addWorkflow(new Workflow(workflowName));

console.log(config.stringify());

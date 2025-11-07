import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Config, Workflow, orb } from '@ndelangen/circleci-config-sdk';
import { program } from 'commander';
import yml from 'yaml';

program
  .description('Generate CircleCI config')
  .requiredOption('-w, --workflow <string>', 'Workflow to generate config for')
  .parse(process.argv);

const { workflow: workflowName } = program.opts();

const dirname = import.meta.dirname;

async function generateConfig() {
  console.log('Generating CircleCI config for workflow:', workflowName);
  console.log('--------------------------------');

  const templates = await import(
    join(dirname, '../../code/lib/cli-storybook/src/sandbox-templates')
  );
  const orbyml = await readFile(join(dirname, '../tmp.yml'), 'utf-8');
  const orbData = yml.parse(orbyml);

  console.log(orbData);

  const config = new Config();
  config.importOrb(
    new orb.OrbImport('git-shallow-clone', 'guitarrapc', 'git-shallow-clone', '2.8.0')
  );
  config.addWorkflow(new Workflow(workflowName));

  console.log(config.stringify());
}

async function getOrbs() {
  const orbs = {
    'browser-tools': 'circleci/browser-tools@1.4.1',
    codecov: 'codecov/codecov@3.2.4',
    discord: 'antonioned/discord@0.1.0',
    'git-shallow-clone': 'guitarrapc/git-shallow-clone@2.5.0',
    node: 'circleci/node@5.2.0',
    nx: 'nrwl/nx@1.6.2',
  };

  return Promise.all(
    Object.entries(orbs).map(async ([alias, reference]) => {
      const text = await new Promise<string>((resolve, reject) => {
        const child = exec(`circleci orb source ${reference}`);
        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        child.on('close', () => {
          resolve(output);
        });
        child.on('error', (error) => {
          reject(error);
        });
      });

      type P<Z extends string | number | boolean = string | number | boolean> = Record<
        string,
        | {
            default: Z;
            description: string;
            type: 'string';
          }
        | {
            default: Z;
            enum: Z[];
            type: 'enum';
          }
      >;

      const data = yml.parse(text) as {
        version: number;
        commands: Record<
          string,
          {
            description: string;
            parameters: P;
            executors: Record<
              string,
              {
                docker: { image: string }[];
                parameters: P;
              }
            >;
          }
        >;
      };

      return {
        alias,
        reference,
        data,
      };
    })
  );
}

const orbs = await getOrbs();
console.log(orbs);

async function convertOrb(input: Awaited<ReturnType<typeof getOrbs>>[0]) {
  //
}

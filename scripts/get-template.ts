import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import { pathExists, readFile } from 'fs-extra';
import { readdir } from 'fs/promises';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';
import yaml from 'yaml';

import {
  type Cadence,
  type SkippableTask,
  type Template as TTemplate,
  allTemplates,
  templatesByCadence,
} from '../code/lib/cli-storybook/src/sandbox-templates';
import { SANDBOX_DIRECTORY } from './utils/constants';
import { esMain } from './utils/esmain';

const sandboxDir = process.env.SANDBOX_ROOT || SANDBOX_DIRECTORY;

type Template = Pick<TTemplate, 'inDevelopment' | 'skipTasks'>;
export type TemplateKey = keyof typeof allTemplates;
export type Templates = Record<TemplateKey, Template>;

async function getDirectories(source: string) {
  return (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export async function getTemplate(
  cadence: Cadence,
  scriptName: string,
  { index, total }: { index: number; total: number }
) {
  let potentialTemplateKeys: TemplateKey[] = [];
  if (await pathExists(sandboxDir)) {
    const sandboxes = await getDirectories(sandboxDir);
    potentialTemplateKeys = sandboxes
      .map((dirName) => {
        return Object.keys(allTemplates).find(
          (templateKey) => templateKey.replace('/', '-') === dirName
        );
      })
      .filter(Boolean) as TemplateKey[];
  }

  if (potentialTemplateKeys.length === 0) {
    const cadenceTemplates = Object.entries(allTemplates).filter(([key]) =>
      templatesByCadence[cadence].includes(key as TemplateKey)
    );
    potentialTemplateKeys = cadenceTemplates.map(([k]) => k) as TemplateKey[];
  }

  potentialTemplateKeys = potentialTemplateKeys.filter((t) => {
    const currentTemplate = allTemplates[t] as Template;
    return (
      currentTemplate.inDevelopment !== true &&
      !currentTemplate.skipTasks?.includes(scriptName as SkippableTask)
    );
  });

  if (potentialTemplateKeys.length !== total) {
    throw new Error(dedent`Circle parallelism set incorrectly.
    
      Parallelism is set to ${total}, but there are ${
        potentialTemplateKeys.length
      } templates to run for the "${scriptName}" task:
      ${potentialTemplateKeys.map((v) => `- ${v}`).join('\n')}
    
      ${await checkParallelism(cadence)}
    `);
  }

  return potentialTemplateKeys[index];
}

const tasksMap = {
  sandbox: 'create-sandboxes',
  build: 'build-sandboxes',
  chromatic: 'chromatic-sandboxes',
  'e2e-tests': 'e2e-production',
  'e2e-tests-dev': 'e2e-dev',
  'test-runner': 'test-runner-production',
  // 'test-runner-dev', TODO: bring this back when the task is enabled again
  bench: 'bench',
  'vitest-integration': 'vitest-integration',
} as const;

type TaskKey = keyof typeof tasksMap;

const tasks = Object.keys(tasksMap) as TaskKey[];

const CONFIG_YML_FILE = '../.circleci/config.yml';

async function checkParallelism(cadence?: Cadence, scriptName?: TaskKey) {
  const configYml = await readFile(CONFIG_YML_FILE, 'utf-8');
  const data = yaml.parse(configYml);

  let potentialTemplateKeys: TemplateKey[] = [];
  const cadences = cadence ? [cadence] : (Object.keys(templatesByCadence) as Cadence[]);
  const scripts = scriptName ? [scriptName] : tasks;
  const summary = [];
  let isIncorrect = false;

  cadences.forEach((cad) => {
    summary.push(`\n${picocolors.bold(cad)}`);
    const cadenceTemplates = Object.entries(allTemplates).filter(([key]) =>
      templatesByCadence[cad].includes(key as TemplateKey)
    );
    potentialTemplateKeys = cadenceTemplates.map(([k]) => k) as TemplateKey[];

    scripts.forEach((script) => {
      const templateKeysPerScript = potentialTemplateKeys.filter((t) => {
        const currentTemplate = allTemplates[t] as Template;

        return (
          currentTemplate.inDevelopment !== true &&
          !currentTemplate.skipTasks?.includes(script as SkippableTask)
        );
      });
      const workflowJobsRaw: (string | { [key: string]: any })[] = data.workflows[cad].jobs;
      const workflowJobs = workflowJobsRaw
        .filter((item) => typeof item === 'object' && item !== null)
        .reduce((result, item) => Object.assign(result, item), {}) as Record<string, any>;

      if (templateKeysPerScript.length > 0 && workflowJobs[tasksMap[script]]) {
        const currentParallelism = workflowJobs[tasksMap[script]].parallelism || 2;
        const newParallelism = templateKeysPerScript.length;

        if (newParallelism !== currentParallelism) {
          summary.push(
            `-- ❌ ${tasksMap[script]} - parallelism: ${currentParallelism} ${picocolors.bgRed(
              `(should be ${newParallelism})`
            )}`
          );
          isIncorrect = true;
        } else {
          summary.push(
            `-- ✅ ${tasksMap[script]} - parallelism: ${templateKeysPerScript.length}${
              templateKeysPerScript.length === 2 ? ' (default)' : ''
            }`
          );
        }
      } else {
        summary.push(`-- ${script} - this script is fully skipped for this cadence.`);
      }
    });
  });

  if (isIncorrect) {
    summary.unshift(
      'The parellism count is incorrect for some jobs in .circleci/config.yml, you have to update them:'
    );
    throw new Error(summary.concat('\n').join('\n'));
  } else {
    summary.unshift('✅  The parallelism count is correct for all jobs in .circleci/config.yml:');
    console.log(summary.concat('\n').join('\n'));
  }

  const inDevelopmentTemplates = Object.entries(allTemplates)
    .filter(([_, t]) => t.inDevelopment)
    .map(([k]) => k);

  if (inDevelopmentTemplates.length > 0) {
    console.log(
      `👇 Some templates were skipped as they are flagged to be in development. Please review if they should still contain this flag:\n${inDevelopmentTemplates
        .map((k) => `- ${k}`)
        .join('\n')}`
    );
  }
}

type RunOptions = { cadence?: Cadence; task?: TaskKey; check: boolean };
async function run({ cadence, task, check }: RunOptions) {
  if (check) {
    if (task && !tasks.includes(task)) {
      throw new Error(
        dedent`The "${task}" task you provided is not valid. Valid tasks (found in .circleci/config.yml) are: 
        ${tasks.map((v) => `- ${v}`).join('\n')}`
      );
    }
    await checkParallelism(cadence as Cadence, task);
    return;
  }

  if (!cadence) {
    throw new Error('Need to supply cadence to get template script');
  }

  const { CIRCLE_NODE_INDEX = 0, CIRCLE_NODE_TOTAL = 1 } = process.env;

  console.log(
    await getTemplate(cadence as Cadence, task, {
      index: +CIRCLE_NODE_INDEX,
      total: +CIRCLE_NODE_TOTAL,
    })
  );
}

if (esMain(import.meta.url)) {
  program
    .description('Retrieve the template to run for a given cadence and task')
    .option('--cadence <cadence>', 'Which cadence you want to run the script for')
    .option('--task <task>', 'Which task you want to run the script for')
    .option(
      '--check',
      'Throws an error when the parallelism counts for tasks are incorrect',
      false
    );

  program.parse(process.argv);

  const options = program.opts() as RunOptions;

  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

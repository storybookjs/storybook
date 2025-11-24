import { access, readFile, readdir, writeFile } from 'node:fs/promises';

import { program } from 'commander';
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

type Template = Pick<TTemplate, 'inDevelopment' | 'skipTasks' | 'typeCheck'>;
export type TemplateKey = keyof typeof allTemplates;
export type Templates = Record<TemplateKey, Template>;

async function getDirectories(source: string) {
  return (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isTaskSkipped(template: Template, script: string): boolean {
  return (
    template.inDevelopment !== true &&
    !template.skipTasks?.includes(script as SkippableTask) &&
    (script !== 'check-sandbox' || template.typeCheck)
  );
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
    return isTaskSkipped(currentTemplate, scriptName);
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
  'check-sandbox': 'check-sandboxes',
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
const WORKFLOWS_DIR = '../.circleci/src/workflows';

async function checkParallelism(cadence?: Cadence, scriptName?: TaskKey, fix: boolean = false) {
  const configYml = await readFile(CONFIG_YML_FILE, 'utf-8');
  const data = yaml.parse(configYml);

  let potentialTemplateKeys: TemplateKey[] = [];
  const cadences = cadence ? [cadence] : (Object.keys(templatesByCadence) as Cadence[]);
  const scripts = scriptName ? [scriptName] : tasks;
  const summary = [];
  let isIncorrect = false;
  const fixes: Array<{
    cadence: string;
    job: string;
    oldParallelism: number;
    newParallelism: number;
  }> = [];

  cadences.forEach((cad) => {
    summary.push(`\n${picocolors.bold(cad)}`);
    const cadenceTemplates = Object.entries(allTemplates).filter(([key]) =>
      templatesByCadence[cad].includes(key as TemplateKey)
    );
    potentialTemplateKeys = cadenceTemplates.map(([k]) => k) as TemplateKey[];

    scripts.forEach((script) => {
      const templateKeysPerScript = potentialTemplateKeys.filter((t) => {
        const currentTemplate = allTemplates[t] as Template;

        return isTaskSkipped(currentTemplate, script);
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
          fixes.push({
            cadence: cad,
            job: tasksMap[script],
            oldParallelism: currentParallelism,
            newParallelism,
          });
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
    if (fix) {
      // Apply fixes to individual workflow files
      const fixesByFile: Record<
        string,
        Array<{ job: string; oldParallelism: number; newParallelism: number }>
      > = {};

      // Group fixes by workflow file
      fixes.forEach(({ cadence: fixCadence, job, oldParallelism, newParallelism }) => {
        const workflowFile = `${fixCadence}.yml`;
        if (!fixesByFile[workflowFile]) {
          fixesByFile[workflowFile] = [];
        }
        fixesByFile[workflowFile].push({ job, oldParallelism, newParallelism });
      });

      // Apply fixes to each workflow file
      for (const [workflowFile, fileFixes] of Object.entries(fixesByFile)) {
        const workflowPath = `${WORKFLOWS_DIR}/${workflowFile}`;
        let workflowContent = await readFile(workflowPath, 'utf-8');

        // Apply fixes using string manipulation to preserve comments and formatting
        fileFixes.forEach(({ job, newParallelism }) => {
          // Find the job definition in the YAML content
          const jobRegex = new RegExp(`^\\s*-\\s+${job}:\\s*$`, 'm');
          const jobMatch = workflowContent.match(jobRegex);

          if (jobMatch) {
            const jobStartIndex = jobMatch.index!;
            const jobStartLine = workflowContent.substring(0, jobStartIndex).split('\n').length - 1;
            const lines = workflowContent.split('\n');

            // Find the parallelism line for this job
            let parallelismLineIndex = -1;
            let indentLevel = 0;

            for (let i = jobStartLine + 1; i < lines.length; i++) {
              const line = lines[i];
              const trimmedLine = line.trim();

              // If we hit another job or top-level key, stop looking
              if (
                trimmedLine.startsWith('- ') ||
                (trimmedLine && !line.startsWith(' ') && !trimmedLine.startsWith('#'))
              ) {
                break;
              }

              // Track indentation level
              if (trimmedLine && !trimmedLine.startsWith('#')) {
                const currentIndent = line.length - line.trimStart().length;
                if (indentLevel === 0) {
                  indentLevel = currentIndent;
                }
              }

              // Look for parallelism line
              if (trimmedLine.startsWith('parallelism:')) {
                parallelismLineIndex = i;
                break;
              }
            }

            if (parallelismLineIndex !== -1) {
              // Update existing parallelism line
              const indent = lines[parallelismLineIndex].match(/^(\s*)/)?.[1] || '';
              lines[parallelismLineIndex] = `${indent}parallelism: ${newParallelism}`;
            } else {
              // Add parallelism line after the job name
              const indent = lines[jobStartLine].match(/^(\s*)/)?.[1] || '';
              const jobIndent = indent + '  ';
              lines.splice(jobStartLine + 1, 0, `${jobIndent}parallelism: ${newParallelism}`);
            }

            workflowContent = lines.join('\n');
          }
        });

        // Write the updated workflow file back with preserved comments and formatting
        await writeFile(workflowPath, workflowContent, 'utf-8');
      }

      summary.unshift(
        `🔧 ${picocolors.green('Fixed')} parallelism counts for ${fixes.length} job${fixes.length === 1 ? '' : 's'} in workflow files:`
      );
      summary.push('');
      summary.push('✅ The parallelism of the following jobs was fixed:');
      fixes.forEach(({ job, oldParallelism, newParallelism, cadence }) => {
        summary.push(`  - ${cadence}/${job}: ${oldParallelism} → ${newParallelism}`);
      });
      summary.push('');
      summary.push(
        `${picocolors.yellow('⚠️  Important:')} You must regenerate the main config file by running:`
      );
      summary.push('');
      summary.push(
        `${picocolors.cyan('  circleci config pack .circleci/src > .circleci/config.yml')}`
      );
      summary.push(`${picocolors.cyan('  circleci config validate .circleci/config.yml')}`);
      summary.push('');
      summary.push(
        `${picocolors.gray('See .circleci/README.md for more details about the packing process.')}`
      );
      console.log(summary.concat('\n').join('\n'));
    } else {
      summary.unshift(
        'The parallelism count is incorrect for some jobs in .circleci/config.yml, you have to update them:'
      );
      summary.push('');
      summary.push(
        `${picocolors.yellow('💡 Tip:')} Use the ${picocolors.cyan('--fix')} flag to automatically fix these issues.`
      );
      summary.push('');
      summary.push(
        `${picocolors.gray('Note: The fix will update the workflow files in .circleci/src/workflows/ and you will need to regenerate the main config.yml file. See .circleci/README.md for details.')}`
      );
      throw new Error(summary.concat('\n').join('\n'));
    }
  } else {
    summary.unshift('✅  The parallelism count is correct for all jobs in .circleci/config.yml:');
    console.log(summary.concat('\n').join('\n'));
  }

  const inDevelopmentTemplates = Object.entries(allTemplates)
    .filter(([, t]) => t.inDevelopment)
    .map(([k]) => k);

  if (inDevelopmentTemplates.length > 0) {
    console.log(
      `👇 Some templates were skipped as they are flagged to be in development. Please review if they should still contain this flag:\n${inDevelopmentTemplates
        .map((k) => `- ${k}`)
        .join('\n')}`
    );
  }
}

type RunOptions = {
  cadence?: Cadence;
  task?: TaskKey;
  check: boolean;
  fix: boolean;
};
async function run({ cadence, task, check, fix }: RunOptions) {
  if (check || fix) {
    if (task && !tasks.includes(task)) {
      throw new Error(
        dedent`The "${task}" task you provided is not valid. Valid tasks (found in .circleci/config.yml) are:
        ${tasks.map((v) => `- ${v}`).join('\n')}`
      );
    }
    await checkParallelism(cadence as Cadence, task, fix);
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
    .option('--check', 'Throws an error when the parallelism counts for tasks are incorrect', false)
    .option('--fix', 'Automatically fix parallelism counts in workflow files', false);

  program.parse(process.argv);

  const options = program.opts() as RunOptions;

  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

import type { TestCase } from 'junit-xml';
import { getJunitXml } from 'junit-xml';
import { outputFile, readFile, pathExists } from 'fs-extra';
import { join, resolve } from 'path';
import { prompt } from 'prompts';
import { dedent } from 'ts-dedent';

import invariant from 'tiny-invariant';
import { CODE_DIRECTORY, JUNIT_DIRECTORY, SANDBOX_DIRECTORY } from './utils/constants';
import type { OptionValues } from './utils/options';
import { createOptions, getCommand, getOptionsOrPrompt } from './utils/options';
import { install } from './tasks/install';
import { compile } from './tasks/compile';
import { check } from './tasks/check';
import { publish } from './tasks/publish';
import { runRegistryTask } from './tasks/run-registry';
import { generate } from './tasks/generate';
import { sandbox } from './tasks/sandbox';
import { syncDocs } from './tasks/sync-docs';
import { dev } from './tasks/dev';
import { smokeTest } from './tasks/smoke-test';
import { build } from './tasks/build';
import { serve } from './tasks/serve';
import { testRunnerBuild } from './tasks/test-runner-build';
import { testRunnerDev } from './tasks/test-runner-dev';
import { chromatic } from './tasks/chromatic';
import { e2eTestsBuild } from './tasks/e2e-tests-build';
import { e2eTestsDev } from './tasks/e2e-tests-dev';
import { bench } from './tasks/bench';

import {
  allTemplates as TEMPLATES,
  type TemplateKey,
  type Template,
} from '../code/lib/cli-storybook/src/sandbox-templates';

import { version } from '../code/package.json';

const sandboxDir = process.env.SANDBOX_ROOT || SANDBOX_DIRECTORY;

export const extraAddons = ['a11y', 'storysource'];

export type Path = string;
export type TemplateDetails = {
  key: TemplateKey;
  selectedTask: TaskKey;
  template: Template;
  codeDir: Path;
  sandboxDir: Path;
  builtSandboxDir: Path;
  junitFilename: Path;
};

type MaybePromise<T> = T | Promise<T>;

export type Task = {
  /**
   * A description of the task for a prompt
   */
  description: string;
  /**
   * Does this task represent a service for another task?
   *
   * Unlink other tasks, if a service is not ready, it doesn't mean the subsequent tasks
   * must be out of date. As such, services will never be reset back to, although they
   * will be started if dependent tasks are.
   */
  service?: boolean;
  /**
   * Which tasks must be ready before this task can run
   */
  dependsOn?: TaskKey[] | ((details: TemplateDetails, options: PassedOptionValues) => TaskKey[]);
  /**
   * Is this task already "ready", and potentially not required?
   */
  ready: (details: TemplateDetails, options?: PassedOptionValues) => MaybePromise<boolean>;
  /**
   * Run the task
   */
  run: (
    details: TemplateDetails,
    options: PassedOptionValues
  ) => MaybePromise<void | AbortController>;
  /**
   * Does this task handle its own junit results?
   */
  junit?: boolean;
};

export const tasks = {
  // These tasks pertain to the whole monorepo, rather than an
  // individual template/sandbox
  install,
  compile,
  check,
  publish,
  'sync-docs': syncDocs,
  'run-registry': runRegistryTask,
  // These tasks pertain to a single sandbox in the ../sandboxes dir
  generate,
  sandbox,
  dev,
  'smoke-test': smokeTest,
  build,
  serve,
  'test-runner': testRunnerBuild,
  'test-runner-dev': testRunnerDev,
  chromatic,
  'e2e-tests': e2eTestsBuild,
  'e2e-tests-dev': e2eTestsDev,
  bench,
};
type TaskKey = keyof typeof tasks;

function isSandboxTask(taskKey: TaskKey) {
  return !['install', 'compile', 'publish', 'run-registry', 'check', 'sync-docs'].includes(taskKey);
}

export const options = createOptions({
  task: {
    type: 'string',
    description: 'Which task would you like to run?',
    values: Object.keys(tasks) as TaskKey[],
    valueDescriptions: Object.values(tasks).map((t) => `${t.description} (${getTaskKey(t)})`),
    required: true,
  },
  startFrom: {
    type: 'string',
    description: 'Which task should we start execution from?',
    values: [...(Object.keys(tasks) as TaskKey[]), 'never', 'auto'] as const,
    // This is prompted later based on information about what's ready
    promptType: false,
  },
  template: {
    type: 'string',
    description: 'What template would you like to make a sandbox for?',
    values: Object.keys(TEMPLATES) as TemplateKey[],
    required: ({ task }) => !task || isSandboxTask(task),
    promptType: (_, { task }) => isSandboxTask(task),
  },
  // // TODO -- feature flags
  // sandboxDir: {
  //   type: 'string',
  //   description: 'What is the name of the directory the sandbox runs in?',
  //   promptType: false,
  // },
  addon: {
    type: 'string[]',
    description: 'Which extra addons (beyond the CLI defaults) would you like installed?',
    values: extraAddons,
    promptType: (_, { task }) => isSandboxTask(task),
  },
  link: {
    type: 'boolean',
    description: 'Build code and link for local development?',
    inverse: true,
    promptType: false,
  },
  prod: {
    type: 'boolean',
    description: 'Build code for production',
    promptType: false,
  },
  dryRun: {
    type: 'boolean',
    description: "Don't execute commands, just list them (dry run)?",
    promptType: false,
  },
  debug: {
    type: 'boolean',
    description: 'Print all the logs to the console',
    promptType: false,
  },
  junit: {
    type: 'boolean',
    description: 'Store results in junit format?',
    promptType: false,
  },
  skipTemplateStories: {
    type: 'boolean',
    description: 'Do not include template stories and their addons',
    promptType: false,
  },
  disableDocs: {
    type: 'boolean',
    description: 'Disable addon-docs from essentials',
    promptType: false,
  },
});

type PassedOptionValues = Omit<OptionValues<typeof options>, 'task' | 'startFrom' | 'junit'>;

const logger = console;

function getJunitFilename(taskKey: TaskKey) {
  return join(JUNIT_DIRECTORY, `${taskKey}.xml`);
}

async function writeJunitXml(
  taskKey: TaskKey,
  templateKey: TemplateKey,
  startTime: Date,
  err?: Error,
  systemError?: boolean
) {
  let errorData = {};
  if (err) {
    // we want to distinguish whether the error comes from the tests we are running or from arbitrary code
    errorData = systemError ? { errors: [{ message: err.stack }] } : { errors: [err] };
  }

  const name = `${taskKey} - ${templateKey}`;
  const time = (Date.now() - +startTime) / 1000;
  const testCase = { name, assertions: 1, time, ...errorData };
  // We store the metadata as a system-err.
  // Which is a bit unfortunate but it seems that one can't store extra data when the task is successful.
  // system-err won't turn the whole test suite as failing, which makes it a reasonable candidate
  const metadata: TestCase = {
    name: `${name} - metadata`,
    systemErr: [JSON.stringify({ ...TEMPLATES[templateKey], id: templateKey, version })],
  };
  const suite = { name, timestamp: startTime, time, testCases: [testCase, metadata] };
  const junitXml = getJunitXml({ time, name, suites: [suite] });
  const path = getJunitFilename(taskKey);
  await outputFile(path, junitXml);
  logger.log(`Test results written to ${resolve(path)}`);
}

function getTaskKey(task: Task): TaskKey {
  return (Object.entries(tasks) as [TaskKey, Task][]).find(([_, t]) => t === task)[0];
}

/**
 *
 * Get a list of tasks that need to be (possibly) run, in order, to
 * be able to run `finalTask`.
 */
function getTaskList(finalTask: Task, details: TemplateDetails, optionValues: PassedOptionValues) {
  const taskDeps = new Map<Task, Task[]>();
  // Which tasks depend on a given task
  const tasksThatDepend = new Map<Task, Task[]>();

  const addTask = (task: Task, dependent?: Task) => {
    if (tasksThatDepend.has(task)) {
      if (!dependent) throw new Error('Unexpected task without dependent seen a second time');
      tasksThatDepend.set(task, tasksThatDepend.get(task).concat(dependent));
      return;
    }

    // This is the first time we've seen this task
    tasksThatDepend.set(task, dependent ? [dependent] : []);

    const dependedTaskNames =
      typeof task.dependsOn === 'function'
        ? task.dependsOn(details, optionValues)
        : task.dependsOn || [];
    const dependedTasks = dependedTaskNames.map((n) => tasks[n]);
    taskDeps.set(task, dependedTasks);

    dependedTasks.forEach((t) => addTask(t, task));
  };
  addTask(finalTask);

  // We need to sort the tasks topologically so we run each task before the tasks that
  // depend on it. This is Kahn's algorithm :shrug:
  const sortedTasks = [] as Task[];
  const tasksWithoutDependencies = [finalTask];

  while (taskDeps.size !== sortedTasks.length) {
    const task = tasksWithoutDependencies.pop();
    if (!task) throw new Error('Topological sort failed, is there a cyclic task dependency?');

    sortedTasks.unshift(task);
    taskDeps.get(task).forEach((depTask) => {
      const remainingTasksThatDepend = tasksThatDepend
        .get(depTask)
        .filter((t) => !sortedTasks.includes(t));
      if (remainingTasksThatDepend.length === 0) tasksWithoutDependencies.push(depTask);
    });
  }

  return { sortedTasks, tasksThatDepend };
}

type TaskStatus =
  | 'ready'
  | 'unready'
  | 'running'
  | 'complete'
  | 'failed'
  | 'serving'
  | 'notserving';
const statusToEmoji: Record<TaskStatus, string> = {
  ready: '🟢',
  unready: '🟡',
  running: '🔄',
  complete: '✅',
  failed: '❌',
  serving: '🔊',
  notserving: '🔇',
};
function writeTaskList(statusMap: Map<Task, TaskStatus>) {
  logger.info(
    [...statusMap.entries()]
      .map(([task, status]) => `${statusToEmoji[status]} ${getTaskKey(task)}`)
      .join(' > ')
  );
  logger.info();
}

async function runTask(task: Task, details: TemplateDetails, optionValues: PassedOptionValues) {
  const { junitFilename } = details;
  const startTime = new Date();
  try {
    let updatedOptions = optionValues;
    if (details.template?.modifications?.skipTemplateStories) {
      updatedOptions = { ...updatedOptions, skipTemplateStories: true };
    }
    if (details.template?.modifications?.disableDocs) {
      updatedOptions = { ...updatedOptions, disableDocs: true };
    }
    const controller = await task.run(details, updatedOptions);

    if (junitFilename && !task.junit) await writeJunitXml(getTaskKey(task), details.key, startTime);

    return controller;
  } catch (err) {
    invariant(err instanceof Error);
    const hasJunitFile = await pathExists(junitFilename);
    // If there's a non-test related error (junit report has not been reported already), we report the general failure in a junit report
    if (junitFilename && !hasJunitFile) {
      await writeJunitXml(getTaskKey(task), details.key, startTime, err, true);
    }

    throw err;
  } finally {
    if (await pathExists(junitFilename)) {
      const junitXml = await (await readFile(junitFilename)).toString();
      const prefixedXml = junitXml.replace(/classname="(.*)"/g, `classname="${details.key} $1"`);
      await outputFile(junitFilename, prefixedXml);
    }
  }
}

const controllers: AbortController[] = [];

async function run() {
  // useful for other scripts to know whether they're running in the creation of a sandbox in the monorepo
  process.env.IN_STORYBOOK_SANDBOX = 'true';

  const allOptionValues = await getOptionsOrPrompt('yarn task', options);

  const { task: taskKey, startFrom, junit, ...optionValues } = allOptionValues;

  const finalTask = tasks[taskKey];
  const { template: templateKey } = optionValues;
  const template = TEMPLATES[templateKey];

  const templateSandboxDir = templateKey && join(sandboxDir, templateKey.replace('/', '-'));
  const details: TemplateDetails = {
    key: templateKey,
    template,
    codeDir: CODE_DIRECTORY,
    selectedTask: taskKey,
    sandboxDir: templateSandboxDir,
    builtSandboxDir: templateKey && join(templateSandboxDir, 'storybook-static'),
    junitFilename: junit && getJunitFilename(taskKey),
  };

  const { sortedTasks, tasksThatDepend } = getTaskList(finalTask, details, optionValues);
  const sortedTasksReady = await Promise.all(
    sortedTasks.map((t) => t.ready(details, optionValues))
  );

  if (templateKey) {
    logger.info(`👉 Selected sandbox: ${templateKey}`);
    logger.info();
  }

  logger.info(`Task readiness up to ${taskKey}`);
  const initialTaskStatus = (task: Task, ready: boolean) => {
    if (task.service) {
      return ready ? 'serving' : 'notserving';
    }
    return ready ? 'ready' : 'unready';
  };
  const statuses = new Map<Task, TaskStatus>(
    sortedTasks.map((task, index) => [task, initialTaskStatus(task, sortedTasksReady[index])])
  );
  writeTaskList(statuses);

  function setUnready(task: Task) {
    // If the task is a service we don't need to set it unready but we still need to do so for
    // it's dependencies
    if (!task.service) statuses.set(task, 'unready');
    tasksThatDepend
      .get(task)
      .filter((t) => !t.service)
      .forEach(setUnready);
  }

  // NOTE: we don't include services in the first unready task. We only need to rewind back to a
  // service if the user explicitly asks. It's expected that a service is no longer running.
  const firstUnready = sortedTasks.find((task) => statuses.get(task) === 'unready');
  if (startFrom === 'auto') {
    // Don't reset anything!
  } else if (startFrom === 'never') {
    if (!firstUnready) throw new Error(`Task ${taskKey} is ready`);
    if (firstUnready !== finalTask)
      throw new Error(`Task ${getTaskKey(firstUnready)} was not ready`);
  } else if (startFrom) {
    // set to reset back to a specific task
    if (firstUnready && sortedTasks.indexOf(tasks[startFrom]) > sortedTasks.indexOf(firstUnready)) {
      throw new Error(
        `Task ${getTaskKey(firstUnready)} was not ready, earlier than your request ${startFrom}.`
      );
    }
    setUnready(tasks[startFrom]);
  } else if (firstUnready === sortedTasks[0]) {
    // We need to do everything, no need to change anything
  } else if (sortedTasks.length === 1) {
    setUnready(sortedTasks[0]);
  } else {
    // We don't know what to do! Let's ask
    const { startFromTask } = await prompt(
      {
        type: 'select',
        message: firstUnready
          ? `We need to run all tasks from ${getTaskKey(
              firstUnready
            )} onwards, would you like to start from an earlier task?`
          : `Which task would you like to start from?`,
        name: 'startFromTask',
        choices: sortedTasks
          .slice(0, firstUnready && sortedTasks.indexOf(firstUnready) + 1)
          .reverse()
          .map((t) => ({
            title: `${t.description} (${getTaskKey(t)})`,
            value: t,
          })),
      },
      {
        onCancel: () => {
          logger.log('Command cancelled by the user. Exiting...');
          process.exit(1);
        },
      }
    );
    setUnready(startFromTask);
  }

  for (let i = 0; i < sortedTasks.length; i += 1) {
    const task = sortedTasks[i];
    const status = statuses.get(task);

    let shouldRun = status === 'unready';
    if (status === 'notserving') {
      shouldRun =
        finalTask === task ||
        !!tasksThatDepend.get(task).find((t) => statuses.get(t) === 'unready');
    }

    if (shouldRun) {
      statuses.set(task, 'running');
      writeTaskList(statuses);

      try {
        const controller = await runTask(task, details, {
          ...optionValues,
          // Always debug the final task so we can see it's output fully
          debug: task === finalTask ? true : optionValues.debug,
        });
        if (controller) controllers.push(controller);
      } catch (err) {
        invariant(err instanceof Error);
        logger.error(`Error running task ${getTaskKey(task)}:`);
        logger.error(JSON.stringify(err, null, 2));

        if (process.env.CI) {
          logger.error(
            dedent`
              To reproduce this error locally, run:

              ${getCommand('yarn task', options, {
                ...allOptionValues,
                link: true,
                startFrom: 'auto',
              })}
              
              Note this uses locally linking which in rare cases behaves differently to CI. For a closer match, run:
              
              ${getCommand('yarn task', options, {
                ...allOptionValues,
                startFrom: 'auto',
              })}`
          );
        }

        controllers.forEach((controller) => {
          controller.abort();
        });

        throw err;
      }
      statuses.set(task, task.service ? 'serving' : 'complete');

      // If the task is a service, we want to stay open until we are ctrl-ced
      if (sortedTasks[i] === finalTask && finalTask.service) {
        await new Promise(() => {});
      }
    }
  }

  return 0;
}

process.on('exit', () => {
  // Make sure to kill any running tasks 🎉
  controllers.forEach((controller) => {
    controller.abort();
  });
});

run()
  .then((status) => process.exit(status))
  .catch((err) => {
    logger.error();
    logger.error(err);
    process.exit(1);
  });

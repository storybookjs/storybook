// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { logTracker } from './prompts/log-tracker';
import { spinner, taskLog } from './prompts/prompt-functions';

/**
 * Given a function that returns a child process or array of functions that return child processes,
 * this function will execute them sequentially and display the output in a task log.
 */
export const executeTask = async (
  childProcessFactories: (() => ExecaChildProcess) | (() => ExecaChildProcess)[],
  {
    intro,
    error,
    success,
    limitLines = 4,
  }: { intro: string; error: string; success: string; limitLines?: number }
) => {
  logTracker.addLog('info', intro);
  const task = taskLog({
    title: intro,
    retainLog: false,
    limit: limitLines,
  });

  const factories = Array.isArray(childProcessFactories)
    ? childProcessFactories
    : [childProcessFactories];

  try {
    for (const factory of factories) {
      const childProcess = factory();
      childProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        logTracker.addLog('info', message);
        task.message(message);
      });
      await childProcess;
    }
    logTracker.addLog('info', success);
    task.success(success);
  } catch (err) {
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    task.error(error);
    throw err;
  }
};

export const executeTaskWithSpinner = async (
  childProcessFactories: (() => ExecaChildProcess) | (() => ExecaChildProcess)[],
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  const task = spinner();
  task.start(intro);

  const factories = Array.isArray(childProcessFactories)
    ? childProcessFactories
    : [childProcessFactories];

  try {
    for (const factory of factories) {
      const childProcess = factory();
      childProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim().slice(0, 25);
        logTracker.addLog('info', `${intro}: ${data.toString()}`);
        task.message(`${intro}: ${message}`);
      });
      await childProcess;
    }
    logTracker.addLog('info', success);
    task.stop(success);
  } catch (err) {
    logTracker.addLog('error', error, { error: err });
    task.stop(error);
    throw err;
  }
};

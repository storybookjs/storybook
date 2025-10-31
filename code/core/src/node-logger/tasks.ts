// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { CLI_COLORS, log } from './logger';
import { logTracker } from './logger/log-tracker';
import { spinner } from './prompts/prompt-functions';

/**
 * Given a function that returns a child process or array of functions that return child processes,
 * this function will execute them sequentially and display the output in a task log.
 */
export const executeTask = async (
  childProcessFactories: (() => ExecaChildProcess) | (() => ExecaChildProcess)[],
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  log(intro);

  const factories = Array.isArray(childProcessFactories)
    ? childProcessFactories
    : [childProcessFactories];

  try {
    for (const factory of factories) {
      const childProcess = factory();
      childProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        logTracker.addLog('info', message);
        log(message);
      });
      await childProcess;
    }
    logTracker.addLog('info', success);
    log(CLI_COLORS.success(success));
  } catch (err: any) {
    if (err.message.includes('Command was killed with SIGINT')) {
      log(CLI_COLORS.error(`${intro} aborted`));
      return;
    }
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    log(CLI_COLORS.error(String((err as any).message ?? err)));
    throw err;
  }
};

export const executeTaskWithSpinner = async (
  childProcessFactories: (() => ExecaChildProcess) | (() => ExecaChildProcess)[],
  { id, intro, error, success }: { id: string; intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  const task = spinner({ id });
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
  } catch (err: any) {
    if (err.message.includes('Command was killed with SIGINT')) {
      task.stop(`${intro} aborted`);
      return;
    }
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    task.stop(String((err as any).message ?? err));
    throw err;
  }
};

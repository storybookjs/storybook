import * as clack from '@clack/prompts';
// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { logTracker } from './log-tracker';

/**
 * Given a callback that returns a child process, this function will execute the function and
 * display the output in a task log.
 */
export const executeTask = async (
  childProcess: ExecaChildProcess,
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  const task = clack.taskLog({
    title: intro,
    retainLog: false,
    limit: 10,
  });
  try {
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      logTracker.addLog('info', message);
      task.message(message);
    });
    await childProcess;
    logTracker.addLog('info', success);
    task.success(success);
  } catch (err) {
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    task.error(error);
    throw err;
  }
};

// TODO: Discuss whether we want this given that we already have "executeTask" above
export const executeTaskWithSpinner = async (
  childProcess: ExecaChildProcess,
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  const task = clack.spinner();
  task.start(intro);
  try {
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim().slice(0, 25);
      logTracker.addLog('info', `${intro}: ${data.toString()}`);
      task.message(`${intro}: ${message}`);
    });
    await childProcess;
    logTracker.addLog('info', success);
    task.stop(success);
  } catch (err) {
    logTracker.addLog('error', error, { error: err });
    task.stop(error);
    throw err;
  }
};

// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { CLI_COLORS, log } from './logger';
import { logTracker } from './logger/log-tracker';
import { spinner } from './prompts/prompt-functions';

type ChildProcessFactory = (signal?: AbortSignal) => ExecaChildProcess;

interface SetupAbortControllerResult {
  abortController: AbortController;
  cleanup: () => void;
}

function setupAbortController(): SetupAbortControllerResult {
  const abortController = new AbortController();
  let isRawMode = false;
  const wasRawMode = process.stdin.isRaw;

  const onKeyPress = (chunk: Buffer) => {
    const key = chunk.toString();
    if (key === 'c' || key === 'C') {
      abortController.abort();
    }
  };

  const cleanup = () => {
    if (isRawMode) {
      process.stdin.setRawMode(wasRawMode ?? false);
      process.stdin.removeListener('data', onKeyPress);
      if (!wasRawMode) {
        process.stdin.pause();
      }
    }
  };

  // Set up stdin in raw mode to capture single keypresses
  if (process.stdin.isTTY) {
    try {
      isRawMode = true;
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onKeyPress);
    } catch {
      isRawMode = false;
    }
  }

  return { abortController, cleanup };
}

/**
 * Given a function that returns a child process or array of functions that return child processes,
 * this function will execute them sequentially and display the output in a task log.
 */
export const executeTask = async (
  childProcessFactories: ChildProcessFactory | ChildProcessFactory[],
  {
    intro,
    error,
    success,
    abortable = false,
  }: { intro: string; error: string; success: string; abortable?: boolean }
) => {
  logTracker.addLog('info', intro);
  log(intro);

  let abortController: AbortController | undefined;
  let cleanup: (() => void) | undefined;

  if (abortable) {
    const result = setupAbortController();
    abortController = result.abortController;
    cleanup = result.cleanup;
  }

  const factories = Array.isArray(childProcessFactories)
    ? childProcessFactories
    : [childProcessFactories];

  try {
    for (const factory of factories) {
      const childProcess = factory(abortController?.signal);
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
    const isAborted =
      abortController?.signal.aborted ||
      err.message?.includes('Command was killed with SIGINT') ||
      err.message?.includes('The operation was aborted');

    if (isAborted) {
      logTracker.addLog('info', `${intro} aborted`);
      log(CLI_COLORS.error(`${intro} aborted`));
      return;
    }
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    log(CLI_COLORS.error(String((err as any).message ?? err)));
    throw err;
  } finally {
    cleanup?.();
  }
};

export const executeTaskWithSpinner = async (
  childProcessFactories: ChildProcessFactory | ChildProcessFactory[],
  {
    id,
    intro,
    error,
    success,
    abortable = false,
  }: { id: string; intro: string; error: string; success: string; abortable?: boolean }
) => {
  logTracker.addLog('info', intro);

  let abortController: AbortController | undefined;
  let cleanup: (() => void) | undefined;

  if (abortable) {
    const result = setupAbortController();
    abortController = result.abortController;
    cleanup = result.cleanup;
  }

  const task = spinner({ id });
  task.start(intro);

  const factories = Array.isArray(childProcessFactories)
    ? childProcessFactories
    : [childProcessFactories];

  try {
    for (const factory of factories) {
      const childProcess = factory(abortController?.signal);
      childProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim().slice(0, 25);
        logTracker.addLog('info', `${intro}: ${data.toString()}`);
        task.message(`${intro}: ${message}`);
      });
      await childProcess;
    }
    logTracker.addLog('info', success);
    task.cancel(success);
  } catch (err: any) {
    const isAborted =
      abortController?.signal.aborted ||
      err.message?.includes('Command was killed with SIGINT') ||
      err.message?.includes('The operation was aborted');

    if (isAborted) {
      logTracker.addLog('info', `${intro} aborted`);
      task.cancel(CLI_COLORS.warning(`${intro} aborted`));
      return;
    }
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('error', error, { error: errorMessage });
    task.error(CLI_COLORS.error(error));
    throw err;
  } finally {
    cleanup?.();
  }
};

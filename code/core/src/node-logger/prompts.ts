import * as clack from '@clack/prompts';
import boxen from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';

import { type LogEntry, logTracker } from './logTracker';

type Primitive = Readonly<string | boolean | number>;

type Option<T> = T extends Primitive
  ? {
      value: T;
      label?: string;
      hint?: string;
    }
  : {
      value: T;
      label: string;
      hint?: string;
    };

interface BasePromptOptions {
  message: string;
}

interface TextPromptOptions extends BasePromptOptions {
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | Error | undefined;
}

interface ConfirmPromptOptions extends BasePromptOptions {
  initialValue?: boolean;
  active?: string;
  inactive?: string;
}

interface SelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
}

interface MultiSelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
  required?: boolean;
}

interface PromptOptions {
  onCancel?: () => void;
}

const handleCancel = (result: unknown | symbol, promptOptions?: PromptOptions) => {
  if (clack.isCancel(result)) {
    if (promptOptions?.onCancel) {
      promptOptions.onCancel();
    } else {
      clack.cancel('Operation canceled.');
      process.exit(0);
    }
  }
};

const text = async (options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> => {
  const result = await clack.text(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result.toString();
};

const confirm = async (
  options: ConfirmPromptOptions,
  promptOptions?: PromptOptions
): Promise<boolean> => {
  const result = await clack.confirm(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return Boolean(result);
};

const select = async <T>(
  options: SelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T> => {
  const result = await clack.select<T>(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result as T;
};

const multiselect = async <T>(
  options: MultiSelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T[]> => {
  const result = await clack.multiselect<T>(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result as T[];
};

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

const logBox = (message: string, style?: BoxenOptions) => {
  logTracker.addLog('info', message);
  console.log(
    boxen(message, {
      borderStyle: 'round',
      padding: 1,
      // borderColor: '#F1618C',
      borderColor: '#5c5c63',
      ...style,
    })
      .replace(/╭/, '├')
      .replace(/╰/, '├')
  );
};

const log = (message: string) => {
  logTracker.addLog('info', message);
  clack.log.message(message);
};

const warn = (message: string) => {
  logTracker.addLog('warn', message);
  clack.log.warn(message);
};

const error = (message: string) => {
  logTracker.addLog('error', message);
  clack.log.error(message);
};

const spinner = clack.spinner;

/**
 * Given a callback that returns a child process, this function will execute the function and
 * display the output in a task log.
 */
const executeTask = async (
  fn: () => ExecaChildProcess,
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('task', intro);
  const task = clack.taskLog({
    title: intro,
    retainLog: false,
    limit: 10,
  });
  try {
    const childProcess = fn();
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      logTracker.addLog('task', message);
      task.message(message);
    });
    await childProcess;
    logTracker.addLog('task', success);
    task.success(success);
  } catch (err) {
    const errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    logTracker.addLog('task', error, { error: errorMessage });
    task.error(error);
    throw err;
  }
};

// TODO: Discuss whether we want this given that we already have "executeTask" above
const executeTaskWithSpinner = async (
  fn: () => ExecaChildProcess,
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('task', intro);
  const task = spinner();
  task.start(intro);
  try {
    const childProcess = fn();
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString().trim().slice(0, 25);
      logTracker.addLog('task', `${intro}: ${data.toString()}`);
      task.message(`${intro}: ${message}`);
    });
    await childProcess;
    logTracker.addLog('task', success);
    task.stop(success);
  } catch (err) {
    logTracker.addLog('task', error, { error: err });
    task.stop(error);
    throw err;
  }
};

export const writeLogsToFile = async (filePath: string): Promise<void> => {
  await logTracker.writeToFile(filePath);
};

export const getTrackedLogs = (): LogEntry[] => {
  return logTracker.getLogs();
};

export const clearTrackedLogs = (): void => {
  logTracker.clear();
};

export const prompt = {
  spinner,
  confirm,
  text,
  select,
  multiselect,
  logBox,
  log,
  warn,
  error,
  executeTask,
  executeTaskWithSpinner,
  writeLogsToFile,
  getTrackedLogs,
  clearTrackedLogs,
};

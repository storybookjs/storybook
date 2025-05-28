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

function getMinimalTrace() {
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  const stack = new Error().stack;

  if (!stack) {
    return;
  }

  // remove the first line ("Error")
  const lines = stack.split('\n').slice(1);

  // Clean up stack: remove this own file utilities from the stack
  const userStackLines = lines.filter(
    (line) => !['getMinimalTrace', 'createLogger', 'logFunction'].some((fn) => line.includes(fn))
  );

  if (userStackLines.length === 0) {
    return;
  }

  const callStack = '\n' + userStackLines.slice(0, 2).join('\n');

  return callStack;
}

// Log level types and state
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

let currentLogLevel: LogLevel = 'info';

const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
};

// Higher-level abstraction for creating logging functions
function createLogger(
  level: LogLevel | 'prompt',
  logFn: (message: string) => void,
  prefix?: string
) {
  return function logFunction(message: string) {
    logTracker.addLog(level, message);

    if (level === 'prompt') {
      level = 'info';
    }
    if (shouldLog(level)) {
      const formattedMessage = prefix ? `${prefix} ${message}` : message;
      logFn(formattedMessage);
    }
  };
}

// Create all logging functions using the factory
const debug = createLogger(
  'debug',
  function logFunction(message) {
    if (shouldLog('trace')) {
      message += getMinimalTrace();
    }
    clack.log.message(message);
  },
  '[DEBUG]'
);
const log = createLogger('info', clack.log.message);
const warn = createLogger('warn', clack.log.warn);
const error = createLogger('error', clack.log.error);

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

const logBox = (message: string, style?: BoxenOptions) => {
  if (shouldLog('info')) {
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
  }
};

// prompts

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

const spinner = clack.spinner;

/**
 * Given a callback that returns a child process, this function will execute the function and
 * display the output in a task log.
 */
const executeTask = async (
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
const executeTaskWithSpinner = async (
  childProcess: ExecaChildProcess,
  { intro, error, success }: { intro: string; error: string; success: string }
) => {
  logTracker.addLog('info', intro);
  const task = spinner();
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

export const writeLogsToFile = async (filePath: string): Promise<void> => {
  await logTracker.writeToFile(filePath);
};

export const getTrackedLogs = (): LogEntry[] => {
  return logTracker.getLogs();
};

export const clearTrackedLogs = (): void => {
  logTracker.clear();
};

// TODO: de-clack the type
export const taskLog = (options: clack.TaskLogOptions) => {
  return clack.taskLog(options);
};

export const intro = (message: string) => {
  logTracker.addLog('info', message);
  clack.intro(message);
};

export const prompt = {
  spinner,
  confirm,
  intro,
  text,
  select,
  multiselect,
  logBox,
  log,
  warn,
  error,
  debug,
  taskLog,
  executeTask,
  executeTaskWithSpinner,
  writeLogsToFile,
  getTrackedLogs,
  clearTrackedLogs,
  setLogLevel,
  getLogLevel,
};

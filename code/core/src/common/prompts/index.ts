import boxen from 'boxen';
import prompts from 'prompts';

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

type Option = {
  value: any;
  label: string;
  hint?: string;
};

interface BasePromptOptions {
  message: string;
}

interface TextPromptOptions extends BasePromptOptions {
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | boolean | Promise<string | boolean>;
}

interface ConfirmPromptOptions extends BasePromptOptions {
  initialValue?: boolean;
  active?: string;
  inactive?: string;
}

interface SelectPromptOptions extends BasePromptOptions {
  options: Option[];
}

interface MultiSelectPromptOptions extends BasePromptOptions {
  options: Option[];
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

const baseOptions: PromptOptions = {
  onCancel: () => process.exit(0),
};

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
function createLogger(level: LogLevel, logFn: (message: string) => void, prefix?: string) {
  return function logFunction(message: string) {
    if (shouldLog(level)) {
      const formattedMessage = prefix ? `${prefix} ${message}` : message;
      logFn(formattedMessage);
    }
  };
}

// Create all logging functions using the factory
const trace = createLogger('trace', console.trace, '[TRACE]');
const debug = createLogger(
  'debug',
  function logFunction(message) {
    const trace = getMinimalTrace();
    console.log(message, trace);
  },
  '[DEBUG]'
);
const log = createLogger('info', console.log);
const warn = createLogger('warn', console.warn);
const error = createLogger('error', console.error);

// Special case for logBox since it has different parameters
const logBox = (message: string, style?: BoxenOptions) => {
  if (shouldLog('info')) {
    console.log(
      boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style })
    );
  }
};

const text = async (options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> => {
  const result = await prompts(
    {
      type: 'text',
      name: 'value',
      message: options.message,
      initial: options.initialValue,
      validate: options.validate,
    },
    { ...baseOptions, ...promptOptions }
  );

  return result.value;
};

const confirm = async (
  options: ConfirmPromptOptions,
  promptOptions?: PromptOptions
): Promise<boolean> => {
  const result = await prompts(
    {
      type: 'confirm',
      name: 'value',
      message: options.message,
      initial: options.initialValue,
      active: options.active,
      inactive: options.inactive,
    },
    { ...baseOptions, ...promptOptions }
  );

  return result.value;
};

const select = async <T>(
  options: SelectPromptOptions,
  promptOptions?: PromptOptions
): Promise<T> => {
  const result = await prompts(
    {
      type: 'select',
      name: 'value',
      message: options.message,
      choices: options.options.map((opt) => ({
        title: opt.label,
        value: opt.value,
        description: opt.hint,
      })),
    },
    { ...baseOptions, ...promptOptions }
  );

  return result.value as T;
};

const multiselect = async <T extends string | number>(
  options: MultiSelectPromptOptions,
  promptOptions?: PromptOptions
): Promise<T[]> => {
  const result = await prompts(
    {
      type: 'multiselect',
      name: 'value',
      message: options.message,
      choices: options.options.map((opt) => ({
        title: opt.label,
        value: opt.value,
        description: opt.hint,
      })),
    },
    promptOptions
  );
  return result.value as T[];
};

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

export const prompt = {
  confirm,
  text,
  select,
  multiselect,
  logBox,
  log,
  warn,
  error,
  trace,
  debug,
  setLogLevel,
  getLogLevel,
};

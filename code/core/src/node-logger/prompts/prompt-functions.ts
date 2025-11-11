import { wrapTextForClack, wrapTextForClackHint } from '../wrap-utils';
import { getPromptProvider } from './prompt-config';
import type {
  BasePromptOptions,
  ConfirmPromptOptions,
  MultiSelectPromptOptions,
  Option,
  PromptOptions,
  SelectPromptOptions,
  SpinnerInstance,
  SpinnerOptions,
  TaskLogInstance,
  TaskLogOptions,
  TextPromptOptions,
} from './prompt-provider-base';

// Re-export types for convenience
export type {
  Option,
  BasePromptOptions,
  TextPromptOptions,
  ConfirmPromptOptions,
  SelectPromptOptions,
  MultiSelectPromptOptions,
  PromptOptions,
  SpinnerInstance,
  TaskLogInstance,
  TaskLogOptions,
};

// Global state for tracking active spinners and task logs
let activeSpinner: SpinnerInstance | null = null;
let activeTaskLog: TaskLogInstance | null = null;
let originalConsoleLog: typeof console.log | null = null;

// Console.log patching functions
const patchConsoleLog = () => {
  if (!originalConsoleLog) {
    originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      const message = args
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');

      if (activeTaskLog) {
        activeTaskLog.message(message);
      } else if (activeSpinner) {
        activeSpinner.message(message);
      } else {
        originalConsoleLog!(...args);
      }
    };
  }
};

const restoreConsoleLog = () => {
  if (originalConsoleLog && !activeSpinner && !activeTaskLog) {
    console.log = originalConsoleLog;
    originalConsoleLog = null;
  }
};

export const text = async (
  options: TextPromptOptions,
  promptOptions?: PromptOptions
): Promise<string> => {
  return getPromptProvider().text(options, promptOptions);
};

export const confirm = async (
  options: ConfirmPromptOptions,
  promptOptions?: PromptOptions
): Promise<boolean> => {
  return getPromptProvider().confirm(options, promptOptions);
};

export const select = async <T>(
  options: SelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T> => {
  return getPromptProvider().select(options, promptOptions);
};

export const multiselect = async <T>(
  options: MultiSelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T[]> => {
  return getPromptProvider().multiselect(
    {
      ...options,
      options: options.options.map((opt) => ({
        ...opt,
        hint: opt.hint
          ? wrapTextForClackHint(opt.hint, undefined, opt.label || String(opt.value))
          : undefined,
      })),
    },
    promptOptions
  );
};

export const spinner = (options: SpinnerOptions): SpinnerInstance => {
  const spinnerInstance = getPromptProvider().spinner(options);

  // Wrap the spinner methods to handle console.log patching
  const wrappedSpinner: SpinnerInstance = {
    start: (message?: string) => {
      activeSpinner = wrappedSpinner;
      patchConsoleLog();
      spinnerInstance.start(message);
    },
    stop: (message?: string) => {
      activeSpinner = null;
      restoreConsoleLog();
      spinnerInstance.stop(message);
    },
    message: (text: string) => {
      spinnerInstance.message(text);
    },
  };

  return wrappedSpinner;
};

export const taskLog = (options: TaskLogOptions): TaskLogInstance => {
  const task = getPromptProvider().taskLog(options);

  // Wrap the task log methods to handle console.log patching
  const wrappedTaskLog: TaskLogInstance = {
    message: (message: string) => {
      task.message(wrapTextForClack(message));
    },
    success: (message: string, options?: { showLog?: boolean }) => {
      activeTaskLog = null;
      restoreConsoleLog();
      task.success(message, options);
    },
    error: (message: string) => {
      activeTaskLog = null;
      restoreConsoleLog();
      task.error(message);
    },
  };

  // Activate console.log patching when task log is created
  activeTaskLog = wrappedTaskLog;
  patchConsoleLog();

  return wrappedTaskLog;
};

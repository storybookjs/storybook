import { error, log, shouldLog } from '../logger';
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

const isInteractiveTerminal = () => {
  return process.stdout.isTTY && process.stdin.isTTY && !process.env.CI;
};

// Console.log patching functions
const patchConsoleLog = () => {
  if (!originalConsoleLog) {
    originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      const message = args
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' ');

      if (activeTaskLog) {
        if (shouldLog('info')) {
          activeTaskLog.message(message);
        }
      } else if (activeSpinner) {
        if (shouldLog('info')) {
          activeSpinner.message(message);
        }
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
          ? wrapTextForClackHint(opt.hint, undefined, opt.label || String(opt.value), 0)
          : undefined,
      })),
    },
    promptOptions
  );
};

export const spinner = (options: SpinnerOptions): SpinnerInstance => {
  if (isInteractiveTerminal()) {
    const spinnerInstance = getPromptProvider().spinner(options);

    // Wrap the spinner methods to handle console.log patching
    const wrappedSpinner: SpinnerInstance = {
      start: (message?: string) => {
        activeSpinner = wrappedSpinner;
        patchConsoleLog();
        if (shouldLog('info')) {
          spinnerInstance.start(message);
        }
      },
      stop: (message?: string) => {
        activeSpinner = null;
        restoreConsoleLog();
        if (shouldLog('info')) {
          spinnerInstance.stop(message);
        }
      },
      cancel: (message?: string) => {
        activeSpinner = null;
        restoreConsoleLog();
        if (shouldLog('info')) {
          spinnerInstance.cancel(message);
        }
      },
      error: (message?: string) => {
        activeSpinner = null;
        restoreConsoleLog();
        if (shouldLog('error')) {
          spinnerInstance.error(message);
        }
      },
      message: (text: string) => {
        if (shouldLog('info')) {
          spinnerInstance.message(text);
        }
      },
    };

    return wrappedSpinner;
  } else {
    const maybeLog = shouldLog('info') ? log : (_: string) => {};

    return {
      start: (message) => {
        if (message) {
          maybeLog(message);
        }
      },
      stop: (message) => {
        if (message) {
          maybeLog(message);
        }
      },
      cancel: (message) => {
        if (message) {
          maybeLog(message);
        }
      },
      error: (message) => {
        if (message) {
          if (shouldLog('error')) {
            error(message);
          }
        }
      },
      message: (message) => {
        maybeLog(message);
      },
    };
  }
};

export const taskLog = (options: TaskLogOptions): TaskLogInstance => {
  if (isInteractiveTerminal() && shouldLog('info')) {
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
      group: function (title: string) {
        this.message(`\n${title}\n`);
        return {
          message: (message: string) => {
            task.message(wrapTextForClack(message));
          },
          success: (message: string) => {
            task.success(message);
          },
          error: (message: string) => {
            task.error(message);
          },
        };
      },
    };

    // Activate console.log patching when task log is created
    activeTaskLog = wrappedTaskLog;
    patchConsoleLog();

    return wrappedTaskLog;
  } else {
    const maybeLog = shouldLog('info') ? log : (_: string) => {};

    return {
      message: (message: string) => {
        maybeLog(message);
      },
      success: (message: string) => {
        maybeLog(message);
      },
      error: (message: string) => {
        maybeLog(message);
      },
      group: (title: string) => {
        maybeLog(`\n${title}\n`);
        return {
          message: (message: string) => {
            maybeLog(message);
          },
          success: (message: string) => {
            maybeLog(message);
          },
          error: (message: string) => {
            maybeLog(message);
          },
        };
      },
    };
  }
};

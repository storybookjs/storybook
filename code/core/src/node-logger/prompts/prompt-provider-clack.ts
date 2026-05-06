import * as clack from '@clack/prompts';

import { logTracker } from '../logger/log-tracker.ts';
import { wrapTextForClackHint } from '../wrap-utils.ts';
import type {
  ConfirmPromptOptions,
  MultiSelectPromptOptions,
  PromptOptions,
  SelectPromptOptions,
  SpinnerInstance,
  SpinnerOptions,
  TaskLogInstance,
  TaskLogOptions,
  TextPromptOptions,
} from './prompt-provider-base.ts';
import { PromptProvider } from './prompt-provider-base.ts';

export const getCurrentTaskLog = (): ReturnType<typeof clack.taskLog> | null => {
  if (globalThis.STORYBOOK_CURRENT_TASK_LOG) {
    return globalThis.STORYBOOK_CURRENT_TASK_LOG[globalThis.STORYBOOK_CURRENT_TASK_LOG.length - 1];
  } else {
    return null;
  }
};

const setCurrentTaskLog = (taskLog: any) => {
  globalThis.STORYBOOK_CURRENT_TASK_LOG = [
    ...(globalThis.STORYBOOK_CURRENT_TASK_LOG || []),
    taskLog,
  ];
};

const clearCurrentTaskLog = () => {
  if (globalThis.STORYBOOK_CURRENT_TASK_LOG) {
    globalThis.STORYBOOK_CURRENT_TASK_LOG.pop();
  }
};

/**
 * Detection state for stdout writes during a taskLog session.
 *
 * Clack's `taskLog` performs cursor-relative erases on every `.message()` (erase-and-redraw) and
 * on `.success()/.error()` (clear the title region). The erase math is computed only from clack's
 * own internal book-keeping, so any direct stdout writes that happen during the session
 * (`logger.logBox`, prompts, multi-line warnings) advance the cursor invisibly to clack and the
 * erase clobbers them. We can't reliably predict the right padding (clack's `.message()` itself
 * does erase-and-redraw, so naive newline counting massively overcounts), so instead we just
 * detect whether *any* untracked stdout write has happened. Once contaminated, every subsequent
 * call on this taskLog skips the erase path entirely and emits a plain `clack.log.*` line.
 */
let hasExternalStdoutWrite = false;
let inTrackedTaskLogWrite = false;
let originalStdoutWrite: typeof process.stdout.write | null = null;

const installStdoutHook = () => {
  if (originalStdoutWrite) {
    return;
  }
  const original = process.stdout.write.bind(process.stdout);
  originalStdoutWrite = original;
  process.stdout.write = ((chunk: any, ...rest: any[]) => {
    if (!inTrackedTaskLogWrite && !hasExternalStdoutWrite && chunk) {
      const length = typeof chunk === 'string' ? chunk.length : (chunk?.length ?? 0);
      if (length > 0) {
        hasExternalStdoutWrite = true;
      }
    }
    return (original as any)(chunk, ...rest);
  }) as typeof process.stdout.write;
};

const uninstallStdoutHook = () => {
  if (originalStdoutWrite) {
    process.stdout.write = originalStdoutWrite;
    originalStdoutWrite = null;
  }
};

const runTracked = <T>(fn: () => T): T => {
  const previous = inTrackedTaskLogWrite;
  inTrackedTaskLogWrite = true;
  try {
    return fn();
  } finally {
    inTrackedTaskLogWrite = previous;
  }
};

export class ClackPromptProvider extends PromptProvider {
  private handleCancel(result: unknown | symbol, promptOptions?: PromptOptions) {
    if (clack.isCancel(result)) {
      if (promptOptions?.onCancel) {
        promptOptions.onCancel();
      } else {
        clack.cancel('Operation canceled.');
        process.exit(0);
      }
    }
  }

  async text(options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> {
    const result = await clack.text(options);
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return result.toString();
  }

  async confirm(options: ConfirmPromptOptions, promptOptions?: PromptOptions): Promise<boolean> {
    const result = await clack.confirm({
      ...options,
      message: wrapTextForClackHint(options.message, undefined, undefined, 2),
    });
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return Boolean(result);
  }

  async select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T> {
    const result = await clack.select<T>({
      ...options,
      message: wrapTextForClackHint(options.message, undefined, undefined, 2),
    });
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return result as T;
  }

  async multiselect<T>(
    options: MultiSelectPromptOptions<T>,
    promptOptions?: PromptOptions
  ): Promise<T[]> {
    const result = await clack.multiselect<T>({
      ...options,
      required: options.required,
    });
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return result as T[];
  }

  spinner(options: SpinnerOptions): SpinnerInstance {
    const task = clack.spinner();
    const spinnerId = `${options.id}-spinner`;

    return {
      start: (message) => {
        logTracker.addLog('info', `${spinnerId}-start: ${message}`);
        task.start(message);
      },
      message: (message) => {
        logTracker.addLog('info', `${spinnerId}: ${message}`);
        task.message(message);
      },
      stop: (message) => {
        logTracker.addLog('info', `${spinnerId}-stop: ${message}`);
        task.stop(message);
      },
      cancel: (message) => {
        logTracker.addLog('info', `${spinnerId}-cancel: ${message}`);
        task.cancel(message);
      },
      error: (message) => {
        logTracker.addLog('error', `${spinnerId}-error: ${message}`);
        task.error(message);
      },
    };
  }

  taskLog(options: TaskLogOptions): TaskLogInstance {
    const isCurrentTaskActive = !!getCurrentTaskLog();
    const task = getCurrentTaskLog() || clack.taskLog(options);
    const taskId = `${options.id}-task`;
    logTracker.addLog('info', `${taskId}-start: ${options.title}`);

    // Only the root taskLog installs the stdout hook (nested calls reuse the parent's task).
    if (!isCurrentTaskActive) {
      hasExternalStdoutWrite = false;
      inTrackedTaskLogWrite = false;
      installStdoutHook();
    }

    const wrapped: TaskLogInstance = {
      message: (message) => {
        logTracker.addLog('info', `${taskId}: ${message}`);
        if (hasExternalStdoutWrite) {
          // Bypass task.message's erase-and-redraw once external writes have moved the cursor.
          clack.log.message(message);
        } else {
          runTracked(() => task.message(message));
        }
      },
      error: (message) => {
        logTracker.addLog('error', `${taskId}-error: ${message}`);
        const contaminated = hasExternalStdoutWrite;
        if (!isCurrentTaskActive) {
          uninstallStdoutHook();
          hasExternalStdoutWrite = false;
        }
        if (contaminated) {
          clack.log.error(message);
        } else {
          task.error(message, { showLog: true });
        }
        clearCurrentTaskLog();
      },
      success: (message, options) => {
        logTracker.addLog('info', `${taskId}-success: ${message}`);
        const contaminated = hasExternalStdoutWrite;
        if (!isCurrentTaskActive) {
          uninstallStdoutHook();
          hasExternalStdoutWrite = false;
        }
        if (!isCurrentTaskActive) {
          if (contaminated) {
            clack.log.success(message);
          } else {
            task.success(message, options);
          }
        }
        clearCurrentTaskLog();
      },
      group(title) {
        logTracker.addLog('info', `${taskId}-group: ${title}`);
        // If contamination has already occurred, don't even create a clack subtask: route
        // every message/success/error through plain clack.log.* which never erases.
        if (hasExternalStdoutWrite) {
          const stub = {
            message: (message: string) => {
              clack.log.message(message);
            },
            success: (message: string) => {
              clack.log.success(message);
              clearCurrentTaskLog();
            },
            error: (message: string) => {
              clack.log.error(message);
              clearCurrentTaskLog();
            },
          };
          setCurrentTaskLog(stub);
          return stub;
        }
        const group = runTracked(() => task.group(title));
        setCurrentTaskLog(group);
        return {
          message: (message) => {
            if (hasExternalStdoutWrite) {
              clack.log.message(message);
            } else {
              runTracked(() => group.message(message));
            }
          },
          success: (message) => {
            if (hasExternalStdoutWrite) {
              clack.log.success(message);
            } else {
              group.success(message);
            }
            clearCurrentTaskLog();
          },
          error: (message) => {
            if (hasExternalStdoutWrite) {
              clack.log.error(message);
            } else {
              group.error(message);
            }
            clearCurrentTaskLog();
          },
        };
      },
    };

    // Push the contamination-aware wrapper (not the raw clack task) so that callers reaching
    // the active task via `getCurrentTaskLog()` (e.g. logger.ts) also get the rerouting.
    if (!isCurrentTaskActive) {
      setCurrentTaskLog(wrapped);
    }

    return wrapped;
  }
}

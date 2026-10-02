import { stripVTControlCharacters } from 'node:util';

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

// Clack counts the terminal rows of a task log line by its length including color codes, and erases
// that many rows on the next update. Drop the colors of a line whose codes push it onto an extra row,
// or the erase reaches into the output above the log.
const withCountableRows = (message: string) => {
  const columns = process.stdout.columns || 80;
  const rows = (length: number) => Math.ceil((length + 3) / columns);
  return message
    .split('\n')
    .map((line) => {
      const plain = stripVTControlCharacters(line);
      return rows(line.length) === rows(plain.length) ? line : plain;
    })
    .join('\n');
};

export class ClackPromptProvider extends PromptProvider {
  private async handleCancel(result: unknown | symbol, promptOptions?: PromptOptions) {
    if (clack.isCancel(result)) {
      if (promptOptions?.onCancel) {
        await promptOptions.onCancel();
      } else {
        clack.cancel('Operation canceled.');
        process.exit(0);
      }
    }
  }

  async text(options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> {
    const result = await clack.text(options);
    await this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return result.toString();
  }

  async confirm(options: ConfirmPromptOptions, promptOptions?: PromptOptions): Promise<boolean> {
    const result = await clack.confirm({
      ...options,
      message: wrapTextForClackHint(options.message, undefined, undefined, 2),
    });
    await this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return Boolean(result);
  }

  async select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T> {
    const result = await clack.select<T>({
      ...options,
      message: wrapTextForClackHint(options.message, undefined, undefined, 2),
    });
    await this.handleCancel(result, promptOptions);
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
    await this.handleCancel(result, promptOptions);
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
    // A log taller than the terminal is redrawn into the scrollback on every update; the trimmed
    // lines are retained for a log shown on error.
    const task = getCurrentTaskLog() || clack.taskLog({ limit: 10, retainLog: true, ...options });
    const taskId = `${options.id}-task`;
    logTracker.addLog('info', `${taskId}-start: ${options.title}`);

    if (!isCurrentTaskActive) {
      setCurrentTaskLog(task);
    }

    return {
      message: (message) => {
        logTracker.addLog('info', `${taskId}: ${message}`);
        task.message(withCountableRows(message));
      },
      error: (message) => {
        logTracker.addLog('error', `${taskId}-error: ${message}`);
        task.error(message, { showLog: true });
        clearCurrentTaskLog();
      },
      success: (message, options) => {
        logTracker.addLog('info', `${taskId}-success: ${message}`);
        if (!isCurrentTaskActive) {
          task.success(message, options);
        }
        clearCurrentTaskLog();
      },
      group(title) {
        logTracker.addLog('info', `${taskId}-group: ${title}`);
        const group = task.group(title);

        setCurrentTaskLog(group);

        return {
          message: (message) => {
            group.message(message);
          },
          success: (message) => {
            group.success(message);
            clearCurrentTaskLog();
          },
          error: (message) => {
            group.error(message);
            clearCurrentTaskLog();
          },
        };
      },
    };
  }
}

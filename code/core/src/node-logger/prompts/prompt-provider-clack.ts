import * as clack from '@clack/prompts';

import { logTracker } from '../logger/log-tracker';
import { wrapTextForClackHint } from '../wrap-utils';
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
} from './prompt-provider-base';
import { PromptProvider } from './prompt-provider-base';

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
      cancel: (message) => {
        logTracker.addLog('info', `${spinnerId}-stop: ${message}`);
        task.cancel(message);
      },
      error: (message) => {
        logTracker.addLog('error', `${spinnerId}-stop: ${message}`);
        task.error(message);
      },
    };
  }

  taskLog(options: TaskLogOptions): TaskLogInstance {
    const isCurrentTaskActive = !!getCurrentTaskLog();
    const task = getCurrentTaskLog() || clack.taskLog(options);
    const taskId = `${options.id}-task`;
    logTracker.addLog('info', `${taskId}-start: ${options.title}`);

    if (!isCurrentTaskActive) {
      setCurrentTaskLog(task);
    }

    return {
      message: (message) => {
        logTracker.addLog('info', `${taskId}: ${message}`);
        task.message(message);
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

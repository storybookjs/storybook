import * as clack from '@clack/prompts';

import { logTracker } from '../logger/log-tracker';
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

export let currentTaskLog: ReturnType<typeof clack.taskLog> | null = null;

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
    const result = await clack.confirm(options);
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return Boolean(result);
  }

  async select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T> {
    const result = await clack.select<T>(options);
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
    };
  }

  taskLog(options: TaskLogOptions): TaskLogInstance {
    const task = clack.taskLog(options);
    const taskId = `${options.id}-task`;
    logTracker.addLog('info', `${taskId}-start: ${options.title}`);

    currentTaskLog = task;

    return {
      message: (message) => {
        logTracker.addLog('info', `${taskId}: ${message}`);
        task.message(message);
      },
      error: (message) => {
        logTracker.addLog('error', `${taskId}-error: ${message}`);
        task.error(message, { showLog: true });
        currentTaskLog = null;
      },
      success: (message, options) => {
        logTracker.addLog('info', `${taskId}-success: ${message}`);
        task.success(message, options);
        currentTaskLog = null;
      },
    };
  }
}

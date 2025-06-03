import * as clack from '@clack/prompts';

import { logTracker } from '../logger/log-tracker';
import type {
  ConfirmPromptOptions,
  MultiSelectPromptOptions,
  PromptOptions,
  SelectPromptOptions,
  SpinnerInstance,
  TaskLogInstance,
  TaskLogOptions,
  TextPromptOptions,
} from './prompt-provider-base';
import { PromptProvider } from './prompt-provider-base';

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
    const result = await clack.multiselect<T>(options);
    this.handleCancel(result, promptOptions);
    logTracker.addLog('prompt', options.message, { choice: result });
    return result as T[];
  }

  spinner(): SpinnerInstance {
    const task = clack.spinner();

    return {
      start: (message) => {
        logTracker.addLog('info', `spinner-start: ${message}`);
        task.start(message);
      },
      message: (message) => {
        logTracker.addLog('info', `spinner: ${message}`);
        task.message(message);
      },
      stop: (message) => {
        logTracker.addLog('info', `spinner-stop: ${message}`);
        task.stop(message);
      },
    };
  }

  taskLog(options: TaskLogOptions): TaskLogInstance {
    const task = clack.taskLog(options);
    logTracker.addLog('info', `task-start: ${options.title}`);

    return {
      message: (message) => {
        logTracker.addLog('info', `task: ${message}`);
        task.message(message);
      },
      error: (message) => {
        logTracker.addLog('error', `task-error: ${message}`);
        task.error(message);
      },
      success: (message) => {
        logTracker.addLog('info', `task-success: ${message}`);
        task.success(message);
      },
    };
  }
}

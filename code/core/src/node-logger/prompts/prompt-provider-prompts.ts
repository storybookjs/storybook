import prompts from 'prompts';

import { logger } from '..';
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

export class PromptsPromptProvider extends PromptProvider {
  private getBaseOptions(promptOptions?: PromptOptions) {
    return {
      onCancel: () => {
        if (promptOptions?.onCancel) {
          promptOptions.onCancel();
        } else {
          logger.info('Operation canceled.');
          process.exit(0);
        }
      },
    };
  }

  async text(options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> {
    const validate = options.validate
      ? (value: string) => {
          const result = options.validate!(value);
          if (result instanceof Error) {
            return result.message;
          }
          if (typeof result === 'string') {
            return result;
          }
          return true;
        }
      : undefined;

    const result = await prompts(
      {
        type: 'text',
        name: 'value',
        message: options.message,
        initial: options.initialValue,
        validate,
      },
      { ...this.getBaseOptions(promptOptions) }
    );

    logTracker.addLog('prompt', options.message, { choice: result.value });
    return result.value;
  }

  async confirm(options: ConfirmPromptOptions, promptOptions?: PromptOptions): Promise<boolean> {
    const result = await prompts(
      {
        type: 'confirm',
        name: 'value',
        message: options.message,
        initial: options.initialValue,
        active: options.active,
        inactive: options.inactive,
      },
      { ...this.getBaseOptions(promptOptions) }
    );

    logTracker.addLog('prompt', options.message, { choice: result.value });
    return result.value;
  }

  async select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T> {
    const result = await prompts(
      {
        type: 'select',
        name: 'value',
        message: options.message,
        choices: options.options.map((opt) => ({
          title: opt.label || String(opt.value),
          value: opt.value,
          description: opt.hint,
          selected: opt.value === options.initialValue,
        })),
      },
      { ...this.getBaseOptions(promptOptions) }
    );

    logTracker.addLog('prompt', options.message, { choice: result.value });
    return result.value as T;
  }

  async multiselect<T>(
    options: MultiSelectPromptOptions<T>,
    promptOptions?: PromptOptions
  ): Promise<T[]> {
    const result = await prompts(
      {
        type: 'multiselect',
        name: 'value',
        message: options.message,
        choices: options.options.map((opt) => ({
          title: opt.label || String(opt.value),
          value: opt.value,
          description: opt.hint,
          selected: options.initialValues?.includes(opt.value),
        })),
        min: options.required ? 1 : 0,
      },
      { ...this.getBaseOptions(promptOptions) }
    );

    logTracker.addLog('prompt', options.message, { choice: result.value });
    return result.value as T[];
  }

  spinner(options: SpinnerOptions): SpinnerInstance {
    // Simple spinner implementation using process.stdout.write since prompts doesn't have a built-in spinner
    let interval: NodeJS.Timeout;
    const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const spinnerId = `${options.id}-spinner`;

    return {
      start: (message?: string) => {
        logTracker.addLog('info', `${spinnerId}-start: ${message}`);
        process.stdout.write('\x1b[?25l'); // Hide cursor
        interval = setInterval(() => {
          process.stdout.write(`\r${chars[i]} ${message || 'Loading...'}`);
          i = (i + 1) % chars.length;
        }, 100);
      },
      stop: (message?: string) => {
        logTracker.addLog('info', `${spinnerId}-stop: ${message}`);
        clearInterval(interval);
        process.stdout.write('\x1b[?25h'); // Show cursor
        if (message) {
          process.stdout.write(`\r✓ ${message}\n`);
        } else {
          process.stdout.write('\r\x1b[K'); // Clear line
        }
      },
      message: (text: string) => {
        logTracker.addLog('info', `${spinnerId}: ${text}`);
        process.stdout.write(`\r${text}`);
      },
    };
  }

  taskLog(options: TaskLogOptions): TaskLogInstance {
    // Simple logs because prompts doesn't allow for clearing lines
    logger.info(`${options.title}\n`);
    const taskId = `${options.id}-task`;
    logTracker.addLog('info', `${taskId}-start: ${options.title}`);

    return {
      message: (text: string) => {
        logger.info(text);
        logTracker.addLog('info', `${taskId}: ${text}`);
      },
      success: (message: string) => {
        logger.info(message);
        logTracker.addLog('info', `${taskId}-success: ${message}`);
      },
      error: (message: string) => {
        logger.error(message);
        logTracker.addLog('error', `${taskId}-error: ${message}`);
      },
    };
  }
}

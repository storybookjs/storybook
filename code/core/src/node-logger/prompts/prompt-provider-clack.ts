import { stripVTControlCharacters } from 'node:util';

import * as clack from '@clack/prompts';

import { logTracker } from '../logger/log-tracker.ts';
import { wrapTextForClackHint } from '../wrap-utils.ts';
import type {
  ConfirmPromptOptions,
  MultiSelectPromptOptions,
  PromptCancelReason,
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
const formatTaskLogMessage = (message: string) => {
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

// Thrown when a prompt is aborted (user cancel or stdin end) and the onCancel handler returns
// without terminating the process itself, so the abort can never resolve as the prompt's answer.
export class PromptAbortedError extends Error {
  readonly reason: PromptCancelReason;

  constructor(reason: PromptCancelReason) {
    super(
      reason === 'stdin-ended'
        ? 'Prompt aborted: stdin ended before an answer was received.'
        : 'Operation canceled.'
    );
    this.name = 'PromptAbortedError';
    this.reason = reason;
  }
}

// Clack never settles a prompt when stdin ends without input (piped runs with stdin closed at
// EOF, the common CI condition): the promise stays pending and Node exits 0 once the event loop
// drains, reporting success for an incomplete init. Hand each prompt clack's own signal support
// instead — an aborted signal settles the prompt as cancelled and releases its readline — driven
// by stdin ending, so the cancel path exits non-zero rather than reporting success.
const stdinEndAbort = (): {
  signal: AbortSignal;
  isStdinEnded: () => boolean;
  dispose: () => void;
} => {
  const controller = new AbortController();
  let stdinEnded = process.stdin.readableEnded;
  const onStdinEnd = () => {
    stdinEnded = true;
    controller.abort();
  };
  if (stdinEnded) {
    controller.abort();
  } else {
    process.stdin.once('end', onStdinEnd);
  }
  return {
    signal: controller.signal,
    isStdinEnded: () => stdinEnded,
    dispose: () => process.stdin.off('end', onStdinEnd),
  };
};

export class ClackPromptProvider extends PromptProvider {
  private async handleAbort(
    result: unknown,
    promptOptions: PromptOptions | undefined,
    stdinEnded: boolean
  ): Promise<void> {
    if (!stdinEnded && !clack.isCancel(result)) {
      return;
    }
    const reason: PromptCancelReason = stdinEnded ? 'stdin-ended' : 'cancel';
    if (promptOptions?.onCancel) {
      await promptOptions.onCancel(reason);
      // Every current onCancel exits or throws; if one ever returns, still refuse to hand the
      // aborted prompt's sentinel back as the answer — reject so the CLI exits non-zero.
      throw new PromptAbortedError(reason);
    }
    clack.cancel(
      stdinEnded
        ? 'Prompt aborted: stdin ended before an answer was received.'
        : 'Operation canceled.'
    );
    process.exit(1);
  }

  async text(options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> {
    const { signal, isStdinEnded, dispose } = stdinEndAbort();
    try {
      const result = await clack.text({ ...options, signal });
      await this.handleAbort(result, promptOptions, isStdinEnded());
      logTracker.addLog('prompt', options.message, { choice: result });
      return result.toString();
    } finally {
      dispose();
    }
  }

  async confirm(options: ConfirmPromptOptions, promptOptions?: PromptOptions): Promise<boolean> {
    const { signal, isStdinEnded, dispose } = stdinEndAbort();
    try {
      const result = await clack.confirm({
        ...options,
        message: wrapTextForClackHint(options.message, undefined, undefined, 2),
        signal,
      });
      await this.handleAbort(result, promptOptions, isStdinEnded());
      logTracker.addLog('prompt', options.message, { choice: result });
      return Boolean(result);
    } finally {
      dispose();
    }
  }

  async select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T> {
    const { signal, isStdinEnded, dispose } = stdinEndAbort();
    try {
      const result = await clack.select<T>({
        ...options,
        message: wrapTextForClackHint(options.message, undefined, undefined, 2),
        signal,
      });
      await this.handleAbort(result, promptOptions, isStdinEnded());
      logTracker.addLog('prompt', options.message, { choice: result });
      return result as T;
    } finally {
      dispose();
    }
  }

  async multiselect<T>(
    options: MultiSelectPromptOptions<T>,
    promptOptions?: PromptOptions
  ): Promise<T[]> {
    const { signal, isStdinEnded, dispose } = stdinEndAbort();
    try {
      const result = await clack.multiselect<T>({
        ...options,
        required: options.required,
        signal,
      });
      await this.handleAbort(result, promptOptions, isStdinEnded());
      logTracker.addLog('prompt', options.message, { choice: result });
      return result as T[];
    } finally {
      dispose();
    }
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
        task.message(formatTaskLogMessage(message));
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

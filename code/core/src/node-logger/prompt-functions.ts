import * as clack from '@clack/prompts';

import { logTracker } from './log-tracker';

type Primitive = Readonly<string | boolean | number>;

export type Option<T> = T extends Primitive
  ? {
      value: T;
      label?: string;
      hint?: string;
    }
  : {
      value: T;
      label: string;
      hint?: string;
    };

export interface BasePromptOptions {
  message: string;
}

export interface TextPromptOptions extends BasePromptOptions {
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | Error | undefined;
}

export interface ConfirmPromptOptions extends BasePromptOptions {
  initialValue?: boolean;
  active?: string;
  inactive?: string;
}

export interface SelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
  initialValue?: T;
}

export interface MultiSelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
  initialValues?: T[];
  required?: boolean;
}

export interface PromptOptions {
  onCancel?: () => void;
}

const handleCancel = (result: unknown | symbol, promptOptions?: PromptOptions) => {
  if (clack.isCancel(result)) {
    if (promptOptions?.onCancel) {
      promptOptions.onCancel();
    } else {
      clack.cancel('Operation canceled.');
      process.exit(0);
    }
  }
};

export const text = async (
  options: TextPromptOptions,
  promptOptions?: PromptOptions
): Promise<string> => {
  const result = await clack.text(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result.toString();
};

export const confirm = async (
  options: ConfirmPromptOptions,
  promptOptions?: PromptOptions
): Promise<boolean> => {
  const result = await clack.confirm(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return Boolean(result);
};

export const select = async <T>(
  options: SelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T> => {
  const result = await clack.select<T>(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result as T;
};

export const multiselect = async <T>(
  options: MultiSelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T[]> => {
  const result = await clack.multiselect<T>(options);

  handleCancel(result, promptOptions);

  logTracker.addLog('prompt', options.message, { choice: result });
  return result as T[];
};

export const spinner = clack.spinner;

// TODO: de-clack the type
export const taskLog = (options: clack.TaskLogOptions) => {
  return clack.taskLog(options);
};

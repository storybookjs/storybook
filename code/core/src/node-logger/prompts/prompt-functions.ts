import { getPromptProvider } from './prompt-config';
import type {
  BasePromptOptions,
  ConfirmPromptOptions,
  MultiSelectPromptOptions,
  Option,
  PromptOptions,
  SelectPromptOptions,
  SpinnerInstance,
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
  return getPromptProvider().multiselect(options, promptOptions);
};

export const spinner = (): SpinnerInstance => {
  return getPromptProvider().spinner();
};

export const taskLog = (options: TaskLogOptions): TaskLogInstance => {
  return getPromptProvider().taskLog(options);
};

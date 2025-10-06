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
  validate?: (value: string | undefined) => string | Error | undefined;
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

export interface SpinnerInstance {
  start: (message?: string) => void;
  stop: (message?: string) => void;
  message: (text: string) => void;
}

export interface TaskLogInstance {
  message: (text: string) => void;
  success: (message: string, options?: { showLog?: boolean }) => void;
  error: (message: string) => void;
}

export interface SpinnerOptions {
  /** The id of the task, to be used by the log tracker. */
  id: string;
}

export interface TaskLogOptions {
  /** The id of the task, to be used by the log tracker. */
  id: string;
  title: string;
  retainLog?: boolean;
  limit?: number;
}

export abstract class PromptProvider {
  abstract text(options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string>;

  abstract confirm(options: ConfirmPromptOptions, promptOptions?: PromptOptions): Promise<boolean>;

  abstract select<T>(options: SelectPromptOptions<T>, promptOptions?: PromptOptions): Promise<T>;

  abstract multiselect<T>(
    options: MultiSelectPromptOptions<T>,
    promptOptions?: PromptOptions
  ): Promise<T[]>;

  abstract spinner(options: SpinnerOptions): SpinnerInstance;

  abstract taskLog(options: TaskLogOptions): TaskLogInstance;
}

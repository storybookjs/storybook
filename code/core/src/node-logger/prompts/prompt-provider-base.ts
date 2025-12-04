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

export interface FileSystemTreeSelectPromptOptions extends BasePromptOptions {
  /** The root directory to start browsing from */
  root?: string;
  /** Whether to include files in the selection (default: true) */
  includeFiles?: boolean;
  /** Whether to include hidden files and directories (default: false) */
  includeHidden?: boolean;
  /** Maximum depth to traverse (default: Infinity) */
  maxDepth?: number;
  /** Optional filter function to exclude certain paths */
  filter?: (path: string) => boolean;
  /** Glob pattern(s) to filter files (based on picomatch) */
  glob?: string | string[];
  /** Whether to allow multiple selections (default: false) */
  multiple?: boolean;
}

export interface PromptOptions {
  onCancel?: () => void;
}

export interface SpinnerInstance {
  start: (message?: string) => void;
  stop: (message?: string) => void;
  cancel: (message?: string) => void;
  error: (message?: string) => void;
  message: (text: string) => void;
}

export interface TaskLogInstance {
  message: (text: string) => void;
  success: (message: string, options?: { showLog?: boolean }) => void;
  error: (message: string) => void;
  group: (title: string) => {
    message: (text: string, options?: any) => void;
    success: (message: string) => void;
    error: (message: string) => void;
  };
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

  abstract fileSystemTreeSelect(
    options: FileSystemTreeSelectPromptOptions,
    promptOptions?: PromptOptions
  ): Promise<string | string[]>;

  abstract spinner(options: SpinnerOptions): SpinnerInstance;

  abstract taskLog(options: TaskLogOptions): TaskLogInstance;
}

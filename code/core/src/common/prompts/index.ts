import prompts from 'prompts';

type Option = {
  value: any;
  label: string;
  hint?: string;
};

type GroupOption = {
  [key: string]: Option[];
};

interface BasePromptOptions {
  message: string;
}

interface TextPromptOptions extends BasePromptOptions {
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | boolean | Promise<string | boolean>;
}

interface ConfirmPromptOptions extends BasePromptOptions {
  initialValue?: boolean;
  active?: string;
  inactive?: string;
}

interface SelectPromptOptions extends BasePromptOptions {
  options: Option[];
}

interface MultiSelectPromptOptions extends BasePromptOptions {
  options: Option[];
  required?: boolean;
}

interface GroupMultiSelectPromptOptions extends BasePromptOptions {
  options: GroupOption;
}

interface SpinnerOptions {
  text?: string;
}

interface ProgressOptions extends SpinnerOptions {
  max: number;
}

interface TaskOptions {
  title: string;
  task: (message: (text: string) => void) => Promise<string>;
}

interface PromptOptions {
  onCancel?: () => void;
}

const intro = (message: string) => {
  console.log(`\n${message}\n`);
};

const outro = (message: string) => {
  console.log(`\n${message}\n`);
};

const cancel = (message: string) => {
  console.log(`\n❌ ${message}\n`);
  process.exit(0);
};

const text = async (options: TextPromptOptions, promptOptions?: PromptOptions): Promise<string> => {
  const result = await prompts(
    {
      type: 'text',
      name: 'value',
      message: options.message,
      initial: options.initialValue,
      validate: options.validate,
    },
    promptOptions
  );

  return result.value;
};

const confirm = async (
  options: ConfirmPromptOptions,
  promptOptions?: PromptOptions
): Promise<boolean> => {
  const result = await prompts(
    {
      type: 'confirm',
      name: 'value',
      message: options.message,
      initial: options.initialValue,
      active: options.active,
      inactive: options.inactive,
    },
    promptOptions
  );

  return result.value;
};

const select = async <T>(
  options: SelectPromptOptions,
  promptOptions?: PromptOptions
): Promise<T> => {
  const result = await prompts(
    {
      type: 'select',
      name: 'value',
      message: options.message,
      choices: options.options.map((opt) => ({
        title: opt.label,
        value: opt.value,
        description: opt.hint,
      })),
    },
    promptOptions
  );

  return result.value as T;
};

const multiselect = async <T extends string | number>(
  options: MultiSelectPromptOptions,
  promptOptions?: PromptOptions
): Promise<T[]> => {
  const result = await prompts(
    {
      type: 'multiselect',
      name: 'value',
      message: options.message,
      choices: options.options.map((opt) => ({
        title: opt.label,
        value: opt.value,
        description: opt.hint,
      })),
    },
    promptOptions
  );

  return result.value as T[];
};

const groupMultiselect = async <T extends string | number>(
  options: GroupMultiSelectPromptOptions,
  promptOptions?: PromptOptions
): Promise<Record<string, T[]>> => {
  const choices = Object.entries(options.options).map(([group, opts]) => ({
    title: group,
    type: 'group',
    choices: opts.map((opt) => ({
      title: opt.label,
      value: opt.value,
      description: opt.hint,
    })),
  }));

  const result = await prompts(
    {
      type: 'multiselect',
      name: 'value',
      message: options.message,
      choices,
    },
    promptOptions
  );

  return result.value as Record<string, T[]>;
};

const spinner = (options?: SpinnerOptions) => {
  let currentText = options?.text || '';

  return {
    start: (text: string) => {
      currentText = text;
      console.log(`⏳ ${text}`);
    },
    stop: (text: string) => {
      console.log(`✅ ${text}`);
    },
    message: (text: string) => {
      console.log(`  ${text}`);
    },
  };
};

const progress = (options: ProgressOptions) => {
  const spinnerInstance = spinner(options);
  let current = 0;

  return {
    ...spinnerInstance,
    advance: (value: number, text?: string) => {
      current = value;
      const percentage = Math.round((current / options.max) * 100);
      spinnerInstance.message(text || `Progress: ${percentage}%`);
    },
  };
};

const tasks = async (tasks: TaskOptions[]) => {
  for (const task of tasks) {
    const spinnerInstance = spinner({ text: task.title });
    spinnerInstance.start(task.title);

    try {
      const result = await task.task((text) => spinnerInstance.message(text));
      spinnerInstance.stop(result);
    } catch (error: any) {
      spinnerInstance.stop(`Failed: ${error.message}`);
      throw error;
    }
  }
};

const log = {
  info: (message: string) => console.log(`ℹ️  ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  step: (message: string) => console.log(`➡️  ${message}`),
  warn: (message: string) => console.log(`⚠️  ${message}`),
  error: (message: string) => console.log(`❌ ${message}`),
  message: (message: string, options?: { symbol?: string }) => {
    const symbol = options?.symbol || '•';
    console.log(`${symbol} ${message}`);
  },
};

const stream = {
  info: (iterable: Iterable<string>) => {
    for (const message of iterable) {
      log.info(message);
    }
  },
  success: (iterable: Iterable<string>) => {
    for (const message of iterable) {
      log.success(message);
    }
  },
  step: (iterable: Iterable<string>) => {
    for (const message of iterable) {
      log.step(message);
    }
  },
  warn: (iterable: Iterable<string>) => {
    for (const message of iterable) {
      log.warn(message);
    }
  },
  error: (iterable: Iterable<string>) => {
    for (const message of iterable) {
      log.error(message);
    }
  },
  message: (iterable: Iterable<string>, options?: { symbol?: string }) => {
    for (const message of iterable) {
      log.message(message, options);
    }
  },
};

const taskLog = (options: { title: string }) => {
  const spinnerInstance = spinner({ text: options.title });
  spinnerInstance.start(options.title);

  return {
    message: (text: string) => spinnerInstance.message(text),
    success: (text: string) => spinnerInstance.stop(text),
    error: (text: string) => {
      console.log(`❌ ${text}`);
    },
  };
};

export const prompt = {
  confirm,
  text,
  select,
  multiselect,
  groupMultiselect,
  spinner,
  progress,
  tasks,
  log,
  stream,
  taskLog,
};

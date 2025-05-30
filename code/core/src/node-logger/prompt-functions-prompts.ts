import prompts from 'prompts';

import { logTracker } from './log-tracker';

type Primitive = Readonly<string | boolean | number>;

type Option<T> = T extends Primitive
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

interface BasePromptOptions {
  message: string;
}

interface TextPromptOptions extends BasePromptOptions {
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | Error | undefined;
}

interface ConfirmPromptOptions extends BasePromptOptions {
  initialValue?: boolean;
  active?: string;
  inactive?: string;
}

interface SelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
  initialValue?: T;
}

interface MultiSelectPromptOptions<T> extends BasePromptOptions {
  options: Option<T>[];
  initialValues?: T[];
  required?: boolean;
}

interface PromptOptions {
  onCancel?: () => void;
}

const baseOptions = {
  onCancel: () => {
    console.log('Operation canceled.');
    process.exit(0);
  },
};

export const text = async (
  options: TextPromptOptions,
  promptOptions?: PromptOptions
): Promise<string> => {
  // Adapt validation function to prompts library format
  const validate = options.validate
    ? (value: string) => {
        const result = options.validate!(value);
        if (result instanceof Error) {
          return result.message;
        }
        if (typeof result === 'string') {
          return result;
        }
        return true; // Valid
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
    { ...baseOptions, ...promptOptions }
  );

  logTracker.addLog('prompt', options.message, { choice: result.value });
  return result.value;
};

export const confirm = async (
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
    { ...baseOptions, ...promptOptions }
  );

  logTracker.addLog('prompt', options.message, { choice: result.value });
  return result.value;
};

export const select = async <T>(
  options: SelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T> => {
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
    { ...baseOptions, ...promptOptions }
  );

  logTracker.addLog('prompt', options.message, { choice: result.value });
  return result.value as T;
};

export const multiselect = async <T>(
  options: MultiSelectPromptOptions<T>,
  promptOptions?: PromptOptions
): Promise<T[]> => {
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
    { ...baseOptions, ...promptOptions }
  );

  logTracker.addLog('prompt', options.message, { choice: result.value });
  return result.value as T[];
};

// Simple spinner implementation using process.stdout.write since prompts doesn't have a built-in spinner
export const spinner = () => {
  let interval: NodeJS.Timeout;
  const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  return {
    start: (message?: string) => {
      process.stdout.write('\x1b[?25l'); // Hide cursor
      interval = setInterval(() => {
        process.stdout.write(`\r${chars[i]} ${message || 'Loading...'}`);
        i = (i + 1) % chars.length;
      }, 100);
    },
    stop: (message?: string) => {
      clearInterval(interval);
      process.stdout.write('\x1b[?25h'); // Show cursor
      if (message) {
        process.stdout.write(`\r✓ ${message}\n`);
      } else {
        process.stdout.write('\r\x1b[K'); // Clear line
      }
    },
    message: (text: string) => {
      // Update spinner message - for compatibility with clack
      process.stdout.write(`\r${text}`);
    },
  };
};

// Simple task log implementation
export const taskLog = ({ title }: { title: string }) => {
  // Initial state
  console.log(`${title}\n`);

  return {
    message: (text: string) => {
      console.log(text);
    },
    success: (message?: string) => {
      console.log(message);
    },
    error: (message?: string) => {
      console.error(message);
    },
  };
};

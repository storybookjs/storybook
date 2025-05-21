import boxen from 'boxen';
import prompts from 'prompts';

type Option = {
  value: any;
  label: string;
  hint?: string;
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

interface PromptOptions {
  onCancel?: () => void;
}

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

type BoxenOptions = {
  borderStyle?: 'round' | 'none';
  padding?: number;
  title?: string;
  titleAlignment?: 'left' | 'center' | 'right';
  borderColor?: string;
  backgroundColor?: string;
};

const logBox = (message: string, style?: BoxenOptions) => {
  console.log(
    boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style })
  );
};

export const prompt = {
  confirm,
  text,
  select,
  logBox,
};

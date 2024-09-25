/** Use commander and prompts to gather a list of options for a script */
import chalk from 'chalk';
import { type Command, type Option as CommanderOption, program } from 'commander';
// eslint-disable-next-line import/extensions
import kebabCase from 'lodash/kebabCase.js';
import prompts from 'prompts';
import type { Falsy, PrevCaller, PromptObject, PromptType } from 'prompts';
import { dedent } from 'ts-dedent';

// Option types

export type OptionId = string;
export type BaseOption = {
  type: 'boolean' | 'string' | 'string[]';
  description?: string;
  /**
   * By default the one-char version of the option key will be used as short flag. Override here,
   * e.g. `shortFlag: 'c'`
   */
  shortFlag?: string;
  /** What type of prompt to use? (return false to skip, true for default) */
  promptType?: PromptType | Falsy | PrevCaller<string, PromptType | boolean>;
};

export type BooleanOption = BaseOption & {
  type: 'boolean';
  /**
   * If this option is set to true and the option value is false or undefined, the flag
   * `--no-option` will be set. If the option value is true, the flag `--no-option` is not set.
   */
  inverse?: boolean;
};

export type StringOption = BaseOption & {
  type: 'string';
  /** What values are allowed for this option? */
  values?: readonly string[];
  /** How to describe the values when selecting them */
  valueDescriptions?: readonly string[];
  /** Is a value required for this option? */
  required?: boolean | ((previous: Record<string, any>) => boolean);
};

export type StringArrayOption = BaseOption & {
  type: 'string[]';
  /** What values are allowed for this option? */
  values?: readonly string[];
  /** How to describe the values when selecting them */
  valueDescriptions?: readonly string[];
};

export type Option = BooleanOption | StringOption | StringArrayOption;
export type MaybeOptionValue<TOption extends Option> = TOption extends StringArrayOption
  ? TOption extends { values: infer TValues }
    ? TValues extends readonly string[]
      ? TValues[number][]
      : never // It isn't possible for values to not be a readonly string[], but TS can't work it out
    : string[]
  : TOption extends StringOption
    ? TOption extends { values: infer TValues }
      ? TValues extends readonly string[]
        ? TValues[number] | undefined
        : never // It isn't possible for values to not be a readonly string[], but TS can't work it out
      : string | undefined
    : TOption extends BooleanOption
      ? boolean
      : never;

export type OptionValue<TOption extends Option> = TOption extends { required: true }
  ? NonNullable<MaybeOptionValue<TOption>>
  : MaybeOptionValue<TOption>;

export type OptionSpecifier = Record<OptionId, Option>;
export type MaybeOptionValues<TOptions extends OptionSpecifier> = {
  [TKey in keyof TOptions]: MaybeOptionValue<TOptions[TKey]>;
};

export type OptionValues<TOptions extends OptionSpecifier = OptionSpecifier> = {
  [TKey in keyof TOptions]: OptionValue<TOptions[TKey]>;
};

export function createOptions<TOptions extends OptionSpecifier>(options: TOptions) {
  return options;
}

const logger = console;

function shortFlag(key: OptionId, option: Option) {
  const inverse = option.type === 'boolean' && option.inverse;
  const defaultShortFlag = inverse ? key.substring(0, 1).toUpperCase() : key.substring(0, 1);
  const short = option.shortFlag || defaultShortFlag;
  if (short.length !== 1) {
    throw new Error(
      `Invalid shortFlag for ${key}: '${short}', needs to be a single character (e.g. 's')`
    );
  }
  return short;
}

function longFlag(key: OptionId, option: Option) {
  const inverse = option.type === 'boolean' && option.inverse;
  return inverse ? `no-${kebabCase(key)}` : kebabCase(key);
}

function optionFlags(key: OptionId, option: Option, existingOptions: CommanderOption[]) {
  const optionShortFlag = `-${shortFlag(key, option)}`;
  let base;
  if (existingOptions.some((opt) => opt.short === optionShortFlag)) {
    base = `--${longFlag(key, option)}`;
  } else {
    base = `${optionShortFlag}, --${longFlag(key, option)}`;
  }
  if (option.type === 'string' || option.type === 'string[]') {
    return `${base} <${key}>`;
  }
  return base;
}

export function getOptions<TOptions extends OptionSpecifier>(
  command: Command,
  options: TOptions,
  argv: string[]
): MaybeOptionValues<TOptions> {
  Object.entries(options)
    .reduce((acc, [key, option]) => {
      const flags = optionFlags(key, option, acc.options as any);

      if (option.type === 'boolean') {
        return acc.option(flags, option.description, !!option.inverse);
      }

      const checkStringValue = (raw: string) => {
        if (option.values && !option.values.includes(raw)) {
          const possibleOptions = chalk.cyan(option.values.join('\n'));
          throw new Error(
            dedent`Unexpected value '${chalk.yellow(raw)}' for option '${chalk.magenta(key)}'.
            
            These are the possible options:
              ${possibleOptions}\n\n`
          );
        }
        return raw;
      };

      if (option.type === 'string') {
        return acc.option(flags, option.description, (raw) => {
          return checkStringValue(raw);
        });
      }

      if (option.type === 'string[]') {
        return acc.option(
          flags,
          option.description,
          (raw, values) => [...values, checkStringValue(raw)],
          []
        );
      }

      throw new Error(`Unexpected option type '${key}'`);
    }, command)
    .parse(argv);

  const intermediate = command.opts();
  if (intermediate.task === undefined && argv[2] && !argv[2].startsWith('-')) {
    intermediate.task = argv[2];
  }

  // Note the code above guarantees the types as they come in, so we cast here.
  // Not sure there is an easier way to do this
  return intermediate as MaybeOptionValues<TOptions>;
}

// Boolean values will have a default, usually `false`, `true` if they are "inverse".
// String arrays default to []
// Currently it isn't possible to have a default for string
export function getDefaults<TOptions extends OptionSpecifier>(options: TOptions) {
  return Object.fromEntries(
    Object.entries(options)
      .filter(([, { type }]) => type === 'boolean' || type === 'string[]')
      .map(([key, option]) => {
        if (option.type === 'boolean') {
          return [key, !!option.inverse];
        }

        if (option.type === 'string[]') {
          return [key, []];
        }
        throw new Error('Not reachable');
      })
  );
}

function checkRequired<TOptions extends OptionSpecifier>(
  option: TOptions[keyof TOptions],
  values: MaybeOptionValues<TOptions>
) {
  if (option.type !== 'string' || !option.required) {
    return false;
  }

  if (typeof option.required === 'boolean') {
    return option.required;
  }

  return option.required(values);
}

export function areOptionsSatisfied<TOptions extends OptionSpecifier>(
  options: TOptions,
  values: MaybeOptionValues<TOptions>
) {
  return !Object.entries(options)
    .filter(([, option]) => checkRequired(option as TOptions[keyof TOptions], values))
    .find(([key]) => !values[key]);
}

export async function promptOptions<TOptions extends OptionSpecifier>(
  options: TOptions,
  values: MaybeOptionValues<TOptions>
): Promise<OptionValues<TOptions>> {
  const questions = Object.entries(options).map(([key, option]): PromptObject => {
    let defaultType: PromptType = 'toggle';
    if (option.type !== 'boolean') {
      if (option.type === 'string[]') {
        defaultType = option.values ? 'autocompleteMultiselect' : 'list';
      } else {
        defaultType = option.values ? 'select' : 'text';
      }
    }

    const passedType = option.promptType;
    let type: PromptObject['type'] = defaultType;
    // Allow returning `undefined` from `type()` function to fallback to default
    if (typeof passedType === 'function') {
      type = (...args: Parameters<typeof passedType>) => {
        const chosenType = passedType(...args);
        return chosenType === true ? defaultType : chosenType;
      };
    } else if (typeof passedType !== 'undefined') {
      type = passedType;
    }

    if (option.type !== 'boolean') {
      if (values[key]) {
        return { name: key, type: false };
      }

      return {
        name: key,
        type,
        message: option.description,
        choices: option.values?.map((value, index) => ({
          title: option.valueDescriptions?.[index] || value,
          value,
        })),
      };
    }
    return {
      type,
      message: option.description,
      name: key,
      initial: option.inverse,
      active: 'yes',
      inactive: 'no',
    };
  });

  const selection = await prompts(questions, {
    onCancel: () => {
      logger.log('Command cancelled by the user. Exiting...');
      process.exit(1);
    },
  });
  // Again the structure of the questions guarantees we get responses of the type we need
  return { ...values, ...selection } as OptionValues<TOptions>;
}

function getFlag<TOption extends Option>(
  key: OptionId,
  option: TOption,
  value?: OptionValue<TOption>
) {
  if (option.type === 'boolean') {
    const toggled = option.inverse ? !value : value;
    return toggled ? `--${longFlag(key, option)}` : '';
  }

  if (option.type === 'string[]') {
    // I'm not sure why TS isn't able to infer that OptionValue<TOption> is a
    // OptionValue<StringArrayOption> (i.e. a string[]), given that it knows
    // option is a StringArrayOption
    return ((value || []) as OptionValue<StringArrayOption>)
      .map((v) => `--${longFlag(key, option)} ${v}`)
      .join(' ');
  }

  if (option.type === 'string') {
    if (value) {
      return `--${longFlag(key, option)} ${value}`;
    }
    return '';
  }

  throw new Error(`Unknown option type for '${key}'`);
}

export function getCommand<TOptions extends OptionSpecifier>(
  prefix: string,
  options: TOptions,
  values: Partial<OptionValues<TOptions>>
) {
  const flags = Object.keys(options)
    .map((key) => getFlag(key, options[key], values[key]))
    .filter(Boolean);
  return `${prefix} ${flags.join(' ')}`;
}

export async function getOptionsOrPrompt<TOptions extends OptionSpecifier>(
  commandPrefix: string,
  options: TOptions
): Promise<OptionValues<TOptions>> {
  const main = program.version('5.0.0');
  const cliValues = getOptions(main as any, options, process.argv);

  if (areOptionsSatisfied(options, cliValues)) {
    // areOptionsSatisfied could be a type predicate but I'm not quite sure how to do it
    return cliValues as OptionValues<TOptions>;
  }

  if (process.env.CI) {
    throw new Error(`${commandPrefix} needed to prompt for options, this is not possible in CI!`);
  }

  const finalValues = await promptOptions(options, cliValues);

  const command = getCommand(commandPrefix, options, finalValues);
  logger.log(`\nTo run this directly next time, use:\n  ${command}\n`);

  return finalValues;
}

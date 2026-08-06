type CompodocOption = {
  short?: string;
  long: string;
  takesValue?: boolean;
};

const SHORT_VALUE_OPTIONS = new Set(['c', 'p', 'd', 'y', 'n', 'a', 'o', 'r', 'e']);
const SHORT_BOOLEAN_OPTIONS = new Set(['t', 's', 'w']);

/**
 * Expands the clustered and attached short-option forms accepted by Commander. Keeping this in one
 * place makes every Compodoc consumer agree on invocations such as `-tw` and `-tdcustom`.
 */
export const normalizeCompodocArgs = (args: readonly string[]): string[] => {
  const normalized: string[] = [];
  let terminated = false;

  for (const argument of args) {
    if (terminated) {
      normalized.push(argument);
      continue;
    }
    if (argument === '--') {
      normalized.push(argument);
      terminated = true;
      continue;
    }
    if (!argument.startsWith('-') || argument === '-' || argument.startsWith('--')) {
      normalized.push(argument);
      continue;
    }

    const cluster = argument.slice(1);
    let offset = 0;
    while (offset < cluster.length) {
      const option = cluster[offset];
      if (SHORT_BOOLEAN_OPTIONS.has(option)) {
        normalized.push(`-${option}`);
        offset += 1;
        continue;
      }
      if (SHORT_VALUE_OPTIONS.has(option)) {
        normalized.push(`-${option}`);
        const attachedValue = cluster.slice(offset + 1).replace(/^=/, '');
        if (attachedValue) {
          normalized.push(attachedValue);
        }
        break;
      }

      // Commander will diagnose unknown options. Preserve the remainder so this preprocessing does
      // not reinterpret or hide that error.
      normalized.push(`-${cluster.slice(offset)}`);
      break;
    }
  }

  return normalized;
};

const matchesOption = (argument: string, option: CompodocOption) =>
  argument === option.short || argument === option.long || argument.startsWith(`${option.long}=`);

export const hasCompodocOption = (args: readonly string[], option: CompodocOption): boolean => {
  const normalized = normalizeCompodocArgs(args);
  const terminator = normalized.indexOf('--');
  return normalized
    .slice(0, terminator === -1 ? normalized.length : terminator)
    .some((argument) => matchesOption(argument, option));
};

export const readCompodocOption = (
  args: readonly string[],
  option: CompodocOption
): string | undefined => {
  const normalized = normalizeCompodocArgs(args);
  let result: string | undefined;

  for (let index = 0; index < normalized.length; index++) {
    const argument = normalized[index];
    if (argument === '--') {
      break;
    }
    if (argument.startsWith(`${option.long}=`)) {
      const value = argument.slice(option.long.length + 1);
      if (value) {
        result = value;
      }
      continue;
    }
    if (argument !== option.short && argument !== option.long) {
      continue;
    }
    const value = normalized[index + 1];
    if (value && !value.startsWith('-')) {
      result = value;
    }
  }

  return result;
};

export const removeCompodocOptions = (
  args: readonly string[],
  options: readonly CompodocOption[]
): string[] => {
  const normalized = normalizeCompodocArgs(args);
  const result: string[] = [];

  for (let index = 0; index < normalized.length; index++) {
    const argument = normalized[index];
    if (argument === '--') {
      result.push(...normalized.slice(index));
      break;
    }
    const option = options.find((candidate) => matchesOption(argument, candidate));
    if (!option) {
      result.push(argument);
      continue;
    }
    if (
      option.takesValue &&
      !argument.startsWith(`${option.long}=`) &&
      normalized[index + 1] &&
      !normalized[index + 1].startsWith('-')
    ) {
      index += 1;
    }
  }

  return result;
};

/** Adds Storybook-owned options before Commander's positional-argument terminator. */
export const insertCompodocOptions = (
  args: readonly string[],
  options: readonly string[]
): string[] => {
  const terminator = args.indexOf('--');
  if (terminator === -1) {
    return [...args, ...options];
  }
  return [...args.slice(0, terminator), ...options, ...args.slice(terminator)];
};

export const COMPODOC_CONFIG_OPTION = { short: '-c', long: '--config', takesValue: true } as const;
export const COMPODOC_TSCONFIG_OPTION = {
  short: '-p',
  long: '--tsconfig',
  takesValue: true,
} as const;
export const COMPODOC_OUTPUT_OPTION = {
  short: '-d',
  long: '--output',
  takesValue: true,
} as const;
export const COMPODOC_EXPORT_OPTION = {
  short: '-e',
  long: '--exportFormat',
  takesValue: true,
} as const;
export const COMPODOC_SERVE_OPTION = { short: '-s', long: '--serve' } as const;
export const COMPODOC_WATCH_OPTION = { short: '-w', long: '--watch' } as const;
export const COMPODOC_COVERAGE_OPTIONS = [
  { long: '--files', takesValue: true },
  { long: '--coverageTest', takesValue: true },
  { long: '--coverageMinimumPerFile', takesValue: true },
  { long: '--coverageExclude', takesValue: true },
  { long: '--coverageTestThresholdFail', takesValue: true },
  { long: '--coverageTestShowOnlyFailed' },
] as const;

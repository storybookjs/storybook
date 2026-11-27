import * as v from 'valibot';

import { JsonSchemaNodeSchema, type JsonSchemaNode } from './schema-lines.ts';

/**
 * The output-shaping flags of the tools CLI. Commander parses them before the toolset name, the
 * token parser after the tool name; the commander-side values arrive as `defaults` and later
 * tokens win.
 */
export type ToolsOutputFlags = {
  input?: string;
  json?: boolean;
  output?: string;
  help?: boolean;
  /** `true` from `--attach`, `false` from `--no-attach`. */
  attach?: boolean;
};

export type ParsedToolsTokens =
  | {
      ok: true;
      help: boolean;
      /** Print the outcome's structured data as JSON instead of its markdown. */
      json: boolean;
      /** Write the output to this file instead of stdout. */
      output?: string;
      /** `true` from `--attach`, `false` from `--no-attach`. */
      attach?: boolean;
      args: Record<string, unknown>;
      /** The value of each `--key value` flag as typed, before it was read as JSON. */
      flagText: Record<string, string>;
      /** Bare arguments, in order; the tool decides whether it takes them (`positional`). */
      positionals: string[];
    }
  | { ok: false; error: string };

/**
 * Parse the pass-through tokens after `storybook tools <toolset> <tool>` into tool arguments.
 *
 * - `--key value` and `--key=value` become tool arguments; values are coerced by attempting
 *   `JSON.parse`, falling back to the raw string.
 * - A bare `--key` (no value) becomes `true`.
 * - Tokens that are not flags or flag values are positionals, as is everything after `--`. Only a
 *   tool that declares `positional` takes them; the dispatcher rejects them for the rest.
 * - `--input '<object>'` is an escape hatch providing the raw argument object; explicit `--key`
 *   flags override its entries.
 * - `--json` switches the output to the outcome's structured data as JSON.
 * - `-o <path>` / `--output <path>` writes the output to a file.
 * - `--help`/`-h` is consumed by the CLI itself and never forwarded to the tool.
 *
 * The same flags are also accepted by commander before the toolset name; `defaults` carries those
 * values, and tokens after the tool name win.
 */
export function parseToolsTokens(
  tokens: string[],
  defaults: ToolsOutputFlags = {}
): ParsedToolsTokens {
  let rawInput = defaults.input;
  let help = defaults.help ?? false;
  let json = defaults.json ?? false;
  let output = defaults.output;
  let attach = defaults.attach;
  const flagArgs: Record<string, unknown> = {};
  const flagText: Record<string, string> = {};
  const positionals: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    i += 1;

    if (token === '--') {
      positionals.push(...tokens.slice(i));
      break;
    }

    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }

    if (token === '--json') {
      json = true;
      continue;
    }

    if (token === '--attach') {
      if (attach === false) {
        return { ok: false, error: 'Cannot combine `--attach` and `--no-attach`.' };
      }
      attach = true;
      continue;
    }

    if (token === '--no-attach') {
      if (attach === true) {
        return { ok: false, error: 'Cannot combine `--attach` and `--no-attach`.' };
      }
      attach = false;
      continue;
    }

    if (token === '-o') {
      if (i >= tokens.length || tokens[i].startsWith('-')) {
        return { ok: false, error: '`-o` requires a file path.' };
      }
      output = tokens[i];
      i += 1;
      continue;
    }

    // `-c`, `-p` and other short options belong before the toolset name; here they would read as
    // bare arguments. A bare argument that starts with `-` goes after `--`.
    if (token.startsWith('-') && !token.startsWith('--')) {
      return {
        ok: false,
        error: `Unexpected option \`${token}\`. Options such as \`-c\` and \`-p\` go before the toolset name; tool arguments are \`--key value\` flags.`,
      };
    }

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    let key = token.slice(2);
    let value: string | undefined;
    const equalsIndex = key.indexOf('=');
    if (equalsIndex !== -1) {
      value = key.slice(equalsIndex + 1);
      key = key.slice(0, equalsIndex);
    } else if (i < tokens.length && !tokens[i].startsWith('--')) {
      // A bare token after a flag is its value, so bare arguments go before the flags or after
      // `--`: in `--a11y false a.tsx`, `false` is the value and `a.tsx` a bare argument.
      value = tokens[i];
      i += 1;
    }

    if (key === '') {
      return { ok: false, error: `Invalid flag \`${token}\`.` };
    }

    // Only reachable via `--help=x` / `--json=x` (or a stray positional after them, which the
    // generic branch consumed as a value): these flags never take one.
    if (key === 'help' || key === 'json' || key === 'attach' || key === 'no-attach') {
      return { ok: false, error: `\`--${key}\` does not take a value.` };
    }

    if (key === 'output') {
      // `!value` also catches the empty path of `--output=`.
      if (!value) {
        return { ok: false, error: '`--output` requires a file path.' };
      }
      output = value;
      continue;
    }

    if (key === 'input') {
      if (value === undefined) {
        return { ok: false, error: '`--input` requires a value.' };
      }
      rawInput = value;
      continue;
    }

    flagArgs[key] = value === undefined ? true : coerceValue(value);
    if (value === undefined) {
      delete flagText[key];
    } else {
      flagText[key] = value;
    }
  }

  let inputArgs: Record<string, unknown> = {};
  if (rawInput !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawInput);
    } catch (error) {
      return {
        ok: false,
        error: `\`--input\` must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        error: '`--input` must be a JSON object, e.g. \'{"id": "button-docs"}\'.',
      };
    }
    inputArgs = parsed as Record<string, unknown>;
  }

  return {
    ok: true,
    help,
    json,
    output,
    attach,
    args: { ...inputArgs, ...flagArgs },
    flagText,
    positionals,
  };
}

/**
 * Whether an invocation is a `--json` data run — the case whose stdout must carry nothing but the
 * printed JSON result. Help requests and invalid tokens produce prose, not data, and are excluded.
 */
export function isJsonToolsRun(tokens: string[], defaults: ToolsOutputFlags = {}): boolean {
  const parsed = parseToolsTokens(tokens, defaults);
  return parsed.ok && parsed.json && !parsed.help;
}

/**
 * A flag value is read as JSON first, so `--a11y false` is a boolean. Where the argument does not
 * take that JSON type but does take a string, the value stays as typed: `--changed 1234567` is a
 * commit and `--files 2024` a folder, not numbers.
 */
export function keepTypedText(
  parsed: Extract<ParsedToolsTokens, { ok: true }>,
  inputSchema: unknown
): Extract<ParsedToolsTokens, { ok: true }> {
  const schema = v.safeParse(JsonSchemaNodeSchema, inputSchema);
  const properties = schema.success ? schema.output.properties : undefined;
  if (!properties) {
    return parsed;
  }
  const args = { ...parsed.args };
  for (const [key, text] of Object.entries(parsed.flagText)) {
    const value = args[key];
    const property = properties[key];
    const jsonType = typeof value === 'number' || typeof value === 'boolean' ? typeof value : null;
    if (!property || (jsonType === null && value !== null)) {
      continue;
    }
    // A list takes its entries one by one: `--files 2024` is a list of one.
    const items = Array.isArray(property.items) ? property.items[0] : property.items;
    const takes = (type: string) =>
      schemaTakes(property, type) || (items !== undefined && schemaTakes(items, type));
    if (!takes(jsonType ?? 'null') && takes('string')) {
      args[key] = text;
    }
  }
  return { ...parsed, args };
}

function schemaTakes(schema: JsonSchemaNode, type: string): boolean {
  return (
    schema.type === type ||
    (type === 'number' && schema.type === 'integer') ||
    [...(schema.anyOf ?? []), ...(schema.oneOf ?? [])].some((variant) => schemaTakes(variant, type))
  );
}

/** Bare arguments fill the method's `positional` key, after any `--key` values for it. */
export function withPositionals(
  parsed: Extract<ParsedToolsTokens, { ok: true }>,
  key: string | undefined
): { ok: true; args: Record<string, unknown> } | { ok: false; unexpected: string } {
  if (!key) {
    return parsed.positionals.length === 0
      ? { ok: true, args: parsed.args }
      : { ok: false, unexpected: parsed.positionals[0] };
  }
  const given = parsed.args[key];
  if (parsed.positionals.length === 0 && given === undefined) {
    return { ok: true, args: parsed.args };
  }
  // A single `--key value` is a list of one.
  const values = [
    ...(given === undefined ? [] : Array.isArray(given) ? given : [given]),
    ...parsed.positionals,
  ];
  return { ok: true, args: { ...parsed.args, [key]: values } };
}

function coerceValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function parsePort(
  rawPort: string | undefined
): { ok: true; port: number | undefined } | { ok: false; error: string } {
  if (rawPort === undefined) {
    return { ok: true, port: undefined };
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      ok: false,
      error: `\`--port\` must be a port number (1-65535), got \`${rawPort}\`.`,
    };
  }
  return { ok: true, port };
}

/**
 * The generic flags of `storybook tools`, in display order. One list serves both the commander
 * registration and the help renderer: commander's own help is disabled (the command surface is
 * derived from the target project's toolset registry at runtime), so the custom help must document
 * these flags itself and would otherwise drift from the registration.
 */
export const TOOLS_OPTION_SPECS: ReadonlyArray<{ flags: string; description: string }> = [
  { flags: '--cwd <path>', description: 'Project directory of the target Storybook' },
  {
    flags: '-c, --config-dir <dir-name>',
    description: 'Storybook config directory of the target Storybook',
  },
  {
    flags: '-p, --port <number>',
    description:
      'Port of a running Storybook; targets that instance directly, no --cwd or --config-dir needed',
  },
  {
    flags: '--attach',
    description:
      'Require attaching to a running Storybook; gate failures are errors instead of a local fallback',
  },
  {
    flags: '--no-attach',
    description: 'Load the project configuration without attaching',
  },
  {
    flags: '--input <object>',
    description: 'Raw JSON object with the tool arguments (escape hatch for complex values)',
  },
  {
    flags: '--json',
    description: "Print the tool's structured result data as JSON instead of markdown",
  },
  { flags: '-o, --output <path>', description: 'Write the result to a file instead of stdout' },
  {
    flags: '-h, --help',
    description: 'List the tools of the target Storybook, or show one tool with its arguments',
  },
];

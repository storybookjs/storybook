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
    }
  | { ok: false; error: string };

/**
 * Parse the pass-through tokens after `storybook tools <toolset> <tool>` into tool arguments.
 *
 * - `--key value` and `--key=value` become tool arguments; values are coerced by attempting
 *   `JSON.parse`, falling back to the raw string.
 * - A bare `--key` (no value) becomes `true`.
 * - `--input '<object>'` is an escape hatch providing the raw argument object; explicit `--key`
 *   flags override its entries. (The `storybook ai` CLI spells this `--json`; here `--json` is the
 *   output-format flag.)
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

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    i += 1;

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

    if (!token.startsWith('--') || token === '--') {
      return {
        ok: false,
        error: `Unexpected argument \`${token}\`. Tool arguments must be passed as \`--key value\` flags (or via \`--input '<object>'\`).`,
      };
    }

    let key = token.slice(2);
    let value: string | undefined;
    const equalsIndex = key.indexOf('=');
    if (equalsIndex !== -1) {
      value = key.slice(equalsIndex + 1);
      key = key.slice(0, equalsIndex);
    } else if (i < tokens.length && !tokens[i].startsWith('--')) {
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

  return { ok: true, help, json, output, attach, args: { ...inputArgs, ...flagArgs } };
}

/**
 * Whether an invocation is a `--json` data run — the case whose stdout must carry nothing but the
 * printed JSON result. Help requests and invalid tokens produce prose, not data, and are excluded.
 */
export function isJsonToolsRun(tokens: string[], defaults: ToolsOutputFlags = {}): boolean {
  const parsed = parseToolsTokens(tokens, defaults);
  return parsed.ok && parsed.json && !parsed.help;
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
    description: 'Show every tool of the target Storybook, or one tool with its arguments',
  },
];

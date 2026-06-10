export type ParsedToolArgs =
  | {
      ok: true;
      cwd: string | undefined;
      port: number | undefined;
      help: boolean;
      args: Record<string, unknown>;
    }
  | { ok: false; error: string };

/**
 * Parse the pass-through tokens after `storybook ai <tool>` into MCP tool arguments.
 *
 * - `--key value` and `--key=value` become tool arguments; values are coerced by attempting
 *   `JSON.parse`, falling back to the raw string.
 * - A bare `--key` (no value) becomes `true`.
 * - `--json '<object>'` is an escape hatch providing the raw argument object; explicit `--key`
 *   flags override its entries.
 * - `--cwd <path>`, `--port <number>` and `--help`/`-h` are consumed by the CLI itself and never
 *   forwarded to the tool.
 *
 * `defaults` carries `--cwd`/`--port`/`--json` values that commander already parsed before the
 * tool name; the same flags appearing after the tool name take precedence.
 */
export function parseToolArgs(
  tokens: string[],
  defaults: { cwd?: string; port?: string; json?: string } = {}
): ParsedToolArgs {
  let cwd = defaults.cwd;
  let rawPort = defaults.port;
  let rawJson = defaults.json;
  let help = false;
  const flagArgs: Record<string, unknown> = {};

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    i += 1;

    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }

    if (!token.startsWith('--') || token === '--') {
      return {
        ok: false,
        error: `Unexpected argument \`${token}\`. Command arguments must be passed as \`--key value\` flags (or via \`--json '<object>'\`).`,
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

    if (key === 'cwd') {
      if (value === undefined) {
        return { ok: false, error: '`--cwd` requires a value.' };
      }
      cwd = value;
      continue;
    }

    if (key === 'port') {
      if (value === undefined) {
        return { ok: false, error: '`--port` requires a value.' };
      }
      rawPort = value;
      continue;
    }

    if (key === 'json') {
      if (value === undefined) {
        return { ok: false, error: '`--json` requires a value.' };
      }
      rawJson = value;
      continue;
    }

    flagArgs[key] = value === undefined ? true : coerceValue(value);
  }

  let port: number | undefined;
  if (rawPort !== undefined) {
    port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return {
        ok: false,
        error: `\`--port\` must be a port number (1-65535), got \`${rawPort}\`.`,
      };
    }
  }

  let jsonArgs: Record<string, unknown> = {};
  if (rawJson !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (error) {
      return {
        ok: false,
        error: `\`--json\` must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        ok: false,
        error: '`--json` must be a JSON object, e.g. \'{"id": "button-docs"}\'.',
      };
    }
    jsonArgs = parsed as Record<string, unknown>;
  }

  return { ok: true, cwd, port, help, args: { ...jsonArgs, ...flagArgs } };
}

function coerceValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

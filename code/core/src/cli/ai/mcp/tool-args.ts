export type ParsedToolArgs =
  | {
      ok: true;
      cwd: string | undefined;
      configDir: string | undefined;
      port: string | undefined;
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
 * - `--cwd <path>`, `--config-dir <path>`, `--port <number>` and `--help`/`-h` are consumed by
 *   the CLI itself and never forwarded to the tool.
 *
 * `defaults` carries `--cwd`/`--config-dir`/`--port`/`--json` values that commander already
 * parsed before the tool name; the same flags appearing after the tool name take precedence.
 */
export function parseToolArgs(
  tokens: string[],
  defaults: {
    cwd?: string;
    configDir?: string;
    port?: string;
    json?: string;
  } = {}
): ParsedToolArgs {
  let cwd = defaults.cwd;
  let configDir = defaults.configDir;
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

    if (token === '-c') {
      if (i >= tokens.length || tokens[i].startsWith('--')) {
        return { ok: false, error: '`-c, --config-dir` requires a value.' };
      }
      configDir = tokens[i];
      i += 1;
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

    if (key === 'config-dir') {
      if (value === undefined) {
        return { ok: false, error: '`-c, --config-dir` requires a value.' };
      }
      configDir = value;
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

  return { ok: true, cwd, configDir, port: rawPort, help, args: { ...jsonArgs, ...flagArgs } };
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
 * Extract only the `--cwd` value from pass-through tokens, tolerating tokens that
 * {@link parseToolArgs} would reject. Telemetry opt-out resolution must locate the target project
 * even when the invocation itself fails as `invalid-arguments` — that intercept still fires an
 * event (storybookjs/storybook#35131). Mirrors the full parser's `--cwd` grammar: `--cwd value`
 * or `--cwd=value`, last occurrence wins.
 */
export function scanCwdToken(tokens: string[]): string | undefined {
  let cwd: string | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--cwd' && i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
      cwd = tokens[i + 1];
      i += 1;
    } else if (token.startsWith('--cwd=')) {
      cwd = token.slice('--cwd='.length);
    }
  }
  return cwd;
}

/** Same lenient scanner as {@link scanCwdToken}, but for `--config-dir`. */
export function scanConfigDirToken(tokens: string[]): string | undefined {
  let configDir: string | undefined;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '-c' && i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
      configDir = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token === '--config-dir' && i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
      configDir = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith('--config-dir=')) {
      configDir = token.slice('--config-dir='.length);
    }
  }
  return configDir;
}

function coerceValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

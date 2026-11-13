import { isIP } from 'node:net';

import { ToolsRuntimeError } from './errors.ts';

export function parseHost(host: string | undefined, port: number | undefined): string | undefined {
  if (host === undefined) {
    return undefined;
  }
  if (port == null) {
    throw new ToolsRuntimeError({
      reason: 'invalid-input',
      message: '`host` requires `port`; use `--host` with `--port`.',
    });
  }

  const authority = isIP(host) === 6 ? `[${host}]` : host;
  try {
    if (/[\s/\\?#@]/.test(host) || (host.includes(':') && !authority.endsWith(']'))) {
      throw new Error('Expected a hostname without a port');
    }
    return new URL(`http://${authority}`).hostname;
  } catch {
    throw new ToolsRuntimeError({
      reason: 'invalid-input',
      message: `Invalid host ${JSON.stringify(host)}. Use a hostname or IP address without a scheme, port, or path.`,
    });
  }
}

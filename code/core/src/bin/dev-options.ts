import { HandledError } from 'storybook/internal/common';

import { isClaudePreviewLaunch, type AgentEnvironment } from '../shared/utils/agent-environment.ts';

type DevCommandEnvironment = AgentEnvironment & {
  PORT?: string;
  SBCONFIG_PORT?: string;
};

type DevCommandOptions = {
  open?: boolean;
  port?: number | string;
  [key: string]: unknown;
};

const parseStrictPort = (value: number | string, source: string) => {
  const port = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HandledError(
      `${source} must be a valid port number from 1 to 65535, received ${JSON.stringify(value)}.`
    );
  }

  return port;
};

const parseLegacyPort = (value: number | string) => {
  const port = parseInt(`${value}`, 10);
  return port || value;
};

export function resolveDevCommandOptions(
  options: DevCommandOptions,
  { env = process.env }: { env?: DevCommandEnvironment } = {}
) {
  const resolvedOptions = { ...options };

  if (env.SBCONFIG_PORT) {
    resolvedOptions.port = parseLegacyPort(env.SBCONFIG_PORT);
  } else if (resolvedOptions.port != null) {
    resolvedOptions.port = parseStrictPort(resolvedOptions.port, '--port');
  } else if (env.PORT?.trim()) {
    resolvedOptions.port = parseStrictPort(env.PORT, 'PORT');
  }

  if (isClaudePreviewLaunch(env)) {
    resolvedOptions.open = false;
  }

  return resolvedOptions;
}

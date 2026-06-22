import { HandledError } from 'storybook/internal/common';

import { isClaudePreviewLaunch, type AgentEnvironment } from '../shared/utils/agent-environment.ts';

type DevCommandEnvironment = AgentEnvironment & {
  PORT?: string;
};

type DevCommandOptions = {
  open?: boolean;
  port?: number | string;
};

const parsePort = (value: number | string, source: string) => {
  const port = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HandledError(
      `${source} must be a valid port number from 1 to 65535, received ${JSON.stringify(value)}.`
    );
  }

  return port;
};

export function resolveDevCommandOptions<TOptions extends DevCommandOptions>(
  options: TOptions,
  {
    env = process.env,
    portSource = 'SBCONFIG_PORT',
  }: { env?: DevCommandEnvironment; portSource?: string } = {}
) {
  const resolvedOptions = { ...options };

  if (resolvedOptions.port != null) {
    resolvedOptions.port = parsePort(resolvedOptions.port, portSource);
  } else if (env.PORT !== undefined) {
    resolvedOptions.port = parsePort(env.PORT, 'PORT');
  }

  if (isClaudePreviewLaunch(env)) {
    resolvedOptions.open = false;
  }

  return resolvedOptions;
}

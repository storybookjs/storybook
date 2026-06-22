import { HandledError } from 'storybook/internal/common';

import { isClaudePreviewLaunch } from '../shared/utils/agent-environment.ts';

type DevCommandEnvironment = {
  AI_AGENT?: string;
  CLAUDE_AGENT_SDK_VERSION?: string;
  PORT?: string;
};

type DevCommandOptions = {
  open?: boolean;
  port?: number | string;
};

const parsePort = (value: string) => {
  if (!/^\d+$/.test(value)) {
    throw new HandledError(
      `PORT must be a valid port number from 1 to 65535, received ${JSON.stringify(value)}.`
    );
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HandledError(
      `PORT must be a valid port number from 1 to 65535, received ${JSON.stringify(value)}.`
    );
  }

  return port;
};

export function resolveDevCommandOptions<TOptions extends DevCommandOptions>(
  options: TOptions,
  {
    env = process.env,
    portWasProvidedByCli = false,
  }: { env?: DevCommandEnvironment; portWasProvidedByCli?: boolean } = {}
) {
  const resolvedOptions = { ...options };

  const parsedOptionPort = parseInt(`${resolvedOptions.port}`, 10);
  if (parsedOptionPort) {
    resolvedOptions.port = parsedOptionPort;
  }

  if (Number.isNaN(resolvedOptions.port)) {
    throw new HandledError(
      '`--port` must be a valid port number. Omit `--port` to use the PORT environment variable.'
    );
  }

  if (!portWasProvidedByCli && resolvedOptions.port == null && env.PORT !== undefined) {
    resolvedOptions.port = parsePort(env.PORT);
  }

  if (isClaudePreviewLaunch(env)) {
    resolvedOptions.open = false;
  }

  return resolvedOptions;
}

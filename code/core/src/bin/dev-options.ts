import { HandledError } from 'storybook/internal/common';

import { isClaudePreviewLaunch, type AgentEnvironment } from '../shared/utils/agent-environment.ts';

type DevCommandEnvironment = AgentEnvironment & {
  PORT?: string;
  SBCONFIG_PORT?: string;
};

type DevCommandOptions = {
  open?: boolean;
  port?: number | string;
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

export function resolveDevCommandOptions<TOptions extends DevCommandOptions>(
  options: TOptions,
  { env = process.env }: { env?: DevCommandEnvironment } = {}
) {
  const resolvedOptions = { ...options } as TOptions;
  const isClaudePreview = isClaudePreviewLaunch(env);
  const portEnv = env.PORT?.trim();
  const sbConfigPort = env.SBCONFIG_PORT?.trim();

  if (sbConfigPort) {
    resolvedOptions.port = parseStrictPort(sbConfigPort, 'SBCONFIG_PORT');
  } else {
    // Validate explicit ports before a Claude launcher PORT override so placeholders still fail.
    const explicitPort =
      resolvedOptions.port == null ? undefined : parseStrictPort(resolvedOptions.port, '--port');

    if (isClaudePreview && portEnv) {
      resolvedOptions.port = parseStrictPort(portEnv, 'PORT');
    } else if (explicitPort != null) {
      resolvedOptions.port = explicitPort;
    } else if (portEnv) {
      resolvedOptions.port = parseStrictPort(portEnv, 'PORT');
    }
  }

  if (isClaudePreview) {
    resolvedOptions.open = false;
  }

  return resolvedOptions;
}

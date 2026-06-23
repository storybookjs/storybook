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

const parseLegacyPort = (value: number | string) => {
  // Preserve the historical SBCONFIG_PORT parseInt behavior while PORT gets strict launcher validation.
  const port = parseInt(`${value}`, 10);
  return port || value;
};

export function resolveDevCommandOptions<TOptions extends DevCommandOptions>(
  options: TOptions,
  { env = process.env }: { env?: DevCommandEnvironment } = {}
) {
  const resolvedOptions = { ...options } as TOptions;
  const isClaudePreview = isClaudePreviewLaunch(env);
  const launcherPort = env.PORT?.trim();

  if (env.SBCONFIG_PORT) {
    resolvedOptions.port = parseLegacyPort(env.SBCONFIG_PORT);
  } else {
    // Validate explicit ports before a Claude launcher PORT override so placeholders still fail.
    const explicitPort =
      resolvedOptions.port == null ? undefined : parseStrictPort(resolvedOptions.port, '--port');

    if (isClaudePreview && launcherPort) {
      resolvedOptions.port = parseStrictPort(launcherPort, 'PORT');
    } else if (explicitPort != null) {
      resolvedOptions.port = explicitPort;
    } else if (launcherPort) {
      resolvedOptions.port = parseStrictPort(launcherPort, 'PORT');
    }
  }

  if (isClaudePreview) {
    resolvedOptions.open = false;
  }

  return resolvedOptions;
}

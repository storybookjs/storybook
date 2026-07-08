import * as v from 'valibot';
import { HandledError } from 'storybook/internal/common';

import { isClaudePreviewLaunch, type AgentEnvironment } from '../shared/utils/agent-environment.ts';
import { detectAgent, type AgentInfo } from '../telemetry/detect-agent.ts';

type DevCommandEnvironment = AgentEnvironment & {
  CI?: string;
  PORT?: string;
  SBCONFIG_CONFIG_DIR?: string;
  SBCONFIG_HOSTNAME?: string;
  SBCONFIG_PORT?: string;
  SBCONFIG_STATIC_DIR?: string;
};

type DevCommandOptions = {
  ci?: boolean | string;
  configDir?: string;
  host?: string;
  open?: boolean;
  port?: number | string;
  staticDir?: string;
};

const PortSchema = v.message(
  v.pipe(
    v.union([v.pipe(v.string(), v.trim(), v.regex(/^\d+$/), v.transform(Number)), v.number()]),
    v.minValue(1),
    v.integer(),
    v.maxValue(65535)
  ),
  (issue) => `Port must be a valid number from 1 to 65535, received ${issue.received}.`
);

const DevOptionsSchema = v.looseObject({
  ci: v.optional(v.union([v.boolean(), v.string()])),
  configDir: v.optional(v.string()),
  host: v.optional(v.string()),
  open: v.optional(v.boolean()),
  port: v.optional(PortSchema),
  staticDir: v.optional(v.string()),
});

export function resolveDevCommandOptions<TOptions extends DevCommandOptions>(
  options: TOptions,
  {
    env = process.env,
    // std-env can only detect agents from the live process.env, not from the injected `env`.
    // Tests pass `null` to force non-agent behavior instead of scrubbing the real environment.
    agent = detectAgent(),
  }: { env?: DevCommandEnvironment; agent?: AgentInfo | null } = {}
) {
  const isClaudePreview = isClaudePreviewLaunch(env);
  // AI agents usually start Storybook to verify changes; auto-opening the system
  // browser next to their own preview is pure noise, so suppress it silently.
  const isAgentSession = isClaudePreview || !!agent;
  const PORT = env.PORT ?? undefined;
  const SBCONFIG_PORT = env.SBCONFIG_PORT ?? undefined;

  const result = v.safeParse(DevOptionsSchema, {
    ...options,
    host: env.SBCONFIG_HOSTNAME || options.host,
    staticDir: env.SBCONFIG_STATIC_DIR || options.staticDir,
    configDir: env.SBCONFIG_CONFIG_DIR || options.configDir,
    ci: env.CI || options.ci,
    port: isClaudePreview
      ? (PORT ?? options.port ?? SBCONFIG_PORT)
      : (options.port ?? SBCONFIG_PORT ?? PORT),
    open: isAgentSession ? false : options.open,
  });

  if (!result.success) {
    throw new HandledError(v.summarize(result.issues));
  }

  return result.output as TOptions & v.InferOutput<typeof DevOptionsSchema>;
}

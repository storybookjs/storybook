import type { InterceptReason, StorybookInstanceRecord } from './types.ts';

/**
 * Repair-instruction markdown for agents, mirroring `@storybook/mcp-proxy` (storybookjs/mcp) so
 * the CLI and the proxy give the same guidance — keep the two in sync when updating either.
 */
const NO_INSTANCE_EMPTY = `Storybook is not running at this cwd. Start \`storybook dev\` from the project's cwd and retry the command.`;

const buildNoInstanceWithCandidates = (records: StorybookInstanceRecord[]) => {
  const instances = records.map((r) => {
    const configDir = r.configDir ? `, config dir \`${r.configDir}\`` : '';
    return `- cwd \`${r.cwd}\`${configDir} (${r.url})`;
  });
  // Concrete invocations built from each instance's recorded values, so the agent can copy one
  // verbatim. Either flag alone selects the instance; both are shown so agents learn both.
  const examples = [
    ...new Set(
      records.flatMap((r) => [
        `- \`storybook ai --cwd ${r.cwd} <command> [args...]\``,
        ...(r.configDir
          ? [`- \`storybook ai --config-dir ${r.configDir} <command> [args...]\``]
          : []),
      ])
    ),
  ];

  return `No running Storybook matches this project (neither its cwd nor its Storybook config dir). Either start \`storybook dev\` from this project, or retry with \`--cwd\` or \`--config-dir\` pointing at one of the running Storybooks below. Both flags must be placed BEFORE the command name.

Running Storybooks:
${instances.join('\n')}

Retry examples (replace \`<command>\` with the command you ran):
${examples.join('\n')}`;
};

const buildPortMismatch = (port: number | undefined, records: StorybookInstanceRecord[]) =>
  `Storybook is running for this project, but not on port \`${port ?? 'unknown'}\`. Retry with one of the running ports below, or omit \`--port\` to route by project alone.

Running Storybooks for this project:
${records.map((r) => `- port \`${r.port}\` (${r.url}, status: \`${r.mcp.status}\`)`).join('\n')}`;

const ADDON_MISSING = `Storybook is running but does not provide these commands. The \`@storybook/addon-mcp\` addon is missing.

Install it:
\`\`\`
npx storybook add @storybook/addon-mcp
\`\`\`

Restart Storybook, then retry the command.`;

const MCP_STARTING = `Storybook is running but its command server is still starting up. Wait a moment and retry the command.`;

const MCP_ERROR = `Storybook is running but its command server reported an error. Inspect the Storybook terminal output, fix the underlying issue, then retry the command.`;

export type InterceptExtras = {
  records?: StorybookInstanceRecord[];
  port?: number;
};

export function getInterceptMarkdown(
  reason: InterceptReason,
  extras: InterceptExtras = {}
): string {
  const { records, port } = extras;
  switch (reason) {
    case 'no-instance':
      return records && records.length > 0
        ? buildNoInstanceWithCandidates(records)
        : NO_INSTANCE_EMPTY;
    case 'port-mismatch':
      return buildPortMismatch(port, records ?? []);
    case 'addon-missing':
      return ADDON_MISSING;
    case 'mcp-starting':
      return MCP_STARTING;
    case 'mcp-error':
      return MCP_ERROR;
    default: {
      const unhandled: never = reason;
      throw new Error(`Unhandled intercept reason: ${unhandled as string}`);
    }
  }
}

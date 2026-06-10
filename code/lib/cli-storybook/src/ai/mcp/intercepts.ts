import type { InterceptReason, StorybookInstanceRecord } from './types.ts';
import { STORYBOOK_MIN_VERSION } from './version-check.ts';

/**
 * Repair-instruction markdown for agents, mirroring `@storybook/mcp-proxy` (storybookjs/mcp) so
 * the CLI and the proxy give the same guidance — keep the two in sync when updating either.
 */
const NO_INSTANCE_EMPTY = `Storybook is not running at this cwd. Start \`storybook dev\` from the project's cwd and retry the command.`;

const buildNoInstanceWithCandidates = (records: StorybookInstanceRecord[]) =>
  `No Storybook is running at this cwd. Either start Storybook from the project's cwd, or retry with \`--cwd\` set to one of the running cwds below.

Running Storybooks:
${records.map((r) => `- \`${r.cwd}\` (${r.url})`).join('\n')}`;

const buildPortMismatch = (port: number | undefined, records: StorybookInstanceRecord[]) =>
  `Storybook is running at this cwd, but not on port \`${port ?? 'unknown'}\`. Retry with one of the running ports below, or omit \`--port\` to route by cwd alone.

Running Storybooks at this cwd:
${records.map((r) => `- port \`${r.port}\` (${r.url}, status: \`${r.mcp.status}\`)`).join('\n')}`;

const buildStorybookTooOld = (version: string) =>
  `The Storybook installed at this cwd is version \`${version}\`, but this command requires \`${STORYBOOK_MIN_VERSION}\` or newer.

Ask the user whether they want to upgrade Storybook. If they agree, invoke the \`storybook-upgrade\` skill to perform the upgrade, then run:
\`\`\`
npx storybook add @storybook/addon-mcp
\`\`\`
to install the addon that provides these commands. Restart Storybook, then retry the command.`;

const STORYBOOK_NOT_INSTALLED = `No Storybook is running at this cwd, and Storybook does not appear to be installed here (\`storybook\` could not be resolved from this project).

Ask the user whether they want to add Storybook. If they agree, invoke the \`storybook-init\` skill to set it up, then install the addon that provides these commands:
\`\`\`
npx storybook add @storybook/addon-mcp
\`\`\`
Start Storybook, then retry the command.

If you believe Storybook is in fact installed (e.g. a monorepo where \`storybook\` resolves from a different location), start \`storybook dev\` from this exact cwd and retry — a running instance is always used regardless of this check.`;

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
  version?: string;
  port?: number;
};

export function getInterceptMarkdown(
  reason: InterceptReason,
  extras: InterceptExtras = {}
): string {
  const { records, version, port } = extras;
  switch (reason) {
    case 'no-instance':
      return records && records.length > 0
        ? buildNoInstanceWithCandidates(records)
        : NO_INSTANCE_EMPTY;
    case 'port-mismatch':
      return buildPortMismatch(port, records ?? []);
    case 'storybook-not-installed':
      return STORYBOOK_NOT_INSTALLED;
    case 'addon-missing':
      return ADDON_MISSING;
    case 'mcp-starting':
      return MCP_STARTING;
    case 'mcp-error':
      return MCP_ERROR;
    case 'storybook-too-old':
      return buildStorybookTooOld(version ?? 'unknown');
    default: {
      const unhandled: never = reason;
      throw new Error(`Unhandled intercept reason: ${unhandled as string}`);
    }
  }
}

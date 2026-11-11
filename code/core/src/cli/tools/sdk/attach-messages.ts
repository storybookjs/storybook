import type { StorybookInstanceRecord } from '../instances/types.ts';
import type { ToolsStorybookInfo } from './types.ts';

const RESTART_GUIDANCE =
  'From your project directory, restart Storybook (for example `npx storybook dev`) and re-run this command from there.';

export function formatNoInstance(records: StorybookInstanceRecord[]): string {
  const lines = [
    'No running Storybook was found for this project. Start it first (for example `npm run storybook`), then retry with `--attach`.',
  ];
  if (records.length > 0) {
    lines.push(
      '',
      'Running Storybook instances that did not match this project — target one by re-running this command from its project directory, or with `--config-dir <dir>`:'
    );
    for (const record of records) {
      const configDir = record.configDir ? `; configDir \`${record.configDir}\`` : '';
      lines.push(`- ${record.url} (cwd \`${record.cwd}\`${configDir})`);
    }
  }
  return lines.join('\n');
}

export function formatPortMismatch(port: number, candidates: StorybookInstanceRecord[]): string {
  const lines = [
    `No running Storybook instance is on port ${port}. Retry with one of the running instances below, or omit \`--port\` to match on the project's cwd/config dir instead:`,
  ];
  for (const record of candidates) {
    lines.push(`- ${record.url} (port \`${record.port}\`, cwd \`${record.cwd}\`)`);
  }
  return lines.join('\n');
}

export function formatOldServer(version: string): string {
  return `Restart Storybook (v${version}+) to enable attach. The running instance was started with an older Storybook that does not publish a channel token.`;
}

export function formatConnectionFailed(record: StorybookInstanceRecord): string {
  return `Could not connect to the Storybook at ${record.url}. The instance registry may be stale — if that Storybook is no longer running, start it again (for example \`npm run storybook\`) and retry.`;
}

// Symmetric fact-only report: every path shown is a stored or compared fact, and no path appears
// in executable-command position — an agent must not be able to paste an installation path into a
// flag.
export function formatInstallationMismatch({
  callerPath,
  callerVersion,
  instancePath,
  instanceVersion,
  configDir,
}: {
  callerPath: string;
  callerVersion: string;
  instancePath: string;
  instanceVersion?: string;
  configDir?: string;
}): string {
  const instanceConfigDir = configDir ? `; config dir \`${configDir}\`` : '';
  return [
    'The running Storybook and this CLI are different `storybook` installations:',
    `- running instance: \`${instancePath}\` (version ${instanceVersion ?? 'unknown'}${instanceConfigDir})`,
    `- this CLI: \`${callerPath}\` (version ${callerVersion})`,
    `They must be the same installation. ${RESTART_GUIDANCE}`,
  ].join('\n');
}

export function formatUnknownInstallation(): string {
  return `Could not verify that the running Storybook and this CLI are the same \`storybook\` installation. ${RESTART_GUIDANCE}`;
}

export function formatAttachFallback(remediation: string): string {
  return `${remediation}\n\nFalling back to loading this project's Storybook configuration.`;
}

/**
 * Out-of-band warning for a run that attached while sibling instances also matched the project.
 * Rendered to stderr, never into the result, so `--json` and `-o` output stay clean.
 */
export function formatMultiInstanceNotice(
  storybook: Pick<ToolsStorybookInfo, 'url' | 'port' | 'pid' | 'cwd' | 'configDir' | 'siblings'>
): string {
  const lines = [
    `Warning: Multiple Storybook instances match this project. This command used ${storybook.url ?? 'the selected instance'}${instanceDetails(storybook)}.`,
    '',
    'Other matching instances — target one with `--port <port>`:',
  ];
  for (const sibling of storybook.siblings ?? []) {
    lines.push(`- ${sibling.url}${instanceDetails(sibling)}`);
  }
  lines.push(
    '',
    'If results look unexpected, ask the user whether they want to stop the other instance(s).'
  );
  return lines.join('\n');
}

function instanceDetails(instance: {
  port?: number;
  pid?: number;
  cwd?: string;
  configDir?: string;
}): string {
  const details = [
    instance.port != null ? `port \`${instance.port}\`` : null,
    instance.pid != null ? `pid \`${instance.pid}\`` : null,
    instance.cwd ? `cwd \`${instance.cwd}\`` : null,
    instance.configDir ? `config dir \`${instance.configDir}\`` : null,
  ].filter((detail) => detail != null);
  return details.length > 0 ? ` (${details.join(', ')})` : '';
}

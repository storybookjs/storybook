import type { StorybookInstanceRecord } from '../instances/types.ts';

function quoteShellArg(value: string): string {
  if (!/[\s'"$`\\]/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function attachCommand(record: StorybookInstanceRecord): string {
  return record.configDir
    ? `npx storybook tools --attach --cwd ${quoteShellArg(record.cwd)} --config-dir ${quoteShellArg(record.configDir)}`
    : `npx storybook tools --attach --cwd ${quoteShellArg(record.cwd)}`;
}

export function formatNoInstance(records: StorybookInstanceRecord[]): string {
  const lines = [
    'No running Storybook was found for this project. Start it first (for example `npm run storybook`), then retry with `--attach`.',
  ];
  if (records.length > 0) {
    lines.push(
      '',
      'Running Storybook instances that did not match this project — target one with `cd <cwd>` or `--config-dir <dir>`:'
    );
    for (const record of records) {
      const configDir = record.configDir ? `; configDir \`${record.configDir}\`` : '';
      lines.push(`- ${record.url} (cwd \`${record.cwd}\`${configDir})`);
      lines.push(`  cd ${quoteShellArg(record.cwd)} && ${attachCommand(record)}`);
    }
  }
  return lines.join('\n');
}

export function formatPortMismatch(
  port: number,
  projectMatches: StorybookInstanceRecord[]
): string {
  const lines = [
    `No Storybook instance for this project is running on port ${port}. Matching instances — target one with \`--port <port>\`:`,
  ];
  for (const record of projectMatches) {
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

export function formatCwdMismatch(processCwd: string, instanceCwd: string): string {
  return `This process is running from ${processCwd}, but the Storybook instance is running from ${instanceCwd}. \`cd ${quoteShellArg(instanceCwd)}\` and retry, or pass \`--cwd ${quoteShellArg(instanceCwd)}\`.`;
}

export function formatVersionMismatch(callerVersion: string, instanceVersion: string): string {
  return `This process is Storybook ${callerVersion}, but the running instance is ${instanceVersion}. Restart your Storybook so both sides match.`;
}

export function formatRestartRequired(
  resolvedProjectVersion: string,
  instanceVersion: string
): string {
  return `The Storybook package in this project is ${resolvedProjectVersion}, but the running instance is ${instanceVersion}. Restart your Storybook so both sides match.`;
}

export function formatAttachFallback(remediation: string): string {
  return `${remediation}\n\nFalling back to loading this project's Storybook configuration.`;
}

/**
 * Out-of-band warning for a run that attached while sibling instances also matched the project.
 * Rendered to stderr, never into the result, so `--json` and `-o` output stay clean.
 */
export function formatMultiInstanceNotice(storybook: {
  url?: string;
  pid?: number;
  siblings?: Array<{ url: string; port: number; pid: number; cwd: string; configDir?: string }>;
}): string {
  const lines = [
    `Warning: Multiple Storybook instances match this project. This command used ${storybook.url ?? 'the selected instance'}${storybook.pid != null ? ` (pid ${storybook.pid})` : ''}.`,
    '',
    'Other matching instances — target one with `--port <port>`:',
  ];
  for (const sibling of storybook.siblings ?? []) {
    const configDir = sibling.configDir ? `, config dir \`${sibling.configDir}\`` : '';
    lines.push(
      `- ${sibling.url} (port \`${sibling.port}\`, pid \`${sibling.pid}\`, cwd \`${sibling.cwd}\`${configDir})`
    );
  }
  return lines.join('\n');
}

import { describe, expect, it } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import {
  formatAttachFallback,
  formatConnectionFailed,
  formatInstallationMismatch,
  formatMultiInstanceNotice,
  formatNoInstance,
  formatOldServer,
  formatPortMismatch,
  formatUnknownInstallation,
} from './attach-messages.ts';

const other: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'other',
  pid: 11,
  cwd: '/apps/web',
  configDir: '/apps/web/.storybook',
  url: 'http://localhost:6006',
  port: 6006,
  token: 't',
  storybookVersion: '10.2.0',
  storybookPath: '/apps/web/node_modules/storybook',
  mcp: { status: 'ready' },
};

const sibling: StorybookInstanceRecord = {
  ...other,
  instanceId: 'sibling',
  pid: 12,
  cwd: '/apps/ui',
  configDir: '/apps/ui/.storybook',
  url: 'http://localhost:6007',
  port: 6007,
};

const mismatch = {
  callerPath: '/work/my app/node_modules/storybook',
  callerVersion: '10.5.2',
  instancePath: '/home/user/.npm/_npx/a1b2c3/node_modules/storybook',
  instanceVersion: '10.7.0',
  configDir: '/work/my app/.storybook',
};

describe('attach failure messages', () => {
  it('tells the caller how to start Storybook and lists the running instances that did not match', () => {
    expect(formatNoInstance([])).toMatchInlineSnapshot(`
      "No running Storybook was found for this project. Start it first (for example \`npm run storybook\`), then retry with \`--attach\`."
    `);
    expect(formatNoInstance([other])).toMatchInlineSnapshot(`
      "No running Storybook was found for this project. Start it first (for example \`npm run storybook\`), then retry with \`--attach\`.

      Running Storybook instances that did not match this project — target one by re-running this command from its project directory, or with \`--config-dir <dir>\`:
      - http://localhost:6006 (cwd \`/apps/web\`; configDir \`/apps/web/.storybook\`)"
    `);
  });

  it('names the running ports and the --port that selects one on a port mismatch', () => {
    expect(formatPortMismatch(9999, [other, sibling])).toMatchInlineSnapshot(`
      "No running Storybook instance is on port 9999. Retry with one of the running instances below, or omit \`--port\` to match on the project's cwd/config dir instead:
      - http://localhost:6006 (port \`6006\`, cwd \`/apps/web\`)
      - http://localhost:6007 (port \`6007\`, cwd \`/apps/ui\`)"
    `);
  });

  it('names the used instance and each competing sibling with the --port that selects it', () => {
    expect(
      formatMultiInstanceNotice({
        url: 'http://localhost:6007',
        port: 6007,
        pid: 123,
        cwd: '/apps/web',
        configDir: '/apps/web/.storybook',
        siblings: [
          {
            url: 'http://localhost:6006',
            port: 6006,
            pid: 456,
            cwd: '/apps/web',
            configDir: '/apps/web/.storybook',
          },
        ],
      })
    ).toMatchInlineSnapshot(`
      "Warning: Multiple Storybook instances match this project. This command used http://localhost:6007 (port \`6007\`, pid \`123\`, cwd \`/apps/web\`, config dir \`/apps/web/.storybook\`).

      Other matching instances — target one with \`--port <port>\`:
      - http://localhost:6006 (port \`6006\`, pid \`456\`, cwd \`/apps/web\`, config dir \`/apps/web/.storybook\`)

      If results look unexpected, ask the user whether they want to stop the other instance(s)."
    `);
  });

  it('names the version that must be restarted to enable attach', () => {
    expect(formatOldServer('10.2.0')).toMatchInlineSnapshot(
      `"Restart Storybook (v10.2.0+) to enable attach. The running instance was started with an older Storybook that does not publish a channel token."`
    );
  });

  it('points at the unreachable URL and how to start Storybook again', () => {
    expect(formatConnectionFailed(other)).toMatchInlineSnapshot(
      `"Could not connect to the Storybook at http://localhost:6006. The instance registry may be stale — if that Storybook is no longer running, start it again (for example \`npm run storybook\`) and retry."`
    );
  });

  it('shows both installations with their versions and the instance config dir on a mismatch', () => {
    expect(formatInstallationMismatch(mismatch)).toMatchInlineSnapshot(`
      "The running Storybook and this CLI are different \`storybook\` installations:
      - running instance: \`/home/user/.npm/_npx/a1b2c3/node_modules/storybook\` (version 10.7.0; config dir \`/work/my app/.storybook\`)
      - this CLI: \`/work/my app/node_modules/storybook\` (version 10.5.2)
      They must be the same installation. From your project directory, restart Storybook (for example \`npx storybook dev\`) and re-run this command from there."
    `);
  });

  it('renders unknown facts on a mismatch without guessing them', () => {
    expect(
      formatInstallationMismatch({
        callerPath: mismatch.callerPath,
        callerVersion: mismatch.callerVersion,
        instancePath: mismatch.instancePath,
      })
    ).toMatchInlineSnapshot(`
      "The running Storybook and this CLI are different \`storybook\` installations:
      - running instance: \`/home/user/.npm/_npx/a1b2c3/node_modules/storybook\` (version unknown)
      - this CLI: \`/work/my app/node_modules/storybook\` (version 10.5.2)
      They must be the same installation. From your project directory, restart Storybook (for example \`npx storybook dev\`) and re-run this command from there."
    `);
  });

  it('tells the caller to restart when the record does not prove the installations match', () => {
    expect(formatUnknownInstallation()).toMatchInlineSnapshot(
      `"Could not verify that the running Storybook and this CLI are the same \`storybook\` installation. From your project directory, restart Storybook (for example \`npx storybook dev\`) and re-run this command from there."`
    );
  });

  it('names the local fallback after the gate message', () => {
    expect(
      formatAttachFallback('Restart Storybook (v10.2.0+) to enable attach.')
    ).toMatchInlineSnapshot(
      `"Restart Storybook (v10.2.0+) to enable attach.

Falling back to loading this project's Storybook configuration."`
    );
  });

  it('never places a path in executable-command position anywhere in the message catalog', () => {
    // Matches a real path (absolute, home-relative, dot-relative, or Windows) directly after `cd `
    // or a `--flag`, i.e. a copy-pasteable command an agent could run with a constructed or
    // node_modules-deep path.
    const pathInCommandPosition = /(?:\bcd\s+|--[\w-]+[= ])[`'"]?(?:~?\/|\.\.?\/|[A-Za-z]:[\\/])/;

    const renderedMessages = [
      formatNoInstance([other, sibling]),
      formatPortMismatch(9999, [other, sibling]),
      formatOldServer('10.2.0'),
      formatConnectionFailed(other),
      formatInstallationMismatch(mismatch),
      formatUnknownInstallation(),
      formatAttachFallback(formatInstallationMismatch(mismatch)),
      formatMultiInstanceNotice({
        url: other.url,
        port: other.port,
        pid: other.pid,
        cwd: other.cwd,
        configDir: other.configDir!,
        siblings: [
          {
            url: sibling.url,
            port: sibling.port,
            pid: sibling.pid,
            cwd: sibling.cwd,
            configDir: sibling.configDir,
          },
        ],
      }),
    ];

    for (const message of renderedMessages) {
      expect(message).not.toMatch(pathInCommandPosition);
    }
  });
});

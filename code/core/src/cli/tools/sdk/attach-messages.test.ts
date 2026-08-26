import { describe, expect, it } from 'vitest';

import type { StorybookInstanceRecord } from '../instances/types.ts';
import {
  formatAttachFallback,
  formatConnectionFailed,
  formatCwdMismatch,
  formatMultipleMatches,
  formatNoInstance,
  formatOldServer,
  formatRestartRequired,
  formatVersionMismatch,
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

describe('attach failure messages', () => {
  it('tells the caller how to start Storybook and how to target another running instance', () => {
    expect(formatNoInstance([])).toMatchInlineSnapshot(`
      "No running Storybook was found for this project. Start it first (for example \`npm run storybook\`), then retry with \`--attach\`."
    `);
    expect(formatNoInstance([other])).toMatchInlineSnapshot(`
      "No running Storybook was found for this project. Start it first (for example \`npm run storybook\`), then retry with \`--attach\`.

      Running Storybook instances that did not match this project — target one with \`cd <cwd>\` or \`--config-dir <dir>\`:
      - http://localhost:6006 (cwd \`/apps/web\`; configDir \`/apps/web/.storybook\`)
        cd /apps/web && npx storybook tools --attach --cwd /apps/web --config-dir /apps/web/.storybook"
    `);
  });

  it('names each match and the --config-dir that selects it', () => {
    expect(formatMultipleMatches([other, sibling])).toMatchInlineSnapshot(`
      "Multiple Storybook instances match this project. Disambiguate with \`--config-dir <dir>\`:
      - http://localhost:6006 (configDir \`/apps/web/.storybook\`)
        npx storybook tools --attach --cwd /apps/web --config-dir /apps/web/.storybook
      - http://localhost:6007 (configDir \`/apps/ui/.storybook\`)
        npx storybook tools --attach --cwd /apps/ui --config-dir /apps/ui/.storybook"
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

  it('quotes paths that contain whitespace in copy-paste commands', () => {
    const spaced: StorybookInstanceRecord = {
      ...other,
      cwd: '/work/My App',
      configDir: '/work/My App/.storybook',
    };

    expect(formatNoInstance([spaced])).toContain(
      `cd '/work/My App' && npx storybook tools --attach --cwd '/work/My App' --config-dir '/work/My App/.storybook'`
    );
    expect(formatCwdMismatch('/tmp/agent', '/work/My App')).toContain("`--cwd '/work/My App'`");
  });

  it('tells the caller to move into the instance directory', () => {
    expect(formatCwdMismatch('/tmp/agent', '/apps/web')).toMatchInlineSnapshot(
      `"This process is running from /tmp/agent, but the Storybook instance is running from /apps/web. \`cd /apps/web\` and retry, or pass \`--cwd /apps/web\`."`
    );
  });

  it('names both Storybook versions and tells the caller to restart', () => {
    expect(formatVersionMismatch('10.2.0', '10.1.0')).toMatchInlineSnapshot(
      `"This process is Storybook 10.2.0, but the running instance is 10.1.0. Restart your Storybook so both sides match."`
    );
  });

  it('names the on-disk package and the running instance when spawning cannot reconcile them', () => {
    expect(formatRestartRequired('10.4.0', '10.2.0')).toMatchInlineSnapshot(
      `"The Storybook package in this project is 10.4.0, but the running instance is 10.2.0. Restart your Storybook so both sides match."`
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
});

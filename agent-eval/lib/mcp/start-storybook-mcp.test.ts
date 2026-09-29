import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'start-storybook-mcp.mjs'
);

let projectDir: string | undefined;

afterEach(() => {
  if (projectDir) {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

function runInstall(options: {
  checkoutPackages?: string[];
  lockfilePackages: Record<string, { resolved?: string }>;
}) {
  projectDir = mkdtempSync(path.join(tmpdir(), 'start-storybook-mcp-'));
  if (options.checkoutPackages) {
    mkdirSync(path.join(projectDir, 'local-packages'));
    writeFileSync(
      path.join(projectDir, 'local-packages', 'packages.json'),
      JSON.stringify(options.checkoutPackages)
    );
  }
  writeFileSync(
    path.join(projectDir, 'package-lock.json'),
    JSON.stringify({ lockfileVersion: 3, packages: options.lockfilePackages })
  );

  // Nothing listens on port 1 and there is no Storybook to start, so a run that passes the check
  // ends in the readiness failure after the 1ms timeout.
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: projectDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      STORYBOOK_MCP_PORT: '1',
      STORYBOOK_MCP_TIMEOUT_MS: '1',
      STORYBOOK_MCP_LOG_PATH: path.join(projectDir, 'storybook.log'),
    },
  });
}

describe('the checkout package check', () => {
  it('fails the install when a packed package was resolved from the registry', () => {
    const result = runInstall({
      checkoutPackages: ['storybook', '@storybook/addon-mcp'],
      lockfilePackages: {
        '': {},
        'node_modules/storybook': { resolved: 'file:local-packages/storybook.tgz' },
        'packages/ui/node_modules/@storybook/addon-mcp': {
          resolved: 'https://registry.npmjs.org/@storybook/addon-mcp/-/addon-mcp-11.0.0.tgz',
        },
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Installed from the registry instead of the checkout:\npackages/ui/node_modules/@storybook/addon-mcp (https://registry.npmjs.org/@storybook/addon-mcp/-/addon-mcp-11.0.0.tgz)'
    );
    expect(result.stderr).not.toContain('did not become ready');
  });

  it('accepts tarballs, packages it did not pack, and workspace folders named like a package', () => {
    const result = runInstall({
      checkoutPackages: ['storybook'],
      lockfilePackages: {
        '': {},
        'node_modules/storybook': { resolved: 'file:local-packages/storybook.tgz' },
        'node_modules/@storybook/addon-themes': {
          resolved: 'https://registry.npmjs.org/@storybook/addon-themes/-/addon-themes-11.0.0.tgz',
        },
        'packages/ui-storybook': {},
        'node_modules/ui-storybook': { resolved: 'packages/ui-storybook' },
      },
    });

    expect(result.stderr).not.toContain('Installed from the registry');
    expect(result.stderr).toContain('did not become ready');
  });

  it('skips the check when Storybook was not installed from the checkout', () => {
    const result = runInstall({
      lockfilePackages: {
        'node_modules/storybook': {
          resolved: 'https://registry.npmjs.org/storybook/-/storybook-10.6.0.tgz',
        },
      },
    });

    expect(result.stderr).not.toContain('Installed from the registry');
    expect(result.stderr).toContain('did not become ready');
  });
});

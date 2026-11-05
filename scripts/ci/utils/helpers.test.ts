import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WORKING_DIR } from './constants.ts';
import { workspace, workspaceIntegrityCheck } from './helpers.ts';

// The roots `pack` archives, plus the one sentinel inside the root tree. A complete tree is every
// one of these present; each case below removes exactly one.
const COMPLETE_TREE_DIRS = [
  `${WORKING_DIR}/node_modules/@types/node`,
  `${WORKING_DIR}/code/node_modules`,
  `${WORKING_DIR}/scripts/node_modules`,
  `${WORKING_DIR}/agent-eval/node_modules`,
];

const SENTINEL_FILE = `${WORKING_DIR}/node_modules/@types/node/index.d.ts`;

let root: string;

// Run the check the way CircleCI runs a `run` step, from the same working directory the generated
// step declares, so the relative paths in the emitted shell resolve as they do on the executor.
const runCheck = () =>
  spawnSync('bash', ['-eo', 'pipefail', '-c', workspaceIntegrityCheck()], {
    cwd: root,
    encoding: 'utf8',
  });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'workspace-integrity-'));
  for (const dir of COMPLETE_TREE_DIRS) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(join(root, SENTINEL_FILE), '');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('workspaceIntegrityCheck', () => {
  it('passes on a fully extracted tree', () => {
    const { status, stderr } = runCheck();

    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('fails when a packed root is missing entirely', () => {
    rmSync(join(root, `${WORKING_DIR}/scripts/node_modules`), { recursive: true });

    const { status, stderr } = runCheck();

    expect(status).toBe(1);
    expect(stderr).toContain('workspace node_modules is incomplete');
    expect(stderr).toContain(`${WORKING_DIR}/scripts/node_modules`);
  });

  // The case a roots-only check would wave through: the root tree is present but was restored
  // without `@types/node`, so every package typechecking `node:` builtins fails far from the cause.
  it('fails when the root tree is present but missing @types/node', () => {
    rmSync(join(root, `${WORKING_DIR}/node_modules/@types/node`), { recursive: true });

    const { status, stderr } = runCheck();

    expect(status).toBe(1);
    expect(stderr).toContain(SENTINEL_FILE);
    // The root itself survives, so it must not be reported as missing.
    expect(stderr).not.toContain(` ${WORKING_DIR}/node_modules `);
  });

  // A short archive leaves the directory entry behind without its contents, which is why the
  // sentinel is a file: checking the directory would pass on exactly this tree.
  it('fails when @types/node is an empty directory rather than a populated package', () => {
    rmSync(join(root, SENTINEL_FILE));

    const { status, stderr } = runCheck();

    expect(status).toBe(1);
    expect(stderr).toContain(SENTINEL_FILE);
  });

  it('names every missing path in one failure rather than stopping at the first', () => {
    rmSync(join(root, `${WORKING_DIR}/code/node_modules`), { recursive: true });
    rmSync(join(root, `${WORKING_DIR}/agent-eval/node_modules`), { recursive: true });

    const { status, stderr } = runCheck();

    expect(status).toBe(1);
    expect(stderr).toContain(`${WORKING_DIR}/code/node_modules`);
    expect(stderr).toContain(`${WORKING_DIR}/agent-eval/node_modules`);
  });

  it('is embedded verbatim in the unpack step, so the tests above cover what CI runs', () => {
    expect(workspace.unpack().run.command).toContain(workspaceIntegrityCheck());
  });
});

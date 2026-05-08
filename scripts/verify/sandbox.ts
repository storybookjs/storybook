// Sandbox resolution, snapshot/restore, and resolutions sanitization for the PR verify harness.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

export function resolveSandboxDir(
  template: 'react-vite/default-ts' = 'react-vite/default-ts'
): string {
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const sandboxKey = template.replace('/', '-');
  const envOverride = process.env.STORYBOOK_SANDBOX_ROOT;
  const candidates: string[] = [];
  if (envOverride) {
    const root = path.isAbsolute(envOverride) ? envOverride : path.join(repoRoot, envOverride);
    candidates.push(path.join(root, sandboxKey));
  }
  candidates.push(
    path.join(repoRoot, 'code', 'sandbox', sandboxKey),
    path.join(repoRoot, 'sandbox', sandboxKey),
    path.join(repoRoot, '..', 'storybook-sandboxes', sandboxKey)
  );

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'node_modules', 'storybook'))) {
      return candidate;
    }
  }

  throw new Error(
    'Sandbox not bootstrapped for template ' +
      template +
      '. Checked:\n' +
      candidates.map((p) => '  - ' + p).join('\n') +
      '\nBootstrap with:\n  yarn task sandbox -s task --no-link --template ' +
      template
  );
}

export async function snapshotSandbox(sandboxDir: string): Promise<void> {
  const snapshotDir = path.join(sandboxDir, '.verify-snapshot');
  await mkdir(snapshotDir, { recursive: true });
  for (const name of ['package.json', 'yarn.lock', '.yarnrc.yml']) {
    const src = path.join(sandboxDir, name);
    const dst = path.join(snapshotDir, name);
    if (existsSync(src)) {
      await copyFile(src, dst);
    }
  }
}

export async function restoreSandbox(sandboxDir: string): Promise<void> {
  const snapshotDir = path.join(sandboxDir, '.verify-snapshot');
  if (!existsSync(snapshotDir)) {
    throw new Error('No .verify-snapshot/ found at ' + snapshotDir + '. Cannot restore.');
  }
  for (const name of ['package.json', 'yarn.lock', '.yarnrc.yml']) {
    const src = path.join(snapshotDir, name);
    const dst = path.join(sandboxDir, name);
    if (existsSync(src)) {
      await copyFile(src, dst);
    }
  }
  console.log('[sandbox] restored from .verify-snapshot/');
}

export async function sanitizeResolutions(sandboxDir: string): Promise<boolean> {
  const pkgPath = path.join(sandboxDir, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  if (!pkg.resolutions) return false;
  let removed = false;
  for (const key of Object.keys(pkg.resolutions)) {
    if (key === 'storybook' || key.startsWith('@storybook/')) {
      delete pkg.resolutions[key];
      removed = true;
    }
  }
  if (removed) {
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }
  return removed;
}

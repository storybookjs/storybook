import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';

import { findPackageRoot } from '@storybook/core/internal/common';

import { dirname, join, normalize } from 'pathe';

import type { StorybookInstanceRecord } from './instances/types.ts';
import { projectPathsEqual } from './instances/project-path.ts';
import { resolveChildHostScript } from './resolve-project-storybook.ts';

export type InstallationCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'different-installation';
      callerPath: string;
      /** The instance's realpathed `@storybook/core` root; absent for a pre-split `storybook` that runs none. */
      instancePath?: string;
      /** The instance's realpathed `storybook` root, when recorded: where its child host resolves. */
      storybookPath?: string;
    }
  | { ok: false; reason: 'unknown-installation' };

/** Realpathed root of the `@storybook/core` package this process runs. */
export function findCorePackageRoot(): string | undefined {
  try {
    const manifest = createRequire(import.meta.url).resolve('@storybook/core/package.json');
    return findPackageRoot(dirname(manifest), '@storybook/core');
  } catch {
    return undefined;
  }
}

/** Realpathed root of the `@storybook/core` package the `storybook` package at `storybookPath` runs. */
export function findStorybookCoreRoot(storybookPath: string): string | undefined {
  try {
    const manifest = createRequire(join(storybookPath, 'package.json')).resolve(
      '@storybook/core/package.json'
    );
    return findPackageRoot(dirname(manifest), '@storybook/core');
  } catch {
    return undefined;
  }
}

// Decides how to attach: the same `@storybook/core` installation on both sides may join
// in-process; a different one must go through a child host of the instance's installation.
// Records without `corePath` (older servers) derive it from `storybookPath`. A pre-split
// `storybook` runs no `@storybook/core`, so it counts as a different installation when its own
// child host resolves; otherwise the installation is unknown — the check never guesses.
export function checkInstallation(
  record: Pick<StorybookInstanceRecord, 'storybookPath' | 'corePath'>,
  callerPath: string | undefined,
  {
    deriveCorePath = findStorybookCoreRoot,
    hasChildHost = canResolveChildHost,
  }: {
    deriveCorePath?: (storybookPath: string) => string | undefined;
    hasChildHost?: (storybookPath: string) => boolean;
  } = {}
): InstallationCheck {
  if (!callerPath) {
    return { ok: false, reason: 'unknown-installation' };
  }

  const recordedCorePath =
    record.corePath ?? (record.storybookPath ? deriveCorePath(record.storybookPath) : undefined);
  const instancePath = recordedCorePath && realpath(recordedCorePath);
  const storybookPath = record.storybookPath && realpath(record.storybookPath);
  if (!instancePath) {
    if (!record.corePath && storybookPath && hasChildHost(storybookPath)) {
      return { ok: false, reason: 'different-installation', callerPath, storybookPath };
    }
    return { ok: false, reason: 'unknown-installation' };
  }

  if (!projectPathsEqual(instancePath, callerPath)) {
    return {
      ok: false,
      reason: 'different-installation',
      callerPath,
      instancePath,
      ...(storybookPath ? { storybookPath } : {}),
    };
  }

  return { ok: true };
}

function canResolveChildHost(storybookPath: string): boolean {
  try {
    resolveChildHostScript(storybookPath);
    return true;
  } catch {
    return false;
  }
}

function realpath(path: string): string | undefined {
  try {
    return normalize(realpathSync(path));
  } catch {
    return undefined;
  }
}

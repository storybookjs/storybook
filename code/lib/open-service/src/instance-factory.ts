import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { findPackageRoot } from '@storybook/core/internal/common';
import {
  createStorybook as createCoreStorybook,
  type CreateStorybookInput,
  type Storybook,
} from '@storybook/core';

import { dirname, join } from 'pathe';

import { findCorePackageRoot, findStorybookCoreRoot } from './installation.ts';
import { projectPathsEqual } from './instances/project-path.ts';

export type StorybookFactory = (input: CreateStorybookInput) => Promise<Storybook>;

export type InstanceFactoryResolution =
  | { kind: 'factory'; createStorybook: StorybookFactory }
  | { kind: 'mismatch'; projectCorePath: string | undefined; callerCorePath: string | undefined };

/** Injectable dependencies for tests. */
export type InstanceFactoryDeps = {
  resolveInstanceEntry?: (resolutionRoot: string) => string | undefined;
  projectCorePath?: (instanceEntry: string) => string | undefined;
  callerCorePath?: () => string | undefined;
  importInstanceEntry?: (path: string) => Promise<{ createStorybook: StorybookFactory }>;
  createCoreStorybook?: StorybookFactory;
};

const PRODUCT_INSTANCE_ENTRY = 'storybook/internal/instance';

/**
 * Pick the instance factory before any configuration loads.
 *
 * An explicit factory wins. Otherwise the `storybook` resolved from `resolutionRoot` provides it
 * when it runs this process's `@storybook/core`; two cores never share one process. Without
 * `storybook`, core's own defaults load the configuration.
 */
export function resolveInstanceFactory(
  { explicit, resolutionRoot }: { explicit?: StorybookFactory; resolutionRoot: string },
  deps: InstanceFactoryDeps = {}
): InstanceFactoryResolution {
  if (explicit) {
    return { kind: 'factory', createStorybook: explicit };
  }

  const entry = (deps.resolveInstanceEntry ?? resolveProductInstanceEntry)(resolutionRoot);
  if (!entry) {
    const createStorybook = deps.createCoreStorybook ?? ((input) => createCoreStorybook(input));
    return { kind: 'factory', createStorybook };
  }

  const projectCorePath = (deps.projectCorePath ?? coreRootOfInstanceEntry)(entry);
  const callerCorePath = (deps.callerCorePath ?? findCorePackageRoot)();
  if (!projectCorePath || !callerCorePath || !projectPathsEqual(projectCorePath, callerCorePath)) {
    return { kind: 'mismatch', projectCorePath, callerCorePath };
  }

  const importEntry =
    deps.importInstanceEntry ??
    ((path: string) =>
      import(pathToFileURL(path).href) as Promise<{ createStorybook: StorybookFactory }>);
  return {
    kind: 'factory',
    createStorybook: async (input) => (await importEntry(entry)).createStorybook(input),
  };
}

function coreRootOfInstanceEntry(instanceEntry: string): string | undefined {
  const storybookPath = findPackageRoot(dirname(instanceEntry), 'storybook');
  return storybookPath ? findStorybookCoreRoot(storybookPath) : undefined;
}

function resolveProductInstanceEntry(resolutionRoot: string): string | undefined {
  try {
    return createRequire(join(resolutionRoot, 'package.json')).resolve(PRODUCT_INSTANCE_ENTRY);
  } catch {
    return undefined;
  }
}

/**
 * Registers the core toolsets the `storybook tools` CLI dispatches over.
 *
 * Test support: in a real invocation, loading the Storybook configuration runs the `services`
 * preset hooks, which register these before the CLI reads the registry. The real toolsets are used
 * (with stub runtime dependencies) rather than fakes, so the CLI is tested against the definitions
 * it ships with — the same approach as addon-mcp's scaffold.
 *
 * The `test` toolset is owned by `@storybook/addon-vitest` and is intentionally not registered
 * here. Cover it in the addon's own unit tests; core/CLI tests that need "test absent" behavior
 * already match this default.
 */

import type { StoryIndex } from 'storybook/internal/types';

import {
  clearToolsetRegistry,
  registerToolset,
} from '../../../shared/open-service/toolset-registry.ts';
import {
  emptyManifests,
  type DocsAccess,
} from '../../../shared/open-service/toolsets/docs/access.ts';
import { createDocsToolset } from '../../../shared/open-service/toolsets/docs/definition.ts';
import { reviewToolset } from '../../../shared/open-service/toolsets/review/definition.ts';
import { createStoriesToolset } from '../../../shared/open-service/toolsets/stories/definition.ts';

const EMPTY_INDEX: StoryIndex = { v: 5, entries: {} };

const EMPTY_DOCS_ACCESS: DocsAccess = {
  list: async () => emptyManifests(),
  resolve: async () => undefined,
};

export function registerCoreToolsetsForTest({
  index = EMPTY_INDEX,
  docsAccess = EMPTY_DOCS_ACCESS,
}: {
  index?: StoryIndex;
  docsAccess?: DocsAccess;
} = {}) {
  clearToolsetRegistry();

  const storyIndex = { getIndex: async () => index };

  registerToolset(
    createStoriesToolset({
      storyIndex,
      git: {
        getRepoRoot: async () => process.cwd(),
        getChangedFiles: async () => ({ changed: new Set<string>(), new: new Set<string>() }),
      },
      changeStatuses: { getAll: () => ({}) },
      storybookDirs: { configDir: `${process.cwd()}/.storybook`, getStaticDirs: async () => [] },
    })
  );
  registerToolset(reviewToolset);
  registerToolset(createDocsToolset({ docsAccess }));
}

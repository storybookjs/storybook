/**
 * Registers the core toolsets the MCP tools are adapters over.
 *
 * Test support: in a real Storybook the `services` preset hook registers these before the MCP
 * server boots, so a test that exercises tool registration has to stand that step up too. The real
 * toolsets are used (with stub runtime dependencies) rather than fakes, so the adapter is tested
 * against the definitions it ships with.
 *
 * The `test` toolset is owned by `@storybook/addon-vitest` and is intentionally not registered
 * here. Cover it in the addon's own unit tests; MCP tests that need a `test` toolset register a
 * local stub in the test file.
 */

import type { StoryIndex } from 'storybook/internal/types';
import { clearToolsetRegistry } from 'storybook/open-service';
import {
  createDocsToolset,
  createStoriesToolset,
  emptyManifests,
  registerToolset,
  reviewToolset,
} from 'storybook/internal/core-server';

const EMPTY_INDEX: StoryIndex = { v: 5, entries: {} };

export function registerCoreToolsetsForTest({
  index = EMPTY_INDEX,
  reviewEnabled = true,
}: { index?: StoryIndex; reviewEnabled?: boolean } = {}) {
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
      reviewEnabled,
    })
  );
  registerToolset(reviewToolset);
  registerToolset(
    createDocsToolset({
      docsAccess: { list: async () => emptyManifests(), resolve: async () => undefined },
    })
  );
}

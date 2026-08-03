/**
 * Registers the core toolsets the MCP tools are adapters over.
 *
 * Test support: in a real Storybook the `services` preset hook registers these before the MCP
 * server boots, so a test that exercises tool registration has to stand that step up too. The real
 * toolsets are used (with stub runtime dependencies) rather than fakes, so the adapter is tested
 * against the definitions it ships with.
 */

import type { StoryIndex } from 'storybook/internal/types';
import { clearToolsetRegistry } from 'storybook/open-service';
import { createStoriesToolset, registerToolset } from 'storybook/internal/core-server';

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
}

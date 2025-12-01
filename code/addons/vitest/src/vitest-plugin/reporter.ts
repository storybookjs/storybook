import type { Reporter, TaskResultPack } from 'vitest/reporters';

import { relative, resolve } from 'pathe';

const EVENT = 'storybook/test:visual-screenshot';

export default function storybookVisualReporter(): Reporter {
  return {
    onTaskUpdate(packs: TaskResultPack[]) {
      // Emit a window event via console for the Storybook manager to pick up when running embedded
      // tests. When running externally, the manager won't be listening.
      for (const pack of packs) {
        const [, result] = pack;

        if (!result) {
          continue;
        }
        // We don’t have direct access to Vitest’s internal path resolver outputs here reliably,
        // but we can heuristically reconstruct the attachments path for actual images using
        // default conventions. Users with custom resolvers will see the panel only when running
        // inside Storybook via emitted events from our own runner (future improvement).
        // For MVP, we skip computing paths and only rely on explicit emissions from the
        // Storybook UI runner which can augment metadata.
        // We don’t have direct access to Vitest’s internal path resolver outputs here reliably,
        // but we can heuristically reconstruct the attachments path for actual images using
        // default conventions. Users with custom resolvers will see the panel only when running
        // inside Storybook via emitted events from our own runner (future improvement).
        // For MVP, we skip computing paths and only rely on explicit emissions from the
        // Storybook UI runner which can augment metadata.
      }
    },
  };
}

import type { NormalizedStoriesSpecifier, Path } from 'storybook/internal/types';

import { relative, resolve } from 'pathe';

import { watchFiles } from './watch-files.ts';

export function watchStorySpecifiers(
  specifiers: NormalizedStoriesSpecifier[],
  options: { workingDir: Path },
  onInvalidate: (path: Path, removed: boolean) => void
) {
  const toImportPath = (absolutePath: Path) => {
    const relativePath = relative(options.workingDir, absolutePath);
    return /^\.\.(\/|$)/.test(relativePath) ? relativePath : `./${relativePath}`;
  };
  const isStoryFile = (absolutePath: Path) => {
    const importPath = toImportPath(absolutePath);
    return specifiers.some((ns) => ns.importPathMatcher.exec(importPath));
  };

  // Batch rapid file events to avoid redundant processing.
  // We collect events for 100ms, then process unique paths only.
  const pendingEvents = new Map<Path, { removed: boolean }>();
  let batchTimeout: ReturnType<typeof setTimeout> | undefined;

  function queueEvent(absolutePath: Path, removed: boolean) {
    // A symlink is watched whatever it points at, so not every reported path is a story file
    if (!isStoryFile(absolutePath)) {
      return;
    }

    // Store/overwrite the event for this path (last event type wins)
    pendingEvents.set(absolutePath, { removed });

    // Reset the timer on each new event to batch them together
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(() => {
      batchTimeout = undefined;
      const events = new Map(pendingEvents);
      pendingEvents.clear();

      events.forEach((event, path) => onInvalidate(toImportPath(path), event.removed));
    }, 100);
  }

  return watchFiles(
    [...new Set(specifiers.map((ns) => resolve(options.workingDir, ns.directory)))],
    queueEvent,
    isStoryFile
  );
}

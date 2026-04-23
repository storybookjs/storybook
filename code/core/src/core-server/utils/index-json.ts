import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import type {
  NormalizedStoriesSpecifier,
  Path,
  StoryId,
  StoryIndex,
} from 'storybook/internal/types';

import { debounce } from 'es-toolkit/function';
import type { Polka } from 'polka';

import { applyRenameChains } from '../../shared/rename-redirect-store/index.ts';
import { renameRedirectStore } from '../stores/rename-redirect.ts';
import type { StoryIndexGenerator } from './StoryIndexGenerator.ts';
import { watchStorySpecifiers } from './watch-story-specifiers.ts';
import { watchConfig } from './watchConfig.ts';

export const DEBOUNCE = 100;

export async function writeIndexJson(
  outputFile: string,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>
) {
  const generator = await initializedStoryIndexGenerator;
  const storyIndex = await generator.getIndex();
  await writeFile(outputFile, JSON.stringify(storyIndex));
}

type RenameCandidate = { oldPath: Path; newPath: Path };

/** Sorted export-name fingerprint string, used to match removed files to their new location. */
function fingerprintOf(exportMap: Record<string, StoryId>): string {
  return Object.keys(exportMap).sort().join(',');
}

/**
 * Match confirmed rename candidates (from Watchpack) to the current index using
 * export-name fingerprints drawn from the `StoryIndexGenerator`'s removed-file
 * snapshots. Returns the old → new story ID pairs, aligned by export name, and
 * the list of candidates that could not be confirmed (logged, then discarded).
 *
 * Fingerprint disambiguation is cross-platform (no filesystem probing) and
 * intentionally conservative: any mismatch or ambiguity drops the candidate
 * rather than risk redirecting the user to the wrong story.
 */
export function resolveRenamePairs(
  candidates: RenameCandidate[],
  removedSnapshots: Map<Path, Record<string, StoryId>>,
  index: StoryIndex,
  workingDir: string
): { renames: { oldId: StoryId; newId: StoryId }[]; unresolved: Path[] } {
  const renames: { oldId: StoryId; newId: StoryId }[] = [];
  const unresolved: Path[] = [];

  // Build: new import path → (export name → story ID) from the live index.
  const newExportsByPath = new Map<Path, Record<string, StoryId>>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story') {
      continue;
    }
    const exportName = (entry as { exportName?: string }).exportName;
    if (!exportName) {
      continue;
    }
    const bucket = newExportsByPath.get(entry.importPath) ?? {};
    bucket[exportName] = entry.id;
    newExportsByPath.set(entry.importPath, bucket);
  }

  for (const { oldPath, newPath } of candidates) {
    const absOld = resolve(workingDir, oldPath);
    const oldSnap = removedSnapshots.get(absOld);
    const newSnap = newExportsByPath.get(newPath);

    if (!oldSnap || !newSnap || fingerprintOf(oldSnap) !== fingerprintOf(newSnap)) {
      unresolved.push(oldPath);
      continue;
    }

    // Align old/new story IDs by export name — robust against any reordering.
    for (const exportName of Object.keys(oldSnap)) {
      const oldId = oldSnap[exportName];
      const newId = newSnap[exportName];
      if (oldId && newId) {
        renames.push({ oldId, newId });
      }
    }
  }

  return { renames, unresolved };
}

export function registerIndexJsonRoute({
  app,
  storyIndexGeneratorPromise,
  workingDir = process.cwd(),
  configDir,
  channel,
  normalizedStories,
  onStoryIndexInvalidated,
}: {
  app: Polka;
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  channel: ChannelLike;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
  onStoryIndexInvalidated?: () => void;
}) {
  // Accumulators drained inside `maybeInvalidate` after the index has settled.
  // Kept at this scope so repeat events within a debounce cycle coalesce.
  const pendingRenameCandidates: RenameCandidate[] = [];
  const pendingDeletions: Path[] = [];

  const maybeInvalidate = debounce(
    async () => {
      // Emit invalidation first so the manager begins its fetchIndex HTTP round-trip.
      // The in-process UniversalStore write below will, in practice, land before the
      // manager's setIndex callback — but the manager falls through to the existing
      // 404 behaviour if it doesn't, so timing is tolerant.
      channel.emit(STORY_INDEX_INVALIDATED);
      onStoryIndexInvalidated?.();

      if (pendingRenameCandidates.length === 0 && pendingDeletions.length === 0) {
        return;
      }

      // Snapshot accumulators so the next cycle starts clean even if we throw.
      const renameCandidates = pendingRenameCandidates.splice(0);
      const deletions = pendingDeletions.splice(0);

      let generator: StoryIndexGenerator;
      let index: StoryIndex;
      try {
        generator = await storyIndexGeneratorPromise;
        index = await generator.getIndex();
      } catch {
        // Generator threw (e.g. indexing error). Discard snapshots and bail:
        // on the next successful index, the user will still see the existing
        // 404 if they happen to be on a renamed story.
        (await storyIndexGeneratorPromise).clearRemovedFileSnapshots();
        return;
      }

      const removedSnapshots = generator.getRemovedFileSnapshots();
      const { renames, unresolved } = resolveRenamePairs(
        renameCandidates,
        removedSnapshots,
        index,
        workingDir
      );

      for (const unresolvedOldPath of unresolved) {
        logger.debug(
          `rename-redirect: could not confirm rename pair for ${unresolvedOldPath}, skipping`
        );
      }

      // Only explicit removals (not unresolved rename candidates) become
      // null-terminated "deletion" chains. A spurious deletion entry for a
      // file that was actually renamed would render the specialised 404 by
      // mistake, which is worse than the generic one.
      const deletedIds: StoryId[] = [];
      for (const deletedPath of deletions) {
        const absDeleted = resolve(workingDir, deletedPath);
        const snap = removedSnapshots.get(absDeleted);
        if (snap) {
          deletedIds.push(...Object.values(snap));
        }
      }

      generator.clearRemovedFileSnapshots();

      if (renames.length === 0 && deletedIds.length === 0) {
        return;
      }

      await renameRedirectStore.untilReady();
      renameRedirectStore.setState((prev) => applyRenameChains(prev, renames, deletedIds));
    },
    DEBOUNCE,
    { edges: ['leading', 'trailing'] }
  );

  watchStorySpecifiers(normalizedStories, { workingDir }, async (path, removed, renameHint) => {
    (await storyIndexGeneratorPromise).invalidate(path, removed);
    if (removed) {
      if (renameHint) {
        pendingRenameCandidates.push({ oldPath: path, newPath: renameHint.pairedWith });
      } else {
        pendingDeletions.push(path);
      }
    }
    maybeInvalidate();
  });

  if (configDir) {
    watchConfig(configDir, async (filePath) => {
      if (basename(filePath).startsWith('preview')) {
        (await storyIndexGeneratorPromise).invalidateAll();
        maybeInvalidate();
      }
    });
  }

  app.use('/index.json', async (_req, res) => {
    try {
      const index = await (await storyIndexGeneratorPromise).getIndex();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
      );
      res.end(JSON.stringify(index));
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.toString() : String(err));
    }
  });
}

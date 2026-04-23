import type { StoryId, StoryName } from '../../types/index.ts';

export type ExportName = string;

export type FileSnapshot = {
  stories: Record<ExportName, { id: StoryId }>;
  docs: { id: StoryId; name: StoryName }[];
};

export type ClassifyResult = {
  renames: { oldId: StoryId; newId: StoryId }[];
  orphans: StoryId[];
};

export function classifyFileChange(old: FileSnapshot, next: FileSnapshot): ClassifyResult {
  const renames: { oldId: StoryId; newId: StoryId }[] = [];
  const orphans: StoryId[] = [];

  for (const exportName of Object.keys(old.stories)) {
    const before = old.stories[exportName];
    const after = next.stories[exportName];
    if (after) {
      if (before.id !== after.id) {
        renames.push({ oldId: before.id, newId: after.id });
      }
    }
  }

  return { renames, orphans };
}

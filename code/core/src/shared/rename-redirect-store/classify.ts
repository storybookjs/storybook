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

export function classifyFileChange(_old: FileSnapshot, _new: FileSnapshot): ClassifyResult {
  return { renames: [], orphans: [] };
}

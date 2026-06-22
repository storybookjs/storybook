// The review payload type is the core-owned ingest contract. Re-exported here so
// the addon's manager code keeps importing it from a local path.
export type { CollectionKind, ReviewCollection, ReviewState } from 'storybook/internal/types';

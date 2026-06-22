// The review ingest contract is core-owned. This husk re-exports it so any
// remaining importer of `@storybook/addon-review` keeps resolving until the
// package is deleted.
export { REVIEW_EVENTS as EVENTS, REVIEW_NAMESPACE as ADDON_ID } from 'storybook/internal/types';
export type { ReviewState, ReviewCollection, CollectionKind } from 'storybook/internal/types';

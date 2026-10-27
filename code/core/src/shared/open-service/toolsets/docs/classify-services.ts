/**
 * How `createServiceDocsAccess` sees a project's documentable entries.
 *
 * Derived from the story index filtered by the manifest tag, not from the docgen and story-docs
 * aggregates: the index is what decides which components a Storybook publishes, and it carries
 * their order. Classifying from the aggregates instead would list components the project does not
 * expose, and alphabetise what the sidebar deliberately does not.
 */
export type DocsClassification = {
  /** Component ids the story index publishes, in index order. */
  componentIds: string[];
  /** Component ids backed by a story-docs payload. */
  storyBasedIds: Set<string>;
  /** Standalone MDX docs keyed by docs id → display name. */
  unattachedDocs: Map<string, string>;
  /** Attached MDX docs ids grouped by owning component id. */
  attachedDocsByComponent: Map<string, string[]>;
};

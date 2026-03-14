import type { API_PreparedIndexEntry } from '../../types';

/** System tags used throughout Storybook for categorizing and filtering stories and docs entries. */
export const Tag = {
  /** Indicates that autodocs should be generated for this component */
  AUTODOCS: 'autodocs',
  /** MDX documentation attached to a component's stories file */
  ATTACHED_MDX: 'attached-mdx',
  /** Standalone MDX documentation not attached to stories */
  UNATTACHED_MDX: 'unattached-mdx',
  /** Story has a play function */
  PLAY_FN: 'play-fn',
  /** Story has a test function */
  TEST_FN: 'test-fn',
  /** Development environment tag */
  DEV: 'dev',
  /** Test environment tag */
  TEST: 'test',
  /** Manifest generation tag */
  MANIFEST: 'manifest',
} as const;

/**
 * Tags can be any string, including custom user-defined tags. The Tag constant above defines the
 * system tags used by Storybook.
 */
export type Tag = string;

/**
 * Built-in story filters that extend beyond simple tag inclusion/exclusion. Those are used in the
 * manager UI and in the manager API stories module.
 */
export const BUILT_IN_FILTERS = {
  _docs: (entry: API_PreparedIndexEntry, excluded?: boolean) =>
    excluded ? entry.type !== 'docs' : entry.type === 'docs',
  _play: (entry: API_PreparedIndexEntry, excluded?: boolean) =>
    excluded
      ? entry.type !== 'story' || !entry.tags?.includes(Tag.PLAY_FN)
      : entry.type === 'story' && !!entry.tags?.includes(Tag.PLAY_FN),
  _test: (entry: API_PreparedIndexEntry, excluded?: boolean) =>
    excluded
      ? entry.type !== 'story' || entry.subtype !== 'test'
      : entry.type === 'story' && entry.subtype === 'test',
};

/**
 * Logic to resolve whether a tag filters a given entry, based on whether the tag is excluded or
 * included. Shared by the manager UI and manager API stories module.
 */
export const USER_TAG_FILTER = (tag: Tag) => (entry: API_PreparedIndexEntry, excluded?: boolean) =>
  excluded ? !entry.tags?.includes(tag) : !!entry.tags?.includes(tag);

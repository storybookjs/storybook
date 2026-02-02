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

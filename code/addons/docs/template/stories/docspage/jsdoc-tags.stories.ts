/**
 * Meta docblock description. The stories in this file show how Storybook reads JSDoc tags in CSF
 * meta and story docblocks today.
 *
 * @summary Meta summary
 * @import import { Button } from '@example/button';
 * @deprecated Meta deprecated note
 * @example <Button label="Meta example" />
 * @since 1.0.0
 */
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  args: { label: 'Click Me!' },
  parameters: {
    // These stories only exist to show their descriptions in Autodocs and the manifests
    chromatic: { disableSnapshot: true },
  },
};

/**
 * Story docblock description.
 *
 * @summary Story summary
 * @deprecated Story deprecated note
 * @example <Button label="Story example" />
 * @since 1.0.0
 */
export const AllTags = {};

/**
 * Story docblock description that the describe tag replaces.
 *
 * @describe Story describe text
 */
export const Describe = {};

/**
 * Story docblock description that the desc tag replaces.
 *
 * @desc Story desc text
 */
export const Desc = {};

/** A story. @deprecated Use another story. */
export const InlineDeprecated = {};

/** A story. Ask @design before you change it. */
export const AtInProse = {};

/** Mail me@example.com for help. */
export const AtInEmail = {};

/** Use the `@summary` tag. */
export const AtInBackticks = {};

/**
 * A story.
 * @summary a story
 * Ask @design first.
 */
export const TagThenText = {};

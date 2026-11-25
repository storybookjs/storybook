import type { Meta, StoryObj } from '@storybook/react-vite';

import { JsDocTaggedButton } from './jsdoc-tagged-button';

/**
 * Meta docblock description.
 *
 * @summary Meta summary
 * @import import { JsDocTaggedButton } from '@example/tagged-button';
 * @deprecated Meta deprecated note
 * @example <JsDocTaggedButton label="Meta example" />
 * @since 1.0.0
 */
const meta = {
  title: 'Examples/Button with JSDoc tags',
  component: JsDocTaggedButton,
  args: { children: 'Button' },
  // The Description and ArgTypes block stories snapshot what these stories document
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof JsDocTaggedButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Story docblock description.
 *
 * @summary Story summary
 * @deprecated Story deprecated note
 * @example <JsDocTaggedButton label="Story example" />
 * @since 1.0.0
 */
export const AllTags: Story = {};

/**
 * Story docblock description that the describe tag replaces.
 *
 * @describe Story describe text
 */
export const Describe: Story = {};

/**
 * Story docblock description that the desc tag replaces.
 *
 * @desc Story desc text
 */
export const Desc: Story = {};

/** A story. @deprecated Use another story. */
export const InlineDeprecated: Story = {};

/** A story. Ask @design before you change it. */
export const AtInProse: Story = {};

/** Mail me@example.com for help. */
export const AtInEmail: Story = {};

/** Use the `@summary` tag. */
export const AtInBackticks: Story = {};

/**
 * A story.
 * @summary a story
 * Ask @design first.
 */
export const TagThenText: Story = {};

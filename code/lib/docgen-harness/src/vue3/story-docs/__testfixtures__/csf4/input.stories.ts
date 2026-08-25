import CsfFourButton from './CsfFourButton.vue';
import preview from './preview.ts';

const meta = preview.meta({
  component: CsfFourButton,
  title: 'Forms/csf4',
});

export default meta;

/**
 * CSF4 button description.
 *
 * @summary CSF4 button summary.
 */
export const Primary = meta.story({
  args: {
    label: 'Save',
  },
});

/** Empty CSF4 story description. */
export const Empty = meta.story();

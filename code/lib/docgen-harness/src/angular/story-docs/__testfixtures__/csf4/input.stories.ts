import { CsfFourComponent } from './csf4.component.ts';
import preview from './preview.ts';

const meta = preview.meta({
  title: 'StoryDocs/csf4',
  component: CsfFourComponent,
  args: { label: 'Base' },
});

export default meta;

/**
 * A CSF4 factory story.
 *
 * @summary Factory summary
 */
export const Primary = meta.story({
  args: { label: 'Save' },
});

/** A factory story with no config at all. */
export const Empty = meta.story();

// Fixture: the story shapes the Angular story-docs provider has to tell apart.
// Excluded from the package tsconfig, so the loose typing here is deliberate.
import { ButtonComponent } from './button.component';

const notAStoryConfig = (...parts: unknown[]) => ({ parts });

export default {
  title: 'StoryDocs',
  component: ButtonComponent,
  args: { label: 'meta' },
};

/** Renders the button with a label and a count. */
export const Basic = {
  args: { label: 'Save', count: 3, clicked: () => {}, notAnInput: 'dropped' },
};

export const InheritsMetaArgs = { args: { count: 2 } };

export const Unclassifiable = notAStoryConfig(1, 2);

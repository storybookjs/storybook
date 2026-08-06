// Fixture: the story shapes the Angular story-docs provider has to tell apart.
// Excluded from the package tsconfig, so the loose typing here is deliberate.
import { ButtonComponent } from './button.component';

const sharedArgs = { label: 'shared' };
const HOISTED_TEMPLATE = '<sb-button hoisted></sb-button>';
const renderFn = () => ({ template: '<sb-button via-fn></sb-button>' });
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

export const InheritsMetaArgs = {};

export const OwnTemplate = { template: '<sb-button emphasis>hi</sb-button>' };

export const EmptyTemplate = { template: '' };

export const NullTemplate = { template: null, args: { count: 2 } };

export const RenderTemplate = {
  render: () => ({ template: '<sb-button rendered></sb-button>' }),
};

export const SpreadArgs = { args: { ...sharedArgs, count: 1 } };

export const Csf2Function = () => ({ template: '<sb-button csf2></sb-button>' });

export const Unclassifiable = notAStoryConfig(1, 2);

export const HoistedTemplate = { template: HOISTED_TEMPLATE };

export const RenderIdentifier = { render: renderFn, args: { count: 4 } };

export const ConfigSpread = { ...Basic, args: { count: 5 } };

// `export { X }` registers a story without a declaration path, so it exercises the other branch of
// the CSF parser. Its own args must still win over the meta's.
const ReExported = { args: { label: 'reexported', count: 9 } };
export { ReExported };

const RenamedSource = { ...sharedArgs, args: { count: 10 } };
export { RenamedSource as RenamedStory };

const ReExportedTemplate = { template: '<sb-button reexported></sb-button>' };
export { ReExportedTemplate };

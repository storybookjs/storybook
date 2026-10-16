// The story shapes the server snippet generator has to tell apart, one export per shape. Shapes
// whose markup or args cannot be read statically must yield NO snippet (recorded as a sentinel),
// never a fabricated element.
import { ShapeButtonComponent } from './shape-button.component.ts';
import { IMPORTED_TEMPLATE } from './templates.ts';
import * as BaseStories from './base-args.stories.ts';

import { argsToTemplate } from '@storybook/angular-vite';

type LooseStory = {
  args?: Record<string, unknown>;
  render?: (args: Record<string, unknown>) => unknown;
  template?: string;
};

const HOISTED_TEMPLATE = '<sb-shape-button hoisted></sb-shape-button>';
const HEADER = '<h1>Shapes</h1>';
const INCLUDES = ['label'];
const base = { args: { label: 'From base' } };
const Template = (args: Record<string, unknown>) => ({
  props: args,
  template: '<div class="bound"><sb-shape-button></sb-shape-button></div>',
});
let MUTABLE_TEMPLATE = '<sb-shape-button first></sb-shape-button>';
MUTABLE_TEMPLATE = '<sb-shape-button second></sb-shape-button>';
const extraArgs = { count: 3 };

export default {
  title: 'AngularShapes/button-shapes',
  component: ShapeButtonComponent,
};

export const OwnTemplate = { template: '<sb-shape-button emphasis>hi</sb-shape-button>' };

export const RenderTemplate = {
  render: () => ({ template: '<sb-shape-button rendered></sb-shape-button>' }),
};

export const MethodRender = {
  args: { label: 'Save' },
  render(_args: Record<string, unknown>) {
    return { template: '<div class="wrap"><sb-shape-button></sb-shape-button></div>' };
  },
};

export const ArgsToTemplateWrapper = {
  args: { label: 'Save', count: 7, clicked: () => {} },
  render: (args: Record<string, unknown>) => ({
    props: args,
    template: `<div class="wrap"><sb-shape-button ${argsToTemplate(args)}></sb-shape-button></div>`,
  }),
};

export const ArgsToTemplateInclude = {
  args: { label: 'Save', count: 7 },
  render: (args: Record<string, unknown>) => ({
    props: args,
    template: `<sb-shape-button ${argsToTemplate(args, { include: ['label'] })}></sb-shape-button>`,
  }),
};

export const SlotInterpolation = {
  args: { label: 'Save', footer: 'Bye' },
  render: ({ footer, ...args }: Record<string, unknown>) => ({
    props: args,
    template: `<sb-shape-button>${footer}</sb-shape-button>`,
  }),
};

export const ModuleConstant = {
  args: { label: 'Save' },
  render: (args: Record<string, unknown>) => ({
    props: args,
    template: `${HEADER}<sb-shape-button></sb-shape-button>`,
  }),
};

export const HoistedTemplate = { template: HOISTED_TEMPLATE };

export const QuotedArgs = {
  args: { label: `it's "quoted" & Tom &amp; Jerry` },
};

export const ImportedTemplate = { template: IMPORTED_TEMPLATE, args: { count: 5 } };

export const SpreadShadowedRender = {
  render: () => ({ template: '<sb-shape-button from-story></sb-shape-button>' }),
  ...base,
};

export const SpreadArgs = { args: { label: 'Save', ...extraArgs } };

export const AccessorRender = {
  args: { label: 'Save' },
  get render() {
    return () => ({ template: '<sb-shape-button from-getter></sb-shape-button>' });
  },
};

export const MultiExitRender = {
  args: { count: 1 },
  render: (args: { count?: number }) => {
    if (args.count) {
      return { template: '<sb-shape-button first></sb-shape-button>' };
    }
    return { template: '<sb-shape-button second></sb-shape-button>' };
  },
};

export const DynamicOptions = {
  args: { label: 'Save' },
  render: (args: Record<string, unknown>) => ({
    props: args,
    template: `<sb-shape-button ${argsToTemplate(args, { include: INCLUDES })}></sb-shape-button>`,
  }),
};

export const TemplateBind = Template.bind({}) as typeof Template & LooseStory;
TemplateBind.args = { label: 'Bound' };

export const MemberAssignedRender: LooseStory = { args: { label: 'Save' } };
MemberAssignedRender.render = () => ({
  template: '<div class="assigned"><sb-shape-button></sb-shape-button></div>',
});

export const ReassignedTemplate = { template: MUTABLE_TEMPLATE };

export const SpreadStoryArgs = { args: { ...QuotedArgs.args, count: 9 } };

// Values an Angular template expression cannot carry: `new` is not in the grammar at all, and
// `Array` is not a name the host component resolves. Both are ordinary TypeScript in a class body.
export const HoistedArgs = {
  args: {
    label: 'Save',
    // The bare Error is the fixture: this file stands in for a user's story, not for repo code.
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    loadingError: new Error('Failed to load cards.'),
    items: Array.from({ length: 3 }, (_, index) => index),
  },
};

export const SpreadCrossFileArgs = { args: { ...BaseStories.Base.args, label: 'overridden' } };

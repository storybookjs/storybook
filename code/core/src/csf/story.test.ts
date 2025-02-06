/* global HTMLElement */
import { test } from 'vitest';

import { expectTypeOf } from 'expect-type';

import type {
  Args,
  ArgsFromMeta,
  ArgsStoryFn,
  ComponentAnnotations,
  DecoratorFunction,
  LoaderFunction,
  ProjectAnnotations,
  Renderer,
  StoryAnnotationsOrFn,
  StrictArgs,
} from './story';

// NOTE Example of internal type definition for @storybook/<X> (where X is a renderer)
interface XRenderer extends Renderer {
  component: (args: this['T']) => string;
  storyResult: string;
  canvasElement: HTMLElement;
}

type XMeta<TArgs = Args> = ComponentAnnotations<XRenderer, TArgs>;
type XStory<TArgs = Args> = StoryAnnotationsOrFn<XRenderer, TArgs>;

// NOTE Examples of using types from @storybook/<X> in real project

type ButtonArgs = {
  x: string;
  y: string;
};

const Button = (props: ButtonArgs) => 'Button';

let a = 1;
async function doSomething() {
  a = 2;
}

async function validateSomething() {}

async function cleanup() {
  a = 1;
}

// NOTE Various kind usages
const simple: XMeta = {
  title: 'simple',
  component: Button,
  tags: ['foo', 'bar'],
  decorators: [(storyFn, context) => `withDecorator(${storyFn(context)})`],
  parameters: { a: () => null, b: NaN, c: Symbol('symbol') },
  loaders: [() => Promise.resolve({ d: '3' })],
  async beforeEach() {
    await doSomething();
    return cleanup;
  },
  async experimental_afterEach() {
    await validateSomething();
  },
  args: { x: '1' },
  argTypes: { x: { type: { name: 'string' } } },
};

const strict: XMeta<ButtonArgs> = {
  title: 'simple',
  component: Button,
  tags: ['foo', 'bar'],
  decorators: [(storyFn, context) => `withDecorator(${storyFn(context)})`],
  parameters: { a: () => null, b: NaN, c: Symbol('symbol') },
  loaders: [() => Promise.resolve({ d: '3' })],
  args: { x: '1' },
  async beforeEach() {
    await doSomething();
    return cleanup;
  },
  async experimental_afterEach() {
    await validateSomething();
  },
  argTypes: { x: { type: { name: 'string' } } },
};

const options = ['foo', 'bar'] as const;
const simpleWithReadonlyOptions: XMeta<ButtonArgs> = {
  title: 'simple',
  component: Button,
  tags: ['foo', 'bar'],
  decorators: [(storyFn, context) => `withDecorator(${storyFn(context)})`],
  parameters: { a: () => null, b: NaN, c: Symbol('symbol') },
  loaders: [() => Promise.resolve({ d: '3' })],
  args: { x: '1' },
  argTypes: {
    x: {
      control: {
        type: 'select',
      },
      options,
    },
  },
};

// NOTE Various story usages
const Simple: XStory = () => 'Simple';

const CSF1Story: XStory = () => 'Named Story';
CSF1Story.story = {
  name: 'Another name for story',
  tags: ['foo', 'bar'],
  decorators: [(storyFn) => `Wrapped(${storyFn()}`],
  parameters: { a: [1, '2', {}], b: undefined, c: Button },
  loaders: [() => Promise.resolve({ d: '3' })],
  async beforeEach() {
    await doSomething();
    return cleanup;
  },
  args: { a: 1 },
};

const CSF2Story: XStory = () => 'Named Story';
CSF2Story.storyName = 'Another name for story';
CSF2Story.tags = ['foo', 'bar'];
CSF2Story.decorators = [(storyFn) => `Wrapped(${storyFn()}`];
CSF2Story.parameters = { a: [1, '2', {}], b: undefined, c: Button };
CSF2Story.loaders = [() => Promise.resolve({ d: '3' })];
CSF2Story.args = { a: 1 };

const CSF3Story: XStory = {
  render: (args) => 'Named Story',
  name: 'Another name for story',
  tags: ['foo', 'bar'],
  decorators: [(storyFn) => `Wrapped(${storyFn()}`],
  parameters: { a: [1, '2', {}], b: undefined, c: Button },
  loaders: [() => Promise.resolve({ d: '3' })],
  args: { a: 1 },
};

const CSF3StoryStrict: XStory<ButtonArgs> = {
  render: (args) => 'Named Story',
  name: 'Another name for story',
  tags: ['foo', 'bar'],
  decorators: [(storyFn) => `Wrapped(${storyFn()}`],
  parameters: { a: [1, '2', {}], b: undefined, c: Button },
  loaders: [() => Promise.resolve({ d: '3' })],
  args: { x: '1' },
  play: async ({ step, canvasElement }) => {
    await step('a step', async ({ step: substep }) => {
      await substep('a substep', () => {});
    });
  },
};

const project: ProjectAnnotations<XRenderer> = {
  async runStep(label, play, context) {
    return play(context);
  },
};

test('ArgsFromMeta will infer correct args from render/loader/decorators', () => {
  const decorator1: DecoratorFunction<XRenderer, { decoratorArg: string }> = (Story, { args }) =>
    `${args.decoratorArg}`;

  const decorator2: DecoratorFunction<XRenderer, { decoratorArg2: string }> = (Story, { args }) =>
    `${args.decoratorArg2}`;

  const decorator3: DecoratorFunction<XRenderer, Args> = (Story, { args }) => ``;

  const decorator4: DecoratorFunction<XRenderer, StrictArgs> = (Story, { args }) => ``;

  const loader: LoaderFunction<XRenderer, { loaderArg: number }> = async ({ args }) => ({
    loader: `${args.loaderArg}`,
  });

  const loader2: LoaderFunction<XRenderer, { loaderArg2: number }> = async ({ args }) => ({
    loader2: `${args.loaderArg2}`,
  });

  const renderer: ArgsStoryFn<XRenderer, { theme: string }> = (args) => `${args.theme}`;

  const meta = {
    component: Button,
    args: { disabled: false },
    render: renderer,
    decorators: [decorator1, decorator2, decorator3, decorator4],
    loaders: [loader, loader2],
  };
  expectTypeOf<ArgsFromMeta<XRenderer, typeof meta>>().toEqualTypeOf<{
    theme: string;
    decoratorArg: string;
    decoratorArg2: string;
    loaderArg: number;
    loaderArg2: number;
  }>();
});

test('You can assign a component to Meta, even when you pass a top type', () => {
  expectTypeOf({ component: Button }).toMatchTypeOf<XMeta>();
  expectTypeOf({ component: Button }).toMatchTypeOf<XMeta<Record<string, any>>>();
  expectTypeOf({ component: Button }).toMatchTypeOf<XMeta<Record<string, unknown>>>();
  expectTypeOf({ component: Button }).toMatchTypeOf<XMeta<unknown>>();
  expectTypeOf({ component: Button }).toMatchTypeOf<XMeta<any>>();
  expectTypeOf({ component: Button }).not.toMatchTypeOf<XMeta<{ a?: number }>>();
  expectTypeOf({ component: Button }).not.toMatchTypeOf<XMeta<{ a: number }>>();
});

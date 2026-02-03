import type { DecoratorFunction } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';
import type { Meta, StoryObj, VueRenderer } from '@storybook/vue3';

import { useArgs } from 'storybook/preview-api';
import { h } from 'vue';
import { computed } from 'vue';

const { Button, Pre } = (globalThis as any).__TEMPLATE_COMPONENTS__;

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const ComponentTemplateWrapper = () => ({
  components: {
    Pre,
  },
  template: `
    <Pre text="decorator" />
    <story v-bind="$attrs"/>
  `,
});

const SimpleTemplateWrapper = () => ({
  template: `
    <div style="border: 5px solid red;">
      <story/>
    </div>
    `,
});

const VueWrapperWrapper: DecoratorFunction<VueRenderer> = (storyFn, context) => {
  // Call the `storyFn` to receive a component that Vue can render
  const story = storyFn();
  // Vue 3 "Functional" component as decorator
  return () => {
    return h('div', { style: 'border: 5px solid blue' }, h(story, context.args));
  };
};

const DynamicWrapperWrapper: DecoratorFunction<VueRenderer> = (storyFn, { args }) => ({
  template: `<div :style="{ borderWidth: level, borderColor: 'green', borderStyle: 'solid' }"><story /></div>`,
  computed: { level: () => `${args.level}px` },
});

const getCaptionForLocale = (locale: string) => {
  switch (locale) {
    case 'es':
      return 'Hola!';
    case 'kr':
      return '안녕하세요!';
    case 'zh':
      return '你好!';
    case 'en':
      return 'Hello!';
    default:
      return undefined;
  }
};

const updateArgsDecorator: DecoratorFunction<VueRenderer> = (story, { args }) => {
  const [, updateArgs] = useArgs();
  return {
    components: { story },
    setup() {
      return {
        args,
        updateArgs,
      };
    },
    template: `
      <div>
        <button @click="() => updateArgs({ label: Number(args.label) + 1 })">Add 1</button>
        <hr />
        <story />
      </div>
    `,
  };
};

const localeDecorator: DecoratorFunction<VueRenderer> = (story, { globals }) => {
  return {
    components: { story },
    setup() {
      const ctxGreeting = computed(() => getCaptionForLocale(globals?.locale) || 'Hello!');

      return {
        ctxGreeting,
        globals,
      };
    },
    template: `
      <div>
        <p>Greeting: {{ctxGreeting}}</p>
        <p>Locale: {{globals?.locale}}</p>
        <story />
      </div>
    `,
  };
};

export const ComponentTemplate: Story = {
  args: { label: 'With component' },
  decorators: [ComponentTemplateWrapper],
};

export const SimpleTemplate: Story = {
  args: { label: 'With border' },
  decorators: [SimpleTemplateWrapper],
};

export const VueWrapper: Story = {
  args: { label: 'With Vue wrapper' },
  decorators: [VueWrapperWrapper],
};

export const DynamicWrapper: Story = {
  args: { label: 'With dynamic wrapper', primary: true },
  argTypes: {
    // Number type is detected, but we still want to constrain the range from 1-6
    level: { control: { type: 'range', min: 1, max: 6 } },
  },
  decorators: [DynamicWrapperWrapper],
};

export const MultipleWrappers = {
  args: { label: 'With multiple wrappers' },
  argTypes: {
    // Number type is detected, but we still want to constrain the range from 1-6
    level: { control: { type: 'range', min: 1, max: 6 } },
  },
  decorators: [
    ComponentTemplateWrapper,
    SimpleTemplateWrapper,
    VueWrapperWrapper,
    DynamicWrapperWrapper,
  ],
};

export const UpdateArgs = {
  args: { label: '0' },
  decorators: [updateArgsDecorator],
};

export const ReactiveGlobalDecorator = {
  args: { label: 'With reactive global decorator' },
  decorators: [localeDecorator],
};

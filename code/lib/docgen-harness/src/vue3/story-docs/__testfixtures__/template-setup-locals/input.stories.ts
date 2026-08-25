import type { Meta, StoryObj } from '@storybook/vue3';

import { ref } from 'vue';

import SetupLocalsPanel from './SetupLocalsPanel.vue';

const meta = {
  component: SetupLocalsPanel,
  title: 'Forms/template-setup-locals',
} satisfies Meta<typeof SetupLocalsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A local declared beside `args`, bound by the template through `v-model`. */
export const LocalAlongsideArgs: Story = {
  args: {
    title: 'Section',
    titleTag: 'h4',
  },
  render: (args) => ({
    components: { SetupLocalsPanel },
    setup() {
      const openPanel = ref(undefined);
      return { openPanel, args };
    },
    template: `
      <SetupLocalsPanel v-model="openPanel" :title="args.title + ' 1'" :title-tag="args.titleTag">
        First
      </SetupLocalsPanel>
    `,
  }),
};

/** A local derived from `args`, with `args` itself never returned. */
export const DerivedLocalOnly: Story = {
  args: {
    title: 'Section',
  },
  render: (args) => ({
    components: { SetupLocalsPanel },
    setup() {
      const heading = `${args.title} details`;
      return { heading };
    },
    template: '<SetupLocalsPanel :title="heading">Details</SetupLocalsPanel>',
  }),
};

/**
 * A `v-model` arg and a `ref()` local in one story.
 *
 * Both need `ref` from Vue, so the snippet has to import it exactly once.
 */
export const ModelArgWithRefLocal: Story = {
  args: {
    modelValue: 'Accepted',
    title: 'Terms',
  },
  render: (args) => ({
    components: { SetupLocalsPanel },
    setup() {
      const badge = ref('New');
      return { badge, args };
    },
    template: `
      <SetupLocalsPanel v-model="args.modelValue" :title="args.title">
        <template #title>{{ badge }}</template>
        Body
      </SetupLocalsPanel>
    `,
  }),
};

/** A renamed return has no declaration the snippet could carry, so it stays snippet-less. */
export const UnsupportedRenamedReturn: Story = {
  args: {
    title: 'Section',
  },
  render: (args) => ({
    components: { SetupLocalsPanel },
    setup() {
      const local = ref('x');
      return { renamed: local, args };
    },
    template: '<SetupLocalsPanel :title="args.title">{{ renamed }}</SetupLocalsPanel>',
  }),
};

/** A reassignable local is pasted into the snippet with the rest of setup. */
export const LetLocal: Story = {
  args: {
    title: 'Section',
  },
  render: (args) => ({
    components: { SetupLocalsPanel },
    setup() {
      let heading = 'Section 1';
      heading += ' (draft)';
      return { heading, args };
    },
    template: '<SetupLocalsPanel :title="heading">{{ args.title }}</SetupLocalsPanel>',
  }),
};

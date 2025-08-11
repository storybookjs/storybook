import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { TestParentComponent, TestChildComponent } from './signal-content-children';

const meta = {
  component: TestParentComponent,
  decorators: [moduleMetadata({ declarations: [TestChildComponent] })],
  parameters: {
    docs: {
      description: {
        component: `
This story tests the fix for the Angular signal contentChildren() issue.

**The Problem:** 
Before the fix, Storybook would overwrite Angular signal functions (like \`contentChildren()\`) with plain arrays during property assignment, causing \`TypeError: this.options() is not a function\`.

**The Fix:**
The StorybookWrapperComponent now uses \`safeAssignProperties()\` instead of \`Object.assign()\` to preserve function properties when new values are non-functions.

**Expected Result:**
- The signal should work correctly and show "✅ SUCCESS"
- The component should correctly count and display child components
- No errors should appear in the console
        `,
      },
    },
  },
} satisfies Meta<TestParentComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithTwoChildren: Story = {
  render: () => ({
    template: `
      <test-parent>
        <test-child></test-child>
        <test-child></test-child>
      </test-parent>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Test with two child components. The contentChildren() signal should correctly detect 2 children.',
      },
    },
  },
};

export const WithNoChildren: Story = {
  render: () => ({
    template: `<test-parent></test-parent>`,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Test with no child components. The contentChildren() signal should correctly detect 0 children.',
      },
    },
  },
};

export const WithManyChildren: Story = {
  render: () => ({
    template: `
      <test-parent>
        <test-child></test-child>
        <test-child></test-child>
        <test-child></test-child>
        <test-child></test-child>
        <test-child></test-child>
      </test-parent>
    `,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'Test with five child components. The contentChildren() signal should correctly detect 5 children.',
      },
    },
  },
};

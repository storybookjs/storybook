import { Component, Signal, contentChildren, AfterContentInit } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'test-child',
  template: `<div>Child Component</div>`,
  standalone: false,
})
export class TestChildComponent {}

@Component({
  selector: 'test-parent',
  template: `
    <div>
      <h3>Parent Component</h3>
      <p>Number of children: {{ childrenCount }}</p>
      <ng-content></ng-content>
    </div>
  `,
  standalone: false,
})
export class TestParentComponent implements AfterContentInit {
  // This should be a Signal<TestChildComponent[]> but gets overwritten with plain array in Storybook
  options = contentChildren(TestChildComponent);
  childrenCount = 0;

  ngAfterContentInit() {
    console.log('=== Signal Debug Info ===');
    console.log('Type of options:', typeof this.options);
    console.log('Is function:', typeof this.options === 'function');
    console.log('Options value:', this.options);
    console.log('Constructor name:', this.options?.constructor?.name);
    
    // This should work in normal Angular but fails in Storybook before our fix
    try {
      const children = this.options();
      console.log('✅ Signal call succeeded, children:', children);
      this.childrenCount = children.length;
    } catch (error) {
      console.error('❌ Signal call failed:', error.message);
      // Fallback: if options is an array instead of signal, use it directly
      if (Array.isArray(this.options)) {
        console.log('📝 Falling back to array access');
        this.childrenCount = this.options.length;
      }
    }
    console.log('=========================');
  }
}

const meta: Meta<TestParentComponent> = {
  component: TestParentComponent,
  title: 'Test/Signal ContentChildren Bug',
} as Meta;

export default meta;

type Story = StoryObj<TestParentComponent>;

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
        story: 'This story tests if contentChildren() signals work correctly in Storybook. Check the console for debug output.',
      },
    },
  },
};

export const WithNoChildren: Story = {
  render: () => ({
    template: `<test-parent></test-parent>`,
  }),
};
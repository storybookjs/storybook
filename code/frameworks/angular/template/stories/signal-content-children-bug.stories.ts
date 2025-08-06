import { Component, Signal, contentChildren, AfterContentInit } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'test-child',
  template: `<div class="child">Child Component</div>`,
  standalone: false,
})
export class TestChildComponent {}

@Component({
  selector: 'test-parent',
  template: `
    <div class="parent">
      <h3>Angular Signal contentChildren() Test</h3>
      <p><strong>Expected behavior:</strong> Signal should work correctly in Storybook</p>
      <p><strong>Children found:</strong> {{ childrenCount }}</p>
      <p><strong>Signal test result:</strong> {{ signalTestResult }}</p>
      <div class="children-container">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  standalone: false,
  styles: [`
    .parent { 
      border: 2px solid #4CAF50; 
      padding: 16px; 
      margin: 8px; 
      border-radius: 8px;
      background: #f9f9f9;
    }
    .children-container { 
      margin-top: 16px; 
      border: 1px dashed #ccc; 
      padding: 8px;
    }
    .child {
      background: #e3f2fd;
      padding: 8px;
      margin: 4px 0;
      border-radius: 4px;
    }
  `]
})
export class TestParentComponent implements AfterContentInit {
  // This is the signal that was being broken by Storybook before our fix
  options = contentChildren(TestChildComponent);
  
  childrenCount = 0;
  signalTestResult = 'Not tested yet';

  ngAfterContentInit() {
    console.log('=== Angular Signal Test ===');
    console.log('Signal type:', typeof this.options);
    console.log('Is function:', typeof this.options === 'function');
    console.log('Constructor name:', this.options?.constructor?.name);
    
    try {
      // This should work with our fix
      const children = this.options();
      this.childrenCount = children.length;
      this.signalTestResult = '✅ SUCCESS - Signal works correctly!';
      console.log('✅ Signal call succeeded, found', children.length, 'children');
    } catch (error) {
      this.signalTestResult = '❌ FAILED - Signal was overwritten: ' + error.message;
      console.error('❌ Signal call failed:', error.message);
      
      // Check if it was overwritten with an array
      if (Array.isArray(this.options)) {
        this.childrenCount = this.options.length;
        this.signalTestResult += ` (Found array with ${this.options.length} items instead of signal)`;
        console.log('📝 Signal was replaced with array:', this.options);
      }
    }
    console.log('==========================');
  }
}

const meta: Meta<TestParentComponent> = {
  component: TestParentComponent,
  title: 'Bug Fix/Angular Signal contentChildren',
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
        story: 'Test with two child components. The contentChildren() signal should correctly detect 2 children.',
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
        story: 'Test with no child components. The contentChildren() signal should correctly detect 0 children.',
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
        story: 'Test with five child components. The contentChildren() signal should correctly detect 5 children.',
      },
    },
  },
};
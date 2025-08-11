import type { AfterContentInit } from '@angular/core';
import { Component, contentChildren } from '@angular/core';

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
  styles: [
    `
      .parent {
        margin: 8px;
        border: 2px solid #4caf50;
        border-radius: 8px;
        background: #f9f9f9;
        padding: 16px;
      }
      .children-container {
        margin-top: 16px;
        border: 1px dashed #ccc;
        padding: 8px;
      }
      .child {
        margin: 4px 0;
        border-radius: 4px;
        background: #e3f2fd;
        padding: 8px;
      }
    `,
  ],
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
    } catch (error: any) {
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

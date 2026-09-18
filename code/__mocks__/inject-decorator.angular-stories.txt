import { Component } from '@angular/core';
import { storiesOf } from '@storybook/angular';

@Component({
  selector: 'storybook-with-ng-content',
  template: `<div style="color: #1e88e5;"><ng-content></ng-content></div>`,
})
class WithNgContentComponent {}

storiesOf('Custom|ng-content', module).add('Default', () => ({
  template: `<storybook-with-ng-content><h1>This is rendered in ng-content</h1></storybook-with-ng-content>`,
  moduleMetadata: {
    declarations: [WithNgContentComponent],
  },
}));

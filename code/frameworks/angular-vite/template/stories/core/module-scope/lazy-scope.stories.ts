import { CommonModule } from '@angular/common';
import { Component, NgModule } from '@angular/core';

import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';

import { of } from 'rxjs';
import { expect, within } from 'storybook/test';

// Nothing reads this component before the story renders (no `component` in the meta, no docgen),
// so its NgModule is still waiting in Angular's JIT scoping queue when the render starts.
@Component({
  selector: 'sb-lazy-scope',
  standalone: false,
  template: `<p *ngIf="show">{{ value$ | async }}</p>`,
})
class LazyScopeComponent {
  show = true;
  value$ = of('Scoped through the NgModule');
}

@NgModule({
  imports: [CommonModule],
  declarations: [LazyScopeComponent],
  exports: [LazyScopeComponent],
})
class LazyScopeModule {}

const meta: Meta = {
  decorators: [moduleMetadata({ imports: [LazyScopeModule] })],
  render: () => ({ template: `<sb-lazy-scope></sb-lazy-scope>` }),
};

export default meta;

export const RendersAfterAnotherStory: StoryObj = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Scoped through the NgModule')
    ).toBeInTheDocument();
  },
};

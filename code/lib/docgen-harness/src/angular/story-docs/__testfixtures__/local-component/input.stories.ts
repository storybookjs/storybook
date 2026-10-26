import { Component, Input } from '@angular/core';

import type { Meta, StoryObj } from '../../../csf-types.ts';

@Component({
  selector: 'sb-local-component',
  template: '<span>{{ heading }}</span>',
})
class LocalComponent {
  @Input() heading = 'Local';
}

const meta = {
  title: 'StoryDocs/local-component',
  component: LocalComponent,
} satisfies Meta<LocalComponent>;

export default meta;

export const Primary: StoryObj<LocalComponent> = {
  args: { heading: 'Declared here' },
};

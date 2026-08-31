import { Component, Input } from '@angular/core';

import { BaseAlertComponent } from './base.component.ts';

@Component({
  selector: 'sb-cross-file-inheritance',
  template: '<div role="alert" (click)="dismissed.emit()">{{ heading }} {{ dismissible }}</div>',
})
export class CrossFileInheritanceComponent extends BaseAlertComponent {
  @Input() heading = '';
}

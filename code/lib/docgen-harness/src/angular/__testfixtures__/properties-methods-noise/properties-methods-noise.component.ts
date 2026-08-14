import type { ElementRef } from '@angular/core';
import { Component, HostBinding, Input, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'sb-properties-methods-noise',
  template: '<div #panel>{{ title }} {{ currentPage }}</div>',
})
export class PropertiesMethodsNoiseComponent {
  @Input() title = '';

  currentPage = 1;

  #secret = 'hidden';

  readonly loading = signal(false);

  @ViewChild('panel') panel?: ElementRef<HTMLDivElement>;

  @HostBinding('class.active') isActive = false;

  nextPage(): void {
    this.currentPage += 1;
  }
}

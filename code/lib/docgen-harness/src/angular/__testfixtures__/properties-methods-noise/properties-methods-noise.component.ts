import type { ElementRef } from '@angular/core';
import { Component, HostBinding, Input, ViewChild } from '@angular/core';

@Component({
  selector: 'sb-properties-methods-noise',
  template: '<div #panel>{{ title }} {{ currentPage }}</div>',
})
export class PropertiesMethodsNoiseComponent {
  @Input() title = '';

  currentPage = 1;

  @ViewChild('panel') panel?: ElementRef<HTMLDivElement>;

  @HostBinding('class.active') isActive = false;

  nextPage(): void {
    this.currentPage += 1;
  }
}

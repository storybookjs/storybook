import type { ElementRef } from '@angular/core';
import {
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

@Component({
  selector: 'sb-properties-methods-noise',
  template: '<div #panel>{{ title }} {{ currentPage }} {{ helperLabel }}</div>',
})
export class PropertiesMethodsNoiseComponent {
  @Input() title = '';

  currentPage = 1;

  #secret = 'hidden';

  // The shape the ui5-webcomponents-ngx measurement is about: 149 components, one of these each.
  private readonly cdr = inject(ChangeDetectorRef);

  private pageCount = 10;

  protected helperLabel = 'Next page';

  /** @internal */
  buildId = 'noise-1';

  readonly loading = signal(false);

  @ViewChild('panel') panel?: ElementRef<HTMLDivElement>;

  @HostBinding('class.active') isActive = false;

  nextPage(): void {
    this.currentPage += 1;
  }

  protected clampPage(): void {
    this.currentPage = Math.min(this.currentPage, this.pageCount);
  }

  private markDirty(): void {
    this.cdr.markForCheck();
  }

  /** @internal */
  resetPage(): void {
    this.currentPage = 1;
  }
}

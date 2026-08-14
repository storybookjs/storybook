import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Inject,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

@Component({
  selector: 'sb-properties-methods-noise',
  template: '<div #panel>{{ title }} {{ currentPage }} {{ helperLabel }} {{ pageLabel }}</div>',
})
export class PropertiesMethodsNoiseComponent {
  // The shape the ui5-webcomponents-ngx measurement is about: 149 components, one of these each.
  // Explicit `@Inject` tokens because the JIT render smoke test has no param-type metadata.
  constructor(
    @Inject(ChangeDetectorRef) private readonly cdr: ChangeDetectorRef,
    @Inject(ElementRef) protected readonly host: ElementRef
  ) {}

  @Input() title = '';

  // Bindable from a parent template: `strictInputAccessModifiers` is off by default, and output
  // access modifiers are never checked at all.
  @Input() private density = 'compact';

  @Output() private densityChange = new EventEmitter<string>();

  currentPage = 1;

  #secret = 'hidden';

  private pageCount = 10;

  protected helperLabel = 'Next page';

  protected get pageLabel(): string {
    return `${this.currentPage}`;
  }

  private get secretLabel(): string {
    return this.#secret;
  }

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

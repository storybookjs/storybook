// ElementRef must be a regular import, not a type-only import, because it's used in dependency injection.
// Type-only imports are stripped during compilation, causing runtime errors like "ElementRef is not defined".
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ElementRef, AfterViewInit, Directive, Input } from '@angular/core';

/** This is an Angular Directive example that has a Prop Table. */
@Directive({
  standalone: false,
  selector: '[docDirective]',
})
export class DocDirective implements AfterViewInit {
  constructor(private ref: ElementRef) {}

  /** Will apply gray background color if set to true. */
  @Input() hasGrayBackground = false;

  ngAfterViewInit(): void {
    if (this.hasGrayBackground) {
      this.ref.nativeElement.style = 'background-color: lightgray';
    }
  }
}

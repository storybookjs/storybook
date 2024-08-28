import { ElementRef, AfterViewInit, Directive, Input } from '@angular/core';

/** This is an Angular Directive example that has a Prop Table. */
@Directive({
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

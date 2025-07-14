import { Component, Input } from '@angular/core';
// DomSanitizer must be a regular import, not a type-only import, because it's used in dependency injection.
// Type-only imports are stripped during compilation, causing runtime errors like "DomSanitizer is not defined".
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  standalone: false,
  selector: 'storybook-html',
  template: `<div [innerHTML]="safeContent"></div>`,
})
export default class HtmlComponent {
  /**
   * The HTML to render. Can be a string or a function that returns a string.
   *
   * @required
   */
  @Input()
  content: string | (() => string) = '';

  constructor(private sanitizer: DomSanitizer) {}

  get safeContent() {
    const contentValue = typeof this.content === 'function' ? this.content() : this.content;
    return this.sanitizer.bypassSecurityTrustHtml(contentValue);
  }
}

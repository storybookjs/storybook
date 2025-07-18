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
   * The HTML to render
   *
   * @required
   */
  @Input()
  content = '';

  constructor(private sanitizer: DomSanitizer) {}

  get safeContent() {
    return this.sanitizer.bypassSecurityTrustHtml(this.content);
  }
}

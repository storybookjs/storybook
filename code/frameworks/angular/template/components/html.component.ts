import { Component, Input } from '@angular/core';
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

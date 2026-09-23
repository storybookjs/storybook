import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-browser-target-banner',
  template: `
    <div class="sb-browser-target-banner">Browser target styles are load bearing</div>
  `,
})
export class BrowserTargetBannerComponent {}

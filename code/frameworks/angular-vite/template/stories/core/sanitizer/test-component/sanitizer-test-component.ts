import type { OnChanges } from '@angular/core';
import { Component, Input, inject } from '@angular/core';
import type { SafeResourceUrl } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  standalone: true,
  template: `
    @if (src) {
      <img [src]="src" title="test" />
      {{ caption }}
    }
  `,
  selector: 'sanitizer-component',
})
export default class SanitizerTestComponent implements OnChanges {
  @Input() caption: string = '';

  private sanitizer = inject(DomSanitizer);

  src: SafeResourceUrl | null = null;

  svgAsBase64 =
    'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48c3ZnIHdpZHRoPSI4MDBweCIgaGVpZ2h0PSI4MDBweCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+DQo8cGF0aCBkPSJNMTg2LjYxNCA3Mi40NzMxQzIyNC4zNzkgNDguNzQ3OSAyNDkuMTI1IDk1Ljg4NzcgMjE3LjU3MyAxMjIuODcyQzIxMS4yMTYgMTI4LjMwNyAyMDMuOTUgMTMxIDE5NS41NzUgMTMxQzE2Ni42NjMgMTMxIDE3NC44MjIgOTguMDE4MSAxODAuOTExIDc5Ljc4ODYiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuOSIgc3Ryb2tlLXdpZHRoPSIxNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+DQo8L3N2Zz4=';

  ngOnChanges() {
    this.src = this.sanitizer.bypassSecurityTrustResourceUrl(this.svgAsBase64);
  }
}

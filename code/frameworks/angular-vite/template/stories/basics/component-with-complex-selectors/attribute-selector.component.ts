// ElementRef must be a regular import, not a type-only import, because it's used in dependency injection.
// Type-only imports are stripped during compilation, causing runtime errors like "ElementRef is not defined".
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { reflectComponentType, ElementRef, Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-attribute-selector[foo=bar]',
  template: `
    <h3>Attribute selector</h3>
    Selector: {{ selectors }} <br />
    Generated template: {{ generatedTemplate }}
  `,
})
export class AttributeSelectorComponent {
  generatedTemplate!: string;

  selectors!: string;

  constructor(public el: ElementRef) {
    this.selectors = reflectComponentType(AttributeSelectorComponent)?.selector ?? '';
    this.generatedTemplate = el.nativeElement.outerHTML;
  }
}

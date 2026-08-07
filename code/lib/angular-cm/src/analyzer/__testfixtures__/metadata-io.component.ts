// Metadata-declared IO in the generated-wrapper style of SAP/ui5-webcomponents-ngx: fields carry
// no member-level decorator; the @Component metadata arrays declare them instead.
import { Component, EventEmitter } from '@angular/core';

@Component({
  selector: 'sb-metadata-io',
  template: '',
  inputs: ['disabled', 'design: buttonDesign', { name: 'state', required: true }],
  outputs: ['ui5Click: click'],
})
export class MetadataIoComponent {
  /** Whether the component is disabled. */
  disabled = false;

  design: 'Default' | 'Positive' = 'Default';

  state?: string;

  ui5Click = new EventEmitter<void>();

  plainField = 1;
}

/** Function-typed members: the signature belongs in the summary, not a bare `function`. */
@Component({ selector: 'sb-function-types', template: '' })
export class FunctionTypesComponent {
  @Input() format!: (value: number, unit?: string) => string;

  @Input() compare!: (a: { id: string }, b: { id: string }) => -1 | 0 | 1;

  @Input() collect!: (...items: string[]) => void;

  @Input() factory!: new (value: number) => Date;

  @Input() nullableCallback?: ((value: string) => void) | null;
}

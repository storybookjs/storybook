import { Component, Directive, Input } from '@angular/core';

@Directive({
  selector: '[sbMetadataBase]',
  inputs: ['color', 'tone'],
  outputs: ['tapped'],
})
export class MetadataBase {
  color = 'red';
  tone = 'soft';
  tapped: unknown;
}

@Component({ selector: 'sb-metadata-child', template: '' })
export class MetadataChildComponent extends MetadataBase {
  shade = 'dark';
}

@Directive({ selector: '[sbPlainBase]' })
export class PlainBase {
  density = 'comfortable';
}

// Metadata naming a field the base declares, which only resolves once the base has been merged in.
@Component({ selector: 'sb-metadata-of-inherited', template: '', inputs: ['density'] })
export class MetadataOfInheritedComponent extends PlainBase {}

@Directive({ selector: '[sbAliasedBase]' })
export class AliasedBase {
  @Input('label') text = 'base';
}

// Re-aliasing to the field's own name is the child's final binding name; the base's `label` is not
// bindable on the child at all.
@Component({ selector: 'sb-aliased-child', template: '' })
export class AliasedChildComponent extends AliasedBase {
  @Input() override text = 'child';
}

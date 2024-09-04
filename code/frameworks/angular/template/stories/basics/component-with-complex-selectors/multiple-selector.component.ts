import { ComponentFactoryResolver, ElementRef, Component } from '@angular/core';

@Component({
  selector: 'storybook-multiple-selector, storybook-multiple-selector2',
  template: `<h3>Multiple selector</h3>
Selector: {{ selectors }} <br />
Generated template: {{ generatedTemplate }}`,
})
export class MultipleSelectorComponent {
  generatedTemplate!: string;

  selectors!: string;

  constructor(
    public el: ElementRef,
    private resolver: ComponentFactoryResolver
  ) {
    const factory = this.resolver.resolveComponentFactory(MultipleClassSelectorComponent);
    this.selectors = factory.selector;
    this.generatedTemplate = el.nativeElement.outerHTML;
  }
}

@Component({
  selector: 'storybook-button, button[foo], .button[foo], button[baz]',
  template: `<h3>Multiple selector</h3>
Selector: {{ selectors }} <br />
Generated template: {{ generatedTemplate }}`,
})
export class MultipleClassSelectorComponent {
  generatedTemplate!: string;

  selectors!: string;

  constructor(
    public el: ElementRef,
    private resolver: ComponentFactoryResolver
  ) {
    const factory = this.resolver.resolveComponentFactory(MultipleClassSelectorComponent);
    this.selectors = factory.selector;
    this.generatedTemplate = el.nativeElement.outerHTML;
  }
}

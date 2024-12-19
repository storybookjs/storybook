import { ComponentFactoryResolver, ElementRef, Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'storybook-class-selector.foo, storybook-class-selector.bar',
  template: `<h3>Class selector</h3>
Selector: {{ selectors }} <br />
Generated template: {{ generatedTemplate }}`,
})
export class ClassSelectorComponent {
  generatedTemplate!: string;

  selectors!: string;

  constructor(
    public el: ElementRef,
    private resolver: ComponentFactoryResolver
  ) {
    const factory = this.resolver.resolveComponentFactory(ClassSelectorComponent);
    this.selectors = factory.selector;
    this.generatedTemplate = el.nativeElement.outerHTML;
  }
}

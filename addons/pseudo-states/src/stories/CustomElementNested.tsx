import './CustomElement';

export class CustomElementNested extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });

    const element = document.createElement('custom-element');
    element.append(document.createElement('slot'));
    shadow.append(element);
  }
}

window.customElements.define('custom-element-nested', CustomElementNested);

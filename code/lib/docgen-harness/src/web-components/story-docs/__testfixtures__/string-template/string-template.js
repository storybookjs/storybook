export class StringTemplate extends HTMLElement {
  static get observedAttributes() {
    return ['label'];
  }
}

if (!customElements.get('string-template')) {
  customElements.define('string-template', StringTemplate);
}

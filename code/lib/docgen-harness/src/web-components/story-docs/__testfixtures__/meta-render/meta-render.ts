import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

export class MetaRender extends LitElement {
  @property()
  label = '';

  render() {
    return html`<span>${this.label}</span>`;
  }
}

if (!customElements.get('meta-render')) {
  customElements.define('meta-render', MetaRender);
}

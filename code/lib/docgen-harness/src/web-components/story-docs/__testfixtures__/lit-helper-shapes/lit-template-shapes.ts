import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

export class LitTemplateShapes extends LitElement {
  @property()
  label = '';

  @property({ type: Number })
  count = 0;

  @property({ type: Boolean })
  disabled = false;

  @property()
  heading = '';

  @property({ type: Boolean })
  open = false;

  @property({ attribute: false })
  items: unknown[] = [];

  render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('lit-template-shapes')) {
  customElements.define('lit-template-shapes', LitTemplateShapes);
}

import { LitElement, html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

/** Exercises Lit schema warning handling. */
export class LitSchemaWarning extends LitElement {
  @property()
  label = 'Label';

  @property({ type: Number })
  count = 0;

  render(): TemplateResult {
    return html`<span>${this.label} ${this.count}</span>`;
  }
}

if (!customElements.get('lit-schema-warning')) {
  customElements.define('lit-schema-warning', LitSchemaWarning);
}

import { LitElement, html } from 'lit';

/** A component. @deprecated Use another component. */
export class InlineDeprecated extends LitElement {
  static get properties() {
    return { label: { type: String } };
  }

  render() {
    return html`<span>${this.label}</span>`;
  }
}

customElements.define('jsdoc-inline-deprecated', InlineDeprecated);

import { LitElement, html } from 'lit';

/** Use the `@summary` tag. */
export class AtInBackticks extends LitElement {
  static get properties() {
    return { label: { type: String } };
  }

  render() {
    return html`<span>${this.label}</span>`;
  }
}

customElements.define('jsdoc-at-in-backticks', AtInBackticks);

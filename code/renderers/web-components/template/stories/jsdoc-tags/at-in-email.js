import { LitElement, html } from 'lit';

/** Mail me@example.com for help. */
export class AtInEmail extends LitElement {
  static get properties() {
    return { label: { type: String } };
  }

  render() {
    return html`<span>${this.label}</span>`;
  }
}

customElements.define('jsdoc-at-in-email', AtInEmail);

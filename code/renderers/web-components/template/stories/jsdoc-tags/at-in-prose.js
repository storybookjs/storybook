import { LitElement, html } from 'lit';

/** A component. Ask @design before you change it. */
export class AtInProse extends LitElement {
  static get properties() {
    return { label: { type: String } };
  }

  render() {
    return html`<span>${this.label}</span>`;
  }
}

customElements.define('jsdoc-at-in-prose', AtInProse);

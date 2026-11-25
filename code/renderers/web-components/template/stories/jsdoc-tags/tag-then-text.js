import { LitElement, html } from 'lit';

/**
 * A component.
 * @summary a component
 * Ask @design first.
 */
export class TagThenText extends LitElement {
  static get properties() {
    return { label: { type: String } };
  }

  render() {
    return html`<span>${this.label}</span>`;
  }
}

customElements.define('jsdoc-tag-then-text', TagThenText);

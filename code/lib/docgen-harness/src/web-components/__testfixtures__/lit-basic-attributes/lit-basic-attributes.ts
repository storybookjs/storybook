import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Panel with string, number and boolean attributes.
 * @summary Attribute fixture.
 */
export class LitBasicAttributes extends LitElement {
  /** Text shown in the component. */
  @property()
  label = 'Basic label';

  /** Number of items to display. */
  @property({ type: Number })
  count = 2;

  /** Whether the panel is disabled. */
  @property({ type: Boolean })
  disabled = false;

  /** Whether the panel is open. */
  @property({ attribute: 'is-open', reflect: true, type: Boolean })
  isOpen = false;

  render() {
    return html`<p>${this.label} ${this.count}</p>`;
  }
}

if (!customElements.get('lit-basic-attributes')) {
  customElements.define('lit-basic-attributes', LitBasicAttributes);
}

import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

interface Item {
  name: string;
}

interface PanelConfig {
  dense: boolean;
  theme: string;
}

export class LitPropertyOnly extends LitElement {
  /** Visible label for the list. */
  @property()
  label = 'Items';

  /** Items rendered by the list. */
  @property({ attribute: false })
  items: Item[] = [];

  /** Rendering options for the list. */
  @property({ attribute: false })
  config: PanelConfig = { dense: false, theme: 'light' };

  render() {
    return html`<p>${this.label}: ${this.items.length}</p>`;
  }
}

if (!customElements.get('lit-property-only')) {
  customElements.define('lit-property-only', LitPropertyOnly);
}

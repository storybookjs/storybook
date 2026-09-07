import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Button with typed visual variants.
 *
 * @summary Compact variant fixture.
 */
export class LitUnionJsdoc extends LitElement {
  /** Visual variant. */
  @property()
  variant: 'primary' | 'secondary' | 'ghost' = 'primary';

  /**
   * Old label field.
   *
   * @deprecated Use label instead.
   */
  @property({ attribute: 'old-label' })
  oldLabel = '';

  /**
   * Current label.
   *
   * @default "Union label"
   */
  @property()
  label = 'Union label';

  render() {
    return html`<button>${this.variant} ${this.label}</button>`;
  }
}

if (!customElements.get('lit-union-jsdoc')) {
  customElements.define('lit-union-jsdoc', LitUnionJsdoc);
}

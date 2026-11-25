import { LitElement, html } from 'lit';

/**
 * Component docblock description.
 *
 * @summary Component summary
 * @describe Component describe text
 * @import import { TaggedButton } from '@example/tagged-button';
 * @deprecated Component deprecated note
 * @example <jsdoc-tagged-button label="Component example"></jsdoc-tagged-button>
 * @since 1.0.0
 */
export class TaggedButton extends LitElement {
  static get properties() {
    return {
      label: { type: String },
      size: { type: String },
      internalId: { type: String, attribute: 'internal-id' },
      variant: { type: String },
    };
  }

  constructor() {
    super();

    /**
     * The button text.
     *
     * @deprecated Use the default slot instead.
     */
    this.label = undefined;

    /**
     * The button size.
     *
     * @default 'medium'
     */
    this.size = 'medium';

    /**
     * A property that docgen should hide.
     *
     * @ignore
     */
    this.internalId = undefined;

    /**
     * The button style.
     *
     * @summary Variant summary
     * @example <jsdoc-tagged-button variant="primary"></jsdoc-tagged-button>
     * @since 1.0.0
     */
    this.variant = 'primary';
  }

  /**
   * Focuses the button.
   *
   * @param {FocusOptions} options The focus options.
   * @returns {void} Nothing.
   */
  focusButton(options) {
    this.renderRoot.querySelector('button')?.focus(options);
  }

  render() {
    return html`<button type="button" data-size=${this.size}>${this.label}</button>`;
  }
}

customElements.define('jsdoc-tagged-button', TaggedButton);

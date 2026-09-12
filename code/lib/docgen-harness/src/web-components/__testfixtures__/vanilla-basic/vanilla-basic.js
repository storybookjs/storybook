/**
 * Plain custom element with attribute-backed properties.
 *
 * @attr {string} legacy-label - Old name for label. @deprecated Use label instead.
 */
export class VanillaBasic extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'count', 'disabled'];
  }

  /** Text label. */
  get label() {
    return this.getAttribute('label') ?? '';
  }

  set label(value) {
    this.setAttribute('label', value);
  }

  /** Item count. */
  get count() {
    return Number(this.getAttribute('count') ?? 0);
  }

  set count(value) {
    this.setAttribute('count', String(value));
  }

  /** Disabled state. */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  set disabled(value) {
    if (value) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }
}

if (!customElements.get('vanilla-basic')) {
  customElements.define('vanilla-basic', VanillaBasic);
}

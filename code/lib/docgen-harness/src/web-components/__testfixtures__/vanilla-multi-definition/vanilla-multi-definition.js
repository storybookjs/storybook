export class MultiAlpha extends HTMLElement {
  static get observedAttributes() {
    return ['alpha-label'];
  }

  /** Alpha label. */
  get alphaLabel() {
    return this.getAttribute('alpha-label') ?? '';
  }

  set alphaLabel(value) {
    this.setAttribute('alpha-label', value);
  }
}

/** Second element defined by the same module. */
export class MultiBeta extends HTMLElement {
  static get observedAttributes() {
    return ['beta-label'];
  }

  /** Beta label. */
  get betaLabel() {
    return this.getAttribute('beta-label') ?? '';
  }

  set betaLabel(value) {
    this.setAttribute('beta-label', value);
  }
}

if (!customElements.get('multi-alpha')) {
  customElements.define('multi-alpha', MultiAlpha);
}

if (!customElements.get('multi-beta')) {
  customElements.define('multi-beta', MultiBeta);
}

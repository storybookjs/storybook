export class CsfShapes extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'count', 'disabled'];
  }

  get label() {
    return this.getAttribute('label') ?? '';
  }

  set label(value) {
    this.setAttribute('label', value);
  }

  get count() {
    return Number(this.getAttribute('count') ?? 0);
  }

  set count(value) {
    this.setAttribute('count', String(value));
  }

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

if (!customElements.get('csf-shapes')) {
  customElements.define('csf-shapes', CsfShapes);
}

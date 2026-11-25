export class ConstantsViewer extends HTMLElement {
  static get observedAttributes() {
    return ['heading', 'html', 'lines', 'selected-line'];
  }
}

if (!customElements.get('constants-viewer')) {
  customElements.define('constants-viewer', ConstantsViewer);
}

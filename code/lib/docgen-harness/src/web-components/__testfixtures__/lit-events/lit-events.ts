import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Emits changes from the text field.
 *
 * @fires my-change - Fired when the value changes.
 * @fires my-close - Fired when the panel closes.
 */
export class LitEvents extends LitElement {
  /** Current text value. */
  @property()
  value = 'ready';

  render() {
    return html`<button @click=${this.emitChange}>${this.value}</button>`;
  }

  emitChange() {
    this.dispatchEvent(
      new CustomEvent<{ value: string }>('my-change', { detail: { value: this.value } })
    );
  }

  close() {
    this.dispatchEvent(new CustomEvent<void>('my-close'));
  }
}

if (!customElements.get('lit-events')) {
  customElements.define('lit-events', LitEvents);
}

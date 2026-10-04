import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Shows projected content with themed parts.
 *
 * @slot - Default body content.
 * @slot actions - Action controls.
 * @csspart panel - Outer panel.
 * @cssprop --slot-panel-color - Panel text color.
 */
export class LitSlotsAndCss extends LitElement {
  /** Heading above the projected content. */
  @property()
  heading = 'Details';

  render() {
    return html`<section part="panel"><h2>${this.heading}</h2><slot></slot><slot name="actions"></slot></section>`;
  }
}

if (!customElements.get('lit-slots-and-css')) {
  customElements.define('lit-slots-and-css', LitSlotsAndCss);
}

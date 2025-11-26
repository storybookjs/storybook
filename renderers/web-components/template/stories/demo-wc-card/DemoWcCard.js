import { global } from '@storybook/global';

import { LitElement, html } from 'lit';

import { demoWcCardStyle } from './demoWcCardStyle.css.js';

const { CustomEvent } = global;

/**
 * This is a container looking like a card with a back and front side you can switch
 *
 * @fires side-changed - Fires whenever it switches between front/back
 * @slot - This is an unnamed slot (the default slot)
 * @cssprop --demo-wc-card-header-font-size - Header font size
 * @cssprop --demo-wc-card-front-color - Font color for front
 * @cssprop --demo-wc-card-back-color - Font color for back
 * @csspart front - Front of the card
 * @csspart back - Back of the card
 */
export class DemoWcCard extends LitElement {
  static get properties() {
    return {
      backSide: {
        type: Boolean,
        reflect: true,
        attribute: 'back-side',
      },
      header: { type: String },
      rows: { type: Object },
    };
  }

  static get styles() {
    return demoWcCardStyle;
  }

  constructor() {
    super();

    /** Indicates that the back of the card is shown */
    this.backSide = false;

    /** Header message */
    this.header = 'Your Message';

    /** Data rows */
    this.rows = [];
  }

  toggle() {
    this.backSide = !this.backSide;
  }

  render() {
    return html`
      <div id="front" part="front">
        <div class="header">${this.header}</div>
        <div class="content">
          <slot></slot>
        </div>
        <div class="footer">
          <div class="note">A</div>
          <button @click=${this.toggle}>></button>
        </div>
      </div>
      <div id="back" part="back">
        <div class="header"><slot name="prefix"></slot> ${this.header}</div>

        <div class="content">
          ${this.rows.length === 0
            ? html``
            : html`
                <dl>
                  ${this.rows.map(
                    (row) => html`
                      <dt>${row.header}</dt>
                      <dd>${row.value}</dd>
                    `
                  )}
                </dl>
              `}
        </div>
        <div class="footer">
          <div class="note">B</div>
          <button @click=${this.toggle}>></button>
        </div>
      </div>
    `;
  }

  updated(changedProperties) {
    if (changedProperties.has('backSide') && changedProperties.get('backSide') !== undefined) {
      this.dispatchEvent(new CustomEvent('side-changed'));
    }
  }
}

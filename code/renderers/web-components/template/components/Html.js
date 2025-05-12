import { global as globalThis } from '@storybook/global';

import { LitElement } from 'lit';

const { customElements } = globalThis;

/** @tag sb-html */
export class SbHtml extends LitElement {
  static get properties() {
    return {
      content: { type: String },
    };
  }

  constructor() {
    super();
    this.content = '';
  }

  render() {
    this.renderRoot.innerHTML = this.content;
  }

  // render into the light dom so we can test this
  createRenderRoot() {
    return this;
  }
}

export const HtmlTag = 'sb-html';
customElements.define(HtmlTag, SbHtml);

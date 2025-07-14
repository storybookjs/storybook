import { global as globalThis } from '@storybook/global';

import { LitElement } from 'lit';

const { customElements } = globalThis;

/** @tag sb-html */
export class SbHtml extends LitElement {
  static get properties() {
    return {
      content: { type: Object }, // Can be string or function
    };
  }

  constructor() {
    super();
    this.content = '';
  }

  render() {
    const contentValue = typeof this.content === 'function' ? this.content() : this.content;
    this.renderRoot.innerHTML = contentValue;
  }

  // render into the light dom so we can test this
  createRenderRoot() {
    return this;
  }
}

export const HtmlTag = 'sb-html';
customElements.define(HtmlTag, SbHtml);

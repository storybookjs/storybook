import { global as globalThis } from '@storybook/global';

import { LitElement, html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

const { customElements } = globalThis;

/** @tag sb-pre */
export class SbPre extends LitElement {
  // Currently TS decorators are not reflected so we have to use static `properties` function
  // https://github.com/Polymer/lit-html/issues/1476
  static get properties() {
    return {
      style: { type: Object },
      object: { type: Object },
      text: { type: String },
    };
  }

  constructor() {
    super();
    this.style = {};
    this.object = undefined;
    this.text = undefined;
  }

  render() {
    const text = this.object ? JSON.stringify(this.object, null, 2) : this.text;
    return html`<pre data-testid="pre" style=${styleMap(this.style)}>${text}</pre>`;
  }

  // render into the light dom so we can test this
  createRenderRoot() {
    return this;
  }
}

export const PreTag = 'sb-pre';
customElements.define(PreTag, SbPre);

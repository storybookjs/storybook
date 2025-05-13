import { global as globalThis } from '@storybook/global';

import { LitElement, html } from 'lit';

const { CustomEvent, customElements } = globalThis;

/**
 * Form test component for framework-independent stories
 *
 * @tag sb-form
 */
export class SbForm extends LitElement {
  // Currently TS decorators are not reflected so we have to use static `properties` function
  // https://github.com/Polymer/lit-html/issues/1476
  static get properties() {
    return {
      value: { type: String },
      complete: { type: Boolean },
      onSuccess: { type: Function },
    };
  }

  constructor() {
    super();
    this.value = '';
    this.complete = false;
    this.onSuccess = undefined;
  }

  onSubmit(event) {
    event.preventDefault();
    const options = {
      bubbles: true,
      composed: true,
    };

    this.dispatchEvent(new CustomEvent('sb-form:success', options));
    if (this.onSuccess) {
      this.onSuccess(this.value);
    }

    setTimeout(() => {
      this.complete = true;
    }, 500);

    setTimeout(() => {
      this.complete = false;
    }, 1500);
  }

  render() {
    return html`
      <form id="interaction-test-form" @submit=${this.onSubmit}>
        <label>
          Enter Value
          <input
            type="text"
            data-testid="value"
            value=${this.value}
            required
            @change=${(event) => {
              event.preventDefault();
              this.value = event.target.value;
              return false;
            }}
          />
        </label>
        <button type="submit">Submit</button>
        ${this.complete ? 'Completed!!' : ''}
      </form>
    `;
  }

  // render into the light dom so we can test this
  createRenderRoot() {
    return this;
  }
}

export const FormTag = 'sb-form';
customElements.define(FormTag, SbForm);

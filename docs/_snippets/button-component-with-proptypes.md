```ts filename="my-button.component.ts" renderer="angular" language="ts"
import { Component, Input } from '@angular/core';

@Component({
  selector: 'my-button',
  template: ` <button type="button" [disabled]="isDisabled">
    {{ content }}
  </button>`,
  styleUrls: ['./button.css'],
})
export class ButtonComponent {
  /**
   * Checks if the button should be disabled
   */
  @Input()
  isDisabled: boolean;

  /**
  The display content of the button
  */
  @Input()
  content: string;
}
```

```js filename="Button.js|jsx" renderer="react" language="js"
import React from 'react';

import PropTypes from 'prop-types';

export function Button({ isDisabled, content }) {
  return (
    <button type="button" disabled={isDisabled}>
      {content}
    </button>
  );
}

Button.propTypes = {
  /**
   Checks if the button should be disabled
  */
  isDisabled: PropTypes.bool.isRequired,
  /**
  The display content of the button
  */
  content: PropTypes.string.isRequired,
};
```

```tsx filename="Button.ts|tsx" renderer="react" language="ts"
export interface ButtonProps {
  /**
   * Checks if the button should be disabled
   */
  isDisabled: boolean;
  /**
  The display content of the button
  */
  content: string;
}

export const Button: React.FC<ButtonProps> = ({ isDisabled = false, content = '' }) => {
  return (
    <button type="button" disabled={isDisabled}>
      {content}
    </button>
  );
};
```

```svelte filename="Button.svelte" renderer="svelte" language="js"
<script>
  /**
   * A Button Component
   * @component
   */

  /**
   * Disable the button
   * @required
   */
  export let disabled = false;

  /**
   * Button content
   * @required
   */
  export let content = '';
<script/>

<button type="button" {disabled}>{content}</button>
```

```html filename="Button.vue" renderer="vue" language="js"
<template>
  <button type="button" :disabled="isDisabled">{{ label }}</button>
</template>

<script>
  import { reactive } from 'vue';

  export default {
    name: 'button',
    props: {
      /**
       * Checks if the button should be disabled
       */
      isDisabled: {
        type: Boolean,
        default: false,
        required: true,
      },
      /**
       * The display label of the button
       */
      label: {
        type: String,
        default: 'One',
        required: true,
      },
    },
    setup(props) {
      props = reactive(props);
      return {
        /**
         * What will be returned here will available to the component
         * Functions referenced here will act like methods
         */
      };
      //
    },
  };
</script>
```

```html filename="Button.vue" renderer="vue" language="ts"
<template>
  <button type="button" :disabled="isDisabled">{{ label }}</button>
</template>

<script lang="ts">
  import { defineComponent } from 'vue';

  export default defineComponent({
    name: 'button',
    props: {
      /**
       * Checks if the button should be disabled
       */
      isDisabled: {
        type: Boolean,
        default: false,
      },
      /**
       * The display label of the button
       */
      label: {
        type: String,
        default: 'One',
        required: true,
      },
    },
    setup(props) {
      /**
       * What will be returned here will available to the component
       * Functions referenced here will act like methods
       */
    },
  });
</script>
```

```js filename="Button.js" renderer="web-components" language="js"
import { LitElement, html } from 'lit';

/**
 * @prop {string} content - The display label of the button
 * @prop {boolean} isDisabled - Checks if the button should be disabled
 * @summary This is a custom button element
 * @tag custom-button
 */

export class CustomButton extends LitElement {
  static get properties() {
    return {
      content: { type: String },
      isDisabled: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.content = 'One';
    this.isDisabled = false;
  }

  render() {
    return html` <button type="button" ?disabled=${this.isDisabled}>${this.content}</button> `;
  }
}

customElements.define('custom-button', CustomButton);
```

```ts filename="Button.ts" renderer="web-components" language="ts"
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * @prop {string} content - The display label of the button
 * @prop {boolean} isDisabled - Checks if the button should be disabled
 * @summary This is a custom button element
 * @tag custom-button
 */

@customElement('custom-button')
export class CustomButton extends LitElement {
  @property()
  content?: string = 'One';
  @property()
  isDisabled?: boolean = false;

  render() {
    return html` <button type="button" ?disabled=${this.isDisabled}>${this.content}</button> `;
  }
}
```

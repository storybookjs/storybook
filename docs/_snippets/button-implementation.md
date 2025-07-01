```ts filename="Button.component.ts" renderer="angular" language="ts"
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'button',
  template: `the component implementation markup`,
})
export class ButtonComponent {
  /**
   * Is this the principal call to action on the page?
   */
  @Input()
  primary = false;

  /**
   * What background color to use
   */
  @Input()
  backgroundColor?: string;

  /**
   * How large should the button be?
   */
  @Input()
  size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Button contents
   *
   * @required
   */
  @Input()
  label = 'Button';

  /**
   * Optional click handler
   */
  @Output()
  onClick = new EventEmitter<Event>();
}
```

```js filename="Button.js|jsx" renderer="react" language="js"
import React from 'react';

import PropTypes from 'prop-types';

/**
 * Primary UI component for user interaction
 */
export const Button = ({ primary, backgroundColor, size, label, ...props }) => {
  // the component implementation
};

Button.propTypes = {
  /**
   * Is this the principal call to action on the page?
   */
  primary: PropTypes.bool,
  /**
   * What background color to use
   */
  backgroundColor: PropTypes.string,
  /**
   * How large should the button be?
   */
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  /**
   * Button contents
   */
  label: PropTypes.string.isRequired,
  /**
   * Optional click handler
   */
  onClick: PropTypes.func,
};
```

```tsx filename="Button.ts|tsx" renderer="react" language="ts"
export interface ButtonProps {
  /**
   * Is this the principal call to action on the page?
   */
  primary?: boolean;
  /**
   * What background color to use
   */
  backgroundColor?: string;
  /**
   * How large should the button be?
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Button contents
   */
  label: string;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

/**
 * Primary UI component for user interaction
 */
export const Button: React.FC<ButtonProps> = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  ...props
}) => {
  // the component implementation
};
```

```svelte filename="Button.svelte" renderer="svelte" language="js"
<script>
  import { createEventDispatcher } from 'svelte';
  /**
   * Is this the principal call to action on the page?
   */
  export let primary = false;

  /**
   * What background color to use
   */
  export let backgroundColor = undefined;
  /**
   * How large should the button be?
   */
  export let size = 'medium';
  /**
   * Button contents
   */
  export let label = '';

  $: style = backgroundColor ? `background-color: ${backgroundColor}` : '';

  const dispatch = createEventDispatcher();

  /**
   * Optional click handler
   */
  export let onClick = (event) => {
    dispatch('click', event);
  };
</script>

<button type="button" {style} on:click="{onClick}">{label}</button>
```

```html filename="Button.vue" renderer="vue" language="js"
<template> <!-- The component markup implementation --> </template>

<script>
  export default {
    name: 'button',
    props: {
      /**
       * Button contents
       */
      label: {
        type: String,
        required: true,
      },
      /**
       * Is this the principal call to action on the page?
       */
      primary: {
        type: Boolean,
        default: false,
      },
      /**
       * How large should the button be?
       */
      size: {
        type: String,
        default: 'medium',
        validator: function (value) {
          return ['small', 'medium', 'large'].indexOf(value) !== -1;
        },
      },
      /**
       * What background color to use
       */
      backgroundColor: {
        type: String,
      },
    },
    emits: ['click'],
    setup(props, { emit }) {
      props = reactive(props);
      return {
        /**
         * Optional click handler
         */
        onClick() {
          emit('click');
        },
      };
    },
  };
</script>
```

```html filename="Button.vue" renderer="vue" language="ts"
<template> <!-- The component markup implementation --> </template>

<script lang="ts">
  import { defineComponent, reactive } from 'vue';

  export default defineComponent({
    // eslint-disable-next-line vue/multi-word-component-names
    name: 'button',
    props: {
      /**
       * Button contents
       */
      label: {
        type: String,
        required: true,
      },
      /**
       * Is this the principal call to action on the page?
       */
      primary: {
        type: Boolean,
        default: false,
      },
      /**
       * How large should the button be?
       */
      size: {
        type: String,
        default: 'medium',
        validator: function (value) {
          return ['small', 'medium', 'large'].indexOf(value) !== -1;
        },
      },
      /**
       * What background color to use
       */
      backgroundColor: {
        type: String,
      },
    },
    emits: ['click'],
    setup(props, { emit }) {
      props = reactive(props);
      return {
        /**
         * Optional click handler
         */
        onClick() {
          emit('click');
        },
      };
    },
  });
</script>
```

<template>
  <button type="button" :class="classes" :style="style">
    <!-- You can use <component /> with `:is` when passing a component as a prop -->
    <component :is="icon" />
  </button>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  name: 'override-args',

  props: {
    icon: {
      type: Object,
      required: true,
    },

    backgroundColor: {
      type: String
    },
  },


  setup(props, { emit }) {
    const classes = {
      'storybook-button': true,
      'storybook-button--primary': true,
      'storybook-button--large': true,
    };
    const style = computed(() => ({
      backgroundColor: props.backgroundColor,
    }));

    // Notice that `icon` prop component is still passed through even though it isn't mapped
    return { classes, style, }
  },
};
</script>

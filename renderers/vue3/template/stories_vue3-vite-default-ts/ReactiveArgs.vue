<template>
  <button type="button" @click="onClick" :class="classes" :style="style">{{ label }} {{ counter }}</button>
</template>

<script>
import { computed, ref } from 'vue';

export default {
  name: 'reactive-args',

  props: {
    label: {
      type: String,
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
    const counter = ref(0);
    const onClick = () => {
      emit('click', 1);
      counter.value += 1;
    };

    // Notice that `icon` prop component is still passed through even though it isn't mapped
    return { classes, style, counter, onClick }
  },
};
</script>

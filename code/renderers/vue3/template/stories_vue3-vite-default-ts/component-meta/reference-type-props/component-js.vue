<script lang="ts">
import { defineComponent } from 'vue';
import { StringEmpty, StringRequired, StringUndefined } from './my-props';

export default defineComponent({
  props: {
    /**
     * foo description, required prop
     * @required
     */
    foo: {
      type: String,
      required: true,
    },
    /**
     * bar description, default value BAR
     */
    bar: {
      type: String,
      default: 'BAR',
    },
    /**
     * baz description, optional prop
     */
    baz: {
      type: String,
    },
    /**
     * xfoo description, required string prop
     */
    xfoo: StringRequired,
    /**
     * xbar description, empty string prop
     */
    xbar: StringEmpty,
    xbaz: StringUndefined,
  },
});
</script>

<template>
  <pre> {{ $props }}</pre>
</template>

<template>
  <div v-html="contentValue"></div>
</template>

<script>
export default {
  name: 'my-html',

  props: {
    content: {
      type: [String, Function],
      required: true,
    },
  },

  computed: {
    contentValue() {
      return typeof this.content === 'function' ? this.content() : this.content;
    },
  },

  setup() {},
};
</script>

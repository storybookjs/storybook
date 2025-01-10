<template>
  <div v-html="content"></div>
</template>

<script>
export default {
  name: 'my-html',

  props: {
    content: {
      type: String,
      required: true,
    },
  },

  setup() {},
};
</script>

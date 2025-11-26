<template>
  <form id="interaction-test-form" @submit.prevent="onSubmit">
    <label>
      Enter Value
      <input type="text" data-testid="value" v-model="value" required />
    </label>
    <button type="submit">Submit</button>
    <p v-if="complete">Completed!!</p>
  </form>
</template>

<script>
export default {
  name: 'my-form',

  props: {
    onSuccess: {
      type: Function,
    },
  },

  data() {
    return {
      value: '',
      complete: false,
    };
  },

  methods: {
    onSubmit() {
      this.onSuccess(this.value);
      setTimeout(() => {
        this.complete = true;
      }, 500);
      setTimeout(() => {
        this.complete = false;
      }, 1500);
    },
  },
};
</script>

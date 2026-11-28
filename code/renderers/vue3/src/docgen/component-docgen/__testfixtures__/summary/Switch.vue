<script lang="ts">
import { defineComponent } from 'vue';

/** A switch that is exported below its declaration. */
const Switch = defineComponent({
  props: { label: String },
});

export default Switch;
</script>

<template>
  <button>{{ label }}</button>
</template>

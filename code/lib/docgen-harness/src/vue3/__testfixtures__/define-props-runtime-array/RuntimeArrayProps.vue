<script lang="ts">
// Deliberately classic Options API in a non-setup script: this is the one fixture
// exercising vue-docgen-api's non-setup handler path. The script-setup macro form
// defineProps(['appearance', 'label']) yields the same thin docgen output, so only
// this variant is recorded.
export default {
  props: ['appearance', 'label'],
};
</script>

<template>
  <button :class="appearance">{{ label }}</button>
</template>

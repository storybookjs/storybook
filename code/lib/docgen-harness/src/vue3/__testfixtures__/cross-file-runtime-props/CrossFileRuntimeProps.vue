<script setup lang="ts">
// Reproduces #11774 and #12331: a runtime props object imported from another
// file is invisible to legacy docgen - vue-docgen-api never follows the import,
// so the props section is missing entirely and the argTypes baseline is {}.
import { sharedProps } from './props.ts';

defineProps(sharedProps);
</script>

<template>
  <span>{{ label }}: {{ count }}</span>
</template>

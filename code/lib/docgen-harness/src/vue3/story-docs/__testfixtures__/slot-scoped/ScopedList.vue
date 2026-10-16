<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <ul>
    <li><slot name="item" :label="label" /></li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  status: object;
  release: object;
  updateProgressInfo: object | null;
  isCollapsed: boolean;
}>();
</script>

<template>
  <aside>
    <pre>{{ status }}</pre>
    <pre>{{ release }}</pre>
    <span>{{ updateProgressInfo }}</span>
    <span>{{ isCollapsed }}</span>
  </aside>
</template>

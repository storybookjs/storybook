<script setup lang="ts">
import ArchBlock from './arch/ArchBlock.vue'
</script>

<template>
  <div class="stores">
    <p class="stores__lede">An owner holds the state; clients sync over an explicit channel. No leader election.</p>
    <div class="stores__grid">
      <ArchBlock kind="core" title="Instance">owns <code>status</code> and <code>test-provider</code></ArchBlock>
      <ArchBlock kind="feature" title="Checklist built-in">owns <code>storybook/checklist</code></ArchBlock>
      <ArchBlock kind="addon" title="addon-vitest runtime">owns <code>storybook/test</code>; the Vitest child is a client</ArchBlock>
      <ArchBlock kind="manager" title="Manager page">clients; owners only in a static build</ArchBlock>
    </div>
  </div>
</template>

<style scoped>
.stores {
  display: grid;
  gap: 14px;
  width: 100%;
  font-family: var(--sb-font-sans);
}
.stores__lede {
  margin: 0;
  color: var(--sb-text-muted);
  font-size: 14px;
}
.stores__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.stores__grid :deep(.arch-block) {
  padding: 10px 12px;
  font-size: 13px;
}
.stores__grid :deep(.arch-block__title) {
  font-size: 15px;
}
.stores__grid :deep(code) {
  font-size: 12px;
  white-space: nowrap;
}
</style>

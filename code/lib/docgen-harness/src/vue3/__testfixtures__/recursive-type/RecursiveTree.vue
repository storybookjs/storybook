<script setup lang="ts">
interface TreeNode {
  /** Node label. */
  value: string;
  /** Nested children of this node. */
  children: TreeNode[];
}

defineProps<{
  /** Root node of the tree. */
  node: TreeNode;
}>();
</script>

<template>
  <span>{{ node.value }} ({{ node.children.length }})</span>
</template>

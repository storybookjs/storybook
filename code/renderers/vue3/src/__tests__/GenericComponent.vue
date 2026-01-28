<template>
  <ul class="generic-list">
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="{ selected: selectedItem === item }"
      @click="selectItem(item)"
    >
      {{ getLabel(item) }}
    </li>
  </ul>
</template>

<script lang="ts" setup generic="T">
import { ref } from 'vue';

const props = defineProps<{
  items: T[];
  getLabel: (item: T) => string;
  defaultSelected?: T;
}>();

const emit = defineEmits<{
  (e: 'select', item: T): void;
}>();

const selectedItem = ref<T | undefined>(props.defaultSelected);

const selectItem = (item: T) => {
  selectedItem.value = item;
  emit('select', item);
};
</script>

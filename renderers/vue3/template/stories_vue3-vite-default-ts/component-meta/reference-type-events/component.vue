<script setup lang="ts">
type MyFooEvent = 'foo';

interface MyEvents {
  /** Test description foo */
  (event: MyFooEvent, data?: { foo: string }): void;
  /** Test description bar */
  (event: 'bar', value: { year: number; title?: any }): void;
  /** Test description baz */
  (e: 'baz'): void;
}

const emit = defineEmits<MyEvents>();
</script>

<template>
  <div>
    foo:
    <button @click="emit('bar', { year: 2023, title: 'Storybook' })">
      event: 'bar', value: {year: 2023, title:'Storybook' }
    </button>
  </div>
  <div>
    bar:
    <button @click="emit('baz')">event: 'baz'</button>
  </div>
  <div>
    foo:
    <button @click="emit('foo', { foo: 'foo' })">event: 'foo', data: {foo: 'foo'}</button>
  </div>
</template>

<script setup lang="ts"></script>

<template>
  <slot name="no-bind"></slot>
  <br />
  <slot :num="123"></slot>
  <br />
  <slot name="named" str="str"></slot>
  <br />
  <slot name="vbind" v-bind="{ num: 123, str: 'str' }"></slot>
</template>

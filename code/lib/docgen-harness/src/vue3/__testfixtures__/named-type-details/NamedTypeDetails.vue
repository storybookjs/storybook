<script setup lang="ts">
import type {
  AliasA,
  AppTypes,
  BigInterface,
  Color,
  Dict,
  ID,
  Level,
  LocalDate,
  Prefs,
  Shapes,
  User,
} from './named-types.ts';

defineProps<{
  /** The user to greet. */
  user: User;
  color: Color;
  level?: Level;
  scalarAlias: ID;
  shapes: Shapes;
  cyclic: AliasA;
  big: BigInterface;
  builtin: Date;
  inlined: { foo: string; bar: number };
  namespaced: AppTypes.Nested;
  dict: Dict;
  prefs: Prefs;
  localDate: LocalDate;
}>();
</script>

<template>
  <span>{{ user.name }} {{ color }}</span>
</template>

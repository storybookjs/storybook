<script setup lang="ts">
import ArchBlock from './arch/ArchBlock.vue'
</script>

<template>
  <div class="arch">
    <ArchBlock kind="product" title="storybook" tag="code/lib/storybook" class="arch__main">
      CLI · dev server · compat layer (4 <code>presets.apply</code>) · <code>storybook/*</code> entries re-export the packages below
      <ArchBlock kind="feature" title="Built-in feature addons" tag="src/features" class="arch__nested">
        actions · backgrounds · controls · highlight · measure · outline · viewport · toolbar · component-testing · components-manifest · review · checklist · whats-new · open-in-editor
      </ArchBlock>
    </ArchBlock>
    <div class="arch__imports arch__main">↓ imports</div>
    <ArchBlock kind="manager" title="@storybook/manager" tag="code/lib/manager" class="arch__main">
      manager UI · manager-api · router · review UI · one ESM build with shared chunks
    </ArchBlock>
    <div class="arch__imports arch__main">↓ imports</div>
    <ArchBlock kind="ui" title="@storybook/ui" tag="code/lib/ui" class="arch__main">
      components · theming · docs block components
    </ArchBlock>
    <div class="arch__imports arch__main">↓ imports</div>
    <ArchBlock kind="core" title="@storybook/core" tag="code/core" class="arch__main">
      <div class="arch__lines">
        <span><code>createStorybook</code> instance · hooks · addon dedupe</span>
        <span>services and stores · toolsets · story index</span>
        <span>preview-api · csf · channels · test</span>
        <span>built-ins: docgen · story docs · change detection · ghost stories</span>
      </div>
    </ArchBlock>
    <div class="arch__side">
      <span class="arch__side-arrow">← core only</span>
      <ArchBlock kind="openService" title="@storybook/open-service">
        createTools · attached client · child host
      </ArchBlock>
    </div>
    <ArchBlock kind="addon" dashed title="Addons" class="arch__plugins">
      frameworks · renderers · builders · addons — Node side imports <code>@storybook/core/*</code>; storybook is an optional peer
    </ArchBlock>
  </div>
</template>

<style scoped>
.arch {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  column-gap: 10px;
  width: 100%;
  font-family: var(--sb-font-sans);
  font-size: 12px;
}
.arch__main {
  grid-column: 1;
}
.arch__nested {
  margin-top: 6px;
}
.arch__imports {
  color: var(--sb-text-muted);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.arch__lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px 14px;
}
.arch__side {
  display: flex;
  align-items: center;
  gap: 8px;
  grid-column: 2;
}
.arch__side-arrow {
  flex: none;
  color: var(--sb-text-muted);
  font-size: 11px;
}
.arch__plugins {
  grid-column: 1 / -1;
  margin-top: 10px;
}
</style>

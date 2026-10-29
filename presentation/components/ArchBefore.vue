<script setup lang="ts">
import ArchBlock from './arch/ArchBlock.vue'
import ArchLegend from './arch/ArchLegend.vue'
</script>

<template>
  <div class="arch">
    <div class="arch__frame">
      <div class="arch__frame-head">
        <span class="arch__frame-title">storybook</span>
        <code>code/core</code>
        <span class="arch__muted">52 <code>presets.apply</code> calls</span>
      </div>
      <div class="arch__grid">
        <ArchBlock kind="product" title="CLI and dev server">cli · core-server · bin · common</ArchBlock>
        <ArchBlock kind="product" title="Presets">every framework, addon and core preset</ArchBlock>
        <ArchBlock kind="manager" title="Manager">manager · manager-api · router · builder-manager; one IIFE bundle per addon entry</ArchBlock>
        <ArchBlock kind="ui" title="Components">components · theming</ArchBlock>
        <ArchBlock kind="core" title="Preview runtime">preview-api · csf · channels · types · telemetry</ArchBlock>
        <ArchBlock kind="feature" title="Feature UIs">actions · backgrounds · controls · highlight · measure · outline · viewport · toolbar · component-testing</ArchBlock>
        <ArchBlock kind="feature" title="Server features">save story · checklist · what's new · open in editor · review</ArchBlock>
        <ArchBlock kind="core" title="Indexing and testing">story index · ghost stories · change detection · instrumenter · mocking</ArchBlock>
        <ArchBlock kind="openService" title="Tools client">storybook tools</ArchBlock>
        <ArchBlock kind="addon" title="Vitest server glue">AI setup · ghost runs · idle wait</ArchBlock>
      </div>
    </div>
    <div class="arch__arrow">↑</div>
    <ArchBlock kind="addon" dashed title="Plugins">
      frameworks · renderers · builders · addons — load through presets and import <code>storybook/internal/*</code>
    </ArchBlock>
    <ArchLegend class="arch__legend" />
  </div>
</template>

<style scoped>
.arch {
  display: flex;
  flex-direction: column;
  width: 100%;
  font-family: var(--sb-font-sans);
  font-size: 12px;
}
.arch__frame {
  padding: 8px 10px 10px;
  border: 1.5px solid var(--sb-border);
  border-radius: 8px;
}
.arch__frame-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.arch__frame-title {
  font-size: 16px;
  font-weight: 900;
}
.arch__frame-head code {
  padding: 0;
  background: none;
  color: var(--sb-text-muted);
  font-size: 11px;
}
.arch__muted {
  color: var(--sb-text-muted);
  font-size: 11px;
}
.arch__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.arch__arrow {
  color: var(--sb-text-muted);
  font-size: 16px;
  line-height: 20px;
  text-align: center;
}
.arch__legend {
  margin-top: 10px;
}
</style>

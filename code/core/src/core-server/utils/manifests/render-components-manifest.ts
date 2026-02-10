import path from 'node:path';

import { groupBy } from 'storybook/internal/common';
import type { ComponentDoc, PropItem } from 'react-docgen-typescript';

import type { ComponentManifest, ComponentsManifest } from '../../../types';

/** Minimal docs entry type for rendering in the manifest debugger */
interface DocsManifestEntry {
  id: string;
  name: string;
  path: string;
  title: string;
  content?: string;
  summary?: string;
  error?: { name: string; message: string };
}

/** Minimal docs manifest type for rendering in the manifest debugger */
export interface DocsManifest {
  v: number;
  docs: Record<string, DocsManifestEntry>;
}

/** Extended component manifest that may include docs from the docs addon */
interface ComponentManifestWithDocs extends ComponentManifest {
  docs?: Record<string, DocsManifestEntry>;
}

// AI generated manifests/components.html page
// Only HTML/CSS no JS
export function renderComponentsManifest(
  manifest: ComponentsManifest | undefined,
  docsManifest?: DocsManifest
) {
  const entries = Object.entries(manifest?.components ?? {}).sort((a, b) =>
    (a[1].name || a[0]).localeCompare(b[1].name || b[0])
  );

  // Get unattached docs entries
  const docsEntries = Object.entries(docsManifest?.docs ?? {}).sort((a, b) =>
    (a[1].name || a[0]).localeCompare(b[1].name || b[0])
  );

  const analyses = entries.map(([, c]) => analyzeComponent(c));
  const docsAnalyses = docsEntries.map(([, d]) => analyzeDoc(d));
  const attachedDocs = analyses.reduce((sum, a) => sum + a.totalDocs, 0);
  const attachedDocsWithError = analyses.reduce((sum, a) => sum + a.docsErrors, 0);
  const unattachedDocsWithError = docsAnalyses.filter((a) => a.hasError).length;
  const totals = {
    components: entries.length,
    componentsWithPropTypeError: analyses.filter((a) => a.hasPropTypeError).length,
    infos: analyses.filter((a) => a.hasWarns).length,
    stories: analyses.reduce((sum, a) => sum + a.totalStories, 0),
    storyErrors: analyses.reduce((sum, a) => sum + a.storyErrors, 0),
    docs: docsEntries.length + attachedDocs,
    docsWithError: unattachedDocsWithError + attachedDocsWithError,
  };

  // Top filters (clickable), no <b> tags; 1px active ring lives in CSS via :target
  const allPill = `<a class="filter-pill all" data-k="all" href="#filter-all">All</a>`;
  const compErrorsPill =
    totals.componentsWithPropTypeError > 0
      ? `<a class="filter-pill err" data-k="errors" href="#filter-errors">${totals.componentsWithPropTypeError}/${totals.components} prop type ${plural(totals.componentsWithPropTypeError, 'error')}</a>`
      : totals.components > 0
        ? `<span class="filter-pill ok" aria-disabled="true">${totals.components} components ok</span>`
        : '';
  const compInfosPill =
    totals.infos > 0
      ? `<a class="filter-pill info" data-k="infos" href="#filter-infos">${totals.infos}/${totals.components} ${plural(totals.infos, 'info', 'infos')}</a>`
      : '';
  const storiesPill =
    totals.storyErrors > 0
      ? `<a class="filter-pill err" data-k="story-errors" href="#filter-story-errors">${totals.storyErrors}/${totals.stories} story errors</a>`
      : totals.stories > 0
        ? `<span class="filter-pill ok" aria-disabled="true">${totals.stories} ${plural(totals.stories, 'story', 'stories')} ok</span>`
        : '';
  const docsPill =
    totals.docs > 0
      ? totals.docsWithError > 0
        ? `<a class="filter-pill info" data-k="docs" href="#filter-docs">${totals.docsWithError}/${totals.docs} doc ${plural(totals.docsWithError, 'error')}</a>`
        : `<a class="filter-pill ok" data-k="docs" href="#filter-docs">${totals.docs} ${plural(totals.docs, 'doc')} ok</a>`
      : '';

  const grid = entries.map(([key, c], idx) => renderComponentCard(key, c, `${idx}`)).join('');
  const docsGrid = docsEntries.map(([key, d], idx) => renderDocCard(key, d, `doc-${idx}`)).join('');

  const errorGroups = Object.entries(
    groupBy(
      entries.map(([, it]) => it).filter((it) => it.error),
      (manifest) => manifest.error?.name ?? 'Error'
    )
  ).sort(([, a], [, b]) => b.length - a.length);

  const errorGroupsHTML = errorGroups
    .map(([error, grouped]) => {
      const id = error.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const headerText = `${esc(error)}`;
      const cards = grouped
        .map((manifest, id) => renderComponentCard(manifest.id, manifest, `error-${id}`))
        .join('');
      return `
        <section class="group">
          <input id="${id}-toggle" class="group-tg" type="checkbox" hidden />
          <label for="${id}-toggle" class="group-header">
            <span class="caret">▸</span>
            <span class="group-title">${headerText}</span>
            <span class="group-count">${grouped.length}</span>
          </label>
          <div class="group-cards">${cards}</div>
        </section>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Components Manifest</title>
  <style>
      :root {
          --bg: #0b0c10;
          --panel: #121318;
          --muted: #9aa0a6;
          --fg: #e8eaed;
          --ok: #22c55e;
          --info: #1e88e5;
          --err: #c62828;
          --ok-bg: #0c1a13;
          --info-bg: #0c1624;
          --err-bg: #1a0e0e;
          --chip: #1f2330;
          --border: #2b2f3a;
          --link: #8ab4f8;
          --active-ring: 1px; /* 1px active ring for pills and toggles */
      }

      * {
          box-sizing: border-box;
      }

      html,
      body {
          margin: 0;
          background: var(--bg);
          color: var(--fg);
          font: 14px/1.5 system-ui,
          -apple-system,
          Segoe UI,
          Roboto,
          Ubuntu,
          Cantarell,
          'Helvetica Neue',
          Arial,
          'Noto Sans';
      }

      .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px 20px;
      }

      header {
          position: sticky;
          top: 0;
          backdrop-filter: blur(6px);
          background: color-mix(in srgb, var(--bg) 84%, transparent);
          border-bottom: 1px solid var(--border);
          z-index: 10;
      }

      h1 {
          font-size: 20px;
          margin: 0 0 6px;
      }

      .summary {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
      }

      /* Top filter pills */
      .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--panel);
          text-decoration: none;
          cursor: pointer;
          user-select: none;
          color: var(--fg);
      }

      .filter-pill.ok {
          color: #b9f6ca;
          border-color: color-mix(in srgb, var(--ok) 55%, var(--border));
          background: color-mix(in srgb, var(--ok) 18%, #000);
      }

      .filter-pill.info {
          color: #b3d9ff;
          border-color: color-mix(in srgb, var(--info) 55%, var(--border));
          background: var(--info-bg);
      }

      .filter-pill.err {
          color: #ff9aa0;
          border-color: color-mix(in srgb, var(--err) 55%, var(--border));
          background: var(--err-bg);
      }

      .filter-pill.all {
          color: #d7dbe0;
          border-color: var(--border);
          background: var(--panel);
      }

      .filter-pill[aria-disabled='true'] {
          cursor: default;
          text-decoration: none;
      }

      .filter-pill:focus,
      .filter-pill:active {
          outline: none;
          box-shadow: none;
      }

      /* Selected top pill ring via :target */
      #filter-all:target ~ header .filter-pill[data-k='all'],
      #filter-errors:target ~ header .filter-pill[data-k='errors'],
      #filter-infos:target ~ header .filter-pill[data-k='infos'],
      #filter-story-errors:target ~ header .filter-pill[data-k='story-errors'],
      #filter-doc-errors:target ~ header .filter-pill[data-k='docs'],
      #filter-docs:target ~ header .filter-pill[data-k='docs'] {
          box-shadow: 0 0 0 var(--active-ring) currentColor;
          border-color: currentColor;
      }

      /* Hidden targets for filtering */
      #filter-all,
      #filter-errors,
      #filter-infos,
      #filter-story-errors,
      #filter-doc-errors,
      #filter-docs {
          display: none;
      }

      main {
          padding: 36px 0 40px;
      }

      .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
      }

      /* one card per row */

      .card {
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
      }

      .head {
          display: flex;
          flex-direction: column;
          gap: 8px;
      }

      .title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
      }

      .title h2 {
          font-size: 16px;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
      }

      .meta {
          font-size: 12px;
          color: var(--muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
      }

      .kv {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
      }

      .chip {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 999px;
          background: var(--chip);
          border: 1px solid var(--border);
      }

      .hint {
          color: var(--muted);
          font-size: 12px;
      }

      .badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
      }

      /* Per-card badges: labels become toggles when clickable */
      .badge {
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--chip);
          color: #d7dbe0;
      }

      .badge.ok {
          color: #b9f6ca;
          border-color: color-mix(in srgb, var(--ok) 55%, var(--border));
      }

      .badge.info {
          color: #b3d9ff;
          border-color: color-mix(in srgb, var(--info) 55%, var(--border));
      }

      .badge.err {
          color: #ff9aa0;
          border-color: color-mix(in srgb, var(--err) 55%, var(--border));
      }

      .as-toggle {
          cursor: pointer;
      }

      /* 1px ring on active toggle */
      .tg-err:checked + label.as-toggle,
      .tg-info:checked + label.as-toggle,
      .tg-stories:checked + label.as-toggle,
      .tg-docs:checked + label.as-toggle,
      .tg-content:checked + label.as-toggle,
      .tg-props:checked + label.as-toggle,
      .tg-rdt:checked + label.as-toggle {
          box-shadow: 0 0 0 var(--active-ring) currentColor;
          border-color: currentColor;
      }

      /* Panels: hidden by default, shown when respective toggle checked */
      .panels {
          display: grid;
          gap: 10px;
      }

      .panel {
          display: none;
      }

      .tg-err:checked ~ .panels .panel-err {
          display: grid;
      }

      .tg-info:checked ~ .panels .panel-info {
          display: grid;
          gap: 8px;
      }

      .tg-stories:checked ~ .panels .panel-stories {
          display: grid;
          gap: 8px;
      }

      .tg-docs:checked ~ .panels .panel-docs {
          display: grid;
          gap: 8px;
      }

      .tg-content:checked ~ .panels .panel-content {
          display: grid;
          gap: 8px;
      }

      .tg-props:checked ~ .panels .panel-props {
          display: grid;
      }

      .tg-rdt:checked ~ .panels .panel-rdt {
          display: grid;
      }

      /* Colored notes for prop type error + info */
      .note {
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
      }

      .note.err {
          border-color: color-mix(in srgb, var(--err) 55%, var(--border));
          background: var(--err-bg);
          color: #ffd1d4;
      }

      .note.info {
          border-color: color-mix(in srgb, var(--info) 55%, var(--border));
          background: var(--info-bg);
          color: #d6e8ff;
      }

      .note.ok {
          border-color: color-mix(in srgb, var(--ok) 55%, var(--border));
          background: var(--ok-bg);
          color: var(--fg);
      }

      .note-title {
          font-weight: 600;
          margin-bottom: 6px;
      }

      .note-body {
          white-space: normal;
      }

      /* Story error cards */
      .ex {
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: #0f131b;
      }

      .ex.err {
          border-color: color-mix(in srgb, var(--err) 55%, var(--border));
      }

      .row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
      }

      .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
      }

      .dot-ok {
          background: var(--ok);
      }

      .dot-err {
          background: var(--err);
      }

      .ex-name {
          font-weight: 600;
      }

      /* Error groups (visible in errors filter) */
      .error-groups {
          display: none;
          margin-bottom: 16px;
      }

      .group {
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: 14px;
          overflow: hidden;
      }

      .group + .group {
          margin-top: 12px;
      }

      .group-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
      }

      .group-header:hover {
          background: #141722;
      }

      .group-title {
          font-weight: 600;
          flex: 1;
      }

      .group-count {
          font-size: 12px;
          color: var(--muted);
      }

      .group-cards {
          display: none;
          padding: 12px;
      }

      .group .card {
          margin: 12px 0;
      }

      .group .card:first-child {
          margin-top: 0;
      }

      .group .card:last-child {
          margin-bottom: 0;
      }

      /* caret rotation */
      .group-tg:checked + label .caret {
          transform: rotate(90deg);
      }

      .caret {
          transition: transform 0.15s ease;
      }

      /* toggle body */
      .group-tg:checked ~ .group-cards {
          display: block;
      }

      /* CSS-only filtering of cards via top pills */
      #filter-errors:target ~ main .card:not(.has-error):not(.has-story-error) {
          display: none;
      }

      #filter-infos:target ~ main .card:not(.has-info) {
          display: none;
      }

      #filter-story-errors:target ~ main .card:not(.has-story-error) {
          display: none;
      }

      #filter-doc-errors:target ~ main .card:not(.has-doc-error) {
          display: none;
      }

      #filter-docs:target ~ main .card:has(> .tg-docs),
      #filter-docs:target ~ main .card.is-doc {
          display: block;
      }

      #filter-docs:target ~ main .card:not(:has(> .tg-docs)):not(.is-doc) {
          display: none;
      }

      #filter-all:target ~ main .card {
          display: block;
      }

      /* In errors view, hide standalone component-error cards in the regular grid (they will appear in groups) */
      #filter-errors:target ~ main .grid .card.has-error {
          display: none;
      }

      /* Show grouped section only in errors view */
      #filter-errors:target ~ main .error-groups {
          display: block;
      }

      /* Section titles */
      .section-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--muted);
          margin: 24px 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
      }
      .section-title:first-child {
          margin-top: 0;
      }

      /* When a toggle is checked, show the corresponding panel */
      .card > .tg-err:checked ~ .panels .panel-err {
          display: grid;
      }
      
      .card > .tg-info:checked ~ .panels .panel-info {
          display: grid;
      }
      
      .card > .tg-stories:checked ~ .panels .panel-stories {
          display: grid;
      }

      .card > .tg-docs:checked ~ .panels .panel-docs {
          display: grid;
      }

      .card > .tg-content:checked ~ .panels .panel-content {
          display: grid;
      }

      /* Add vertical spacing around panels only when any panel is visible */
      .card > .tg-err:checked ~ .panels,
      .card > .tg-info:checked ~ .panels,
      .card > .tg-stories:checked ~ .panels,
      .card > .tg-docs:checked ~ .panels,
      .card > .tg-content:checked ~ .panels,
      .card > .tg-props:checked ~ .panels,
      .card > .tg-rdt:checked ~ .panels {
          margin: 10px 0;
      }

      /* Optional: a subtle 1px ring on the active badge, using :has() if available */
      @supports selector(.card:has(.tg-err:checked)) {
          .card:has(.tg-err:checked) label[for$='-err'],
          .card:has(.tg-info:checked) label[for$='-info'],
          .card:has(.tg-stories:checked) label[for$='-stories'],
          .card:has(.tg-docs:checked) label[for$='-docs'],
          .card:has(.tg-content:checked) label[for$='-content'],
          .card:has(.tg-props:checked) label[for$='-props'],
          .card:has(.tg-rdt:checked) label[for$='-rdt'] {
              box-shadow: 0 0 0 1px currentColor;
              border-color: currentColor;
          }
      }

      /* Wrap long lines in code blocks at ~120 characters */
      pre, code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      }
      pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
          overflow-x: auto; /* fallback for extremely long tokens */
          margin: 8px 0 0;
      }
      pre > code {
          display: block;
          white-space: inherit;
          overflow-wrap: inherit;
          word-break: inherit;
          inline-size: min(100%, 120ch);
      }

      /* MDX content container for docs */
      .mdx-content {
          background: #0f131b;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          max-height: 400px;
          overflow-y: auto;
          margin-top: 8px;
      }
  </style>
</head>
<body>
<!-- Hidden targets for the top-level filters -->
<span id="filter-all"></span>
<span id="filter-errors"></span>
<span id="filter-infos"></span>
<span id="filter-story-errors"></span>
<span id="filter-doc-errors"></span>
<span id="filter-docs"></span>
<header>
  <div class="wrap">
    <h1>Manifest Debugger</h1>
    <div class="summary">${allPill}${compErrorsPill}${compInfosPill}${storiesPill}${docsPill}</div>
  </div>
</header>
<main>
  <div class="wrap">
    ${
      grid
        ? `<h2 class="section-title">Components</h2>
    <div class="grid" role="list">
      ${grid}
    </div>`
        : ''
    }
    ${
      errorGroups.length
        ? `<div class="error-groups" role="region" aria-label="Prop type error groups">${errorGroupsHTML}</div>`
        : ''
    }
    ${
      docsGrid
        ? `<h2 class="section-title">Unattached Docs</h2>
    <div class="grid" role="list">
      ${docsGrid}
    </div>`
        : ''
    }
    ${
      !grid && !docsGrid
        ? `<div class="card"><div class="head"><div class="hint">No components or docs.</div></div></div>`
        : ''
    }
  </div>
</main>
</body>
</html>  `;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

function analyzeComponent(c: ComponentManifestWithDocs) {
  const hasPropTypeError = !!c.error;
  const warns: string[] = [];

  if (!c.description?.trim()) {
    warns.push('No description found. Write a jsdoc comment such as /** Component description */.');
  }

  if (!c.import?.trim()) {
    warns.push(
      `Specify an @import jsdoc tag on your component or your stories meta such as @import import { ${c.name} } from 'my-design-system';`
    );
  }

  const totalStories = c.stories?.length ?? 0;
  const storyErrors = (c.stories ?? []).filter((e) => !!e?.error).length;
  const storyOk = totalStories - storyErrors;

  // Analyze attached docs
  const docsEntries = c.docs ? Object.values(c.docs) : [];
  const totalDocs = docsEntries.length;
  const docsErrors = docsEntries.filter((d) => !!d?.error).length;
  const docsOk = totalDocs - docsErrors;

  const hasAnyError = hasPropTypeError || storyErrors > 0 || docsErrors > 0; // for status dot (red if any errors)

  return {
    hasPropTypeError,
    hasAnyError,
    hasWarns: warns.length > 0,
    warns,
    totalStories,
    storyErrors,
    storyOk,
    totalDocs,
    docsErrors,
    docsOk,
  };
}

function analyzeDoc(d: DocsManifestEntry) {
  return {
    hasError: !!d.error,
  };
}

function note(title: string, bodyHTML: string, kind: 'info' | 'err') {
  return `
    <div class="note ${kind}">
      <div class="note-title">${esc(title)}</div>
      <div class="note-body">${bodyHTML}</div>
    </div>`;
}

function renderDocCard(key: string, d: DocsManifestEntry, id: string) {
  const a = analyzeDoc(d);
  const statusDot = a.hasError ? 'dot-err' : 'dot-ok';

  const slug = `${id}-${(d.id || key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

  const errorBadge = a.hasError
    ? `<label for="${slug}-err" class="badge err as-toggle">error</label>`
    : '';

  const contentBadge = d.content
    ? `<label for="${slug}-content" class="badge ok as-toggle">view content</label>`
    : '';

  return `
<article
  class="card is-doc ${a.hasError ? 'has-doc-error' : 'no-doc-error'}"
  role="listitem"
  aria-label="${esc(d.name || key)}">
  <div class="head">
    <div class="title">
      <h2><span class="status-dot ${statusDot}"></span> ${esc(d.title || d.name || key)}</h2>
      <div class="badges">
        ${errorBadge}
        ${contentBadge}
      </div>
    </div>
    <div class="meta" title="${esc(d.path)}">${esc(d.id)} · ${esc(d.path)}</div>
    ${d.summary ? `<div>${esc(d.summary)}</div>` : ''}
  </div>

  <!-- Hidden toggles must be siblings BEFORE .panels -->
  ${a.hasError ? `<input id="${slug}-err" class="tg tg-err" type="checkbox" hidden />` : ''}
  ${d.content ? `<input id="${slug}-content" class="tg tg-content" type="checkbox" hidden />` : ''}

  <div class="panels">
    ${
      a.hasError
        ? `
        <div class="panel panel-err">
          <div class="note err">
            <div class="note-title">${esc(d.error?.name || 'Error')}</div>
            <div class="note-body"><pre><code>${esc(d.error?.message || 'Unknown error')}</code></pre></div>
          </div>
        </div>`
        : ''
    }
    ${
      d.content
        ? `
        <div class="panel panel-content">
          <div class="mdx-content">
            <pre><code>${esc(d.content)}</code></pre>
          </div>
        </div>`
        : ''
    }
  </div>
</article>`;
}

function renderComponentCard(key: string, c: ComponentManifestWithDocs, id: string) {
  const a = analyzeComponent(c);
  const statusDot = a.hasAnyError ? 'dot-err' : 'dot-ok';
  const allStories = c.stories ?? [];
  const errorStories = allStories.filter((ex) => !!ex?.error);
  const okStories = allStories.filter((ex) => !ex?.error);

  // Get attached docs entries
  const allDocs = c.docs ? Object.values(c.docs) : [];
  const errorDocs = allDocs.filter((d) => !!d?.error);
  const okDocs = allDocs.filter((d) => !d?.error);

  const slug = `c-${id}-${(c.id || key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

  const componentErrorBadge = a.hasPropTypeError
    ? `<label for="${slug}-err" class="badge err as-toggle">prop type error</label>`
    : '';

  const infosBadge = a.hasWarns
    ? `<label for="${slug}-info" class="badge info as-toggle">${a.warns.length} ${plural(a.warns.length, 'info', 'infos')}</label>`
    : '';

  const storiesBadge =
    a.totalStories > 0
      ? `<label for="${slug}-stories" class="badge ${a.storyErrors > 0 ? 'err' : 'ok'} as-toggle">${a.storyErrors > 0 ? `${a.storyErrors}/${a.totalStories} story errors` : `${a.totalStories} ${plural(a.totalStories, 'story', 'stories')}`}</label>`
      : '';

  const docsBadge =
    a.totalDocs > 0
      ? `<label for="${slug}-docs" class="badge ${a.docsErrors > 0 ? 'err' : 'ok'} as-toggle">${a.docsErrors > 0 ? `${a.docsErrors}/${a.totalDocs} doc errors` : `${a.totalDocs} ${plural(a.totalDocs, 'doc')}`}</label>`
      : '';

  // When there is no prop type error, try to read prop types from reactDocgen if present
  const reactDocgen =
    !a.hasPropTypeError && 'reactDocgen' in c ? (c.reactDocgen as DocgenDoc) : undefined;
  const parsedDocgen = reactDocgen ? parseReactDocgen(reactDocgen) : undefined;
  const propEntries = parsedDocgen ? Object.entries(parsedDocgen.props ?? {}) : [];
  const propTypesBadge =
    !a.hasPropTypeError && propEntries.length > 0
      ? `<label for="${slug}-props" class="badge ok as-toggle">${propEntries.length} ${plural(propEntries.length, 'prop type')}</label>`
      : '';

  // react-docgen-typescript results (alongside react-docgen)
  const rdtData =
    'reactDocgenTypescript' in c ? (c.reactDocgenTypescript as RdtComponentDoc) : undefined;
  const parsedRdt = rdtData ? parseReactDocgenTypescript(rdtData) : undefined;
  const rdtPropEntries = parsedRdt ? Object.entries(parsedRdt.props ?? {}) : [];
  const rdtBadge =
    rdtPropEntries.length > 0
      ? `<label for="${slug}-rdt" class="badge ok as-toggle">${rdtPropEntries.length} rdt ${plural(rdtPropEntries.length, 'prop')}</label>`
      : '';

  const primaryBadge = componentErrorBadge || propTypesBadge;

  const propsCode =
    propEntries.length > 0
      ? propEntries
          .sort(([aName], [bName]) => aName.localeCompare(bName))
          .map(([propName, info]) => {
            const description = (info?.description ?? '').trim();
            const t = (info?.type ?? 'any').trim();
            const optional = info?.required ? '' : '?';
            const defaultVal = (info?.defaultValue ?? '').trim();
            const def = defaultVal ? ` = ${defaultVal}` : '';
            const doc =
              ['/**', ...description.split('\n').map((line) => ` * ${line}`), ' */'].join('\n') +
              '\n';
            return `${description ? doc : ''}${propName}${optional}: ${t}${def}`;
          })
          .join('\n\n')
      : '';

  const rdtPropsCode =
    rdtPropEntries.length > 0
      ? rdtPropEntries
          .sort(([aName], [bName]) => aName.localeCompare(bName))
          .map(([propName, info]) => {
            const description = (info?.description ?? '').trim();
            const t = (info?.type ?? 'any').trim();
            const optional = info?.required ? '' : '?';
            const defaultVal = (info?.defaultValue ?? '').trim();
            const def = defaultVal ? ` = ${defaultVal}` : '';
            const doc =
              ['/**', ...description.split('\n').map((line: string) => ` * ${line}`), ' */'].join(
                '\n'
              ) + '\n';
            return `${description ? doc : ''}${propName}${optional}: ${t}${def}`;
          })
          .join('\n\n')
      : '';

  const tags =
    c.jsDocTags && typeof c.jsDocTags === 'object'
      ? Object.entries(c.jsDocTags)
          .flatMap(([k, v]) =>
            (Array.isArray(v) ? v : [v]).map(
              (val) => `<span class="chip">${esc(k)}: ${esc(val)}</span>`
            )
          )
          .join('')
      : '';

  esc(c.error?.message || 'Unknown error');
  return `
<article
  class="card 
  ${a.hasPropTypeError ? 'has-error' : 'no-error'} 
  ${a.hasWarns ? 'has-info' : 'no-info'} 
  ${a.storyErrors ? 'has-story-error' : 'no-story-error'}
  ${a.docsErrors ? 'has-doc-error' : 'no-doc-error'}"
  role="listitem"
  aria-label="${esc(c.name || key)}">
  <div class="head">
    <div class="title">
      <h2><span class="status-dot ${statusDot}"></span> ${esc(c.name || key)}</h2>
      <div class="badges">
        ${primaryBadge}
        ${rdtBadge}
        ${infosBadge}
        ${storiesBadge}
        ${docsBadge}
      </div>
    </div>
    <div class="meta" title="${esc(c.path)}">${esc(c.id)} · ${esc(c.path)}</div>
    ${c.summary ? `<div>${esc(c.summary)}</div>` : ''}
    ${c.description ? `<div class="hint">${esc(c.description)}</div>` : ''}
    ${tags ? `<div class="kv">${tags}</div>` : ''}
  </div>

  <!-- ⬇️ Hidden toggles must be siblings BEFORE .panels -->
  ${a.hasPropTypeError ? `<input id="${slug}-err" class="tg tg-err" type="checkbox" hidden />` : ''}
  ${a.hasWarns ? `<input id="${slug}-info" class="tg tg-info" type="checkbox" hidden />` : ''}
  ${a.totalStories > 0 ? `<input id="${slug}-stories" class="tg tg-stories" type="checkbox" hidden />` : ''}
  ${a.totalDocs > 0 ? `<input id="${slug}-docs" class="tg tg-docs" type="checkbox" hidden />` : ''}
  ${!a.hasPropTypeError && propEntries.length > 0 ? `<input id="${slug}-props" class="tg tg-props" type="checkbox" hidden />` : ''}
  ${rdtPropEntries.length > 0 ? `<input id="${slug}-rdt" class="tg tg-rdt" type="checkbox" hidden />` : ''}

  <div class="panels">
    ${
      a.hasPropTypeError
        ? `
        <div class="panel panel-err">
          ${note('Prop type error', `<pre><code>${esc(c.error?.message || 'Unknown error')}</code></pre>`, 'err')}
        </div>`
        : ''
    }
    ${
      a.hasWarns
        ? `
        <div class="panel panel-info">
          ${a.warns.map((w) => note('Info', esc(w), 'info')).join('')}
        </div>`
        : ''
    }
    ${
      !a.hasPropTypeError && propEntries.length > 0
        ? `
        <div class="panel panel-props">
          <div class="note ok">
            <div class="row">
              <span class="ex-name">Prop types <small>(react-docgen)</small></span>
              <span class="badge ok">${propEntries.length} ${plural(propEntries.length, 'prop type')}</span>
            </div>
            <pre><code>Component: ${reactDocgen?.definedInFile ? esc(path.relative(process.cwd(), reactDocgen.definedInFile)) : ''}${reactDocgen?.exportName ? '::' + esc(reactDocgen?.exportName) : ''}</code></pre>
            <pre><code>Props:</code></pre>
            <pre><code>${esc(propsCode)}</code></pre>
          </div>
        </div>`
        : ''
    }
    ${
      rdtPropEntries.length > 0
        ? `
        <div class="panel panel-rdt">
          <div class="note ok">
            <div class="row">
              <span class="ex-name">Prop types <small>(react-docgen-typescript)</small></span>
              <span class="badge ok">${rdtPropEntries.length} ${plural(rdtPropEntries.length, 'prop')}</span>
            </div>
            <pre><code>Component: ${rdtData?.filePath ? esc(path.relative(process.cwd(), rdtData.filePath)) : ''}${rdtData?.exportName ? '::' + esc(rdtData.exportName) : ''} (displayName: ${esc(rdtData?.displayName ?? '')})</code></pre>
            <pre><code>Props:</code></pre>
            <pre><code>${esc(rdtPropsCode)}</code></pre>
          </div>
        </div>`
        : ''
    }
    ${
      a.totalStories > 0
        ? `
        <div class="panel panel-stories">
          ${errorStories
            .map(
              (ex, j) => `
            <div class="note err">
              <div class="row">
                <span class="ex-name">${esc(ex.name)}</span>
                <span class="badge err">story error</span>
              </div>
              ${ex?.summary ? `<div class=\"hint\">Summary: ${esc(ex.summary)}</div>` : ''}
              ${ex?.description ? `<div class=\"hint\">${esc(ex.description)}</div>` : ''}
              ${ex?.snippet ? `<pre><code>${esc(ex.snippet)}</code></pre>` : ''}
              ${ex?.error?.message ? `<pre><code>${esc(ex.error.message)}</code></pre>` : ''}
            </div>`
            )
            .join('')}
          
          
          ${
            c.import
              ? `<div class="note ok">
                <div class="row">
                  <span class="ex-name">Imports</span>
                </div>
                <pre><code>${c.import}</code></pre>
              </div>`
              : ''
          }
          
          ${okStories
            .map(
              (ex) => `
            <div class="note ok">
              <div class="row">
                <span class="ex-name">${esc(ex.name)}</span>
                <span class="badge ok">story ok</span>
              </div>
              ${ex?.summary ? `<div>${esc(ex.summary)}</div>` : ''}
              ${ex?.description ? `<div class=\"hint\">${esc(ex.description)}</div>` : ''}
              ${ex?.snippet ? `<pre><code>${esc(ex.snippet)}</code></pre>` : ''}
            </div>`
            )
            .join('')}
        </div>`
        : ''
    }
    ${
      a.totalDocs > 0
        ? `
        <div class="panel panel-docs">
          ${errorDocs
            .map(
              (doc) => `
            <div class="note err">
              <div class="row">
                <span class="ex-name">${esc(doc.name)}</span>
                <span class="badge err">doc error</span>
              </div>
              <div class="hint">${esc(doc.path)}</div>
              ${doc?.summary ? `<div>${esc(doc.summary)}</div>` : ''}
              ${doc?.error?.message ? `<pre><code>${esc(doc.error.message)}</code></pre>` : ''}
            </div>`
            )
            .join('')}
          ${okDocs
            .map(
              (doc) => `
            <div class="note ok">
              <div class="row">
                <span class="ex-name">${esc(doc.name)}</span>
                <span class="badge ok">doc ok</span>
              </div>
              <div class="hint">${esc(doc.path)}</div>
              ${doc?.summary ? `<div>${esc(doc.summary)}</div>` : ''}
              ${doc?.content ? `<div class="mdx-content"><pre><code>${esc(doc.content)}</code></pre></div>` : ''}
            </div>`
            )
            .join('')}
        </div>`
        : ''
    }
  </div>
</article>`;
}

type ParsedProp = {
  description?: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
};

type ParsedDocgen = {
  props: Record<string, ParsedProp>;
};

type RdtComponentDoc = ComponentDoc & { exportName?: string };

const parseReactDocgenTypescript = (reactDocgenTypescript: RdtComponentDoc): ParsedDocgen => {
  const props: Record<string, PropItem> = reactDocgenTypescript.props ?? {};
  return {
    props: Object.fromEntries(
      Object.entries(props).map(([propName, prop]) => [
        propName,
        {
          description: prop.description,
          // RDT uses prop.type.name as a flat string (e.g. "() => void", "{ id: string }")
          // For enums, prefer prop.type.raw which has the full union
          type: prop.type?.raw ?? prop.type?.name,
          defaultValue: prop.defaultValue?.value,
          required: prop.required,
        },
      ])
    ),
  };
};

/** Shape of a react-docgen tsType node (recursive) */
interface DocgenTsType {
  name?: string;
  raw?: string;
  value?: string;
  elements?: DocgenTsType[];
  type?: string;
  signature?: {
    arguments?: { name: string; type?: DocgenTsType }[];
    return?: DocgenTsType;
    properties?: { key: string; value?: DocgenTsType & { required?: boolean } }[];
  };
}

/** Shape of a single prop from react-docgen's Documentation.props */
interface DocgenPropItem {
  description?: string;
  tsType?: DocgenTsType;
  type?: DocgenTsType;
  defaultValue?: { value?: string } | null;
  required?: boolean;
}

/** Shape of react-docgen's Documentation (only fields we read) */
interface DocgenDoc {
  props?: Record<string, DocgenPropItem>;
  definedInFile?: string;
  exportName?: string;
}

const parseReactDocgen = (reactDocgen: DocgenDoc): ParsedDocgen => {
  const props = reactDocgen.props ?? {};
  return {
    props: Object.fromEntries(
      Object.entries(props).map(([propName, prop]) => [
        propName,
        {
          description: prop.description,
          type: serializeTsType(prop.tsType ?? prop.type),
          defaultValue: prop.defaultValue?.value,
          required: prop.required,
        },
      ])
    ),
  };
};

// Serialize a react-docgen tsType into a TypeScript-like string when raw is not available
function serializeTsType(tsType: DocgenTsType | undefined): string | undefined {
  if (!tsType) {
    return undefined;
  }
  // Prefer raw if provided
  if (tsType.raw && tsType.raw.trim().length > 0) {
    return tsType.raw;
  }

  if (!tsType.name) {
    return undefined;
  }

  if (tsType.elements) {
    if (tsType.name === 'union') {
      const parts = tsType.elements.map((el) => serializeTsType(el) ?? 'unknown');
      return parts.join(' | ');
    }
    if (tsType.name === 'intersection') {
      const parts = tsType.elements.map((el) => serializeTsType(el) ?? 'unknown');
      return parts.join(' & ');
    }
    if (tsType.name === 'Array') {
      // Prefer raw earlier; here build fallback
      const el = tsType.elements[0];
      const inner = serializeTsType(el) ?? 'unknown';
      return `${inner}[]`;
    }
    if (tsType.name === 'tuple') {
      const parts = tsType.elements.map((el) => serializeTsType(el) ?? 'unknown');
      return `[${parts.join(', ')}]`;
    }
  }
  if (tsType.value && tsType.name === 'literal') {
    return tsType.value;
  }
  if (tsType.signature && tsType.name === 'signature') {
    if (tsType.type === 'function') {
      const args = (tsType.signature.arguments ?? []).map((a) => {
        const argType = serializeTsType(a.type) ?? 'any';
        return `${a.name}: ${argType}`;
      });
      const ret = serializeTsType(tsType.signature.return) ?? 'void';
      return `(${args.join(', ')}) => ${ret}`;
    }
    if (tsType.type === 'object') {
      const props = (tsType.signature.properties ?? []).map((p) => {
        const req: boolean = Boolean(p.value?.required);
        const propType = serializeTsType(p.value) ?? 'any';
        return `${p.key}${req ? '' : '?'}: ${propType}`;
      });
      return `{ ${props.join('; ')} }`;
    }
    return 'unknown';
  }
  // Default case (Generic like Item<TMeta>)
  if (tsType.elements) {
    const inner = tsType.elements.map((el) => serializeTsType(el) ?? 'unknown');

    if (inner.length > 0) {
      return `${tsType.name}<${inner.join(', ')}>`;
    }
  }

  return tsType.name;
}

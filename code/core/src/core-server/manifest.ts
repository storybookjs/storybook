import { groupBy } from 'storybook/internal/common';

import type { ComponentManifest, ComponentsManifest } from '../types';

// AI generated manifests/components.html page
// Only HTML/CSS no JS
export function renderManifestComponentsPage(manifest: ComponentsManifest) {
  const entries = Object.entries(manifest?.components ?? {}).sort((a, b) =>
    (a[1].name || a[0]).localeCompare(b[1].name || b[0])
  );

  const analyses = entries.map(([, c]) => analyzeComponent(c));
  const totals = {
    components: entries.length,
    componentsWithPropTypeError: analyses.filter((a) => a.hasPropTypeError).length,
    warnings: analyses.filter((a) => a.hasWarns).length,
    stories: analyses.reduce((sum, a) => sum + a.totalStories, 0),
    storyErrors: analyses.reduce((sum, a) => sum + a.storyErrors, 0),
  };

  // Top filters (clickable), no <b> tags; 1px active ring lives in CSS via :target
  const allPill = `<a class="filter-pill all" data-k="all" href="#filter-all">All</a>`;
  const compErrorsPill =
    totals.componentsWithPropTypeError > 0
      ? `<a class="filter-pill err" data-k="errors" href="#filter-errors">${totals.componentsWithPropTypeError}/${totals.components} prop type ${plural(totals.componentsWithPropTypeError, 'error')}</a>`
      : `<span class="filter-pill ok" aria-disabled="true">${totals.components} components ok</span>`;
  const compWarningsPill =
    totals.warnings > 0
      ? `<a class="filter-pill warn" data-k="warnings" href="#filter-warnings">${totals.warnings}/${totals.components} ${plural(totals.warnings, 'warning')}</a>`
      : '';
  const storiesPill =
    totals.storyErrors > 0
      ? `<a class="filter-pill err" data-k="story-errors" href="#filter-story-errors">${totals.storyErrors}/${totals.stories} story errors</a>`
      : `<span class="filter-pill ok" aria-disabled="true">${totals.stories} ${plural(totals.stories, 'story', 'stories')} ok</span>`;

  const grid = entries.map(([key, c], idx) => renderComponentCard(key, c, `${idx}`)).join('');

  const errorGroups = Object.entries(
    groupBy(
      entries.map(([, it]) => it).filter((it) => it.error),
      (manifest) => manifest.error?.name ?? 'Error'
    )
  );

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
          --warn: #b08900;
          --err: #c62828;
          --ok-bg: #0c1a13;
          --warn-bg: #1a1608;
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

      .filter-pill.warn {
          color: #ffd666;
          border-color: color-mix(in srgb, var(--warn) 55%, var(--border));
          background: var(--warn-bg);
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
      #filter-warnings:target ~ header .filter-pill[data-k='warnings'],
      #filter-story-errors:target ~ header .filter-pill[data-k='story-errors'] {
          box-shadow: 0 0 0 var(--active-ring) currentColor;
          border-color: currentColor;
      }

      /* Hidden targets for filtering */
      #filter-all,
      #filter-errors,
      #filter-warnings,
      #filter-story-errors {
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

      .badge.warn {
          color: #ffd666;
          border-color: color-mix(in srgb, var(--warn) 55%, var(--border));
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
      .tg-warn:checked + label.as-toggle,
      .tg-stories:checked + label.as-toggle,
      .tg-props:checked + label.as-toggle {
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

      .tg-warn:checked ~ .panels .panel-warn {
          display: grid;
          gap: 8px;
      }

      .tg-stories:checked ~ .panels .panel-stories {
          display: grid;
          gap: 8px;
      }

      .tg-props:checked ~ .panels .panel-props {
          display: grid;
      }

      /* Colored notes for prop type error + warnings */
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

      .note.warn {
          border-color: color-mix(in srgb, var(--warn) 55%, var(--border));
          background: var(--warn-bg);
          color: #ffe9a6;
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

      #filter-warnings:target ~ main .card:not(.has-warn) {
          display: none;
      }

      #filter-story-errors:target ~ main .card:not(.has-story-error) {
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

      /* When a toggle is checked, show the corresponding panel */
      .card > .tg-err:checked ~ .panels .panel-err {
          display: grid;
      }

      .card > .tg-warn:checked ~ .panels .panel-warn {
          display: grid;
      }

      .card > .tg-stories:checked ~ .panels .panel-stories {
          display: grid;
      }

      /* Optional: a subtle 1px ring on the active badge, using :has() if available */
      @supports selector(.card:has(.tg-err:checked)) {
          .card:has(.tg-err:checked) label[for$='-err'],
          .card:has(.tg-warn:checked) label[for$='-warn'],
          .card:has(.tg-stories:checked) label[for$='-stories'],
          .card:has(.tg-props:checked) label[for$='-props'] {
              box-shadow: 0 0 0 1px currentColor;
              border-color: currentColor;
          }
      }
  </style>
</head>
<body>
<!-- Hidden targets for the top-level filters -->
<span id="filter-all"></span>
<span id="filter-errors"></span>
<span id="filter-warnings"></span>
<span id="filter-story-errors"></span>
<header>
  <div class="wrap">
    <h1>Components Manifest</h1>
    <div class="summary">${allPill}${compErrorsPill}${compWarningsPill}${storiesPill}</div>
  </div>
</header>
<main>
  <div class="wrap">
    <div class="grid" role="list">
      ${
        grid ||
        `<div class="card"><div class="head"><div class="hint">No components.</div></div></div>`
      }
    </div>
    ${
      errorGroups.length
        ? `<div class="error-groups" role="region" aria-label="Prop type error groups">${errorGroupsHTML}</div>`
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

function analyzeComponent(c: ComponentManifest) {
  const hasPropTypeError = !!c.error;
  const warns: string[] = [];

  if (!c.import?.trim()) {
    warns.push(
      `Specify an @import jsdoc tag on your component or your stories meta such as @import import { ${c.name} } from 'my-design-system';`
    );
  }

  const totalStories = c.stories?.length ?? 0;
  const storyErrors = (c.stories ?? []).filter((e) => !!e?.error).length;
  const storyOk = totalStories - storyErrors;

  const hasAnyError = hasPropTypeError || storyErrors > 0; // for status dot (red if any errors)

  return {
    hasPropTypeError,
    hasAnyError,
    hasWarns: warns.length > 0,
    warns,
    totalStories,
    storyErrors,
    storyOk,
  };
}

function note(title: string, bodyHTML: string, kind: 'warn' | 'err') {
  return `
    <div class="note ${kind}">
      <div class="note-title">${esc(title)}</div>
      <div class="note-body">${bodyHTML}</div>
    </div>`;
}

function renderComponentCard(key: string, c: ComponentManifest, id: string) {
  const a = analyzeComponent(c);
  const statusDot = a.hasAnyError ? 'dot-err' : 'dot-ok';
  const allStories = c.stories ?? [];
  const errorStories = allStories.filter((ex) => !!ex?.error);
  const okStories = allStories.filter((ex) => !ex?.error);

  const slug = `c-${id}-${(c.id || key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

  const componentErrorBadge = a.hasPropTypeError
    ? `<label for="${slug}-err" class="badge err as-toggle">prop type error</label>`
    : '';

  const warningsBadge = a.hasWarns
    ? `<label for="${slug}-warn" class="badge warn as-toggle">${a.warns.length} ${plural(a.warns.length, 'warning')}</label>`
    : '';

  const storiesBadge =
    a.totalStories > 0
      ? `<label for="${slug}-stories" class="badge ${a.storyErrors > 0 ? 'err' : 'ok'} as-toggle">${a.storyErrors > 0 ? `${a.storyErrors}/${a.totalStories} story errors` : `${a.totalStories} ${plural(a.totalStories, 'story', 'stories')}`}</label>`
      : '';

  // When there is no prop type error, try to read prop types from reactDocgen if present
  const hasDocgen = !a.hasPropTypeError && 'reactDocgen' in c && c.reactDocgen;
  const parsedDocgen = hasDocgen ? parseReactDocgen(c.reactDocgen) : undefined;
  const propEntries = parsedDocgen ? Object.entries(parsedDocgen.props ?? {}) : [];
  const propTypesBadge =
    !a.hasPropTypeError && propEntries.length > 0
      ? `<label for="${slug}-props" class="badge ok as-toggle">${propEntries.length} ${plural(propEntries.length, 'prop type')}</label>`
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
            const doc = description ? `/** ${description} */\n` : '';
            return `${doc}${propName}${optional}: ${t}${def}`;
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
  ${a.hasWarns ? 'has-warn' : 'no-warn'} 
  ${a.storyErrors ? 'has-story-error' : 'no-story-error'}"
  role="listitem"
  aria-label="${esc(c.name || key)}">
  <div class="head">
    <div class="title">
      <h2><span class="status-dot ${statusDot}"></span> ${esc(c.name || key)}</h2>
      <div class="badges">
        ${primaryBadge}
        ${warningsBadge}
        ${storiesBadge}
      </div>
    </div>
    <div class="meta" title="${esc(c.path)}">${esc(c.id)} · ${esc(c.path)}</div>
    ${c.summary ? `<div>${esc(c.summary)}</div>` : ''}
    ${c.description ? `<div class="hint">${esc(c.description)}</div>` : ''}
    ${tags ? `<div class="kv">${tags}</div>` : ''}
  </div>

  <!-- ⬇️ Hidden toggles must be siblings BEFORE .panels -->
  ${a.hasPropTypeError ? `<input id="${slug}-err" class="tg tg-err" type="checkbox" hidden />` : ''}
  ${a.hasWarns ? `<input id="${slug}-warn" class="tg tg-warn" type="checkbox" hidden />` : ''}
  ${a.totalStories > 0 ? `<input id="${slug}-stories" class="tg tg-stories" type="checkbox" hidden />` : ''}
  ${!a.hasPropTypeError && propEntries.length > 0 ? `<input id="${slug}-props" class="tg tg-props" type="checkbox" hidden />` : ''}

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
        <div class="panel panel-warn">
          ${a.warns.map((w) => note('Warning', esc(w), 'warn')).join('')}
        </div>`
        : ''
    }
    ${
      !a.hasPropTypeError && propEntries.length > 0
        ? `
        <div class="panel panel-props">
          <div class="note ok">
            <div class="row">
              <span class="ex-name">Prop types</span>
              <span class="badge ok">${propEntries.length} ${plural(propEntries.length, 'prop type')}</span>
            </div>
            <pre><code>${esc(propsCode)}</code></pre>
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
              ${ex?.snippet ? `<pre><code>${esc(ex.snippet)}</code></pre>` : ''}
              ${ex?.error?.message ? `<pre><code>${esc(ex.error.message)}</code></pre>` : ''}
            </div>`
            )
            .join('')}
          ${okStories
            .map(
              (ex, k) => `
            <div class="note ok">
              <div class="row">
                <span class="ex-name">${esc(ex.name)}</span>
                <span class="badge ok">story ok</span>
              </div>
              ${ex?.snippet ? `<pre><code>${esc(ex.snippet)}</code></pre>` : ''}
            </div>`
            )
            .join('')}
        </div>`
        : ''
    }
  </div>
</article>`;
}

export type ParsedDocgen = {
  props: Record<
    string,
    {
      description?: string;
      type?: string;
      defaultValue?: string;
      required?: boolean;
    }
  >;
};

export const parseReactDocgen = (reactDocgen: any): ParsedDocgen => {
  const props: Record<string, any> = (reactDocgen as any)?.props ?? {};
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
function serializeTsType(tsType: any): string | undefined {
  if (!tsType) {
    return undefined;
  }
  // Prefer raw if provided
  // Prefer raw if provided
  if ('raw' in tsType && typeof tsType.raw === 'string' && tsType.raw.trim().length > 0) {
    return tsType.raw;
  }

  if (!tsType.name) {
    return undefined;
  }

  if ('elements' in tsType) {
    if (tsType.name === 'union') {
      const parts = (tsType.elements ?? []).map((el: any) => serializeTsType(el) ?? 'unknown');
      return parts.join(' | ');
    }
    if (tsType.name === 'intersection') {
      const parts = (tsType.elements ?? []).map((el: any) => serializeTsType(el) ?? 'unknown');
      return parts.join(' & ');
    }
    if (tsType.name === 'Array') {
      // Prefer raw earlier; here build fallback
      const el = (tsType.elements ?? [])[0];
      const inner = serializeTsType(el) ?? 'unknown';
      return `${inner}[]`;
    }
    if (tsType.name === 'tuple') {
      const parts = (tsType.elements ?? []).map((el: any) => serializeTsType(el) ?? 'unknown');
      return `[${parts.join(', ')}]`;
    }
  }
  if ('value' in tsType && tsType.name === 'literal') {
    return tsType.value;
  }
  if ('signature' in tsType && tsType.name === 'signature') {
    if (tsType.type === 'function') {
      const args = (tsType.signature?.arguments ?? []).map((a: any) => {
        const argType = serializeTsType(a.type) ?? 'any';
        return `${a.name}: ${argType}`;
      });
      const ret = serializeTsType(tsType.signature?.return) ?? 'void';
      return `(${args.join(', ')}) => ${ret}`;
    }
    if (tsType.type === 'object') {
      const props = (tsType.signature?.properties ?? []).map((p: any) => {
        const req: boolean = Boolean(p.value?.required);
        const propType = serializeTsType(p.value) ?? 'any';
        return `${p.key}${req ? '' : '?'}: ${propType}`;
      });
      return `{ ${props.join('; ')} }`;
    }
    return 'unknown';
  }
  // Default case (Generic like Item<TMeta>)
  if ('elements' in tsType) {
    const inner = (tsType.elements ?? []).map((el: any) => serializeTsType(el) ?? 'unknown');

    if (inner.length > 0) {
      return `${tsType.name}<${inner.join(', ')}>`;
    }
  }

  return tsType.name;
}

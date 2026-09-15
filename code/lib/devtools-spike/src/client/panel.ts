/**
 * Floating panel skeleton — a shadow-DOM island with zero framework
 * dependencies. Stage 0 ships the inspect card only; the Generate button,
 * flagged list, and embed iframe arrive with stage 1.
 */

import type { InspectCardData, InspectorPanel } from './inspector.ts';

/** The panel's host element id — the inspector skips hover events inside it. */
export const ISLAND_ID = 'sb-devtools-spike-island';

function regimeLabel(source: InspectCardData['source']): string | null {
  if (!source || source === 'resolving') {
    return null;
  }
  return source.regime === 'debugSource' ? 'react _debugSource' : 'component stack';
}

function renderSourceRow(card: InspectCardData): string {
  if (card.source === 'resolving') {
    return '<div class="row source">resolving source…</div>';
  }
  if (card.source === null) {
    return '<div class="row source unknown">source unknown</div>';
  }
  const regime = regimeLabel(card.source);
  return `<div class="row source">${escapeHtml(card.source.file)}:${card.source.line}:${card.source.column} <span class="regime">${regime}</span></div>`;
}

/** All dynamic text goes through escapeHtml — card content is app data. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountPanel(): InspectorPanel {
  const host = document.createElement('div');
  host.id = ISLAND_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
      .panel { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #eef2f6;
               background: #1a1f27; border: 1px solid #2f3a47; border-radius: 8px;
               box-shadow: 0 6px 24px rgba(0,0,0,0.35); min-width: 260px; max-width: 340px; }
      .header { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                border-bottom: 1px solid #2f3a47; }
      .title { font-weight: 600; letter-spacing: 0.02em; }
      .hint { color: #8fa1b3; font-size: 10px; }
      button { font: inherit; background: #ff4785; color: #fff; border: 0; border-radius: 5px;
               padding: 2px 10px; cursor: pointer; }
      button.off { background: #2f3a47; }
      .card { padding: 8px 10px; }
      .name { font-weight: 700; color: #ff8ab5; }
      .tag { color: #8fa1b3; }
      .row { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row.props { color: #cfe0ee; }
      .row.source { color: #9fe8c5; margin-top: 4px; }
      .row.source.unknown { color: #e8c69f; }
      .regime { color: #8fa1b3; font-size: 10px; border: 1px solid #2f3a47; border-radius: 4px;
                padding: 0 4px; }
      .empty { padding: 8px 10px; color: #8fa1b3; }
    </style>
    <div class="panel">
      <div class="header">
        <span class="title">sb-devtools</span>
        <button class="off" type="button">Inspect</button>
        <span class="hint">⌥⇧D / Esc</span>
      </div>
      <div class="body"><div class="empty">Arm inspect, then hover a component.</div></div>
    </div>
  `;
  document.body.append(host);

  const button = shadow.querySelector('button');
  const body = shadow.querySelector('.body');
  let toggleHandler: () => void = () => {};

  button?.addEventListener('click', () => toggleHandler());

  return {
    onToggle(handler: () => void): void {
      toggleHandler = handler;
    },
    setArmed(armed: boolean): void {
      if (!button) {
        return;
      }
      button.classList.toggle('off', !armed);
      button.textContent = armed ? 'Armed' : 'Inspect';
    },
    setCard(data: InspectCardData | null): void {
      if (!body) {
        return;
      }
      if (!data) {
        body.innerHTML = '<div class="empty">Arm inspect, then hover a component.</div>';
        return;
      }
      const propRows = data.props
        .map(
          (prop) =>
            `<div class="row props">${escapeHtml(prop.name)}: ${escapeHtml(prop.preview)}</div>`
        )
        .join('');
      body.innerHTML = `
        <div class="card">
          <div class="row"><span class="name">${escapeHtml(data.componentName)}</span> <span class="tag">&lt;${escapeHtml(data.hostTag)}&gt;</span></div>
          ${propRows}
          ${renderSourceRow(data)}
        </div>
      `;
    },
  };
}

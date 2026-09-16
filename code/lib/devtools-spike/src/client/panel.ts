/**
 * Floating panel — a shadow-DOM island with zero framework dependencies.
 * Renders the inspect card, the Generate action, and every capture state:
 * generating, success (flagged list + embed iframe), Storybook-unreachable
 * banner, and write-failure error with the attempted file path.
 */

import type { FlaggedProp } from '../types.ts';

import type { CaptureUiState, EmbedTarget, InspectCardData, InspectorPanel } from './inspector.ts';

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

function renderCard(data: InspectCardData, generating: boolean): string {
  const propRows = data.props
    .map(
      (prop) => `<div class="row props">${escapeHtml(prop.name)}: ${escapeHtml(prop.preview)}</div>`
    )
    .join('');
  return `
    <div class="card">
      <div class="row"><span class="name">${escapeHtml(data.componentName)}</span> <span class="tag">&lt;${escapeHtml(data.hostTag)}&gt;</span></div>
      ${propRows}
      ${renderSourceRow(data)}
      <button class="generate" type="button" ${generating ? 'disabled' : ''}>${
        generating ? 'Generating…' : 'Generate story'
      }</button>
      ${generating ? '<div class="status">writing story file…</div>' : ''}
    </div>
  `;
}

function renderFlagged(flagged: FlaggedProp[]): string {
  if (flagged.length === 0) {
    return '<div class="flagged-empty">no flagged props</div>';
  }
  return flagged
    .map(
      (prop) => `
      <div class="flagged">
        <div class="row"><span class="name">${escapeHtml(prop.name)}</span> <span class="tag">${escapeHtml(prop.reason)}</span></div>
        <div class="guidance">${escapeHtml(prop.guidance)}</div>
      </div>`
    )
    .join('');
}

function renderEmbed(embed: EmbedTarget): string {
  if (embed.kind === 'unreachable') {
    return `<div class="banner">Storybook dev server unreachable — start it with:<br><code>${escapeHtml(
      embed.command
    )}</code></div>`;
  }
  return `<iframe class="embed" src="${escapeHtml(embed.url)}" title="Generated story preview"></iframe>`;
}

function renderBody(state: CaptureUiState, card: InspectCardData | null): string {
  switch (state.status) {
    case 'idle':
      return '<div class="empty">Arm inspect, then hover a component.</div>';
    case 'error':
      return `<div class="error">${escapeHtml(state.message)}</div>${
        state.filePath ? `<div class="path">${escapeHtml(state.filePath)}</div>` : ''
      }`;
    case 'success':
      return `
        <div class="ok">✓ ${escapeHtml(state.storyName)} written</div>
        <div class="path">${escapeHtml(state.filePath)}</div>
        ${renderFlagged(state.flagged)}
        ${renderEmbed(state.embed)}
      `;
    case 'generating':
      // The last card stays visible with its button disabled — the user still
      // sees what is being generated.
      return card ? renderCard(card, true) : '<div class="status">writing story file…</div>';
    default:
      return '<div class="empty">Arm inspect, then hover a component.</div>';
  }
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
               box-shadow: 0 6px 24px rgba(0,0,0,0.35); min-width: 260px; max-width: 360px; }
      .header { display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                border-bottom: 1px solid #2f3a47; }
      .title { font-weight: 600; letter-spacing: 0.02em; }
      .hint { color: #8fa1b3; font-size: 10px; }
      button { font: inherit; background: #ff4785; color: #fff; border: 0; border-radius: 5px;
               padding: 2px 10px; cursor: pointer; }
      button.off { background: #2f3a47; }
      button.generate { display: block; width: 100%; margin-top: 8px; padding: 5px 10px; }
      button.generate:disabled { background: #6b4356; cursor: wait; }
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
      .status { color: #8fa1b3; padding: 4px 0 2px; }
      .ok { color: #7ddb91; padding: 8px 10px 0; font-weight: 700; }
      .path { color: #9fe8c5; padding: 2px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .flagged { padding: 6px 10px; border-top: 1px solid #2f3a47; }
      .flagged .guidance { color: #c9b3e0; padding: 2px 0 0; }
      .flagged-empty { padding: 6px 10px; color: #8fa1b3; border-top: 1px solid #2f3a47; }
      .error { color: #ff9d9d; padding: 8px 10px 0; }
      .error + .path { color: #e8c69f; }
      .banner { margin: 8px 10px 10px; padding: 6px 8px; border: 1px solid #e8c69f;
                border-radius: 6px; color: #e8c69f; background: rgba(232,198,159,0.08); }
      .banner code { display: block; margin-top: 4px; font-size: 10px; color: #cfe0ee;
                     word-break: break-all; white-space: normal; }
      iframe.embed { display: block; width: 320px; height: 240px; margin: 6px 10px 10px;
                     border: 1px solid #2f3a47; border-radius: 6px; background: #fff; }
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

  const toggleButton = shadow.querySelector<HTMLElement>('.header button');
  const body = shadow.querySelector('.body');
  let toggleHandler: () => void = () => {};
  let generateHandler: () => void = () => {};
  // Remembered so the generating state can re-render the card with a disabled
  // Generate button instead of erasing it.
  let lastCard: InspectCardData | null = null;

  toggleButton?.addEventListener('click', () => toggleHandler());
  // Event delegation: the Generate button is re-rendered with each state.
  body?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains('generate') && !target.hasAttribute('disabled')) {
      generateHandler();
    }
  });

  return {
    onToggle(handler: () => void): void {
      toggleHandler = handler;
    },
    onGenerate(handler: () => void): void {
      generateHandler = handler;
    },
    setArmed(armed: boolean): void {
      if (!toggleButton) {
        return;
      }
      toggleButton.classList.toggle('off', !armed);
      toggleButton.textContent = armed ? 'Armed' : 'Inspect';
    },
    setCard(data: InspectCardData | null): void {
      lastCard = data;
      if (!body) {
        return;
      }
      body.innerHTML = data
        ? renderCard(data, false)
        : '<div class="empty">Arm inspect, then hover a component.</div>';
    },
    setCaptureState(state: CaptureUiState): void {
      if (!body) {
        return;
      }
      body.innerHTML = renderBody(state, lastCard);
    },
  };
}

/**
 * Client entry — loaded by the devtools-spike Vite plugin in serve mode only
 * (virtual:sb-devtools-client). Wires the panel island to the inspector and
 * the capture → generate → embed flow: POST the payload, wait for the
 * embed-host Storybook to index the written story (HMR), then navigate the
 * panel's iframe to the story embed.
 */

import { CaptureResponseError, captureComponent } from './capture.ts';
import {
  DEFAULT_EMBED_STORYBOOK_URL,
  STORYBOOK_START_COMMAND,
  embedUrl,
  probeStorybook,
  waitForStoryIndexed,
} from './embed-url.ts';
import { createInspector } from './inspector.ts';
import { mountPanel } from './panel.ts';

const panel = mountPanel();
const inspector = createInspector(panel);

panel.onGenerate(() => {
  void generate();
});

/** The embed host base URL; localStorage overrides for ad-hoc ports. */
function storybookBaseUrl(): string {
  try {
    return localStorage.getItem('sb-devtools-storybook-url') || DEFAULT_EMBED_STORYBOOK_URL;
  } catch {
    // Storage can be blocked (private mode) — the default stands.
    return DEFAULT_EMBED_STORYBOOK_URL;
  }
}

async function generate(): Promise<void> {
  panel.setCaptureState({ status: 'generating' });

  const payload = await inspector.capture();
  if (!payload) {
    panel.setCaptureState({
      status: 'error',
      message: 'Nothing to generate — hover a component first.',
    });
    return;
  }

  try {
    const result = await captureComponent(payload);
    const outcome = await waitForStoryIndexed(() => probeStorybook(result.storyId));
    panel.setCaptureState({
      status: 'success',
      storyName: result.storyName,
      filePath: result.filePath,
      flagged: result.flagged,
      embed:
        outcome === 'unreachable'
          ? { kind: 'unreachable', command: STORYBOOK_START_COMMAND }
          : // 'indexed' navigates straight away; 'timeout' navigates anyway —
            // the iframe shows the real state (server may still be indexing).
            { kind: 'iframe', url: embedUrl(storybookBaseUrl(), result.storyId) },
    });
  } catch (error) {
    panel.setCaptureState({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      filePath: error instanceof CaptureResponseError ? error.filePath : undefined,
    });
  }
}

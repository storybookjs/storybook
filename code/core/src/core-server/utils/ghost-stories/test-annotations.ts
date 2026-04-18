import type { AfterEach } from 'storybook/internal/csf';
import { definePreviewAddon } from 'storybook/internal/csf';

const isEmptyRender = (element: Element) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const rendersContent =
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    Number(style.opacity) > 0 &&
    style.display !== 'none';

  return !rendersContent;
};

/**
 * Properties we sample to decide whether any user CSS reached the canvas.
 *
 * If at least one of them differs from the user-agent default, we conclude that some
 * stylesheet (global, scoped, or inline) is applied. False negatives are still possible
 * when the only applied styles happen to match the UA default exactly — that's the
 * inherent limit of a property-comparison approach.
 */
const PROBED_PROPERTIES = ['font-family', 'color', 'background-color'] as const;

/**
 * Capture the user-agent baseline for a probe `<div>` by inspecting a probe rendered
 * inside a fresh, scriptless `<iframe srcdoc="">`. The iframe loads no user CSS, so its
 * computed styles are the UA baseline for the current browser. Returns null if the
 * isolated iframe cannot be constructed (e.g. cross-origin restrictions, jsdom).
 */
const getUserAgentBaseline = (doc: Document): Record<string, string> | null => {
  let iframe: HTMLIFrameElement | null = null;
  try {
    iframe = doc.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('srcdoc', '<!doctype html><html><body></body></html>');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
    doc.body.appendChild(iframe);

    const innerDoc = iframe.contentDocument;
    const innerWindow = iframe.contentWindow;
    if (!innerDoc || !innerWindow || !innerDoc.body) {
      return null;
    }

    const probe = innerDoc.createElement('div');
    innerDoc.body.appendChild(probe);
    const style = innerWindow.getComputedStyle(probe);
    const baseline: Record<string, string> = {};
    for (const prop of PROBED_PROPERTIES) {
      baseline[prop] = style.getPropertyValue(prop);
    }
    return baseline;
  } catch {
    return null;
  } finally {
    if (iframe?.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
};

/**
 * Detect whether any user CSS is applied at the canvas root.
 *
 * Renders a transient probe `<div>` inside the canvas, reads its computed styles for a
 * small set of properties, and compares against a UA baseline captured from an isolated
 * `<iframe srcdoc="">`. If at least one property differs from the baseline, user CSS is
 * considered applied.
 *
 * Returns `null` when detection is inconclusive (no document, baseline unavailable),
 * so callers can distinguish "no CSS" from "couldn't tell".
 */
const isCssApplied = (canvasElement: HTMLElement): boolean | null => {
  const doc = canvasElement.ownerDocument;
  const win = doc?.defaultView;
  if (!doc || !win) {
    return null;
  }

  const baseline = getUserAgentBaseline(doc);
  if (!baseline) {
    return null;
  }

  const probe = doc.createElement('div');
  try {
    canvasElement.appendChild(probe);
    const style = win.getComputedStyle(probe);
    for (const prop of PROBED_PROPERTIES) {
      if (style.getPropertyValue(prop) !== baseline[prop]) {
        return true;
      }
    }
    return false;
  } catch {
    return null;
  } finally {
    if (probe.parentNode) {
      probe.parentNode.removeChild(probe);
    }
  }
};

const afterEach: AfterEach = async ({ reporting, canvasElement, globals }) => {
  try {
    // Render analysis runs during ghost stories and agent-mode vitest runs
    if (!globals.renderAnalysis?.enabled) {
      return;
    }

    const emptyRender = isEmptyRender(canvasElement.firstElementChild ?? canvasElement);
    const cssApplied = isCssApplied(canvasElement);

    if (emptyRender || cssApplied === false) {
      reporting.addReport({
        type: 'render-analysis',
        version: 1,
        result: {
          emptyRender,
          cssApplied,
        },
        status: 'warning',
      });
    }
  } catch {}
};

export default () => definePreviewAddon({ afterEach });

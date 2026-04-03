import type { AfterEach } from 'storybook/internal/csf';
import { definePreviewAddon } from 'storybook/internal/csf';

export const EMPTY_RENDER_ERROR_MESSAGE =
  'Empty render: this story rendered no visible content in the canvas. Common causes: missing required props, missing provider or global preview setup, missing fetch/browser-state mocks, or CSS hiding the root element. Fix the shared preview environment or the story JSX so the canvas shows visible content.';

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

const afterEach: AfterEach = async ({ reporting, canvasElement, globals }) => {
  const shouldAnalyze = Boolean(globals.ghostStories || globals.emptyRenderFailure);

  if (!shouldAnalyze) {
    return;
  }

  let emptyRender = false;
  try {
    emptyRender = isEmptyRender(canvasElement.firstElementChild ?? canvasElement);
  } catch {
    return;
  }

  if (emptyRender) {
    try {
      reporting.addReport({
        type: 'render-analysis',
        version: 1,
        result: {
          emptyRender,
        },
        status: 'warning',
      });
    } catch {
      /* ignore reporting failures */
    }

    if (globals.emptyRenderFailure) {
      throw new Error(EMPTY_RENDER_ERROR_MESSAGE);
    }
  }
};

export default () => definePreviewAddon({ afterEach });

import type { AfterEach } from 'storybook/internal/csf';
import { definePreviewAddon } from 'storybook/internal/csf';

const isEmptyRender = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const rendersContent =
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    style.display !== 'none';

  return !rendersContent;
};

const afterEach: AfterEach = async ({ reporting, canvasElement, globals }) => {
  try {
    // We only run this through ghost stories runs
    if (!globals.ghostStories) {
      return;
    }

    const emptyRender = isEmptyRender(canvasElement.firstElementChild ?? canvasElement);

    if (emptyRender) {
      reporting.addReport({
        type: 'render-analysis',
        version: 1,
        result: {
          emptyRender,
        },
        status: 'warning',
      });
    }
  } catch {}
};

export default () => definePreviewAddon({ afterEach });

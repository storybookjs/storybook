import { expect, waitFor } from 'storybook/test';

type StyleProperty = 'backgroundColor' | 'borderRadius' | 'color' | 'padding' | 'width';

/**
 * Asserts computed styles, waiting for them: in development the StyleX Vite plugin can deliver CSS
 * shortly after a lazily loaded story renders (facebook/stylex#1919), and on a cold start that can
 * take longer than `waitFor`'s default second.
 */
export const expectStyle = (
  element: HTMLElement,
  expected: Partial<Record<StyleProperty, string>>
) =>
  waitFor(
    () => {
      const style = getComputedStyle(element);
      for (const [property, value] of Object.entries(expected)) {
        expect(style[property as StyleProperty]).toBe(value);
      }
    },
    { timeout: 5000 }
  );

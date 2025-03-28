import componentTestingAnnotations from 'storybook/internal/component-testing/preview';

import actionAnnotations from 'storybook/actions/preview';
import backgroundsAnnotations from 'storybook/backgrounds/preview';
import measureAnnotations from 'storybook/measure/preview';
import outlineAnnotations from 'storybook/outline/preview';
import testAnnotations from 'storybook/test/preview';
import viewportAnnotations from 'storybook/viewport/preview';

export function getCoreAnnotations() {
  return [
    // @ts-expect-error CJS fallback
    (measureAnnotations.default ?? measureAnnotations)(),
    // @ts-expect-error CJS fallback
    (backgroundsAnnotations.default ?? backgroundsAnnotations)(),
    // @ts-expect-error CJS fallback
    (outlineAnnotations.default ?? outlineAnnotations)(),
    // @ts-expect-error CJS fallback
    (viewportAnnotations.default ?? viewportAnnotations)(),
    // @ts-expect-error CJS fallback
    (actionAnnotations.default ?? actionAnnotations)(),
    // @ts-expect-error CJS fallback
    (componentTestingAnnotations.default ?? componentTestingAnnotations)(),
    // @ts-expect-error CJS fallback
    (testAnnotations.default ?? testAnnotations)(),
  ];
}

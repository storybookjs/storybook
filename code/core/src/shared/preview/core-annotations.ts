import actionAnnotations from '../../actions/preview';
import backgroundsAnnotations from '../../backgrounds/preview';
import componentTestingAnnotations from '../../component-testing/preview';
import highlightAnnotations from '../../highlight/preview';
import measureAnnotations from '../../measure/preview';
import outlineAnnotations from '../../outline/preview';
import testAnnotations from '../../test/preview';
import viewportAnnotations from '../../viewport/preview';

export function getCoreAnnotations() {
  return [
    // @ts-expect-error CJS fallback
    (measureAnnotations.default ?? measureAnnotations)(),
    // @ts-expect-error CJS fallback
    (backgroundsAnnotations.default ?? backgroundsAnnotations)(),
    // @ts-expect-error CJS fallback
    (highlightAnnotations.default ?? highlightAnnotations)(),
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

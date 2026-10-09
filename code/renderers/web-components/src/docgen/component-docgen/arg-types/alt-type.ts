// This reader is outside the Custom Elements Manifest spec: analyzer plugins such as
// `@wc-toolkit/type-parser` write resolved alias text under a sibling key, defaulting to
// `parsedType`, and the analyzer also writes non-spec `type` on CSS custom properties.
import type { ManifestCssCustomProperty } from '../manifest/types.ts';
import { isRecord } from '../utils.ts';

type CssCustomPropertyWithType = ManifestCssCustomProperty & { type?: { text?: unknown } };

export const DEFAULT_TYPE_PROPERTY = 'parsedType';

export function readTypeText(
  item: { type?: { text?: unknown } },
  typeProperty: string
): string | undefined {
  const alternate = Reflect.get(item, typeProperty);
  if (isRecord(alternate) && typeof alternate.text === 'string' && alternate.text.trim()) {
    return alternate.text;
  }
  return typeof item.type?.text === 'string' ? item.type.text : undefined;
}

export function readCssPropertySyntax(
  property: CssCustomPropertyWithType,
  typeProperty: string
): string | undefined {
  return property.syntax ?? readTypeText(property, typeProperty);
}

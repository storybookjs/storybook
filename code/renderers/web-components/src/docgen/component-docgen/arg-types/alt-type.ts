// This reader is outside the Custom Elements Manifest spec: analyzer plugins such as
// `@wc-toolkit/type-parser` write resolved alias text under a sibling key, defaulting to
// `parsedType`, which Storybook reads before spec `type.text`; everything else is spec-only.
import { isRecord } from '../utils.ts';

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

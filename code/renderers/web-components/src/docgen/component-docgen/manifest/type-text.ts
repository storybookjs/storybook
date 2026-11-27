// This reader is outside the Custom Elements Manifest spec: `@wc-toolkit/type-parser` writes
// resolved alias text under its default `parsedType` key (a custom output name is not read),
// and the analyzer also writes non-spec `type` on CSS custom properties.
import type { ManifestCssCustomProperty } from './types.ts';
import { isRecord } from '../utils.ts';

type TypedManifestItem = { type?: { text?: unknown }; parsedType?: unknown };
type CssCustomPropertyWithType = ManifestCssCustomProperty & TypedManifestItem;

export function readTypeText({ type, parsedType }: TypedManifestItem): string | undefined {
  if (isRecord(parsedType) && typeof parsedType.text === 'string' && parsedType.text.trim()) {
    return parsedType.text;
  }
  return typeof type?.text === 'string' ? type.text : undefined;
}

export function readCssPropertySyntax(property: CssCustomPropertyWithType): string | undefined {
  return property.syntax ?? readTypeText(property);
}

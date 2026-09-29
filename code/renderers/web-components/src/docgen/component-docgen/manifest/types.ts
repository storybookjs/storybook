export type {
  Attribute as ManifestAttribute,
  ClassMethod as ManifestClassMethod,
  ClassMember as ManifestClassMember,
  CssCustomProperty as ManifestCssCustomProperty,
  CssCustomState as ManifestCssCustomState,
  CssPart as ManifestCssPart,
  CustomElementField as ManifestClassField,
  Declaration as ManifestAnyDeclaration,
  Event as ManifestEvent,
  Package as ManifestPackage,
  Parameter as ManifestParameter,
  Reference as ManifestReference,
  Slot as ManifestSlot,
} from 'custom-elements-manifest';
import type { CustomElementDeclaration, Declaration } from 'custom-elements-manifest';

export type ManifestDeclaration = CustomElementDeclaration;
export type ManifestClassLikeDeclaration = Extract<Declaration, { kind: 'class' | 'mixin' }>;

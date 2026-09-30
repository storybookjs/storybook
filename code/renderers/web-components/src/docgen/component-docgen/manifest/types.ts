export type {
  Attribute as ManifestAttribute,
  ClassMember as ManifestClassMember,
  CustomElementField as ManifestClassField,
  Declaration as ManifestAnyDeclaration,
  Package as ManifestPackage,
} from 'custom-elements-manifest';
import type {
  CustomElementDeclaration,
  CustomElementMixinDeclaration,
} from 'custom-elements-manifest';

export type ManifestDeclaration = CustomElementDeclaration | CustomElementMixinDeclaration;

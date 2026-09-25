import { HandledError } from 'storybook/internal/common';
import type { AnnotationFileKind, CsfObject } from 'storybook/internal/csf-tools';
import { loadAnnotationFile } from 'storybook/internal/csf-tools';

const legacyPath = ['parameters', 'componentSubtitle'];
const subtitlePath = ['parameters', 'docs', 'subtitle'];

export const LEGACY_SUBTITLE = 'componentSubtitle';

export class ComponentSubtitleMigrationError extends HandledError {}

export type Inheritance = { subtitleCanWin: boolean; legacyCanBeInherited?: boolean };
export const noInheritance: Inheritance = { subtitleCanWin: false };

const migrate = (object: CsfObject, inherited: Inheritance) => {
  const legacy = object.get(legacyPath);
  const subtitle = object.get(subtitlePath);
  if (!legacy) {
    if (inherited.legacyCanBeInherited && subtitle && !object.getValue(subtitlePath)) {
      throw new ComponentSubtitleMigrationError(
        'A descendant parameters.docs.subtitle can hide an inherited componentSubtitle fallback'
      );
    }
    return;
  }

  if (subtitle) {
    if (object.getValue(subtitlePath)) {
      // Reading the value reports a diagnostic unless dropping it cannot skip a side effect.
      object.getValue(legacyPath);
    } else {
      object.set(subtitlePath, legacy);
    }
    object.remove(legacyPath);
  } else {
    if (inherited.subtitleCanWin) {
      throw new ComponentSubtitleMigrationError(
        'An inherited parameters.docs.subtitle value can take precedence'
      );
    }
    object.group(['parameters', 'docs'], ['componentSubtitle']);
    object.rename(['parameters', 'docs', 'componentSubtitle'], 'subtitle');
  }
};

/**
 * Migrate every annotation object of a preview or story file, root annotations first. Resolves the
 * new source (or `null` when unchanged) and what the file's root passes down to its descendants.
 */
export const transformAnnotations = (
  source: string,
  kind: AnnotationFileKind,
  inherited: Inheritance
) => {
  const file = loadAnnotationFile(source, kind);
  const isRoot = (object: CsfObject) =>
    object.target.kind === 'meta' || object.target.kind === 'config';
  const root = file.objects.find(isRoot);
  const inheritance: Inheritance = root
    ? {
        subtitleCanWin: Boolean(root.get(subtitlePath)) || inherited.subtitleCanWin,
        legacyCanBeInherited: Boolean(root.get(legacyPath)) || inherited.legacyCanBeInherited,
      }
    : inherited;

  if (root) {
    migrate(root, kind === 'preview' ? noInheritance : inherited);
  }
  for (const object of file.objects.filter((object) => object !== root)) {
    migrate(object, inheritance);
  }

  const [diagnostic] = file.mutationDiagnostics;
  if (diagnostic) {
    throw new ComponentSubtitleMigrationError(diagnostic.message);
  }
  return { code: file.changed ? file.print() : null, inheritance };
};

export const transformPreviewSource = (source: string) =>
  transformAnnotations(source, 'preview', noInheritance).code;

export const transformStorySource = (source: string, inherited: Inheritance = noInheritance) =>
  source.includes(LEGACY_SUBTITLE) || inherited.legacyCanBeInherited
    ? transformAnnotations(source, 'stories', inherited).code
    : null;

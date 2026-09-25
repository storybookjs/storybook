import { formatConfig, loadConfig } from './ConfigFile.ts';
import { loadCsf, printCsf } from './CsfFile.ts';

export type AnnotationFileKind = 'preview' | 'stories';

/** Load preview or story annotations through the same object editor and printer interface. */
export const loadAnnotationFile = (source: string, kind: AnnotationFileKind) => {
  const file =
    kind === 'preview'
      ? loadConfig(source).parse()
      : loadCsf(source, { makeTitle: (title) => title || 'default' }).parse();
  return {
    objects: 'objects' in file ? file.objects() : [file],
    get changed() {
      return file.changed;
    },
    get mutationDiagnostics() {
      return file.mutationDiagnostics;
    },
    print: () => ('objects' in file ? printCsf(file).code : formatConfig(file)),
  };
};

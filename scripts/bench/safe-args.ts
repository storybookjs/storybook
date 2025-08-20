const METAFILES_DIR = 'bench/esbuild-metafiles';

// allows the metafile path to be used in the URL hash
export const safeMetafileArg = (path: string) =>
  path
    .replace(new RegExp(`.*${METAFILES_DIR}/`), '')
    .replaceAll('/', '__')
    .replace(/(\w*).json/, '$1');

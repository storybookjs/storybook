import { basename, join } from 'pathe';

const DIR_METAFILE_BASE = join(import.meta.dirname, '../../../code/bench/esbuild-metafiles');

/** The build writes a package's esbuild metafiles to a folder named after its directory basename. */
export const metafileDirFor = (packageDir: string) => join(DIR_METAFILE_BASE, basename(packageDir));

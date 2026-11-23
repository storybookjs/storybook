import picocolors from 'picocolors';

/** Highlights a file or a package that a dry run names as one a run would change. */
export const highlightChange = (text: string) => picocolors.yellow(text);

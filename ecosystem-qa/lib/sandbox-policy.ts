import type { CatalogEntry, Os } from './schema.ts';

// Without a sandbox the project's code runs on the host, next to the provider key. That is for our
// own repos, and on Windows, where no sandbox exists, for the repos the catalog marks for it.
export const unsandboxedRefusal = (entry: CatalogEntry, os: Os): string | undefined => {
  if (entry.class === 'owned' || (os === 'windows' && entry.windows)) {
    return undefined;
  }
  return os === 'windows'
    ? `${entry.id} is not an owned repo and the catalog does not mark it for Windows, so it cannot run with --sandbox none.`
    : `${entry.id} is not an owned repo, so on ${os} it cannot run with --sandbox none.`;
};

import { getMajor, getMinor, getPatch } from 'verkit';

export function hasMultipleVersions(versions: string[]) {
  return versions.find((v) => {
    const major = getMajor(v);
    // If major version === 0, treat minor or patch as major
    if (major === 0) {
      const minor = getMinor(v);
      if (minor === 0) {
        const patch = getPatch(v);
        return versions.some((v2) => {
          return getPatch(v2) !== patch;
        });
      }

      return versions.some((v2) => {
        return getMinor(v2) !== minor;
      });
    }

    return versions.some((v2) => {
      return getMajor(v2) !== major;
    });
  });
}

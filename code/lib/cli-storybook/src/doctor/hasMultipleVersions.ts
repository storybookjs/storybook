import semver from 'semver';

export function hasMultipleVersions(versions: string[]) {
  return versions.find((v) => {
    const major = semver.major(v);
    // If major version === 0, treat minor or patch as major
    if (major === 0) {
      const minor = semver.minor(v);
      if (minor === 0) {
        const patch = semver.patch(v);
        return versions.some((v2) => {
          return semver.patch(v2) !== patch;
        });
      }

      return versions.some((v2) => {
        return semver.minor(v2) !== minor;
      });
    }

    return versions.some((v2) => {
      return semver.major(v2) !== major;
    });
  });
}

// inspired by https://github.com/npm/validate-npm-package-name/blob/main/lib/index.js
const scopedPackagePattern = new RegExp('^(?:@([^/]+?)[/])?([^/]+?)$');

export function stripSubpath(name: string): string {
  const parts = name.split('/');

  if (name.startsWith('@')) {
    // @scope/pkg/...
    if (parts.length >= 3) {
      return `${parts[0]}/${parts[1]}`;
    }
    return name;
  }

  // react/..., lodash/..., etc
  return parts[0];
}

export function validPackageName(name: string) {
  if (!name.length) {
    return false;
  }

  if (name.startsWith('.')) {
    return false;
  }

  if (name.match(/^_/)) {
    return false;
  }

  if (name.trim() !== name) {
    return false;
  }

  if (name.length > 214) {
    return false;
  }

  // mIxeD CaSe nAMEs
  if (name.toLowerCase() !== name) {
    return false;
  }

  if (/[~'!()*]/.test(name.split('/').slice(-1)[0])) {
    return false;
  }

  if (encodeURIComponent(name) !== name) {
    const nameMatch = name.match(scopedPackagePattern);
    if (nameMatch) {
      const user = nameMatch[1];
      const pkg = nameMatch[2];

      if (pkg.startsWith('.')) {
        return false;
      }

      if (encodeURIComponent(user) === user && encodeURIComponent(pkg) === pkg) {
        return true;
      }
    }
    return false;
  }

  return false;
}

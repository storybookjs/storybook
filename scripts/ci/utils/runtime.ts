let trustedAuthor = false;

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

let lockfileChanged = false;

/** Whether the pull request changes `pnpm-lock.yaml`, which every dependency change does. */
export function setLockfileChanged(changed: boolean): void {
  lockfileChanged = changed;
}

export function isLockfileChanged(): boolean {
  return lockfileChanged;
}

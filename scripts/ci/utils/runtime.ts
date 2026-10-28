let trustedAuthor = false;

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

let nightly = false;

/** Whether this is the scheduled `daily` run on `next`, which reports failures instead of gating a PR. */
export function setNightly(isNightly: boolean): void {
  nightly = isNightly;
}

export function isNightly(): boolean {
  return nightly;
}

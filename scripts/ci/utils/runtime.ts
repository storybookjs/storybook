let trustedAuthor = false;
let nightly = false;

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

/** The scheduled `daily` run on `next`, which reports its failures instead of cancelling on the first one. */
export function setNightly(isNightlyRun: boolean): void {
  nightly = isNightlyRun;
}

export function isNightly(): boolean {
  return nightly;
}

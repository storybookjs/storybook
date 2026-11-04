let trustedAuthor = false;
let prNumber = '';

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

export function setPrNumber(value: string): void {
  prNumber = value;
}

/** The number of the pull request this pipeline runs for, or `''` for branch pipelines. */
export function getPrNumber(): string {
  return prNumber;
}

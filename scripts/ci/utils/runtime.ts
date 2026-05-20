let trustedAuthor = true;

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

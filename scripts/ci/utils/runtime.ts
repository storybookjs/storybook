let trustedAuthor = false;

export function setTrustedAuthor(isTrusted: boolean): void {
  trustedAuthor = isTrusted;
}

export function isTrustedAuthor(): boolean {
  return trustedAuthor;
}

let windowsUnitFull = false;

/** Run every unit test file on Windows, not only those the Linux probe marks as OS-sensitive. */
export function setWindowsUnitFull(full: boolean): void {
  windowsUnitFull = full;
}

export function isWindowsUnitFull(): boolean {
  return windowsUnitFull;
}

let windowsUnitInRun = false;

/** Whether this run includes the Windows unit job, so a Linux failure must not cancel it. */
export function setWindowsUnitInRun(inRun: boolean): void {
  windowsUnitInRun = inRun;
}

export function isWindowsUnitInRun(): boolean {
  return windowsUnitInRun;
}

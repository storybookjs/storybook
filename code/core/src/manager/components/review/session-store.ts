// The single place the review addon touches `sessionStorage`. Centralizing it
// here keeps persistence consistent and guards every access: `sessionStorage`
// can throw (privacy modes, disabled storage, sandboxed iframes), so failures
// degrade gracefully and in-memory state still drives the current session.
export const sessionStore = {
  read(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Storage unavailable — ignore.
    }
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage unavailable — ignore.
    }
  },
};

const FLASH_COOKIE_PREFIX = "__flash";
const flashCookies = new Map<string, string>();

export function flashCookieName(key: string) {
  return `${FLASH_COOKIE_PREFIX}:${key}`;
}

export function isFlashCookieName(name: string) {
  return name.startsWith(`${FLASH_COOKIE_PREFIX}:`);
}

export async function getFlashCookie(key: string) {
  const value = flashCookies.get(key) ?? null;
  flashCookies.delete(key);
  return value;
}

export async function setFlashCookie(key: string, value: string) {
  flashCookies.set(key, value);
}

export function deleteFlashCookies() {
  flashCookies.clear();
}

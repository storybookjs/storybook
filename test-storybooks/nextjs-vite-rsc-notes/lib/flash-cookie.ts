import { cookies } from "next/headers";
import { env } from "#env/server.ts";

const FLASH_COOKIE_PREFIX = "__flash";
const FLASH_COOKIE_MAX_AGE_SECONDS = 60;

export function flashCookieName(key: string) {
  return `${FLASH_COOKIE_PREFIX}:${key}`;
}

export function isFlashCookieName(name: string) {
  return name.startsWith(`${FLASH_COOKIE_PREFIX}:`);
}

export async function getFlashCookie(key: string) {
  return (await cookies()).get(flashCookieName(key))?.value ?? null;
}

export async function setFlashCookie(key: string, value: string) {
  (await cookies()).set(flashCookieName(key), value, {
    httpOnly: true,
    maxAge: FLASH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

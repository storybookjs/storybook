import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "#lib/auth.ts";

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];

export async function getOptionalUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getOptionalUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}

export async function requireRole(role: string) {
  const user = await requireUser();
  if (user.role !== role) forbidden();
  return user;
}

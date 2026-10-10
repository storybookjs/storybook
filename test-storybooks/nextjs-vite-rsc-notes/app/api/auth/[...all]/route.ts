import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "#lib/auth.ts";

export const { GET, POST } = toNextJsHandler(auth);

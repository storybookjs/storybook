import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-core/presets-zod";
import * as z from "zod";

export const scenarios = ["empty", "notes-basic", "notes-many"] as const;
export type Scenario = (typeof scenarios)[number];

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32).default("dev-secret-dev-secret-dev-secret-dev-secret"),
    CI: z.stringbool().default(false),
    DATABASE_PROVIDER: z.enum(["pglite", "neon"]).default("pglite"),
    DATABASE_URL: z.url().optional(),
    DATABASE_URL_UNPOOLED: z.url().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
    SCENARIO: z.enum(scenarios).default("empty"),
  },
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  extends: [vercel()],
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

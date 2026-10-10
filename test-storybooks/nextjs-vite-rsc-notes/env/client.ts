import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: { NODE_ENV: process.env.NODE_ENV },
  emptyStringAsUndefined: true,
});

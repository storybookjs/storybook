import "#env/load-next.ts";
import { passkey } from "@better-auth/passkey";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BaseURLConfig } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import * as schema from "#db/schema.ts";
import { env } from "#env/server.ts";
import { APP_NAME } from "#lib/config.ts";
import { db } from "#lib/db.ts";
import { sendAuthEmail } from "#lib/email.ts";

const authBaseURL: BaseURLConfig = {
  allowedHosts: [
    "localhost:*",
    "127.0.0.1:*",
    "*.vercel.app",
    ...(env.NODE_ENV === "development" ? ["*.trycloudflare.com"] : []),
  ],
  protocol: env.NODE_ENV === "development" ? "http" : "https",
};

function linkEmailHtml({ title, copy, url }: { title: string; copy: string; url: string }) {
  return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
  <h1 style="font-size: 20px;">${title}</h1>
  <p>${copy}</p>
  <p><a href="${url}" style="color: #111827;">${url}</a></p>
  <p style="color: #6b7280; font-size: 14px;">If you did not request this, you can ignore this email.</p>
</div>`;
}

function sendAuthEmailInBackground(options: Parameters<typeof sendAuthEmail>[0]) {
  void sendAuthEmail(options).catch((error: unknown) => {
    console.error("Auth email delivery failed", error);
  });
}

export const auth = betterAuth({
  appName: APP_NAME,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: authBaseURL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    camelCase: true,
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
        input: false,
      },
    } as const,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      sendAuthEmailInBackground({
        to: user.email,
        subject: `Verify your ${APP_NAME} email`,
        html: linkEmailHtml({
          title: `Verify your ${APP_NAME} email`,
          copy: "Use this link to verify your email address.",
          url,
        }),
        text: `Use this link to verify your ${APP_NAME} email address: ${url}`,
        idempotencyKey: `verify-email/${token}`,
      });
    },
  },
  plugins: [
    magicLink({
      storeToken: "hashed",
      sendMagicLink: async ({ email, token, url }) => {
        await sendAuthEmail({
          to: email,
          subject: `Sign in to ${APP_NAME}`,
          html: linkEmailHtml({
            title: `Sign in to ${APP_NAME}`,
            copy: "Use this magic link to sign in or create your account.",
            url,
          }),
          text: `Use this magic link to sign in or create your ${APP_NAME} account: ${url}`,
          idempotencyKey: `magic-link/${token}`,
        });
      },
    }),
    passkey({
      rpName: APP_NAME,
    }),
    nextCookies(),
  ] as const,
});

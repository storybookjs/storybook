import { Resend } from "resend";
import { env } from "#env/server.ts";

type SendAuthEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

let resend: Resend | null = null;

function getResend() {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    if (env.NODE_ENV !== "production") return null;
    throw new Error("Resend is not configured");
  }

  resend ??= new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendAuthEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendAuthEmailOptions) {
  const client = getResend();

  if (!client) {
    console.info(`[auth email] ${subject} for ${to}\n${text}`);
    return { id: `dev-${idempotencyKey}` };
  }

  const { data, error } = await client.emails.send(
    {
      from: env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
      text,
    },
    {
      idempotencyKey,
    },
  );

  if (error) {
    console.error("Resend auth email failed", error);
    throw new Error("Failed to send auth email");
  }

  return data;
}

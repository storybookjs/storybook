import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { zfd } from "zod-form-data";
import { Link } from "#components/link.tsx";
import { MailIcon, NotebookPenIcon } from "#components/icons.tsx";
import { PasskeySignInButton } from "#components/passkey-auth.tsx";
import { SubmitButton } from "#components/submit-button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "#components/ui/card.tsx";
import { Field, FieldError, FieldGroup, FieldLabel } from "#components/ui/field.tsx";
import { Input } from "#components/ui/input.tsx";
import { auth } from "#lib/auth.ts";
import { APP_NAME } from "#lib/config.ts";
import { getForm, setForm } from "#lib/form-flash.ts";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter a valid email address."));

const magicLinkSchema = zfd.formData({
  email: zfd.text(emailSchema),
});

const errorMessages = {
  magic: "We couldn’t send your sign-in link. Please try again.",
} as const;

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const magicLinkForm = await getForm(magicLinkSchema, {
    id: "email-magic-link",
  });
  const sent = searchValue(params.sent);
  const error = searchValue(params.error);
  const errorMessage = error === "magic" ? errorMessages[error] : undefined;

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(70%_60%_at_50%_0%,oklch(0.94_0.1_82/0.6),transparent_70%)] dark:bg-[radial-gradient(70%_60%_at_50%_0%,oklch(0.42_0.1_75/0.35),transparent_70%)]"
      />
      <Card className="relative overflow-hidden border-0 ring-1 ring-foreground/10 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_24px_48px_-24px_oklch(0.32_0.06_70/0.25)] backdrop-blur-sm">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-brand/15 to-transparent dark:from-brand/10"
        />
        <CardHeader className="gap-3 px-6 pt-7 text-center">
          <span className="relative mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-foreground to-foreground/85 text-background shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-4px_oklch(0.32_0.06_70/0.45)] ring-1 ring-foreground/10">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1.5 -z-10 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,oklch(0.85_0.12_75/0.35),transparent_70%)]"
            />
            <NotebookPenIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {`Welcome back to ${APP_NAME}`}
            </h1>
            <CardDescription>
              Don’t have an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-foreground underline underline-offset-4 decoration-brand transition hover:decoration-2"
              >
                Sign up
              </Link>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-6">
          {sent === "magic-link" && (
            <output className="flex items-start gap-2.5 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand-foreground">
              <MailIcon className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>Check your inbox for the sign-in link.</span>
            </output>
          )}
          {errorMessage && (
            <p
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          <form
            noValidate
            action={async (formData) => {
              "use server";

              const result = await setForm(magicLinkSchema, formData, {
                id: "email-magic-link",
              });
              if (!result.success) {
                refresh();
                return;
              }

              let sent = true;
              try {
                await auth.api.signInMagicLink({
                  body: {
                    email: result.data.email,
                    name: result.data.email,
                    callbackURL: "/notes",
                    newUserCallbackURL: "/profile?setup=passkey",
                    errorCallbackURL: "/auth/sign-in?error=magic",
                  },
                  headers: await headers(),
                });
              } catch {
                sent = false;
              }

              if (!sent) redirect("/auth/sign-in?error=magic");
              redirect("/auth/sign-in?sent=magic-link");
            }}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(magicLinkForm.errors.email) || undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  key={magicLinkForm.old.email}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue={magicLinkForm.old.email}
                  aria-invalid={Boolean(magicLinkForm.errors.email)}
                  placeholder="you@example.com"
                  className="h-auto rounded-2xl px-4 py-3"
                />
                <FieldError>{magicLinkForm.errors.email}</FieldError>
              </Field>
              <SubmitButton className="w-full rounded-2xl py-3 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_8px_22px_-10px_oklch(0.32_0.06_70/0.5)]">
                <MailIcon data-icon="inline-start" />
                Continue with email
              </SubmitButton>
            </FieldGroup>
          </form>

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
            <span>Or</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
          </div>

          <PasskeySignInButton />
        </CardContent>
        <CardFooter className="px-6 pb-6 text-center">
          <p className="mx-auto text-xs text-muted-foreground">
            By continuing you agree to our terms. We’ll never email you anything you didn’t ask for.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, KeyRoundIcon, LogOutIcon, Trash2Icon } from "#components/icons.tsx";
import { Link } from "#components/link.tsx";
import { AddPasskeyButton } from "#components/passkey-auth.tsx";
import { SubmitButton } from "#components/submit-button.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "#components/ui/card.tsx";
import { Separator } from "#components/ui/separator.tsx";
import { auth } from "#lib/auth.ts";
import { requireUser } from "#lib/auth-session.ts";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const passkeys = await auth.api.listPasskeys({
    headers: await headers(),
  });
  const isPasskeySetup = searchValue(params.setup) === "passkey" && passkeys.length === 0;
  const initial = (user.email || "?").slice(0, 1).toUpperCase();

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-[320px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.94_0.08_82/0.6),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.4_0.08_75/0.3),transparent_70%)]"
      />
      <Link
        href="/notes"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "h-auto w-fit rounded-full px-3 text-muted-foreground hover:text-foreground",
        })}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to notes
      </Link>

      <Card className="mt-6 overflow-hidden border-0 ring-1 ring-foreground/10 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_24px_48px_-24px_oklch(0.32_0.06_70/0.2)]">
        <CardHeader className="gap-3 px-6 pt-7">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand/30 via-brand/10 to-transparent text-base font-semibold text-brand-foreground ring-1 ring-border/70"
            >
              {initial}
            </span>
            <div className="space-y-0.5">
              <h1
                data-slot="card-title"
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                {isPasskeySetup ? "Add a passkey" : "Profile"}
              </h1>
              <CardDescription>
                {isPasskeySetup
                  ? `Finish setting up passwordless sign-in for ${user.email}.`
                  : `Signed in as ${user.email}.`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="mt-5 overflow-hidden border-0 ring-1 ring-foreground/10 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_24px_48px_-24px_oklch(0.32_0.06_70/0.2)]">
        <CardHeader className="gap-2 px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand/30 via-brand/10 to-transparent text-brand-foreground ring-1 ring-border/70">
              <KeyRoundIcon className="size-[18px]" />
            </span>
            <div className="space-y-0.5">
              <h2 data-slot="card-title" className="text-lg font-semibold tracking-tight">
                Passkeys
              </h2>
              <CardDescription>Sign in without email by registering a device.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-6">
          {isPasskeySetup ? (
            <div className="rounded-2xl border border-brand/30 bg-brand/10 px-5 py-5">
              <p className="font-medium text-brand-foreground">Your account is ready.</p>
              <p className="pt-1 text-sm text-muted-foreground">
                Add a passkey now so next time you can sign in without a magic link.
              </p>
            </div>
          ) : passkeys.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/40 px-5 py-4 backdrop-blur-sm">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand/30 via-brand/10 to-transparent text-brand-foreground ring-1 ring-border/70">
                <KeyRoundIcon className="size-4" />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">No passkeys yet</p>
                <p className="text-sm text-muted-foreground">Add one to sign in without email.</p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">
              {passkeys.map((passkey, index) => (
                <li key={passkey.id} className="flex flex-col">
                  {index > 0 && <Separator />}
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand/30 to-brand/10 text-brand-foreground ring-1 ring-border/70">
                        <KeyRoundIcon className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{passkey.name ?? "Passkey"}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {passkey.createdAt
                            ? `Added ${dateFormat.format(passkey.createdAt)}`
                            : "Creation date unavailable"}
                        </p>
                      </div>
                    </div>
                    <form
                      action={async () => {
                        "use server";

                        await requireUser();
                        await auth.api.deletePasskey({
                          body: { id: passkey.id },
                          headers: await headers(),
                        });
                        refresh();
                      }}
                    >
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        className="w-full rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3 px-6 sm:flex-row sm:justify-end">
          <AddPasskeyButton />
        </CardFooter>
      </Card>

      <Card className="mt-5 overflow-hidden border-0 ring-1 ring-foreground/10 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_24px_48px_-24px_oklch(0.32_0.06_70/0.2)]">
        <CardHeader className="gap-2 px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-foreground/10 via-foreground/5 to-transparent text-muted-foreground ring-1 ring-border/70">
              <LogOutIcon className="size-[18px]" />
            </span>
            <div className="space-y-0.5">
              <h2 data-slot="card-title" className="text-lg font-semibold tracking-tight">
                Sign out
              </h2>
              <CardDescription>End this session on this device.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex-col gap-3 px-6 pb-6 sm:flex-row sm:justify-end">
          <form
            action={async () => {
              "use server";

              await auth.api.signOut({
                headers: await headers(),
              });
              redirect("/auth/sign-in");
            }}
          >
            <SubmitButton variant="outline" className="w-full rounded-full px-5 sm:w-auto">
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </SubmitButton>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}

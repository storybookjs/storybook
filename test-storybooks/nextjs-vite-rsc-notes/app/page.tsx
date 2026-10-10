import { Link } from "#components/link.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import { APP_NAME } from "#lib/config.ts";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">React Server Components demo</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          A small notes app with server actions, authentication, seeded data, and database-backed
          RSC tests.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/notes" className={buttonVariants({ size: "lg" })}>
            Open notes
          </Link>
          <Link
            href="/auth/sign-in"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

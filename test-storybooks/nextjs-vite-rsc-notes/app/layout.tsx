import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProgressBar, ProgressBarProvider } from "react-transition-progress";
import { Link } from "#components/link.tsx";
import { NotebookPenIcon } from "#components/icons.tsx";
import { ThemeProvider } from "#components/theme-provider.tsx";
import { ThemeToggle } from "#components/theme-toggle.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import { getOptionalUser } from "#lib/auth-session.ts";
import { APP_NAME } from "#lib/config.ts";
import { fontVariables } from "./fonts.ts";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "A database-backed notes app for React Server Components tests.",
};

async function AuthNav() {
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/auth/sign-in"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className:
              "rounded-full border-foreground/15 bg-card/80 px-3.5 shadow-[0_1px_0_oklch(1_0_0/0.5)_inset] backdrop-blur dark:border-foreground/20 dark:bg-card/60",
          })}
        >
          Log in
        </Link>
        <Link
          href="/auth/sign-up"
          className={buttonVariants({
            size: "sm",
            className:
              "rounded-full px-3.5 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-6px_oklch(0.32_0.06_70/0.45)]",
          })}
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/profile"
      aria-label={`Signed in as ${user.email}, open profile`}
      title={user.email}
      className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 p-1 text-xs font-medium text-muted-foreground shadow-[0_1px_0_oklch(1_0_0/0.6)_inset] backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:pr-2.5 dark:bg-background/40"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-brand/45 via-brand/15 to-transparent text-[0.7rem] font-semibold text-brand-foreground ring-0 transition group-hover:scale-[1.04] sm:ring-1 sm:ring-border/70"
      >
        {(user.email || "?").slice(0, 1).toUpperCase()}
      </span>
      <span className="hidden sm:inline">Profile</span>
    </Link>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ProgressBarProvider>
        <ProgressBar className="pointer-events-none fixed left-0 top-0 z-50 h-0.5 bg-brand opacity-0 shadow-[0_0_12px_var(--brand)] [animation:nav-progress-reveal_120ms_ease_200ms_forwards]" />
        <div className="relative flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-full border border-border/60 bg-background/70 px-2 py-2 shadow-[0_1px_0_oklch(1_0_0/0.6)_inset,0_8px_24px_-12px_oklch(0.32_0.06_70/0.18)] backdrop-blur-xl dark:bg-background/50">
              <Link
                href="/"
                aria-label={APP_NAME}
                className="group inline-flex items-center gap-2.5 rounded-full pl-1 pr-3 text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-foreground to-foreground/85 text-background shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_10px_-4px_oklch(0.32_0.06_70/0.4)] ring-1 ring-foreground/10 transition group-hover:scale-[1.04]"
                >
                  <NotebookPenIcon className="size-4" />
                </span>
                <span className="hidden text-[0.95rem] tracking-tight sm:inline">{APP_NAME}</span>
              </Link>
              <div className="flex items-center gap-1.5">
                <AuthNav />
                <ThemeToggle />
              </div>
            </div>
          </header>
          {children}
        </div>
      </ProgressBarProvider>
    </ThemeProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

import { refresh } from "next/cache";
import { and, desc, eq, not } from "drizzle-orm";
import { Link } from "#components/link.tsx";
import {
  ArrowRightIcon,
  ClockIcon,
  FilePenLineIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  Trash2Icon,
} from "#components/icons.tsx";
import { SubmitButton } from "#components/submit-button.tsx";
import { buttonVariants } from "#components/ui/button-variants.ts";
import { Card } from "#components/ui/card.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#components/ui/empty.tsx";
import { db } from "#lib/db.ts";
import { requireUser } from "#lib/auth-session.ts";
import { notes } from "#db/schema.ts";

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

type Note = typeof notes.$inferSelect;

export default async function NotesPage() {
  const user = await requireUser();
  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.ownerId, user.id))
    .orderBy(desc(notes.isFavorite), desc(notes.updatedAt));

  const favorites = allNotes.filter((note) => note.isFavorite);
  const others = allNotes.filter((note) => !note.isFavorite);
  const totalLabel = `${allNotes.length} ${allNotes.length === 1 ? "note" : "notes"}`;

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-12 sm:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-[360px] bg-[radial-gradient(70%_60%_at_50%_0%,oklch(0.94_0.08_82/0.7),transparent_70%)] dark:bg-[radial-gradient(70%_60%_at_50%_0%,oklch(0.4_0.08_75/0.35),transparent_70%)]"
      />
      <div className="mb-8 flex flex-col items-start gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Notes</h1>
          <p className="text-sm text-muted-foreground">
            {allNotes.length === 0
              ? "Start by creating your first note."
              : `${totalLabel} · ${favorites.length} favorited`}
          </p>
        </div>
        <Link
          href="/notes/new"
          className={buttonVariants({
            className:
              "shrink-0 rounded-full px-4 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_4px_12px_-6px_oklch(0.32_0.06_70/0.45)]",
          })}
        >
          <PlusIcon data-icon="inline-start" />
          New note
        </Link>
      </div>

      {allNotes.length === 0 ? (
        <Empty className="relative overflow-hidden rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-24 backdrop-blur-sm">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.94_0.08_82/0.55),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.4_0.08_75/0.3),transparent_70%)]"
          />
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="relative size-16 rounded-2xl bg-gradient-to-br from-brand/35 via-brand/12 to-transparent text-brand-foreground ring-1 ring-border/70"
            >
              <FilePenLineIcon className="size-7" />
            </EmptyMedia>
            <EmptyTitle className="text-xl tracking-tight">No notes yet</EmptyTitle>
            <EmptyDescription>
              Capture an idea, a todo, or a thought. Everything saves the moment you submit.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              href="/notes/new"
              className={buttonVariants({
                className:
                  "rounded-full px-5 shadow-[0_1px_0_oklch(1_0_0/0.18)_inset,0_8px_22px_-10px_oklch(0.32_0.06_70/0.5)]",
              })}
            >
              Create your first note
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {favorites.length > 0 && (
            <NoteSection
              icon={<SparklesIcon className="size-3.5 text-amber-500 dark:text-amber-400" />}
              label="Favorites"
              count={favorites.length}
              notes={favorites}
            />
          )}
          {others.length > 0 && (
            <NoteSection
              icon={null}
              label={favorites.length > 0 ? "All notes" : null}
              count={others.length}
              notes={others}
            />
          )}
        </div>
      )}
    </main>
  );
}

function NoteSection({
  icon,
  label,
  count,
  notes,
}: {
  icon: React.ReactNode;
  label: string | null;
  count: number;
  notes: Note[];
}) {
  return (
    <section className="flex flex-col gap-3">
      {label && (
        <header className="flex items-center gap-2 px-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{count}</span>
        </header>
      )}
      <ul className="flex flex-col gap-2.5">
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} />
        ))}
      </ul>
    </section>
  );
}

function NoteRow({ note }: { note: Note }) {
  return (
    <li>
      <Card
        className={`group/note relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden border-0 bg-card/70 px-3 py-3 ring-1 ring-border/60 backdrop-blur transition hover:bg-card hover:ring-foreground/15 sm:gap-4 sm:px-4 ${note.isFavorite ? "ring-amber-500/20 dark:ring-amber-400/20" : ""}`}
      >
        {note.isFavorite && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-400 via-amber-500 to-amber-500/40 dark:from-amber-300 dark:via-amber-400 dark:to-amber-400/30"
          />
        )}
        <form
          action={async () => {
            "use server";

            const user = await requireUser();
            await db
              .update(notes)
              .set({ isFavorite: not(notes.isFavorite) })
              .where(and(eq(notes.id, note.id), eq(notes.ownerId, user.id)));
            refresh();
          }}
        >
          <SubmitButton
            variant="ghost"
            size="icon"
            aria-label={note.isFavorite ? "Unfavorite note" : "Favorite note"}
            aria-pressed={note.isFavorite}
            className="rounded-full text-muted-foreground transition hover:bg-amber-100/60 hover:text-amber-500 aria-pressed:text-amber-500 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 dark:aria-pressed:text-amber-400"
          >
            <StarIcon fill={note.isFavorite ? "currentColor" : "none"} />
          </SubmitButton>
        </form>
        <Link
          href={`/notes/${note.id}`}
          className="min-w-0 rounded-xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-card-foreground transition group-hover/note:text-foreground">
            {note.title}
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <p className="truncate">
              {note.content || <span className="italic opacity-70">No content yet</span>}
            </p>
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground/80 sm:hidden">
            <ClockIcon className="size-3" />
            {dateFormat.format(note.updatedAt)}
          </p>
        </Link>
        <div className="flex items-center gap-1">
          <span
            className="hidden items-center gap-1 rounded-full bg-muted/60 px-2 py-1 text-xs text-muted-foreground sm:inline-flex"
            title={`Updated ${dateFormat.format(note.updatedAt)}`}
          >
            <ClockIcon className="size-3" />
            {dateFormat.format(note.updatedAt)}
          </span>
          <form
            action={async () => {
              "use server";

              const user = await requireUser();
              await db.delete(notes).where(and(eq(notes.id, note.id), eq(notes.ownerId, user.id)));
              refresh();
            }}
          >
            <SubmitButton
              variant="ghost"
              size="icon-sm"
              aria-label="Delete note"
              className="rounded-full text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive group-hover/note:opacity-100"
            >
              <Trash2Icon />
            </SubmitButton>
          </form>
        </div>
      </Card>
    </li>
  );
}

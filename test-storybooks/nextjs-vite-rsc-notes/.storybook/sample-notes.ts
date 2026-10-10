import { notes } from "#db/schema.ts";
import { db } from "#lib/db.ts";

// Notes that read like someone's own, for the stories that show a filled app.
// Dates are fixed, so a story looks the same every day.
export const sampleNotes = [
  {
    title: "Product roadmap Q3",
    content:
      "Ship offline sync first, then shared notebooks. Revisit the pricing page once the beta feedback is in.",
    isFavorite: true,
    updatedAt: new Date("2026-08-18T09:30:00Z"),
  },
  {
    title: "Team offsite agenda",
    content:
      "Day 1: retro and planning. Day 2: hack day, demos at four. Book the bigger room on the second floor.",
    isFavorite: true,
    updatedAt: new Date("2026-08-12T15:10:00Z"),
  },
  {
    title: "Book recommendations",
    content:
      "The Pragmatic Programmer, A Philosophy of Software Design, and Shape Up for the reading group.",
    isFavorite: false,
    updatedAt: new Date("2026-08-20T19:45:00Z"),
  },
  {
    title: "Groceries",
    content: "Oat milk, sourdough, basil, cherry tomatoes, parmesan, coffee beans.",
    isFavorite: false,
    updatedAt: new Date("2026-08-21T08:05:00Z"),
  },
  {
    title: "Conference talk ideas",
    content:
      "Testing React Server Components without a server. Demo: a Storybook story for every route.",
    isFavorite: false,
    updatedAt: new Date("2026-07-30T11:20:00Z"),
  },
];

/** Gives a user the sample notes, and answers with them as the database has them. */
export function seedSampleNotes(ownerId: string) {
  return db
    .insert(notes)
    .values(sampleNotes.map((note) => ({ ...note, ownerId, createdAt: note.updatedAt })))
    .returning();
}

import { Geist, Geist_Mono } from "next/font/google";

// The fonts of the app, which the root layout sets on the document. A module
// of their own, so that a story of a component, which renders without the
// layouts, can set them too: see .storybook/preview.ts.

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The class names that give an element the fonts of the app. */
export const fontVariables = `${geistSans.variable} ${geistMono.variable}`;
